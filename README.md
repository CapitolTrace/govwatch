<h1 align="center">🔍 govwatch</h1>

<p align="center">
  <strong>Open-source health monitor for government APIs</strong><br/>
  <em>Is Congress.gov up? Is FEC responding? Are CISA feeds current? Find out in seconds.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@capitoltrace/govwatch"><img src="https://img.shields.io/npm/v/%40capitoltrace%2Fgovwatch?style=flat-square&logo=npm&color=CB3837" alt="npm" /></a>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/CLI_+_Library-black?style=flat-square" alt="CLI + Library" />
  <img src="https://img.shields.io/badge/17_APIs_Monitored-brightgreen?style=flat-square" alt="17 APIs" />
  <img src="https://img.shields.io/badge/Zero_Dependencies-blue?style=flat-square" alt="Zero Dependencies" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT" />
</p>

---

> **Status: v0.1.0 on npm** — try it right now: `npx @capitoltrace/govwatch check`
>
> **📊 [Live status page](https://status.capitoltrace.com/)** — these checks running every 30 minutes, with 30-day uptime history.

---

### Why this exists

Government APIs go down. A lot. They rate-limit without warning, return empty responses instead of errors, and break backwards compatibility on federal holidays. If you're building civic tech, you need to know when your data sources are healthy — before your users find out.

`govwatch` is the health check layer extracted from [Capitol Trace](https://capitoltrace.com), where we monitor 25+ government APIs every 15 minutes in production.

### Usage

#### CLI

```bash
# Check all supported APIs
npx govwatch check

# Check specific services
npx govwatch check congress fec cisa-kev

# Watch mode — continuous monitoring
npx govwatch watch --interval 5m

# JSON output for CI/scripts
npx govwatch check --json

# List services and their API key requirements
npx govwatch list
```

```
  ✅ Congress.gov API      200      469ms
  ✅ FEC OpenFEC           200      510ms
  ✅ Senate LDA            200      345ms
  ✅ GovInfo API           200    2,842ms
  ✅ Federal Register      200      346ms
  ⚠️ USAspending.gov      200    8,735ms  (degraded)
  ✅ BLS Public Data API   200      288ms
  ✅ CISA KEV Catalog      200      365ms
  ✅ NVD (NIST)            200      179ms
  ✅ State Dept Travel     200      242ms
  ❌ GDELT Project         429   10,335ms  (rate limited)
  ✅ CelesTrak NORAD       200      390ms
  ✅ SEC EDGAR             200      220ms
  ◌ Open States v3          —          —  (skipped: no API key — set OPENSTATES_API_KEY)

  12/14 healthy · 1 degraded · 1 rate limited · 1 skipped (no API key)
```

Exit codes are CI-friendly: `0` when everything is healthy (degraded and rate-limited don't fail the run unless you pass `--strict`), `1` when any service is unhealthy.

#### As a library

```typescript
import { govwatch } from '@capitoltrace/govwatch';

// Check a single API
const result = await govwatch.check('congress');
// { service: 'congress', status: 'healthy', statusCode: 200, responseTime: 469, ... }

// Check all APIs
const results = await govwatch.checkAll();

// Custom health check
govwatch.register({
  name: 'my-state-api',
  url: 'https://api.mystate.gov/v1/bills',
  assertions: [
    { type: 'status', expected: 200 },
    { type: 'jsonPath', path: '$.results', check: 'isNotNull' },
    { type: 'responseTime', maxMs: 5000 },
  ],
});
const custom = await govwatch.check('my-state-api');
```

Named exports (`check`, `checkAll`, `register`, `listServices`) and full TypeScript types are also available.

### APIs monitored

| Category | Services (CLI slugs) |
|:---------|:---------------------|
| 🏛️ Congressional | `congress`, `fec`, `senate-lda`, `govinfo` |
| 📊 Federal | `federal-register`, `usaspending`, `openstates`, `census`, `bls` |
| 🛡️ National Security | `cisa-kev`, `nvd`, `state-travel`, `gdelt`, `celestrak`, `acled` |
| 💰 Financial | `sec-edgar`, `quiver` |

### API keys

Most services work with no configuration. Services on api.data.gov (Congress.gov, FEC, GovInfo) fall back to the shared `DEMO_KEY` (30 requests/hour per IP), so casual checks work out of the box — set your own free keys for anything regular. Keyed services are **skipped** (not failed) when no key is set.

| Env var | Service | Notes |
|:--------|:--------|:------|
| `DATA_GOV_API_KEY` | Congress.gov, FEC, GovInfo | One [api.data.gov key](https://api.data.gov/signup/) covers all three |
| `CONGRESS_API_KEY` / `FEC_API_KEY` / `GOVINFO_API_KEY` | Per-service overrides | Take precedence over `DATA_GOV_API_KEY` |
| `OPENSTATES_API_KEY` | Open States v3 | [Free key](https://open.pluralpolicy.com/accounts/signup/) |
| `CENSUS_API_KEY` | Census Bureau ACS | [Free key](https://api.census.gov/data/key_signup.html) — the API returns HTTP 200 with an HTML error page without one |
| `NVD_API_KEY` | NVD (NIST) | Optional — raises rate limits |
| `ACLED_API_KEY` + `ACLED_EMAIL` | ACLED | [Registration](https://acleddata.com/register/) |
| `QUIVER_API_KEY` | Quiver Quantitative | Paid API |

### Health check anatomy

Each check validates:
- **Status code** — Is the API returning 2xx? (429 is reported as `rate-limited`, distinct from an outage)
- **Response time** — Is it within acceptable latency? Slow-but-working services are reported as `degraded`, not down
- **Content validation** — Does the response body contain expected data? Catches the classic government-API failure mode of HTTP 200 with an empty or HTML error body
- **Freshness** — For data feeds (e.g. CISA KEV), is the content recent?

### Installation

```bash
# Global CLI
npm install -g @capitoltrace/govwatch

# Project dependency
npm install @capitoltrace/govwatch
```

Requires Node.js 18.17+. Zero runtime dependencies.

### GitHub Action

Add govwatch to any workflow with [govwatch-action](https://github.com/CapitolTrace/govwatch-action):

```yaml
- uses: CapitolTrace/govwatch-action@v1
  with:
    services: congress fec cisa-kev   # empty = all services
```

It prints per-service results, writes a table to the job summary, exposes `results` (JSON) and `outcome` outputs, and fails the step when an API is unhealthy.

### Use cases

- **CI pipelines** — Fail fast if a government API your app depends on is down
- **Monitoring dashboards** — Integrate with Grafana, Datadog, or Checkly via `--json`, or see the [hosted status page](https://status.capitoltrace.com/)
- **Incident response** — Quickly determine if an outage is your code or an upstream dependency
- **Civic tech community** — Shared visibility into the reliability of public data sources

### Contributing

This is an open-source project by [Capitol Trace](https://github.com/CapitolTrace). We'd love help with:
- Adding new government API endpoints (see `src/registry.ts` — a service is ~20 lines)
- Regional/international government API support
- Webhook/Slack/Discord alert integrations
- Dashboard UI (maybe a simple web view?)

```bash
git clone https://github.com/CapitolTrace/govwatch
cd govwatch
npm install
npm test
node dist/cli.js check
```

### License

MIT

---

<p align="center">
  <strong>Part of the <a href="https://github.com/CapitolTrace">Capitol Trace</a> ecosystem.</strong><br/>
  <em>Because democracy runs on uptime.</em>
</p>
