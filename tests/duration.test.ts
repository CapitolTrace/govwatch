import { describe, expect, it } from 'vitest';
import { parseDuration } from '../src/duration.js';

describe('parseDuration', () => {
  it('parses units, defaulting bare numbers to seconds', () => {
    expect(parseDuration('30s')).toBe(30_000);
    expect(parseDuration('5m')).toBe(300_000);
    expect(parseDuration('1h')).toBe(3_600_000);
    expect(parseDuration('45')).toBe(45_000);
    expect(parseDuration('1.5m')).toBe(90_000);
  });

  it('floors at 1 second to stay polite to upstream APIs', () => {
    expect(parseDuration('100ms')).toBe(1000);
  });

  it('rejects garbage', () => {
    expect(() => parseDuration('soon')).toThrow(/Invalid duration/);
    expect(() => parseDuration('5 minutes')).toThrow(/Invalid duration/);
    expect(() => parseDuration('-5m')).toThrow(/Invalid duration/);
  });
});
