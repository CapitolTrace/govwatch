import type { Assertion, JsonPathCheck } from './types.js';

const nf = new Intl.NumberFormat('en-US');

/**
 * Minimal JSON path resolver. Supports `$`, `.key`, `[index]`, `["key"]`,
 * and `['key']` segments — e.g. `$.results[0].title`. Returns undefined when
 * a segment doesn't resolve; throws only when the path itself is malformed.
 */
export function resolveJsonPath(root: unknown, path: string): unknown {
  if (!path.startsWith('$')) {
    throw new Error(`JSON path must start with $: ${path}`);
  }
  const rest = path.slice(1);
  const tokenRe = /\.([A-Za-z0-9_$-]+)|\[(\d+)\]|\["([^"]+)"\]|\['([^']+)'\]/g;
  let value: unknown = root;
  let consumed = 0;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(rest)) !== null) {
    if (m.index !== consumed) throw new Error(`Invalid JSON path: ${path}`);
    consumed = m.index + m[0].length;
    const key = m[1] ?? m[3] ?? m[4];
    if (key !== undefined) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[key];
    } else {
      if (!Array.isArray(value)) return undefined;
      value = value[Number(m[2])];
    }
  }
  if (consumed !== rest.length) throw new Error(`Invalid JSON path: ${path}`);
  return value;
}

export class JsonParseError extends Error {
  constructor() {
    super('response body is not valid JSON');
    this.name = 'JsonParseError';
  }
}

export interface AssertionContext {
  statusCode: number;
  responseTime: number;
  bodyText: string;
  /** Lazily parsed body; throws JsonParseError when the body isn't JSON. */
  json(): unknown;
}

export interface AssertionOutcome {
  ok: boolean;
  /** Failed assertions marked degrade lower status to 'degraded', not 'unhealthy'. */
  degrade?: boolean;
  message?: string;
}

function checkJsonValue(value: unknown, check: JsonPathCheck): boolean {
  switch (check) {
    case 'exists':
      return value !== undefined;
    case 'isNotNull':
      return value !== undefined && value !== null;
    case 'isArray':
      return Array.isArray(value);
    case 'isNonEmptyArray':
      return Array.isArray(value) && value.length > 0;
    case 'isString':
      return typeof value === 'string';
    case 'isNumber':
      return typeof value === 'number';
  }
}

export function evaluateAssertion(
  assertion: Assertion,
  ctx: AssertionContext,
): AssertionOutcome {
  switch (assertion.type) {
    case 'status': {
      const expected = Array.isArray(assertion.expected)
        ? assertion.expected
        : [assertion.expected];
      return expected.includes(ctx.statusCode)
        ? { ok: true }
        : {
            ok: false,
            message: `HTTP ${ctx.statusCode} (expected ${expected.join(' or ')})`,
          };
    }
    case 'responseTime':
      return ctx.responseTime <= assertion.maxMs
        ? { ok: true }
        : {
            ok: false,
            degrade: true,
            message: `slow: ${nf.format(ctx.responseTime)}ms exceeds ${nf.format(assertion.maxMs)}ms budget`,
          };
    case 'bodyIncludes':
      return ctx.bodyText.includes(assertion.text)
        ? { ok: true }
        : { ok: false, message: `body missing expected text "${assertion.text}"` };
    case 'jsonPath':
    case 'jsonPathEquals':
    case 'freshness': {
      let json: unknown;
      try {
        json = ctx.json();
      } catch (err) {
        if (err instanceof JsonParseError) {
          return { ok: false, message: err.message };
        }
        throw err;
      }
      const value = resolveJsonPath(json, assertion.path);
      if (assertion.type === 'jsonPath') {
        return checkJsonValue(value, assertion.check)
          ? { ok: true }
          : {
              ok: false,
              message: `${assertion.path} failed check "${assertion.check}"`,
            };
      }
      if (assertion.type === 'jsonPathEquals') {
        return value === assertion.value
          ? { ok: true }
          : {
              ok: false,
              message: `${assertion.path} is ${JSON.stringify(value)} (expected ${JSON.stringify(assertion.value)})`,
            };
      }
      // freshness
      const timestamp =
        typeof value === 'number'
          ? value > 1e12
            ? value
            : value * 1000
          : Date.parse(String(value));
      if (Number.isNaN(timestamp)) {
        return {
          ok: false,
          message: `${assertion.path} is not a parseable date (${JSON.stringify(value)})`,
        };
      }
      const ageDays = (Date.now() - timestamp) / 86_400_000;
      return ageDays <= assertion.maxAgeDays
        ? { ok: true }
        : {
            ok: false,
            message: `stale: last updated ${Math.floor(ageDays)} days ago (max ${assertion.maxAgeDays})`,
          };
    }
  }
}
