# Handoff Contract: dashboard-completion-and-integration

**Generated:** 2026-05-31
**Branch:** `feature/dashboard-completion-tax-export`
**Plan:** `.omo/plans/dashboard-completion-and-integration.md`
**For:** External executor / next session

---

## 1. What Is Done (Verified)

These tasks are complete and build-verified. Do not re-implement.

| Task | What Was Built | Verified By |
|------|---------------|-------------|
| 6 | Shared page layout primitives (header/KPI/content pattern) | Build |
| 7 | Multi-property filter on all operational pages | Build |
| 8/28 | Prisma schema: `tax_export_settings`, `tax_export_jobs`, `tax_export_items` | `db:generate` + Azure push |
| 9 | Tax-export REST endpoints (7 routes) wired in backend | Build |
| 10 | `ProviderConnector`/`WithOneProviderConnector` interface + `GET /api/integrations/status` | Build |
| 11 | Ingest `sourceAccount` generalized (no hardcoded literals) | Build |
| 12 | Page data hooks for 11 new pages (reuse existing hooks) | Build |
| 13 | Router wiring: 18 routes in `src/router.tsx`, sidebar in `src/components/app-sidebar.tsx` | Build + Playwright |
| 14 | Check-in/Check-out page (`src/components/check-in-out/check-in-out-page.tsx`) | Build + Playwright |
| 15 | VIP Guests page (`src/components/guests/vip-guests-page.tsx`) | Build + Playwright |
| 16 | Room Types page (`src/components/rooms/room-types-page.tsx`) | Build + Playwright |
| 17 | Availability page (`src/components/rooms/availability-page.tsx`) | Build + Playwright |
| 18 | Housekeeping page (`src/components/housekeeping/housekeeping-page.tsx`) | Build + Playwright |
| 19 | Dining & Events page (`src/components/dining-events/dining-events-page.tsx`) | Build + Playwright |
| 20 | Maintenance Log Issue dialog + `POST /api/maintenance` | Build |
| 21 | Rate Manager page (`src/components/revenue/rate-manager-page.tsx`) | Build + Playwright |
| 22 | Billing & Invoices page (`src/components/revenue/billing-invoices-page.tsx`) | Build + Playwright |
| 23 | Channel Distribution page (`src/components/revenue/channel-distribution-page.tsx`) | Build + Playwright |
| 24 | Staff & Roles page (`src/components/admin/staff-roles-page.tsx`) | Build + Playwright |
| 25 | Security & Access page (`src/components/admin/security-access-page.tsx`) | Build + Playwright |
| 26 | Guests Export CSV button (client-side, filtered rows) | Build + browser |
| 32 | Tax-Export orchestration service (`backend/src/tax-export/service.ts`, 309 lines) | Build |
| 33 | Tax-Export REST routes (`backend/src/tax-export/routes.ts`, 7 endpoints) | Build |
| 35 | Tax & Compliance page (`src/components/tax-export/tax-export-page.tsx`, 542 lines) | Build + Playwright |
| 36 | Per-reservation Tax-Export row action (scoped by `reservation_id`) | Build |
| 39 | Needs-review correction workflow (review queue + PATCH item status/unit price) | Build + browser QA |
| 41 | Integrations dashboard hardening (provider health, disconnect feedback, mode guidance) | Build + browser QA |
| 42 | Manual tax-export retry safety (`runTaxExport()` same-scope completed-job reuse, explicit run metadata/status code) | Build |

---

## 2. Remaining Tasks (Execution Order)

Execute in this order. Tasks 37 and 38 can run in parallel. Tasks 42-45 and F1-F4 can run in parallel after 40 is done.

### Priority 1: Tax-Export completeness

**Task 40 — Tax-Export end-to-end UI polish** (partial, unblock first)
- Add toast notifications on export run success/failure
- Add disconnected-state banner when `GET /api/integrations/status` returns `disconnected`
- Files: `src/components/tax-export/tax-export-page.tsx`
- Verify: `npm run typecheck && npm run build`

**Task 37 — Scheduled Tax-Export UI**
- `tax_export_settings` schema has `schedule_enabled`, `schedule_time`, `schedule_timezone` fields (no `schedule_cron`)
- Add schedule toggle + time/timezone inputs to Tax & Compliance settings panel
- Wire to existing `PUT /api/tax-export/settings` endpoint
- No backend scheduler needed yet; UI only
- Files: `src/components/tax-export/tax-export-page.tsx`
- Verify: `npm run typecheck && npm run build`

