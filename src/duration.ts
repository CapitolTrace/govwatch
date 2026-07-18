/**
 * Parses durations like "30s", "5m", "1h", "500ms". Bare numbers are seconds.
 * Result is floored at 1s to keep watch mode polite to upstream APIs.
 */
export function parseDuration(input: string): number {
  const m = /^(\d+(?:\.\d+)?)(ms|s|m|h)?$/.exec(input.trim());
  if (!m) {
    throw new Error(`Invalid duration "${input}" (use e.g. 30s, 5m, 1h)`);
  }
  const mult = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 }[m[2] ?? 's']!;
  return Math.max(1000, Math.round(Number(m[1]) * mult));
}
