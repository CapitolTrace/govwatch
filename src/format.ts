import type { CheckResult, ServiceDefinition, ServiceStatus } from './types.js';

const nf = new Intl.NumberFormat('en-US');

const ICONS: Record<ServiceStatus, string> = {
  healthy: '✅',
  degraded: '⚠️',
  unhealthy: '❌',
  'rate-limited': '❌',
  skipped: '◌',
};

const COLORS: Record<ServiceStatus, string> = {
  healthy: '32',
  degraded: '33',
  unhealthy: '31',
  'rate-limited': '31',
  skipped: '90',
};

export function supportsColor(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function paint(code: string, text: string, useColor: boolean): string {
  return useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
}

function note(result: CheckResult): string {
  switch (result.status) {
    case 'healthy':
      return '';
    case 'degraded':
      return '(degraded)';
    case 'rate-limited':
      return '(rate limited)';
    case 'skipped':
      return `(skipped: ${result.skipReason ?? 'no API key'})`;
    case 'unhealthy':
      return result.failures[0] ? `(${result.failures[0]})` : '(unhealthy)';
  }
}

export function formatResults(
  results: CheckResult[],
  useColor = supportsColor(),
): string {
  const labelWidth = Math.max(...results.map((r) => r.label.length), 20);
  const lines = results.map((r) => {
    const icon = ICONS[r.status];
    const code = r.statusCode === null ? '—' : String(r.statusCode);
    const time =
      r.responseTime === null ? '—' : `${nf.format(r.responseTime)}ms`;
    const suffix = note(r);
    return `  ${icon} ${r.label.padEnd(labelWidth)}  ${code.padStart(3)}  ${time.padStart(9)}  ${paint(COLORS[r.status], suffix, useColor)}`.trimEnd();
  });

  const count = (status: ServiceStatus) =>
    results.filter((r) => r.status === status).length;
  const skipped = count('skipped');
  const checked = results.length - skipped;
  const parts = [`${count('healthy')}/${checked} healthy`];
  if (count('degraded')) parts.push(`${count('degraded')} degraded`);
  if (count('unhealthy')) parts.push(`${count('unhealthy')} unhealthy`);
  if (count('rate-limited')) parts.push(`${count('rate-limited')} rate limited`);
  if (skipped) parts.push(`${skipped} skipped (no API key)`);

  return `\n${lines.join('\n')}\n\n  ${parts.join(' · ')}\n`;
}

export function formatList(services: ServiceDefinition[]): string {
  const nameWidth = Math.max(...services.map((s) => s.name.length));
  const labelWidth = Math.max(...services.map((s) => s.label.length));
  const lines = services.map((s) => {
    const auth = s.auth
      ? s.auth.optional
        ? `key optional (${s.auth.keys.map((k) => k.env[0]).join(', ')})`
        : s.auth.keys.some((k) => k.demo)
          ? `key or DEMO_KEY (${s.auth.keys.map((k) => k.env[0]).join(', ')})`
          : `key required (${s.auth.keys.map((k) => k.env[0]).join(', ')})`
      : 'no key needed';
    return `  ${s.name.padEnd(nameWidth)}  ${s.label.padEnd(labelWidth)}  ${s.category.padEnd(13)}  ${auth}`;
  });
  return `\n${lines.join('\n')}\n\n  ${services.length} services\n`;
}
