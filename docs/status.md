# Project Status — Just Management Hospitality Dashboard

**Last Updated**: 2026-06-12
**Branch**: `main`
**Base**: Track B (Azure PostgreSQL / Express / Prisma)

---

## Goal

Complete every sidebar-promised dashboard page, add same-day checkout Tax-Export with Vietnamese invoice template support, and prepare WithOne integration boundary for Gmail/Sheets enrichment — all without building a full PMS/accounting platform.

## Constraints & Preferences

- Track B uses Azure PostgreSQL Flexible Server (`webdbmujo.postgres.database.azure.com`)
- `supabase/migrations/` files are schema-intent reference only; do NOT deploy to Azure
- Prisma migrations are the canonical Azure deployment path
- No Supabase RLS (anon, authenticated roles) in Azure migration SQL
- Frontend must support env-based switching between Track A (Supabase) and Track B (REST API)
- DESIGN.md is the primary design system (Harbor-blue + brass hospitality theme)
- Tax-Export outputs `.xlsx` files following user-provided Vietnamese tax invoice template
- Pages first, tests afterward (per user decision)

---

## Progress

### Done

**Infrastructure (2026-05-29)**
- Azure PostgreSQL connected and operational (`DATABASE_URL` with `sslmode=require`)
- Prisma schema pushed with 3 new tax-export models (`tax_export_settings`, `tax_export_jobs`, `tax_export_items`)
- Backend build pipeline fixed: `"build": "prisma generate && tsc"` — 0 TS errors
- Pre-existing `@types/compression` Express type conflicts resolved
- Supervisor bridge: Python reverse proxy (uvicorn port 8001 → Express port 3001)
- Frontend bridge: Vite dev server on port 3000 via `frontend/package.json`
- Database seeded with 8 properties, 77 rooms, 61 reservations (local), Azure DB has production data

**Dashboard Pages — 11/11 complete (2026-05-29)**
1. Check-in / Check-out (`/check-in-out`) — arrivals/departures board, Check In/Out buttons, property filter
2. Room Types (`/rooms/types`) — room type cards with occupancy bars, property filter
3. Availability (`/rooms/availability`) — 14-day date grid, arriving/occupied/departing/vacant, week navigation
4. Housekeeping (`/housekeeping`) — cleanliness board (dirty/cleaning/inspected/ready), checkout-today badges
5. Dining & Events (`/dining-events`) — event schedule cards, type badges, venue info, Track B REST/Prisma data
6. Rate Manager (`/rate-manager`) — rate calendar by room type/date, weekend surcharge, Track B REST/Prisma data
7. Billing & Invoices (`/billing`) — TanStack Table with search, status/property filters, pagination
8. Channel Distribution (`/channels`) — channel cards with external account status (real API data)
9. Staff & Roles (`/staff`) — staff directory with role badges, search, role filter, Track B REST/Prisma data
10. Security & Access (`/security`) — audit log with severity filtering, Track B REST/Prisma data
11. VIP Guests (`/guests/vip`) — VIP-filtered guest table with pagination

**Sidebar & Routing (2026-05-29)**
- All 18 routes wired in `src/router.tsx` with lazy loading
- Sidebar fully rewritten with collapsible groups (Front Office, Property, Revenue, Administration)
- Brand updated from "Latte Lounge" to "Just Management"
- "Manage Room Types" button on Rooms page → navigates to `/rooms/types`
- Guests Export button present (not yet wired to CSV)
- Maintenance Log Issue button present (not yet wired to dialog)

**Tax-Export — Wave 5-6 partial (2026-05-29)**
- Tax & Compliance page (`/tax-export`) with date picker, preview table, history tab, download
- Backend service: `backend/src/tax-export/service.ts` (309 lines) — preview, run, Excel generation
- Backend routes: `backend/src/tax-export/routes.ts` (207 lines) — 7 REST endpoints
- Excel output follows Vietnamese template exactly:
  - Columns F/J/L/P = defaults (buyer label, payment method, unit, VAT 8%)
  - Columns C/D/E/G/H/I = empty per user spec
  - Dynamic: A=Invoice#, B=Date, K=Service desc, M=Nights, N=Price, O=Total, Q=VAT
