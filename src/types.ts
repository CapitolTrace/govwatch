export type ServiceStatus =
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'rate-limited'
  | 'skipped';

export type JsonPathCheck =
  | 'exists'
  | 'isNotNull'
  | 'isArray'
  | 'isNonEmptyArray'
  | 'isString'
  | 'isNumber';

export type Assertion =
  | { type: 'status'; expected: number | number[] }
  | { type: 'responseTime'; maxMs: number }
  | { type: 'jsonPath'; path: string; check: JsonPathCheck }
  | { type: 'jsonPathEquals'; path: string; value: string | number | boolean }
  | { type: 'bodyIncludes'; text: string }
  | { type: 'freshness'; path: string; maxAgeDays: number };

/**
 * One credential slot for a service. The first env var found in `env` wins;
 * `demo` is used as a fallback (e.g. api.data.gov's DEMO_KEY) when none is set.
 */
export interface AuthKey {
  /** Query param name, header name, or `{placeholder}` token in the URL. */
  placeholder: string;
  env: string[];
  demo?: string;
  /** Prepended to the value, e.g. 'Bearer '. */
  prefix?: string;
}

export interface AuthSpec {
  keys: AuthKey[];
  in: 'query' | 'header' | 'url';
  /** When true, missing keys mean "check without auth" instead of "skip". */
  optional?: boolean;
}

export type ServiceCategory =
  | 'congressional'
  | 'federal'
  | 'natsec'
  | 'financial'
  | 'custom';

export interface ServiceDefinition {
  /** CLI slug, e.g. 'cisa-kev'. */
  name: string;
  /** Display name, e.g. 'CISA KEV Catalog'. */
  label: string;
  category: ServiceCategory;
  url: string;
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  auth?: AuthSpec;
  timeoutMs?: number;
  assertions: Assertion[];
}

export interface CheckResult {
  service: string;
  label: string;
  category: string;
  status: ServiceStatus;
  statusCode: number | null;
  /** Milliseconds, null when the check was skipped. */
  responseTime: number | null;
  failures: string[];
  skipReason?: string;
  checkedAt: string;
}

export interface CheckOptions {
  /** Overrides per-service and default timeouts. */
  timeoutMs?: number;
  /** Max in-flight checks for checkAll (default 6). */
  concurrency?: number;
  /** Environment to read API keys from (default process.env). */
  env?: Record<string, string | undefined>;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  userAgent?: string;
}
