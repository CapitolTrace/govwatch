import { describe, expect, it } from 'vitest';
import { getService, getServices, listServices, register } from '../src/registry.js';

describe('built-in registry', () => {
  const services = listServices();

  it('has unique slug names and https URLs', () => {
    const names = services.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const s of services) {
      expect(s.name).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      expect(s.url).toMatch(/^https:\/\//);
    }
  });

  it('gives every service a status and responseTime assertion', () => {
    for (const s of services) {
      const types = s.assertions.map((a) => a.type);
      expect(types, s.name).toContain('status');
      expect(types, s.name).toContain('responseTime');
    }
  });

  it('covers the README service categories', () => {
    const categories = new Set(services.map((s) => s.category));
    expect(categories).toEqual(
      new Set(['congressional', 'federal', 'natsec', 'financial']),
    );
    expect(services.length).toBeGreaterThanOrEqual(17);
  });

  it('resolves names and rejects unknown ones', () => {
    expect(getService('congress').label).toBe('Congress.gov API');
    expect(getServices(['congress', 'fec'])).toHaveLength(2);
    expect(getServices()).toHaveLength(services.length);
    expect(() => getService('nope')).toThrow(/Unknown service "nope"/);
  });
});

describe('register', () => {
  it('adds a custom service usable by name', () => {
    register({
      name: 'my-state-api',
      label: 'My State API',
      category: 'custom',
      url: 'https://api.mystate.gov/v1/bills',
      assertions: [{ type: 'status', expected: 200 }],
    });
    expect(getService('my-state-api').category).toBe('custom');
  });

  it('defaults label and category for minimal definitions', () => {
    register({
      name: 'minimal-api',
      url: 'https://api.example.gov/health',
      assertions: [{ type: 'status', expected: 200 }],
    });
    const def = getService('minimal-api');
    expect(def.label).toBe('minimal-api');
    expect(def.category).toBe('custom');
  });

  it('rejects duplicates, bad slugs, bad URLs, and empty assertions', () => {
    expect(() =>
      register({
        name: 'congress',
        label: 'Dup',
        category: 'custom',
        url: 'https://x.gov',
        assertions: [{ type: 'status', expected: 200 }],
      }),
    ).toThrow(/already registered/);
    expect(() =>
      register({
        name: 'Bad Name',
        label: 'Bad',
        category: 'custom',
        url: 'https://x.gov',
        assertions: [{ type: 'status', expected: 200 }],
      }),
    ).toThrow(/lowercase slug/);
    expect(() =>
      register({
        name: 'bad-url',
        label: 'Bad',
        category: 'custom',
        url: 'ftp://x.gov',
        assertions: [{ type: 'status', expected: 200 }],
      }),
    ).toThrow(/http/);
    expect(() =>
      register({
        name: 'no-asserts',
        label: 'Bad',
        category: 'custom',
        url: 'https://x.gov',
        assertions: [],
      }),
    ).toThrow(/at least one assertion/);
  });
});
