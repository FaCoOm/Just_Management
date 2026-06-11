# Plan: QA Testing Stack Implementation (2026-06-09)

## Goal

Establish a deterministic, CI-gated QA stack on top of the existing Vitest + Node test runner foundation, plus an agent-driven exploratory QA path. The goal is to move QA from manual `curl` + ad-hoc Playwright MCP screenshots into a repeatable suite that runs locally and in CI, while preserving the existing manual evidence workflow described in `docs/qa/`.

## Out of scope

- Replacing or rewriting existing Vitest unit tests in `src/test/*` or `backend/test/*`.
- Visual regression (Percy/Chromatic) - deferred until UI churn justifies cost.
- Production synthetic monitoring (Checkly) - deferred until the app has a deployed URL.
- Real-device cross-browser cloud (BrowserStack/Sauce Labs) - not justified for current single-team scope.
- Auth/RBAC test coverage - Sprint 2 owns auth; tests will run unauthenticated until then.
- Cypress migration - Playwright is the chosen primary E2E framework.

## Scope

- Add `@playwright/test` as the primary E2E framework with a Vite-aware `webServer` config.
- Codify `docs/qa/ingestion-sync/qa-test-plan.md` scenarios as runnable Playwright specs.
- Add `@axe-core/playwright` for in-suite accessibility regression.
- Add Lighthouse CI for performance/a11y gating on the dashboard route.
- Add a unified `npm test` at repo root that runs frontend Vitest + backend Node tests.
- Add a GitHub Actions CI workflow that runs typecheck, build, unit, and e2e on PR.
- Document Browserbase Browse CLI local-mode usage for agent-driven exploratory QA.
- Document the dogfood/agent-browser exploratory QA artifact format under `docs/qa/`.

## Stack decision summary

| Layer | Tool | Why this repo | Cost |
|---|---|---|---|
| Frontend unit/component | Vitest + Testing Library (existing) | Already wired, fast, Vite-native | $0 |
| Backend unit | Node test runner + tsx (existing) | Already wired, no extra deps | $0 |
| Backend integration | `verify-ingestion.ts` (existing, WithOne-aware) | Spawns real server with `INGEST_SHEETS_PROVIDER=withone`, hits Prisma | $0 |
| E2E browser | **Playwright** (new) | Free parallelism, multi-browser, official MCP, matches QA docs | $0 |
| Accessibility regression | **@axe-core/playwright** (new) | Zero false positives, runs inside e2e tests | $0 |
| Performance gate | **Lighthouse CI** (new) | Free, GitHub Actions native, catches CWV regressions | $0 |
| CI runner | **GitHub Actions** (new) | Free for this repo size, Playwright official action | $0 |
| Agent exploratory QA | **Browserbase Browse CLI (local mode)** (new docs) | Confirmed `browse open --local` hits localhost:5173; same workflow scales to remote | $0 local; cloud optional |
| Agent reproducible QA | **Playwright MCP** (new docs) | Lets Claude/Cursor drive the browser and generate specs from QA docs | $0 |
| Defer | Checkly, Percy/Chromatic, BrowserStack | Not justified pre-deploy; revisit Sprint 3+ | n/a |

## Architecture

```text
                    Developer / CI
                          |
      +-------------------+----------------------+
      |                   |                      |
  Vitest (FE)        Node test (BE)        Playwright (E2E)
  src/test/**         backend/test/**       e2e/**
      |                   |                      |
      |                   |                      v
      |                   |              Vite dev server (5173)
      |                   |                      |
      |                   |                      v
      |                   +------------> Express API (3001)
      |                                          |
      |                                          v
      |                                 Prisma -> Postgres (test DB)
      v
  jsdom (mocked fetch)

                Agent exploratory layer
                          |
    +---------------------+--------------------+
    |                                          |
Playwright MCP                       Browserbase Browse CLI
(LLM drives @playwright/test)        (browse open --local|--remote)
    |                                          |
    +-------> docs/qa/exploratory/*.md (evidence + repro)
```

Key contracts:

