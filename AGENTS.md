# govwatch

Health checks for government APIs — a TypeScript CLI + library with zero runtime dependencies. See `README.md` for full usage.

## Cursor Cloud specific instructions

This is a CLI/library package, not a long-running service — there is nothing to "serve". Standard commands live in `package.json` `scripts`.

- Build (also the type-check gate): `npm run build` (`tsc`). There is no ESLint/Prettier config; `tsc --strict` is the only lint/type gate.
- Test: `npm test` (`vitest run`). Tests mock `fetch`, so they need no network.
- Run the app: build first, then `node dist/cli.js <check|watch|list>`. The `bin` (`govwatch`) points at `dist/cli.js`, so the CLI does not work until `dist/` exists.
- `npm ci`/`npm install` auto-runs the `prepare` script, which builds `dist/` — so a fresh install leaves the CLI immediately runnable.
- Live `check`/`watch` hit real government APIs and require network egress. Two expected, non-error outcomes: GDELT frequently returns `429` (reported as `rate-limited`, does not fail the run without `--strict`), and keyed services (e.g. `openstates`, `census`, `acled`, `quiver`) are **skipped** (not failed) when their API keys are absent. api.data.gov services fall back to a shared `DEMO_KEY` (30 req/hr/IP). See the README API-keys table for the relevant env vars.
