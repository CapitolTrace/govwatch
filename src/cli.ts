#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { parseDuration } from './duration.js';
import { formatList, formatResults } from './format.js';
import { getServices, listServices } from './registry.js';
import { runChecks } from './runner.js';
import type { CheckOptions } from './types.js';
import { VERSION } from './version.js';

const HELP = `govwatch ${VERSION} — health checks for government APIs

Usage:
  govwatch check [services...]   Check all (or named) services once
  govwatch watch [services...]   Check continuously (default every 5m)
  govwatch list                  List supported services and key requirements

Options:
  --json               Output results as JSON
  --strict             Exit non-zero on degraded/rate-limited too
  --timeout <ms>       Per-request timeout override
  --concurrency <n>    Max in-flight checks (default 6)
  --interval <dur>     Watch interval, e.g. 30s, 5m, 1h (default 5m)
  -h, --help           Show this help
  -v, --version        Show version

Examples:
  npx govwatch check
  npx govwatch check congress fec cisa-kev
  npx govwatch watch --interval 5m
  npx govwatch check --json`;

function parsePositiveInt(raw: string, flag: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${flag} must be a positive integer (got "${raw}")`);
  }
  return n;
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: 'boolean', default: false },
      strict: { type: 'boolean', default: false },
      timeout: { type: 'string' },
      concurrency: { type: 'string' },
      interval: { type: 'string', default: '5m' },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
  });

  if (values.version) {
    console.log(VERSION);
    return 0;
  }
  const [command = 'help', ...names] = positionals;
  if (values.help || command === 'help') {
    console.log(HELP);
    return 0;
  }
  if (command === 'list') {
    console.log(formatList(listServices()));
    return 0;
  }
  if (command !== 'check' && command !== 'watch') {
    console.error(`Unknown command "${command}"\n`);
    console.log(HELP);
    return 2;
  }

  const opts: CheckOptions = {};
  if (values.timeout) opts.timeoutMs = parsePositiveInt(values.timeout, '--timeout');
  if (values.concurrency) {
    opts.concurrency = parsePositiveInt(values.concurrency, '--concurrency');
  }
  const defs = getServices(names.length > 0 ? names : undefined);

  const runOnce = async () => {
    const results = await runChecks(defs, opts);
    if (values.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log(formatResults(results));
    }
    return results;
  };

  if (command === 'check') {
    const results = await runOnce();
    const failed =
      results.some((r) => r.status === 'unhealthy') ||
      (values.strict &&
        results.some(
          (r) => r.status === 'degraded' || r.status === 'rate-limited',
        ));
    return failed ? 1 : 0;
  }

  // watch
  const intervalMs = parseDuration(values.interval);
  for (;;) {
    if (!values.json) {
      console.log(`\n  govwatch · ${new Date().toLocaleString()}`);
    }
    await runOnce();
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  },
);
