import type { ServiceCategory, ServiceDefinition } from './types.js';

/**
 * Built-in service definitions. Endpoints are chosen to be the cheapest
 * request that still proves the API returns real data — smallest page size,
 * constants endpoints, or static feeds.
 *
 * Keyed services read from env vars (see README). api.data.gov services fall
 * back to DEMO_KEY (shared 30 req/hour/IP limit) so `npx govwatch check`
 * works out of the box.
 */
const BUILT_IN: ServiceDefinition[] = [
  // ── Congressional ────────────────────────────────────────────────
  {
    name: 'congress',
    label: 'Congress.gov API',
    category: 'congressional',
    url: 'https://api.congress.gov/v3/bill?format=json&limit=1',
    auth: {
      in: 'query',
      keys: [
        {
          placeholder: 'api_key',
          env: ['CONGRESS_API_KEY', 'DATA_GOV_API_KEY'],
          demo: 'DEMO_KEY',
        },
      ],
    },
    assertions: [
      { type: 'status', expected: 200 },
      { type: 'responseTime', maxMs: 6000 },
      { type: 'jsonPath', path: '$.bills', check: 'isNonEmptyArray' },
    ],
  },
  {
    name: 'fec',
    label: 'FEC OpenFEC',
    category: 'congressional',
    url: 'https://api.open.fec.gov/v1/candidates/?per_page=1',
    auth: {
      in: 'query',
      keys: [
        {
          placeholder: 'api_key',
          env: ['FEC_API_KEY', 'DATA_GOV_API_KEY'],
          demo: 'DEMO_KEY',
        },
      ],
    },
    assertions: [
      { type: 'status', expected: 200 },
      { type: 'responseTime', maxMs: 6000 },
      { type: 'jsonPath', path: '$.results', check: 'isArray' },
    ],
  },
  {
    name: 'senate-lda',
    label: 'Senate LDA',
    category: 'congressional',
    url: 'https://lda.senate.gov/api/v1/constants/filing/filingtypes/',
    assertions: [
      { type: 'status', expected: 200 },
      { type: 'responseTime', maxMs: 6000 },
      { type: 'jsonPath', path: '$', check: 'isNonEmptyArray' },
    ],
  },
  {
    name: 'govinfo',
    label: 'GovInfo API',
    category: 'congressional',
    url: 'https://api.govinfo.gov/collections',
    auth: {
      in: 'query',
      keys: [
        {
          placeholder: 'api_key',
          env: ['GOVINFO_API_KEY', 'DATA_GOV_API_KEY'],
          demo: 'DEMO_KEY',
        },
      ],
    },
    assertions: [
      { type: 'status', expected: 200 },
      { type: 'responseTime', maxMs: 6000 },
      { type: 'jsonPath', path: '$.collections', check: 'isNonEmptyArray' },
    ],
  },

  // ── Federal ──────────────────────────────────────────────────────
  {
    name: 'federal-register',
    label: 'Federal Register',
    category: 'federal',
    url: 'https://www.federalregister.gov/api/v1/documents.json?per_page=1&order=newest',
    assertions: [
      { type: 'status', expected: 200 },
      { type: 'responseTime', maxMs: 6000 },
      { type: 'jsonPath', path: '$.results', check: 'isNonEmptyArray' },
    ],
  },
  {
    name: 'usaspending',
    label: 'USAspending.gov',
    category: 'federal',
    url: 'https://api.usaspending.gov/api/v2/references/toptier_agencies/',
    timeoutMs: 20_000,
    assertions: [
      { type: 'status', expected: 200 },
      { type: 'responseTime', maxMs: 8000 },
      { type: 'jsonPath', path: '$.results', check: 'isNonEmptyArray' },
    ],
  },
  {
    name: 'openstates',
    label: 'Open States v3',
    category: 'federal',
    url: 'https://v3.openstates.org/jurisdictions?classification=state&per_page=1',
    auth: {
      in: 'header',
      keys: [{ placeholder: 'X-API-KEY', env: ['OPENSTATES_API_KEY'] }],
    },
    assertions: [
      { type: 'status', expected: 200 },
      { type: 'responseTime', maxMs: 6000 },
      { type: 'jsonPath', path: '$.results', check: 'isArray' },
    ],
  },
  {
    name: 'census',
    label: 'Census Bureau ACS',
    category: 'federal',
    // Returns HTTP 200 with an HTML "Missing Key" page when unauthenticated,
    // so a key is required for a meaningful check.
    url: 'https://api.census.gov/data/2023/acs/acs1?get=NAME&for=state:06',
    auth: {
      in: 'query',
      keys: [{ placeholder: 'key', env: ['CENSUS_API_KEY'] }],
    },
    assertions: [
      { type: 'status', expected: 200 },
      { type: 'responseTime', maxMs: 8000 },
      { type: 'jsonPath', path: '$', check: 'isNonEmptyArray' },
    ],
  },
  {
    name: 'bls',
    label: 'BLS Public Data API',
    category: 'federal',
    url: 'https://api.bls.gov/publicAPI/v1/timeseries/data/LNS14000000',
    assertions: [
      { type: 'status', expected: 200 },
      { type: 'responseTime', maxMs: 8000 },
      { type: 'jsonPathEquals', path: '$.status', value: 'REQUEST_SUCCEEDED' },
    ],
  },

  // ── National security ────────────────────────────────────────────
  {
    name: 'cisa-kev',
    label: 'CISA KEV Catalog',
    category: 'natsec',
    url: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
    timeoutMs: 25_000,
    assertions: [
      { type: 'status', expected: 200 },
      { type: 'responseTime', maxMs: 10_000 },
      { type: 'jsonPath', path: '$.vulnerabilities', check: 'isNonEmptyArray' },
      { type: 'freshness', path: '$.dateReleased', maxAgeDays: 30 },
    ],
  },
  {
    name: 'nvd',
    label: 'NVD (NIST)',
    category: 'natsec',
    url: 'https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=1',
    timeoutMs: 20_000,
    auth: {
      in: 'header',
      optional: true,
      keys: [{ placeholder: 'apiKey', env: ['NVD_API_KEY'] }],
    },
    assertions: [
      { type: 'status', expected: 200 },
      { type: 'responseTime', maxMs: 10_000 },
      { type: 'jsonPath', path: '$.vulnerabilities', check: 'isArray' },
    ],
  },
  {
    name: 'state-travel',
    label: 'State Dept Travel',
    category: 'natsec',
    url: 'https://travel.state.gov/_res/rss/TAsTWs.xml',
    assertions: [
      { type: 'status', expected: 200 },
      { type: 'responseTime', maxMs: 8000 },
      { type: 'bodyIncludes', text: '<rss' },
    ],
  },
  {
    name: 'gdelt',
    label: 'GDELT Project',
    category: 'natsec',
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=congress&mode=artlist&maxrecords=1&format=json',
    timeoutMs: 15_000,
    assertions: [
      { type: 'status', expected: 200 },
      { type: 'responseTime', maxMs: 10_000 },
      { type: 'jsonPath', path: '$.articles', check: 'isArray' },
    ],
  },
  {
    name: 'celestrak',
    label: 'CelesTrak NORAD',
    category: 'natsec',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json',
    assertions: [
      { type: 'status', expected: 200 },
      { type: 'responseTime', maxMs: 8000 },
      { type: 'jsonPath', path: '$', check: 'isNonEmptyArray' },
    ],
  },
  {
    name: 'acled',
    label: 'ACLED',
    category: 'natsec',
    url: 'https://api.acleddata.com/acled/read?limit=1',
    auth: {
      in: 'query',
      keys: [
        { placeholder: 'key', env: ['ACLED_API_KEY'] },
        { placeholder: 'email', env: ['ACLED_EMAIL'] },
      ],
    },
    assertions: [
      { type: 'status', expected: 200 },
      { type: 'responseTime', maxMs: 8000 },
      { type: 'jsonPath', path: '$.data', check: 'isArray' },
    ],
  },

  // ── Financial ────────────────────────────────────────────────────
  {
    name: 'sec-edgar',
    label: 'SEC EDGAR',
    category: 'financial',
    url: 'https://data.sec.gov/submissions/CIK0000320193.json',
    // SEC's fair-access policy requires a user-agent with contact info;
    // their edge returns 403 for generic tool UAs.
    headers: {
      'user-agent': 'govwatch (Capitol Trace; contact@capitoltrace.com)',
    },
    assertions: [
      { type: 'status', expected: 200 },
      { type: 'responseTime', maxMs: 6000 },
      { type: 'jsonPath', path: '$.cik', check: 'exists' },
    ],
  },
  {
    name: 'quiver',
    label: 'Quiver Quantitative',
    category: 'financial',
    url: 'https://api.quiverquant.com/beta/live/congresstrading',
    timeoutMs: 20_000,
    auth: {
      in: 'header',
      keys: [
        {
          placeholder: 'Authorization',
          env: ['QUIVER_API_KEY'],
          prefix: 'Bearer ',
        },
      ],
    },
    assertions: [
      { type: 'status', expected: 200 },
      { type: 'responseTime', maxMs: 10_000 },
      { type: 'jsonPath', path: '$', check: 'isArray' },
    ],
  },
];