**Task 38 — Sheet settings and column mapping UI**
- `tax_export_settings` has `sheet_id`, `sheet_tab`, `template_columns` fields
- Add sheet ID + tab name inputs to settings panel
- Wire to existing `PUT /api/tax-export/settings` endpoint
- Files: `src/components/tax-export/tax-export-page.tsx`
- Verify: `npm run typecheck && npm run build`

### 2026-05-31 Task 38 status update
- Implemented smallest full-stack slice across `backend/prisma/schema.prisma`, new migration `backend/prisma/migrations/20260531153000_add_tax_export_sheet_settings/migration.sql`, `backend/src/tax-export/service.ts`, `backend/src/tax-export/routes.ts`, and `src/components/tax-export/tax-export-page.tsx`.
- Persisted settings fields now include `sheet_id`, `sheet_tab`, and `template_columns` through existing `GET/PUT /api/tax-export/settings` flow.
- Tax page now exposes sheet ID input, sheet tab input, and JSON column-mapping textarea on existing settings card without touching review queue or export tabs.
- Verification: `npm run typecheck` PASS, `npm run build` PASS, `npm run db:validate` PASS, `npm run db:verify:migration` PASS, backend TypeScript compile PASS via `PRISMA_GENERATE_NO_ENGINE=1 npm run build`.
- Remaining caveat: exact `cd backend && npm run db:generate` and exact `cd backend && npm run build` currently fail in this workspace with Windows `EPERM` rename lock on Prisma engine DLL while Node processes are active.

### 2026-05-31 Task 38 runtime repair update
- Investigated live backend failure using `C:/Users/OLLYTR~1/AppData/Local/Temp/opencode/atlas-backend-3001.log`.
- Root cause: live DB lacked Task 38 columns because pending migration had not deployed; normal deploy was blocked by older half-applied migration `20260528000000_watched_files_target_kind`.
- Repair steps executed:
  1. Created missing `watched_files_target_kind_idx` with `CREATE INDEX IF NOT EXISTS`.
  2. Marked `20260528000000_watched_files_target_kind` as applied with `prisma migrate resolve`.
  3. Ran `npm run db:deploy`, which applied `20260531153000_add_tax_export_sheet_settings`.
- Direct API QA after repair:
  - `GET http://localhost:3001/api/tax-export/settings` -> `200 OK`
  - `PUT http://localhost:3001/api/tax-export/settings` with `sheet_id`, `sheet_tab`, `template_columns` -> `200 OK`
  - Follow-up GET returned persisted sheet values.

### Priority 2: Gmail + Sheets pipeline (needs live credentials)

**Task 29 — Gmail search service**
- Implement `backend/src/tax-export/gmail-service.ts`
- Use WithOne Gmail connection via `WithOneProviderConnector` (already in `backend/src/integrations/provider-connector.ts`)
- Search inbox for OTA payment emails by date range
- Store message IDs only; do not persist raw email body
- Blocked by: `ONE_CONNECTION_KEY` env var (WithOne credentials)

**Task 30 — OTA parser registry**
- Implement `backend/src/tax-export/parsers/` directory
- Parsers needed: Airbnb, Booking.com, Agoda, generic fallback
- Ambiguous/missing parse results must route to `needs_review`, not fail the batch
- Idempotency key: `reservation_id + checkout_date + confirmation_code`
- Blocked by: Task 29

**Task 31 — Google Sheets writer/upsert**
- Implement `backend/src/tax-export/sheets-service.ts`
- Upsert rows by idempotency key; never blind-append
- Sheet target: user-provided `sheet_id` + `sheet_tab` from `tax_export_settings`
- Blocked by: `ONE_CONNECTION_KEY` + Tasks 29-30

### Priority 3: Hardening (parallel after Task 40)

**Task 42 — Scheduler and retry safety**
- Add cron-based scheduler in backend that reads `schedule_enabled` + `schedule_time` + `schedule_timezone` from `tax_export_settings`
- Retry failed jobs up to N times with backoff
- Files: `backend/src/tax-export/scheduler.ts`, wire into `backend/src/index.ts`
- Verify: `cd backend && npm run build`

**Task 43 — Performance and pagination pass**
- Audit pages that load unbounded data: Reservations, Billing, Security/Audit log
- Add cursor or offset pagination to heavy REST endpoints
- Files: `backend/src/index.ts` (query params), relevant page components
- Verify: `npm run typecheck && npm run build`