- Settings API: configurable defaults (buyer label, payment method, unit, VAT rate, service template)
- `needs_review` status for items missing unit price
- Job history with per-job download

**Testing (2026-05-29)**
- Testing Agent Iteration 1: 11/11 frontend pages PASS, sidebar 11/11 navigation PASS
- Testing Agent Iteration 2: Tax-export backend 14/16 PASS (UUID validation fixed → 16/16), frontend 100% PASS, regression 11/11 PASS

### Completed Since 2026-05-29

- Frontend repository contracts expanded; app-level raw REST calls consolidated behind `src/lib/repositories/rest-repositories.ts`.
- Dining & Events, Staff & Roles, Security & Access, and Rate Manager now read Track B REST/Prisma endpoints instead of frontend-generated mock/static data.
- Added Prisma migration `20260609000000_add_ops_page_data` for page-specific operational tables and deployed it to Azure PostgreSQL on 2026-06-09 after approval.
- Removed room passcodes from public room DTOs and confirmed `/api/rooms` response does not expose `passcode`.
- Added frontend tests for repository-backed page data and ingest repository endpoints.
- Added minimal accessibility hardening for icon-only controls, custom tab/date buttons, and Tax Export needs-review unit-price input.

**WithOne Default Sheets Provider (2026-06-11)**
- Switched `INGEST_SHEETS_PROVIDER` runtime default from `google-sheets-direct` to `withone` in both `backend/src/ingest/routes.ts` and `backend/src/config/env-validator.ts`.
- `backend/.env.example` documents WithOne as the default and demotes service-account credentials to a commented legacy fallback.
- `verify-ingestion` script now spawns the API server with `INGEST_SHEETS_PROVIDER=withone`, asserts a deterministic 400 + `CONFIG_AUTH_FAILURE` (`field=connectionKey`) for the missing-key case, and gates an opt-in live happy-path on three trimmed, non-placeholder env vars.
- Reconciled four narrative docs to match: `docs/m-management-ingestion-pipeline.md`, `docs/plans/m-management-ingestion-pipeline-implementation-plan.md`, `docs/plans/qa-testing-stack-implementation-2026-06-09.md`, `docs/analysis/ingestion-implementation-summary-report.md`.
- Verification: `npm run build`, `npm test` (11/11), `npm run verify-ingestion` (9/9 scenarios), `npm run typecheck` all green. Oracle-verified.
- Handoff document for QA: `docs/qa/withone-sheets-default-handoff-2026-06-11.md`.

**Rooms Source-of-Truth + Reservations Replace-Mode (2026-06-12)**
- Codified the canonical 45-room inventory across 8 properties (Mujo MH 7, 23 4, 19 7, CC 8, Latte Lounge 8, The Alley 4, The Crest 2, The Opera 5) in `backend/src/lib/rooms-source-of-truth.ts`. Compile-time guard pins the total to 45.
- Type codes resolved against the Notion Room Standards data source. Codes 3.2 / 3.3 replaced legacy 1.2 / 1.3 per user direction; Latte Lounge Coffee 1 / Milk 1 demoted from code 1 to code 2 because the Standard label takes priority over the code.
- `docs/database_design/Room Types.md` now tracked in git. Header counts match the table contents (Mujo 19 = 7 rooms, The Alley = 4 rooms).
- New idempotent seed `backend/scripts/seed-rooms-sot.ts` with `--check` (default, read-only) and `--apply`. Refuses to mutate Azure DBs without `JM_ROOMS_SOT_AZURE_OK=1`. Wired as `npm run seed:rooms-sot`.
- `POST /api/ingest/reservations` now accepts a `replaceMode` flag. When set, the (airbnb, sourceAccount) reservation scope is wiped before re-importing. Tax-export safety: HTTP 409 + `REPLACE_BLOCKED_BY_TAX_EXPORT` if any `tax_export_items` reference reservations in scope. `replaceMode` + `dryRun=true` rejected at the route with HTTP 400.
- Test fixtures aligned with the SoT (`mh`, `ruby` slugs; SoT names; `total_rooms` matching counts). Backend 11/11, frontend 7/7 still pass.
- Verification: build + typecheck + tests + verify-ingestion all green. Seed `--check` correctly reports drift on Azure (create=13, update=32). Live WithOne `/api/integrations/status` returns `disconnected` with WithOne 401 - external auth state, not a defect.
- Handoff document for QA: `docs/qa/rooms-sot-and-replace-mode-handoff-2026-06-12.md`.