- Vitest tests stay sealed: jsdom + `vi.fn()` fetch mocking. They never hit a real server.
- Playwright e2e boots Vite (`webServer.command = npm run dev:all`) and runs against `http://localhost:5173`. Vite proxies `/api` to the Express backend on `3001`.
- Playwright requires a `DATABASE_URL` pointing to a QA-safe Postgres (Azure dev DB or local container). Tests that mutate state are tagged `@write` and skipped when only `DATABASE_URL_READONLY` is provided.
- Backend ingestion verification (`backend/scripts/verify-ingestion.ts`) spawns the API server with `INGEST_SHEETS_PROVIDER=withone` so the documented default Google Sheets path is exercised on every run. The deterministic assertion is the missing-`connectionKey` 400 + `CONFIG_AUTH_FAILURE`. The optional live happy-path runs only when `ONE_CONNECTION_KEY`, `ONE_SECRET_KEY`, and `GOOGLE_SHEETS_SPREADSHEET_ID` are all provided in the environment as non-placeholder values.

## Surfaces

### Repo additions

- `e2e/` directory at repo root containing Playwright specs.
- `playwright.config.ts` at repo root.
- `lighthouserc.json` at repo root for Lighthouse CI thresholds.
- `.github/workflows/ci.yml` for the CI pipeline.
- `docs/qa/playwright-runbook.md` developer-facing runbook.
- `docs/qa/exploratory/` folder for agent-driven QA evidence reports.

### Package script changes

Frontend `package.json`:

- `test` -> orchestrator: `npm run test:frontend && npm --prefix backend test`.
- `test:frontend` (existing) -> unchanged.
- `test:e2e` -> `playwright test`.
- `test:e2e:ui` -> `playwright test --ui`.
- `test:e2e:install` -> `playwright install --with-deps chromium firefox webkit`.
- `test:lhci` -> `lhci autorun`.
- `qa:all` -> `npm run typecheck && npm run build && npm test && npm run test:e2e`.

Backend `package.json`:

- `test` (existing Node test runner) -> unchanged.
- `test:integration` -> alias for `npm run verify-ingestion` (already exists, just exposes a clearer name).

### New devDependencies

Root:

- `@playwright/test` (~1.55+).
- `@axe-core/playwright`.
- `@lhci/cli`.

Backend: none new.

### Playwright config contract

- `webServer`: runs `npm run dev:all` so Vite (5173) and Express (3001) both come up. `reuseExistingServer: !process.env.CI`.
- `baseURL`: `http://localhost:5173`.
- Projects: chromium (default), firefox, webkit. CI runs chromium only on PR; full matrix nightly.
- Reporter: `list` locally, `html` + `github` in CI.
- Trace: `on-first-retry`. Screenshots: `only-on-failure`. Video: `retain-on-failure`.
- `testDir: "./e2e"`. `testMatch: "**/*.spec.ts"`.
- Global setup checks `DATABASE_URL` is present and points to a non-production host (regex deny `azure.com` prod hostnames; require explicit `QA_DB_OK=1` to bypass).

### E2E test inventory (initial)

Each spec maps to an existing QA scenario in `docs/qa/`.

| Spec file | Source doc | Tag |
|---|---|---|
| `e2e/dashboard/load.spec.ts` | `docs/qa/qa-verification-report-2026-05-26.md` (UI cases) | `@read` |
| `e2e/reservations/list.spec.ts` | same | `@read` |
| `e2e/reservations/manual-create.spec.ts` | `docs/plans/manual-reservation-creation-2026-05-26.md` | `@write` |
| `e2e/ingestion/sync-now.spec.ts` | `docs/qa/ingestion-sync/qa-test-plan.md` Scenarios 2,5,6,7 | `@write` |
| `e2e/ingestion/dry-run.spec.ts` | same Scenarios 3,4 | `@read` |
| `e2e/a11y/dashboard.spec.ts` | new (axe sweep on dashboard, reservations, settings) | `@a11y` |

