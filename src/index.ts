import { getService, getServices, listServices, register } from './registry.js';
import { runCheck, runChecks } from './runner.js';
import type { CheckOptions, CheckResult, ServiceDefinition } from './types.js';

export type * from './types.js';
export { register, listServices };
export { VERSION } from './version.js';

/** Checks a single service by name, e.g. `check('congress')`. */
export async function check(
  name: string,
  opts?: CheckOptions,
): Promise<CheckResult> {
  return runCheck(getService(name), opts);
}

export interface CheckAllOptions extends CheckOptions {
  /** Subset of service names; all registered services when omitted. */
  services?: string[];
}

/** Checks all registered services (or a named subset) concurrently. */
export async function checkAll(
  opts: CheckAllOptions = {},
): Promise<CheckResult[]> {
  return runChecks(getServices(opts.services), opts);
}

/** Namespace-style API: `import { govwatch } from '@capitoltrace/govwatch'`. */
export const govwatch = {
  check,
  checkAll,
  register,
  list: listServices,
};

export type { ServiceDefinition as GovwatchService };