### In Progress / Blocked

- Live WithOne Gmail/Sheets verification is blocked by connection authentication: `/api/integrations/status` returns `disconnected` with WithOne 401 using the current connection key.
- Billing & Invoices remains a reservation-derived MVP; a real invoice/folio model is future product scope, not part of the completed dashboard hardening.

### Remaining

- Agile feedback review for any new user-story changes before implementation.
- Live WithOne happy-path verification: pending a real, non-placeholder `ONE_CONNECTION_KEY` AuthKit grant for Gmail/Drive. The connection key is configured; what's missing is the user-side OAuth grant. `/api/integrations/status` currently surfaces a clean WithOne 401.
- Apply the rooms SoT to Azure when ready: `cd backend && $env:JM_ROOMS_SOT_AZURE_OK="1"; npm run seed:rooms-sot -- --apply`. Current drift: create=13, update=32 across 45 rooms.
- Optional live browser walkthrough with a human reviewer once SoT applied + WithOne credentials available.
- Decide whether to keep, delete, or commit untracked local artifacts under `.omo/`, `.understand-anything/`, `resources/`, and `logs.txt`.
- Address single-line `.gitignore` drift (`+.omo`) introduced outside of this work; revert before next staging cycle.
- `docs/database_design/listings.csv` and `reservations.csv` show as modified; user-authored content - confirm before next commit cycle.

---

## Key Decisions

- Prisma is the canonical schema source for Azure; `supabase/migrations/` are reference-only
- `VITE_TRACK=B` env var controls factory selection in the frontend repository layer
- Vite dev proxy handles `/api` → Express backend
- Tax-Export outputs `.xlsx` (user-uploaded template) rather than Google Sheets write (for now)
- Auth (Clerk/Auth0) deferred
- Pages built with real API data where available; frontend mock data where backend CRUD not yet built
- Tests deferred per user request — testing agent used for integration verification

## Next Steps

1. Run the QA handoff (`docs/qa/rooms-sot-and-replace-mode-handoff-2026-06-12.md`) end-to-end - user + assigned agents.
2. Provide a real WithOne connection key/OAuth connection, then rerun live Gmail/Sheets smoke and the gated `verify-ingestion` live happy-path.
3. Rotate live secrets that were exposed in the tool transcript during env verification.
4. Review dashboard UX/a11y findings and approve any user-story-level changes before implementation.
5. Decide whether Billing & Invoices should remain reservation-derived or become a true invoice/folio feature.
6. Decide how to handle untracked tooling/report artifacts before the next commit.

## Relevant Files

### Frontend
- `src/router.tsx` — 18 lazy routes
- `src/components/app-sidebar.tsx` — Full sidebar navigation
- `src/components/check-in-out/check-in-out-page.tsx`
- `src/components/rooms/room-types-page.tsx`
- `src/components/rooms/availability-page.tsx`
- `src/components/housekeeping/housekeeping-page.tsx`
- `src/components/dining-events/dining-events-page.tsx`
- `src/components/revenue/rate-manager-page.tsx`
- `src/components/revenue/billing-invoices-page.tsx`
- `src/components/revenue/channel-distribution-page.tsx`
- `src/components/admin/staff-roles-page.tsx`
- `src/components/admin/security-access-page.tsx`
- `src/components/guests/vip-guests-page.tsx`
- `src/components/tax-export/tax-export-page.tsx`

### Backend
- `backend/src/index.ts` — Express server (tax-export routes registered)
- `backend/src/tax-export/service.ts` — Tax-export core service
- `backend/src/tax-export/routes.ts` — Tax-export REST API (7 endpoints)
- `backend/prisma/schema.prisma` — 3 new tax-export models
- `backend/fixtures/Tax_export_template.xlsx` — Vietnamese invoice template
- `backend/scripts/seed.ts` — Database seed script
- `backend/server.py` — Python reverse proxy bridge (uvicorn → Express)

### Config
- `backend/.env` — Azure PostgreSQL URL + WithOne API key
- `backend/package.json` — Build: `prisma generate && tsc`
- `frontend/package.json` — Vite dev bridge on port 3000