Tagging convention: `@read` runs on every PR. `@write` runs only when a writable test DB is configured. `@a11y` runs on every PR but failures are warnings until a baseline is recorded.

## CI design

### Workflow file: `.github/workflows/ci.yml`

Triggers: `pull_request`, `push` to `main`, scheduled `nightly` for full browser matrix.

Jobs:

1. `static`
   - Node 20 LTS, npm cache.
   - `npm run install:all`.
   - `npm run typecheck`.
   - `cd backend && npm run db:generate && npm run db:validate && npm run db:verify:migration`.
2. `unit`
   - Depends on `static`.
   - `npm run test:frontend`.
   - `cd backend && npm test`.
3. `build`
   - Depends on `static`.
   - `npm run build:all`.
4. `e2e-read`
   - Depends on `build`.
   - Spins up Postgres service container or skips and uses `DATABASE_URL` secret pointing to a read-only QA replica.
   - `npx playwright install --with-deps chromium`.
   - `npx playwright test --project=chromium --grep @read`.
   - Uploads `playwright-report/` and `test-results/` as artifacts.
5. `e2e-write` (only on `main` push or `qa-write` PR label)
   - Same as `e2e-read` but with writable QA DB and `--grep @write`.
   - Wraps each spec in `BEGIN`/`ROLLBACK` where feasible; otherwise uses unique fixture data per run.
6. `lhci`
   - Depends on `build`.
   - Boots `npm run preview` against the build output.
   - Runs `lhci autorun` against `/`, `/reservations`, `/dashboard`.
   - Asserts: performance >= 0.7, accessibility >= 0.9 (warning-only initially).
7. `nightly-matrix` (cron only)
   - Runs `e2e-read` against firefox + webkit in addition to chromium.

### Concurrency and cost

- `concurrency: ${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true` on PRs.
- Estimated PR runtime: static ~1m, unit ~1m, build ~2m, e2e-read (chromium) ~3-5m, lhci ~2m. Sequential critical path ~10m, parallel ~6m.
- Free GitHub Actions minutes are sufficient for this volume.

### Secrets

| Secret | Used by | Notes |
|---|---|---|
| `QA_DATABASE_URL` | `e2e-read`, `e2e-write` | Points to a non-production Postgres. Never the prod Azure URL. |
| `QA_DB_OK` | global setup bypass | Set to `1` in CI to confirm the DB is QA-safe. |
| `BROWSERBASE_API_KEY` | optional, for cloud exploratory runs only | Not required for CI. |

## Test data isolation strategy

- Default: e2e tests assume an Azure dev branch DB or a Docker Postgres started by CI. Production Azure host names are denied at global setup.
- `@read` tests: rely on seeded data from `backend/scripts/verify-ingestion.ts` runs and never assert exact row counts that drift over time.
- `@write` tests: must create their own fixtures with unique IDs (UUID prefix or test-run timestamp) and clean up in `afterAll` using direct API calls (not raw SQL).
- No e2e test runs Prisma migrations. CI runs `db:deploy` once during `static` against the QA DB if missing tables are detected.
- For local dev, Compose snippet documented in `docs/qa/playwright-runbook.md` boots a throwaway `postgres:16` container with `DATABASE_URL=postgres://postgres:postgres@localhost:55432/qa`.

## Agent-driven exploratory QA

Two agent paths, neither replacing the deterministic Playwright suite:

### Path 1: Playwright MCP (in-IDE agent)

- Used by Claude/Cursor/Kiro inside this repo to record new specs, debug failures, or convert QA docs into test code.
- Install: `npm i -D @playwright/mcp` then register the MCP server.
- Output: new specs land in `e2e/`. Manual review required before merge.
- Use case: Sisyphus reads `docs/qa/ingestion-sync/qa-test-plan.md`, drives the browser via MCP, and emits Playwright code.

### Path 2: Browserbase Browse CLI (terminal agent)

- Confirmed local-mode support: `browse open http://localhost:5173 --local` runs against the dev server with no Browserbase account.
- Workflow:
  1. `npm run dev:all`.
  2. `browse env local` then `browse open http://localhost:5173 --local`.
  3. `browse snapshot`, `browse click <ref>`, `browse screenshot` to walk a flow.
  4. `browse stop` when done.