**Task 44 — Accessibility and responsive QA**
- Run Lighthouse accessibility audit on all 11 new pages
- Fix critical a11y violations (missing labels, contrast, keyboard nav)
- Do a responsive pass at 375px, 768px, 1280px breakpoints
- Verify: Lighthouse score >= 90 on accessibility

**Task 45 — Verification docs and evidence index**
- Write `docs/verification-evidence.md` listing QA results, build outputs, and test coverage
- Reference test_reports/iteration_1.json and test_reports/iteration_2.json
- Verify: file exists and is accurate

### Priority 4: Final verification (after all above)

**F1 — Plan Compliance Audit**
- Read `.omo/plans/dashboard-completion-and-integration.md` Must Have and Must NOT Have lists
- Confirm every Must Have is met; flag any gaps

**F2 — Code Quality Review**
- Run `npm run typecheck && npm run build` (frontend)
- Run `cd backend && npm run build`
- Zero errors required before marking complete

**F3 — Real Manual QA**
- Start `npm run dev:all`
- Navigate every sidebar route and confirm non-placeholder content
- Run a tax-export preview + download cycle
- Confirm needs-review queue loads and PATCH works

**F4 — Scope Fidelity Check**
- Confirm no Supabase runtime adapter was added
- Confirm no full accounting/PMS/payments platform was built
- Confirm no live Booking.com/Agoda/Airbnb API integrations beyond email parsing
- Confirm frontend never calls Gmail/Sheets directly

---

## 3. Environment Blockers

| Blocker | Impact | Resolution |
|---------|--------|------------|
| `DATABASE_URL` missing in `backend/.env` | All Prisma-backed endpoints return errors at runtime | Add `DATABASE_URL=postgresql://USER:PASSWORD@HOST.postgres.database.azure.com:5432/m_management?sslmode=require` to `backend/.env` |
| `ONE_CONNECTION_KEY` missing | `GET /api/integrations/status` returns `disconnected`; Tasks 29-31 cannot be tested live | Obtain from WithOne dashboard; add to `backend/.env` |
| WithOne Gmail OAuth credentials | Gmail search service (Task 29) cannot authenticate | Provide OAuth client ID + secret or connection key from WithOne |
| WithOne Google Sheets credentials | Sheets writer (Task 31) cannot authenticate | Same as above |
| LSP/biome not installed | No in-editor type diagnostics | Run `npm run typecheck` manually instead |

Tasks 37, 38, 40, 42, 43, 44, 45, F1-F4 do NOT require live credentials. They can be executed with only the repo and Node.js.
Tasks 29, 30, 31 require `ONE_CONNECTION_KEY` and live WithOne OAuth to test end-to-end.

---

## 4. Verification Commands

```bash
# Frontend typecheck
npm run typecheck

# Frontend build
npm run build

# Backend build (includes prisma generate)
cd backend && npm run build

# Prisma schema validation
cd backend && npm run db:generate
cd backend && npm run db:validate

# Migration safety check (Azure-safe, no RLS)
cd backend && npm run db:verify:migration

# Ingestion pipeline verification
cd backend && npm run verify-ingestion

# Full backend verification suite
cd backend && npm run verify:all

# Run everything locally
npm run dev:all
```

### Current Build Status

| Command | Status |
|---------|--------|
| `cd backend && npm run build` | PASSES |
| `cd backend && npm run db:generate` | PASSES |
| `npm run typecheck` | PASSES |
| `npm run build` | PASSES |
| `cd backend && npm run db:validate` | NOT VERIFIED |

---

## 5. No-Go Guardrails

These are hard constraints from the plan. Do not cross them.

- Do NOT revive Supabase runtime adapter or add a Supabase repository in `src/lib/repositories/`
- Do NOT build a full accounting/PMS/payments platform
- Do NOT add live Booking.com, Agoda, or Airbnb API integrations beyond email parsing
- Do NOT store raw full email body in the database
- Do NOT let frontend call Gmail or Google Sheets directly
- Do NOT blindly append duplicate rows to Google Sheets (upsert by idempotency key only)
- Do NOT implement placeholder/stub pages (all 11 pages are already real)
- Do NOT apply `supabase/migrations/*.sql` to Azure PostgreSQL
- Do NOT hardcode secrets, DATABASE_URL, API keys, or production origins in source
- Do NOT put fetch calls or Prisma assumptions in dashboard panel components
- Do NOT treat `guests` table as authoritative booking data (use `reservations`)

---

## 6. Key File Locations

