import { describe, expect, it, vi } from 'vitest';
import { resolveAuth, runCheck, runChecks } from '../src/runner.js';
import type { ServiceDefinition } from '../src/types.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeDef(overrides: Partial<ServiceDefinition> = {}): ServiceDefinition {
  return {
    name: 'test-api',
    label: 'Test API',
    category: 'custom',
    url: 'https://example.gov/api',
    assertions: [
      { type: 'status', expected: 200 },
      { type: 'jsonPath', path: '$.results', check: 'isArray' },
    ],
    ...overrides,
  };
}

function jsonFetch(status: number, body: unknown): typeof fetch {
  return async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
}

describe('resolveAuth', () => {
  it('appends query keys from env, preferring env over demo', () => {
    const def = makeDef({
      url: 'https://example.gov/api?limit=1',
      auth: {
        in: 'query',
        keys: [{ placeholder: 'api_key', env: ['MY_KEY'], demo: 'DEMO_KEY' }],
      },
    });
    const withEnv = resolveAuth(def, { MY_KEY: 'secret' });
    expect(withEnv).toMatchObject({
      url: 'https://example.gov/api?limit=1&api_key=secret',
    });
    const withDemo = resolveAuth(def, {});
    expect(withDemo).toMatchObject({
      url: 'https://example.gov/api?limit=1&api_key=DEMO_KEY',
    });
  });

  it('sets header keys with prefixes', () => {
    const def = makeDef({
      auth: {
        in: 'header',
        keys: [
          { placeholder: 'Authorization', env: ['TOKEN'], prefix: 'Bearer ' },
        ],
      },
    });
    expect(resolveAuth(def, { TOKEN: 'abc' })).toMatchObject({
      headers: { Authorization: 'Bearer abc' },
    });
  });

  it('skips when a required key is missing, but not when optional', () => {
    const required = makeDef({
      auth: { in: 'header', keys: [{ placeholder: 'X-API-KEY', env: ['K'] }] },
    });
    expect(resolveAuth(required, {})).toEqual({ skip: 'no API key — set K' });

    const optional = makeDef({
      auth: {
        in: 'header',
        optional: true,
        keys: [{ placeholder: 'apiKey', env: ['K'] }],
      },
    });
    expect(resolveAuth(optional, {})).toMatchObject({
      url: 'https://example.gov/api',
    });
  });

  it('requires every key when a service needs multiple credentials', () => {
    const def = makeDef({
      auth: {
        in: 'query',
        keys: [
          { placeholder: 'key', env: ['ACLED_API_KEY'] },
          { placeholder: 'email', env: ['ACLED_EMAIL'] },
        ],
      },
    });
    expect(resolveAuth(def, { ACLED_API_KEY: 'k' })).toEqual({
      skip: 'no API key — set ACLED_EMAIL',
    });
  });
});

describe('runCheck', () => {
  it('reports healthy when all assertions pass', async () => {
    const result = await runCheck(makeDef(), {
      env: {},
      fetchImpl: jsonFetch(200, { results: [] }),
    });
    expect(result.status).toBe('healthy');
    expect(result.statusCode).toBe(200);
    expect(result.failures).toEqual([]);
    expect(result.responseTime).toBeGreaterThanOrEqual(0);
  });

  it('reports unhealthy on bad status or failed content assertions', async () => {
    const bad = await runCheck(makeDef(), {
      env: {},
      fetchImpl: jsonFetch(500, {}),
    });
    expect(bad.status).toBe('unhealthy');
    expect(bad.failures.join()).toMatch(/HTTP 500/);

    const empty = await runCheck(makeDef(), {
      env: {},
      fetchImpl: jsonFetch(200, { wrong: true }),
    });
    expect(empty.status).toBe('unhealthy');
    expect(empty.failures.join()).toMatch(/\$\.results/);
  });

  it('short-circuits HTTP 429 to rate-limited', async () => {
    const result = await runCheck(makeDef(), {
      env: {},
      fetchImpl: jsonFetch(429, {}),
    });
    expect(result.status).toBe('rate-limited');
    expect(result.statusCode).toBe(429);
  });

  it('reports degraded when only the responseTime budget fails', async () => {
    const def = makeDef({
      assertions: [
        { type: 'status', expected: 200 },
        { type: 'responseTime', maxMs: 1 },
        { type: 'jsonPath', path: '$.results', check: 'isArray' },
      ],
    });
    const slowFetch: typeof fetch = async () => {
      await sleep(15);
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    };
    const result = await runCheck(def, { env: {}, fetchImpl: slowFetch });
    expect(result.status).toBe('degraded');
    expect(result.failures.join()).toMatch(/slow/);
  });

  it('reports skipped with a reason when a required key is missing', async () => {
    const def = makeDef({
      auth: {
        in: 'header',
        keys: [{ placeholder: 'X-API-KEY', env: ['OPENSTATES_API_KEY'] }],
      },
    });
    const fetchSpy = vi.fn();
    const result = await runCheck(def, { env: {}, fetchImpl: fetchSpy });
    expect(result.status).toBe('skipped');
    expect(result.skipReason).toMatch(/OPENSTATES_API_KEY/);
    expect(result.statusCode).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports unhealthy on network errors', async () => {
    const result = await runCheck(makeDef(), {
      env: {},
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    });
    expect(result.status).toBe('unhealthy');
    expect(result.failures.join()).toMatch(/request failed: fetch failed/);
  });

  it('aborts and reports a timeout when the request hangs', async () => {
    const hangingFetch: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted', 'AbortError')),
        );
      });
    const result = await runCheck(makeDef(), {
      env: {},
      fetchImpl: hangingFetch,
      timeoutMs: 25,
    });
    expect(result.status).toBe('unhealthy');
    expect(result.failures.join()).toMatch(/timed out after 25ms/);
  });

  it('sends a govwatch user-agent by default', async () => {
    const fetchSpy = vi.fn(jsonFetch(200, { results: [] }));
    await runCheck(makeDef(), { env: {}, fetchImpl: fetchSpy });
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['user-agent']).toMatch(/^govwatch\//);
  });
});

describe('runChecks', () => {
  it('preserves input order under bounded concurrency', async () => {
    const defs = Array.from({ length: 8 }, (_, i) =>
      makeDef({ name: `svc-${i}`, label: `Service ${i}` }),
    );
    const fetchImpl: typeof fetch = async () => {
      await sleep(Math.random() * 10);
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    };
    const results = await runChecks(defs, {
      env: {},
      fetchImpl,
      concurrency: 3,
    });
    expect(results.map((r) => r.service)).toEqual(defs.map((d) => d.name));
    expect(results.every((r) => r.status === 'healthy')).toBe(true);
  });
});