const registry = new Map<string, ServiceDefinition>(
  BUILT_IN.map((def) => [def.name, def]),
);

/** Custom services default to label = name and category = 'custom'. */
export type RegisterInput = Omit<ServiceDefinition, 'label' | 'category'> & {
  label?: string;
  category?: ServiceCategory;
};

/** Registers a custom service (README `govwatch.register(...)` API). */
export function register(def: RegisterInput): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(def.name)) {
    throw new Error(
      `Service name must be a lowercase slug (got "${def.name}")`,
    );
  }
  if (registry.has(def.name)) {
    throw new Error(`Service "${def.name}" is already registered`);
  }
  if (!/^https?:\/\//.test(def.url)) {
    throw new Error(`Service URL must be http(s): ${def.url}`);
  }
  if (!Array.isArray(def.assertions) || def.assertions.length === 0) {
    throw new Error('Service must define at least one assertion');
  }
  registry.set(def.name, {
    ...def,
    label: def.label ?? def.name,
    category: def.category ?? 'custom',
  });
}

export function getService(name: string): ServiceDefinition {
  const def = registry.get(name);
  if (!def) {
    throw new Error(
      `Unknown service "${name}". Run \`govwatch list\` to see supported services.`,
    );
  }
  return def;
}

/** Resolves names to definitions; all services when names is omitted. */
export function getServices(names?: string[]): ServiceDefinition[] {
  if (!names || names.length === 0) return [...registry.values()];
  return names.map(getService);
}

export function listServices(): ServiceDefinition[] {
  return [...registry.values()];
}