- Remote mode (`browse env remote`, requires `BROWSERBASE_API_KEY`) is documented but reserved for tunneled/deployed app testing - not Sprint 1.
- Output format: each exploratory run produces `docs/qa/exploratory/YYYY-MM-DD-<topic>.md` with intent, repro steps, screenshots, and either a captured Playwright spec or a follow-up ticket.

### dogfood skill integration

- The dogfood skill (`C:/Users/Fate_Conqueror/.agents/skills/dogfood/SKILL.md`) is the standard format for exploratory QA reports.
- It is invoked manually, not in CI. Reports are checked into `docs/qa/exploratory/`.
- Findings with deterministic repros must be promoted into Playwright specs in `e2e/`.

## Step-by-step

### Phase 1: Foundation (target: 1 day)

1. Add devDependencies: `@playwright/test`, `@axe-core/playwright`, `@lhci/cli`.
2. Run `npx playwright install --with-deps chromium` locally to verify the binaries install on the target host.
3. Create `playwright.config.ts` with the contract above.
4. Create `e2e/.gitkeep` and `e2e/global-setup.ts` enforcing the QA-DB guard.
5. Add the new package scripts (`test`, `test:e2e`, `test:e2e:ui`, `test:e2e:install`, `test:lhci`, `qa:all`).
6. Add `lighthouserc.json` with the thresholds in the CI design.
7. Run `npm run typecheck` and `npm run build` to confirm no regression.

### Phase 2: First specs (target: 1 day)

8. Implement `e2e/dashboard/load.spec.ts`: load `/`, assert dashboard data renders without console errors, take a baseline screenshot.
9. Implement `e2e/reservations/list.spec.ts`: load `/reservations`, assert table renders rows, network log shows `/api/reservations` 200.
10. Implement `e2e/ingestion/dry-run.spec.ts` from QA scenarios 3 and 4.
11. Implement `e2e/a11y/dashboard.spec.ts`: run axe sweep on three routes, attach JSON results.
12. Run `npm run test:e2e` locally with `npm run dev:all` already up. Land all green or document blockers in the plan progress section.

### Phase 3: Mutating specs (target: 1 day, depends on QA DB availability)

13. Implement `e2e/reservations/manual-create.spec.ts` once `POST /api/reservations` lands per `manual-reservation-creation-2026-05-26.md`.
14. Implement `e2e/ingestion/sync-now.spec.ts` Scenarios 2, 5, 6, 7.
15. Add cleanup helpers in `e2e/support/cleanup.ts` that delete fixture rows by tagged `id_prefix` after the suite.

### Phase 4: CI wiring (target: 0.5 day)

16. Create `.github/workflows/ci.yml` with the jobs above.
17. Add `QA_DATABASE_URL`, `QA_DB_OK` repo secrets via the GitHub UI (out-of-band; document the exact secret names in the runbook).
18. Open a draft PR to validate the workflow before merging.
19. Capture pipeline timing for the first three runs and record in `docs/qa/playwright-runbook.md`.

### Phase 5: Documentation and adoption (target: 0.5 day)

20. Write `docs/qa/playwright-runbook.md` covering: local run, CI matrix, secret setup, Browserbase local-mode walkthrough, dogfood evidence template.
21. Update `AGENTS.md` Verification section: add `npm run test:e2e` and `npm run qa:all` next to existing `verify-ingestion`.
22. Update root `README.md` test section to document the new entry points without redefining how Track A/B switching works.
23. Open follow-up tickets for deferred items: Checkly synthetic monitoring, visual regression, real-device cloud.

## Acceptance criteria