| What | Path |
|------|------|
| Plan | `.omo/plans/dashboard-completion-and-integration.md` |
| This handoff | `.omo/notepads/dashboard-completion-and-integration/handoff.md` |
| Tax-Export page | `src/components/tax-export/tax-export-page.tsx` |
| Tax-Export service | `backend/src/tax-export/service.ts` |
| Tax-Export routes | `backend/src/tax-export/routes.ts` |
| ProviderConnector | `backend/src/integrations/provider-connector.ts` |
| Integrations page | `src/pages/settings/integrations-page.tsx` |
| Prisma schema | `backend/prisma/schema.prisma` |
| Router | `src/router.tsx` |
| Sidebar | `src/components/app-sidebar.tsx` |
| Backend entry | `backend/src/index.ts` |
| Seed script | `backend/scripts/seed.ts` |
| Excel template | `backend/fixtures/Tax_export_template.xlsx` |
| Test reports | `test_reports/iteration_1.json`, `test_reports/iteration_2.json` |

---

## 7. Recommended Execution Order

```
Step 1 (no credentials needed, parallel ok):
  Task 40  — Tax-Export UI polish (toasts + disconnected banner)
  Task 37  — Scheduled export UI (settings panel fields)
  Task 38  — Sheet settings UI (sheet_id + tab inputs)

Step 2 (no credentials needed, parallel ok):
  Task 42  — Scheduler + retry safety (backend)
  Task 43  — Performance + pagination pass
  Task 44  — Accessibility + responsive QA
  Task 45  — Verification docs + evidence index

Step 3 (requires ONE_CONNECTION_KEY + WithOne OAuth):
  Task 29  — Gmail search service
  Task 30  — OTA parser registry (after 29)
  Task 31  — Google Sheets writer/upsert (after 29+30)

Step 4 (after all above):
  F1  — Plan compliance audit
  F2  — Code quality review (typecheck + build, zero errors)
  F3  — Real manual QA (dev:all, navigate all routes, run tax-export cycle)
  F4  — Scope fidelity check
```

---

## 8. Pages Using Mock Data (not yet wired to backend)

These pages render frontend-generated data. They work visually but show no real records.
Wire them to real backend endpoints when backend CRUD is added for those domains.

| Page | Mock Data Type |
|------|---------------|
| Dining & Events (`/dining-events`) | Frontend-generated event cards |
| Staff & Roles (`/staff`) | Frontend-generated staff directory |
| Security & Access (`/security`) | Frontend-generated audit log |
| Rate Manager (`/rate-manager`) | Base-rate constants + weekend surcharge |
| Billing & Invoices (`/billing`) | Invoices derived from reservations on frontend |

---

## 9. Known Issues

- `package-lock.json` has a large unreviewed diff. Review separately before merging.
- LSP/biome not installed in current environment. Use `npm run typecheck` for type checking.
- Chrome DevTools may be unavailable. Use Playwright for browser-based QA.
- Frontend `npm run typecheck` and `npm run build` both pass (verified in current session).
- Task 34 (tax-export observability) is partial: `needs_review_reason` tracked but no structured audit log or metrics counters.
- Task 27 (integration polish) is partial: no responsive QA pass done.
- Legacy tax-export jobs with old `triggered_by: "manual"` tagging are not auto-reused; duplicate protection applies to new scoped manual runs.

---

## 10. Contract for External Executor

You are picking up this plan mid-flight. Here is what you need to know:

1. The repo is on branch `feature/dashboard-completion-tax-export`. Do not merge to main until F1-F4 pass.
2. All 11 sidebar pages are implemented and verified. Do not touch them unless a bug is found.
3. The backend builds clean. Keep it that way: run `cd backend && npm run build` after every backend change.
4. The frontend build is verified clean (`npm run typecheck && npm run build` both pass). Run them again after any frontend change.
5. Tasks 37, 38, 40 are UI-only changes to `src/components/tax-export/tax-export-page.tsx`. Start there.
6. Tasks 29-31 are blocked until `ONE_CONNECTION_KEY` and WithOne OAuth credentials are available. Do not attempt them without credentials.
7. Every task must end with a passing build. No exceptions.
8. Do not invent completed work. If a task is not done, mark it not done.
9. Read `backend/AGENTS.md`, `backend/prisma/AGENTS.md`, and `src/hooks/AGENTS.md` before touching those subsystems.
10. The plan file at `.omo/plans/dashboard-completion-and-integration.md` is the source of truth for scope. This handoff doc is a navigation aid, not a replacement.
