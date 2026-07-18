import {
  evaluateAssertion,
  JsonParseError,
  type AssertionContext,
} from './assertions.js';
import type {
  CheckOptions,
  CheckResult,
  ServiceDefinition,
} from './types.js';
import { VERSION } from './version.js';

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_USER_AGENT = `govwatch/${VERSION} (+https://github.com/CapitolTrace/govwatch)`;

interface ResolvedRequest {
  url: string;
  headers: Record<string, string>;
}

/**
 * Applies the service's auth spec against the environment. Returns a skip
 * reason when a required key is missing.
 */
export function resolveAuth(
  def: ServiceDefinition,
  env: Record<string, string | undefined>,
): ResolvedRequest | { skip: string } {
  let url = def.url;
  const headers: Record<string, string> = { ...def.headers };
  if (def.auth) {
    for (const key of def.auth.keys) {
      const envName = key.env.find((name) => env[name]);
      const raw = envName ? env[envName] : key.demo;
      if (!raw) {
        if (def.auth.optional) continue;
        return { skip: `no API key — set ${key.env.join(' or ')}` };
      }
      const value = (key.prefix ?? '') + raw;
      if (def.auth.in === 'query') {
        url += `${url.includes('?') ? '&' : '?'}${key.placeholder}=${encodeURIComponent(value)}`;
      } else if (def.auth.in === 'header') {
        headers[key.placeholder] = value;
      } else {
        url = url.replaceAll(`{${key.placeholder}}`, encodeURIComponent(value));
      }
    }
  }
  return { url, headers };
}

export async function runCheck(
  def: ServiceDefinition,
  opts: CheckOptions = {},
): Promise<CheckResult> {
  const base = {
    service: def.name,
    label: def.label,
    category: def.category,
    checkedAt: new Date().toISOString(),
  };
  const env = opts.env ?? process.env;
  const resolved = resolveAuth(def, env);
  if ('skip' in resolved) {
    return {
      ...base,
      status: 'skipped',
      statusCode: null,
      responseTime: null,
      failures: [],
      skipReason: resolved.skip,
    };
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? def.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();

  let response: Response;
  let bodyText: string;
  try {
    response = await fetchImpl(resolved.url, {
      method: def.method ?? 'GET',
      headers: {
        'user-agent': opts.userAgent ?? DEFAULT_USER_AGENT,
        accept: '*/*',
        ...resolved.headers,
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    bodyText = await response.text();
  } catch (err) {
    const responseTime = Math.round(performance.now() - started);
    return {
      ...base,
      status: 'unhealthy',
      statusCode: null,
      responseTime,
      failures: [
        controller.signal.aborted
          ? `timed out after ${timeoutMs}ms`
          : `request failed: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  } finally {
    clearTimeout(timer);
  }

  const responseTime = Math.round(performance.now() - started);

  if (response.status === 429) {
    return {
      ...base,
      status: 'rate-limited',
      statusCode: 429,
      responseTime,
      failures: ['rate limited (HTTP 429)'],
    };
  }

  let json: unknown;
  let jsonState: 'unparsed' | 'ok' | 'invalid' = 'unparsed';
  const ctx: AssertionContext = {
    statusCode: response.status,
    responseTime,
    bodyText,
    json() {
      if (jsonState === 'unparsed') {
        try {
          json = JSON.parse(bodyText);
          jsonState = 'ok';
        } catch {
          jsonState = 'invalid';
        }
      }
      if (jsonState === 'invalid') throw new JsonParseError();
      return json;
    },
  };

  const failures: string[] = [];
  let degradedOnly = true;
  for (const assertion of def.assertions) {
    const outcome = evaluateAssertion(assertion, ctx);
    if (!outcome.ok) {
      failures.push(outcome.message ?? `${assertion.type} assertion failed`);
      if (!outcome.degrade) degradedOnly = false;
    }
  }

  const status =
    failures.length === 0 ? 'healthy' : degradedOnly ? 'degraded' : 'unhealthy';
  return {
    ...base,
    status,
    statusCode: response.status,
    responseTime,
    failures,
  };
}

/** Runs checks with bounded concurrency, preserving input order. */
export async function runChecks(
  defs: ServiceDefinition[],
  opts: CheckOptions = {},
): Promise<CheckResult[]> {
  const limit = Math.max(1, opts.concurrency ?? DEFAULT_CONCURRENCY);
  const results: CheckResult[] = new Array(defs.length);
  let next = 0;
  const worker = async () => {
    while (next < defs.length) {
      const i = next++;
      results[i] = await runCheck(defs[i], opts);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, defs.length) }, worker),
  );
  return results;
}
