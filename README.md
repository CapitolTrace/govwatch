<h1 align="center">🔍 govwatch</h1>

<p align="center">
  <strong>Open-source health monitor for government APIs</strong><br/>
  <em>Is Congress.gov up? Is FEC responding? Are CISA feeds current? Find out in seconds.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/CLI_+_Library-black?style=flat-square" alt="CLI + Library" />
  <img src="https://img.shields.io/badge/20+_APIs_Monitored-brightgreen?style=flat-square" alt="20+ APIs" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT" />
</p>

---

> **Status: Coming Soon** — Star this repo to get notified when the first release ships.

---

### Why this exists

Government APIs go down. A lot. They rate-limit without warning, return empty responses instead of errors, and break backwards compatibility on federal holidays. If you're building civic tech, you need to know when your data sources are healthy — before your users find out.

`govwatch` is the health check layer extracted from [Capitol Trace](https://capitoltrace.com), where we monitor 25+ government APIs every 15 minutes in production.

### Planned usage

#### CLI

```bash
# Check all supported APIs
npx govwatch check

# Check specific services
npx govwatch check congress fec cisa

# Watch mode — continuous monitoring
npx govwatch watch --interval 5m

# JSON output for CI/scripts
npx govwatch check --json
```

```
  ✅ Congress.gov API        200  1,240ms
  ✅ FEC OpenFEC             200    890ms
  ✅ CISA KEV Catalog        200    340ms
  ✅ Federal Register        200    520ms
  ⚠️ USAspending.gov        200  8,100ms  (degraded)
  ✅ Open States v3          200    210ms
  ❌ NVD (NIST)              429      —    (rate limited)
  ✅ GDELT Project           200    680ms
  ✅ CelesTrak NORAD         200    150ms
  ✅ State Dept Travel       200    430ms
  ✅ Senate LDA              200    310ms
  ✅ GovInfo / data.gov      200    280ms

  11/12 healthy · 1 degraded · 1 rate limited
```

#### As a library

```typescript
import { govwatch } from '@capitoltrace/govwatch';

// Check a single API
const result = await govwatch.check('congress');
// { service: 'congress', status: 'healthy', statusCode: 200, responseTime: 1240, ... }

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
```

### APIs monitored

| Category | Services |
|:---------|:---------|
| 🏛️ Congressional | Congress.gov, FEC OpenFEC, Senate LDA, GovInfo |
| 📊 Federal | Federal Register, USAspending, Open States, Census ACS, BLS |
| 🛡️ National Security | CISA KEV, NVD (NIST), State Dept Travel, GDELT, CelesTrak, ACLED |
| 💰 Financial | SEC EDGAR, Quiver Quantitative |

### Health check anatomy

Each check validates:
- **Status code** — Is the API returning 2xx?
- **Response time** — Is it within acceptable latency? (configurable per-service)
- **Content validation** — Does the response body contain expected data?
- **Freshness** — For data feeds, is the content recent?

### Installation

```bash
# Global CLI
npm install -g @capitoltrace/govwatch

# Project dependency
npm install @capitoltrace/govwatch
```

### Use cases

- **CI pipelines** — Fail fast if a government API your app depends on is down
- **Monitoring dashboards** — Integrate with Grafana, Datadog, or Checkly
- **Incident response** — Quickly determine if an outage is your code or an upstream dependency
- **Civic tech community** — Shared visibility into the reliability of public data sources

### Contributing

This is an open-source project by [Capitol Trace](https://github.com/CapitolTrace). We'd love help with:
- Adding new government API endpoints
- Regional/international government API support
- Webhook/Slack/Discord alert integrations
- Dashboard UI (maybe a simple web view?)

### License

MIT

---

<p align="center">
  <strong>Part of the <a href="https://github.com/CapitolTrace">Capitol Trace</a> ecosystem.</strong><br/>
  <em>Because democracy runs on uptime.</em>
</p>