- `npm run test:e2e` passes locally against `npm run dev:all` for all `@read` specs without seeded mutations.
- `npm test` at repo root runs frontend Vitest and backend Node tests; both pass.
- `npm run qa:all` exits 0: typecheck, build, unit, e2e read-only.
- A green CI run is recorded on a draft PR with `playwright-report/` uploaded as an artifact.
- `lhci autorun` produces a report on `/`; performance and accessibility scores logged (warnings only initially).
- `docs/qa/playwright-runbook.md` exists and another agent can follow it to run the full QA suite without prior context.
- No new use of `any`, no defensive backward-compatibility code, no edits outside the surfaces listed.
- Existing Vitest specs in `src/test/*` and Node tests in `backend/test/*` remain untouched.

## Risks and mitigations

- Risk: Playwright `webServer` race against Vite + Express startup on Windows.
  - Mitigation: keep `npm run dev:all` invocation as the command; set `webServer.timeout` to 120s; `reuseExistingServer: !CI`.
- Risk: e2e tests accidentally hit production Azure Postgres.
  - Mitigation: global-setup hostname guard plus `QA_DB_OK=1` opt-in. CI enforces non-prod connection string via secret naming convention.
- Risk: flaky network-dependent specs (ingestion sync hits Google Sheets).
  - Mitigation: tag flaky external specs `@external` and exclude from PR pipeline; run them only on `main` push.
- Risk: Lighthouse CI scores regress for unrelated reasons (network jitter).
  - Mitigation: keep LHCI as warning-only for the first two weeks; collect baseline before promoting to a hard gate.
- Risk: Browserbase remote mode tested before app is publicly reachable.
  - Mitigation: scope Sprint 1 to local-mode only; add tunneled-URL plan in Sprint 2.
- Risk: scope creep into visual regression or auth coverage.
  - Mitigation: explicit `Out of scope` section; deferred items get tickets, not inline work.

## Verification commands

Run from repo root:

```bash
npm run install:all
npx playwright install --with-deps chromium
npm run typecheck
npm run build
npm test
npm run dev:all   # in a separate terminal
npm run test:e2e -- --grep @read
npm run test:lhci
```

Backend-side guardrails (already exist):

```bash
cd backend
npm run db:generate
npm run db:validate
npm run db:verify:migration
npm run verify-ingestion
```

## Team layout (for team-mode dispatch)

- Lead: Sisyphus (this session) - sequencing, plan ownership, final verification.
- Member 1 (`playwright-impl`) - installs Playwright, writes config, lands `@read` specs. Category `unspecified-high`, skills: `playwright`, `frontend-ui-ux`.
- Member 2 (`ci-impl`) - authors `.github/workflows/ci.yml`, wires LHCI, configures secrets (documents-only, no secret values). Category `unspecified-low`, skills: `git-master`.
- Member 3 (`runbook-writer`) - writes `docs/qa/playwright-runbook.md`, updates `AGENTS.md` and `README.md`. Category `writing`, skills: none required.
- Member 4 (`verifier`) - runs the full Verification commands list and records evidence. Category `quick`, skills: `review-work`.

## Knowledge base entry

This plan should be linked from `docs/README.md` under a new section once landed. Suggested entry:

```md
| [qa-testing-stack-implementation-2026-06-09.md](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/plans/qa-testing-stack-implementation-2026-06-09.md) | QA testing stack implementation: Playwright e2e, axe-core, Lighthouse CI, GitHub Actions, Browserbase local-mode exploratory QA. | `docs/plans/` |
```

## Sources

- Playwright vs Cypress 2026 benchmarks: https://qaskills.sh/blog/playwright-vs-cypress-2026-detailed-comparison
- Browserbase Browse CLI local mode: https://www.npmjs.com/package/@browserbasehq/browse-cli and https://github.com/browserbase/skills/blob/main/skills/browserbase-cli/REFERENCE.md
- Browserbase + Playwright integration: https://docs.browserbase.com/welcome/quickstarts/playwright
- Existing repo QA docs: `docs/qa/qa-verification-report-2026-05-26.md`, `docs/qa/ingestion-sync/qa-test-plan.md`, `docs/qa/implementation-qa-requirements-2026-05-26.md`.
- Background research synthesis: session `ses_15595e2a1ffeFShDoCk4nzfGy5` (background task `bg_1325012a`).

