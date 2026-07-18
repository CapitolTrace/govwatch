import { describe, expect, it } from 'vitest';
import {
  evaluateAssertion,
  JsonParseError,
  resolveJsonPath,
  type AssertionContext,
} from '../src/assertions.js';

function ctx(overrides: Partial<AssertionContext> = {}): AssertionContext {
  const bodyText = overrides.bodyText ?? '{}';
  return {
    statusCode: 200,
    responseTime: 100,
    bodyText,
    json: () => JSON.parse(bodyText),
    ...overrides,
  };
}

describe('resolveJsonPath', () => {
  const doc = {
    results: [{ title: 'HR 1' }, { title: 'S 2' }],
    meta: { count: 2, 'total-pages': 1 },
  };

  it('resolves nested keys and array indices', () => {
    expect(resolveJsonPath(doc, '$.results[0].title')).toBe('HR 1');
    expect(resolveJsonPath(doc, '$.meta.count')).toBe(2);
    expect(resolveJsonPath(doc, '$.results')).toHaveLength(2);
  });

  it('resolves the root and bracket-quoted keys', () => {
    expect(resolveJsonPath([1, 2], '$')).toEqual([1, 2]);
    expect(resolveJsonPath([1, 2], '$[1]')).toBe(2);
    expect(resolveJsonPath(doc, '$.meta["total-pages"]')).toBe(1);
  });

  it('returns undefined for missing segments', () => {
    expect(resolveJsonPath(doc, '$.nope')).toBeUndefined();
    expect(resolveJsonPath(doc, '$.results[9].title')).toBeUndefined();
    expect(resolveJsonPath(null, '$.anything')).toBeUndefined();
  });

  it('throws on malformed paths', () => {
    expect(() => resolveJsonPath(doc, 'results')).toThrow(/must start/);
    expect(() => resolveJsonPath(doc, '$..results')).toThrow(/Invalid/);
    expect(() => resolveJsonPath(doc, '$.results[x]')).toThrow(/Invalid/);
  });
});

describe('evaluateAssertion', () => {
  it('checks status codes, including arrays of allowed codes', () => {
    expect(
      evaluateAssertion({ type: 'status', expected: 200 }, ctx()).ok,
    ).toBe(true);
    const fail = evaluateAssertion(
      { type: 'status', expected: [200, 204] },
      ctx({ statusCode: 500 }),
    );
    expect(fail.ok).toBe(false);
    expect(fail.message).toMatch(/HTTP 500/);
  });

  it('marks slow responses as degrade, not hard failure', () => {
    const slow = evaluateAssertion(
      { type: 'responseTime', maxMs: 50 },
      ctx({ responseTime: 8100 }),
    );
    expect(slow.ok).toBe(false);
    expect(slow.degrade).toBe(true);
    expect(slow.message).toMatch(/8,100ms/);
  });

  it('evaluates jsonPath checks', () => {
    const body = JSON.stringify({ results: [], bills: [{ n: 1 }] });
    expect(
      evaluateAssertion(
        { type: 'jsonPath', path: '$.bills', check: 'isNonEmptyArray' },
        ctx({ bodyText: body }),
      ).ok,
    ).toBe(true);
    expect(
      evaluateAssertion(
        { type: 'jsonPath', path: '$.results', check: 'isNonEmptyArray' },
        ctx({ bodyText: body }),
      ).ok,
    ).toBe(false);
    expect(
      evaluateAssertion(
        { type: 'jsonPath', path: '$.results', check: 'isArray' },
        ctx({ bodyText: body }),
      ).ok,
    ).toBe(true);
  });

  it('evaluates jsonPathEquals', () => {
    const body = JSON.stringify({ status: 'REQUEST_SUCCEEDED' });
    expect(
      evaluateAssertion(
        { type: 'jsonPathEquals', path: '$.status', value: 'REQUEST_SUCCEEDED' },
        ctx({ bodyText: body }),
      ).ok,
    ).toBe(true);
    const fail = evaluateAssertion(
      { type: 'jsonPathEquals', path: '$.status', value: 'REQUEST_SUCCEEDED' },
      ctx({ bodyText: JSON.stringify({ status: 'REQUEST_FAILED' }) }),
    );
    expect(fail.ok).toBe(false);
    expect(fail.message).toMatch(/REQUEST_FAILED/);
  });

  it('evaluates bodyIncludes for non-JSON feeds', () => {
    expect(
      evaluateAssertion(
        { type: 'bodyIncludes', text: '<rss' },
        ctx({ bodyText: '<?xml version="1.0"?><rss version="2.0"></rss>' }),
      ).ok,
    ).toBe(true);
    expect(
      evaluateAssertion(
        { type: 'bodyIncludes', text: '<rss' },
        ctx({ bodyText: '<html>error</html>' }),
      ).ok,
    ).toBe(false);
  });

  it('evaluates freshness from ISO dates and epoch seconds', () => {
    const fresh = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const stale = new Date(Date.now() - 90 * 86_400_000).toISOString();
    expect(
      evaluateAssertion(
        { type: 'freshness', path: '$.dateReleased', maxAgeDays: 30 },
        ctx({ bodyText: JSON.stringify({ dateReleased: fresh }) }),
      ).ok,
    ).toBe(true);
    const failed = evaluateAssertion(
      { type: 'freshness', path: '$.dateReleased', maxAgeDays: 30 },
      ctx({ bodyText: JSON.stringify({ dateReleased: stale }) }),
    );
    expect(failed.ok).toBe(false);
    expect(failed.message).toMatch(/stale/);

    const epochSeconds = Math.floor((Date.now() - 86_400_000) / 1000);
    expect(
      evaluateAssertion(
        { type: 'freshness', path: '$.updated', maxAgeDays: 7 },
        ctx({ bodyText: JSON.stringify({ updated: epochSeconds }) }),
      ).ok,
    ).toBe(true);
  });

  it('fails JSON assertions gracefully on non-JSON bodies', () => {
    const broken = ctx({
      bodyText: '<html>gateway timeout</html>',
      json: () => {
        throw new JsonParseError();
      },
    });
    const outcome = evaluateAssertion(
      { type: 'jsonPath', path: '$.results', check: 'isArray' },
      broken,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toMatch(/not valid JSON/);
  });
});
