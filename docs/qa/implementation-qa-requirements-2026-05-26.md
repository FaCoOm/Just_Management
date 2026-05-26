# Implementation QA Requirements - 2026-05-26

## Purpose

This document is a QA handoff for another agent. It defines test requirements for the current implementation work in this branch/worktree. QA must verify behavior from the running app/API, not by trusting implementation notes.

## Current Scope Under Test

Test these implemented or partially implemented surfaces:

1. Frontend Track B dashboard and page routing.
2. Reservations page `New Reservation` dialog.
3. Reservation CSV upload flow.
4. Ingestion REST endpoints for listings, reservations, Google Sheets, and pipeline run/status.
5. WithOne integration backend routes.
6. Prisma connector schema/migrations.
7. Build and verification commands.

Known incomplete item: manual reservation creation is not implemented. QA should verify it is clearly disabled/non-submitting and does not pretend to create data.

## Required Environment

Run from repository root unless noted.

```bash
npm install
cd backend && npm install
```

Backend requires a valid `DATABASE_URL` in `backend/.env` that points to a QA-safe PostgreSQL database. Do not run mutating tests against production.

Recommended dev commands:

```bash
cd backend
npm run db:generate
npm run db:validate
npm run db:verify:migration
npm run build
npm run verify-ingestion
```

Frontend commands:

```bash
npm run typecheck
npm run build
npm run dev
```

Full build command:

```bash
npm run build:all
```

Manual app run:

```bash
npm run dev:all
```

Expected local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

## Evidence Requirements

For each QA case, record:

- Test ID.
- Date/time.
- Environment variables relevant to the test, with secrets redacted.
- Exact command or browser steps.
- Expected result.
- Actual result.
- Pass/fail.
- Screenshot for user-visible UI cases.
- HTTP status/body for API cases.
- Console/network errors, if any.

Interactive UI defects require step screenshots and, if possible, a short repro video. Static visual/content defects require one annotated screenshot.

## Build And Static Verification

### QA-BUILD-001 - Frontend Typecheck

Run:

```bash
npm run typecheck
```

Pass criteria:

- Command exits `0`.
- No TypeScript errors.

### QA-BUILD-002 - Frontend Production Build

Run:

```bash
npm run build
```

Pass criteria:

- Command exits `0`.
- Vite prints final `built in ...` line.
- Build does not hang for more than 120 seconds.

Known prior failure to watch for:

- `src/components/reservations/reservations-page.tsx` had missing `properties` and `rooms` props for `ReservationsHeader`.

### QA-BUILD-003 - Backend Build

Run:

```bash
cd backend
npm run build
```

Pass criteria:

- Command exits `0`.
- No TypeScript errors.

### QA-BUILD-004 - Combined Build

Run:

```bash
npm run build:all
```

Pass criteria:

- Frontend and backend build both complete.
- Command exits `0`.
- Build does not hang for more than 180 seconds.

## Prisma And Migration QA

### QA-DB-001 - Prisma Client Generation

Run:

```bash
cd backend
npm run db:generate
```

Pass criteria:

- Command exits `0`.
- Generated client includes new models:
  - `integration_connections`
  - `watched_files`
  - `email_import_messages`
  - `seed_batches`

### QA-DB-002 - Prisma Schema Validation

Run:

```bash
cd backend
npm run db:validate
```

Pass criteria:

- Command exits `0`.
- No schema validation errors.

### QA-DB-003 - Azure-Safe Migration Verification

Run:

```bash
cd backend
npm run db:verify:migration
```

Pass criteria:

- Command exits `0`.
- Migration verifier reports no Supabase-only RLS/policy syntax.

### QA-DB-004 - Migration Content Review

Review migration files under `backend/prisma/migrations/`.

Pass criteria:

- Connector tables exist in migration SQL.
- `channel_listings.owner` migration exists and is indexed.
- `provider_listing_id` uniqueness is intentional and compatible with current data.
- No destructive drops of compatibility tables unless explicitly approved.

## Backend API Smoke Tests

Start backend:

```bash
cd backend
npm run dev
```

### QA-API-001 - Health Route

Request:

```bash
curl -i http://localhost:3001/health
```

Pass criteria:

- HTTP `200`.
- Response indicates server is healthy.

### QA-API-002 - Dashboard Summary

Request:

```bash
curl -i "http://localhost:3001/api/dashboard/summary"
```

Pass criteria:

- HTTP `200`.
- Response includes `properties`, `rooms`, `reservations`, `guests`, `requests`, `maintenance`, `metrics`, `totals`, and `occupancySeries`.
- No privileged fields such as room passcodes appear in response.

### QA-API-003 - Reservations List

Request:

```bash
curl -i "http://localhost:3001/api/reservations"
```

Pass criteria:

- HTTP `200`.
- Response is an array.
- Each reservation has dates, status, property reference, guest name/count, and compatible fields consumed by frontend.

### QA-API-004 - Reservations Date Filters

Requests:

```bash
curl -i "http://localhost:3001/api/reservations?check_in_date=2026-05-26"
curl -i "http://localhost:3001/api/reservations?check_out_date=2026-05-26"
curl -i "http://localhost:3001/api/reservations?start_date=2026-05-01&end_date=2026-05-31"
```

Pass criteria:

- HTTP `200` for valid dates.
- Invalid date values produce explicit validation errors, not server crashes.

## Ingestion QA

### QA-INGEST-001 - Verification Harness

Run:

```bash
cd backend
npm run verify-ingestion
```

Pass criteria:

- Command exits `0`.
- Dry run does not mutate row counts.
- Real listing run creates/updates expected records.
- Idempotency run updates rather than duplicates.
- Ambiguous input dead-letters instead of creating bad inventory.
- Reservation import creates/updates reservations and dead-letters invalid rows.

### QA-INGEST-002 - Missing `dryRun` Contract

Request:

```bash
curl -i -X POST http://localhost:3001/api/ingest/reservations \
  -H "Content-Type: application/json" \
  -d '{"sourceAccount":"airbnb-main","sourceType":"json"}'
```

Pass criteria:

- HTTP `400`.
- Response includes an error for missing/invalid `dryRun`.

### QA-INGEST-003 - Reservation CSV Dry Run Upload

Use a QA CSV with valid and invalid reservation rows.

Request shape:

```bash
curl -i -X POST http://localhost:3001/api/ingest/reservations \
  -F "dryRun=true" \
  -F "sourceAccount=airbnb-main" \
  -F "file=@path/to/reservations.csv"
```

Pass criteria:

- HTTP `200`.
- Response includes `syncRunId`, `dryRun`, `processed`, `created`, `updated`, `skipped`, `deadLetters`, `errors`.
- Database state remains unchanged by dry run.

### QA-INGEST-004 - Reservation CSV Real Upload

Use same QA CSV after dry run.

Request shape:

```bash
curl -i -X POST http://localhost:3001/api/ingest/reservations \
  -F "dryRun=false" \
  -F "sourceAccount=airbnb-main" \
  -F "file=@path/to/reservations.csv"
```

Pass criteria:

- HTTP `200`.
- Valid rows create/update reservations.
- Invalid/ambiguous rows create dead letters.
- Re-running same file does not duplicate reservations.

### QA-INGEST-005 - Listings CSV Upload

Repeat dry-run and real-run tests against:

```text
POST /api/ingest/listings
```

Pass criteria:

- Valid listing rows sync to channel/listing tables.
- Ambiguous listing names dead-letter or skip safely.
- `channel_listings.owner` is assigned correctly.

### QA-INGEST-006 - Google Sheets Direct Provider Not Configured

With `INGEST_SHEETS_PROVIDER=google-sheets-direct` and no credential file configured, request:

```bash
curl -i -X POST http://localhost:3001/api/ingest/google-sheets \
  -H "Content-Type: application/json" \
  -d '{"dryRun":false,"sourceAccount":"airbnb-main","sourceType":"google-sheets","spreadsheetId":"fake","targetKind":"listings"}'
```

Pass criteria:

- Route responds with controlled JSON error.
- Error code should be `CONFIG_AUTH_FAILURE` or equivalent configured-auth failure.
- Server does not crash.

### QA-INGEST-007 - Google Sheets WithOne Provider Validation

Set:

```bash
INGEST_SHEETS_PROVIDER=withone
```

Request without `connectionKey`:

```bash
curl -i -X POST http://localhost:3001/api/ingest/google-sheets \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true,"sourceAccount":"airbnb-main","sourceType":"google-sheets","spreadsheetId":"fake","targetKind":"listings"}'
```

Pass criteria:

- HTTP `400`.
- Response says `connectionKey` is required for WithOne provider.

### QA-INGEST-008 - Pipeline Status

Request:

```bash
curl -i http://localhost:3001/api/ingest/pipeline/status
```

Pass criteria:

- HTTP `200`.
- Response lists connector modes:
  - `admin-upload`
  - `folder-watch`
  - `email`
  - `built-in`
  - `google-sheets`
- Disabled connectors report `not_configured` rather than failing.

### QA-INGEST-009 - Built-In Pipeline Dry Run

Request:

```bash
curl -i -X POST http://localhost:3001/api/ingest/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"mode":"built-in","targetKind":"listings","sourceAccount":"airbnb-main","dryRun":true}'
```

Pass criteria:

- HTTP `200`.
- Response has non-negative `processed`, `created`, `updated`, `skipped`, `deadLetters`.
- Database state unchanged.

### QA-INGEST-010 - Unsupported Pipeline Mode Validation

Request:

```bash
curl -i -X POST http://localhost:3001/api/ingest/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"mode":"bad-mode","targetKind":"listings","sourceAccount":"airbnb-main","dryRun":true}'
```

Pass criteria:

- HTTP `400`.
- Error says mode must be one of supported modes.

## WithOne Integration QA

### QA-ONE-001 - Auth Token Missing User

Request:

```bash
curl -i -X POST http://localhost:3001/api/one/auth-token \
  -H "Content-Type: application/json" \
  -d '{}'
```

Pass criteria:

- HTTP `400`, unless dev token policy blocks first.
- Response says `userId` is required.

### QA-ONE-002 - Dev Token Gate

If `ONE_DEV_TOKEN` is configured, request without `x-dev-token`:

```bash
curl -i -X POST http://localhost:3001/api/one/auth-token \
  -H "Content-Type: application/json" \
  -d '{"userId":"qa-user"}'
```

Pass criteria:

- HTTP `403`.
- Response says missing or invalid `x-dev-token`.

Then retry with correct header:

```bash
curl -i -X POST http://localhost:3001/api/one/auth-token \
  -H "Content-Type: application/json" \
  -H "x-dev-token: <redacted>" \
  -d '{"userId":"qa-user"}'
```

Pass criteria:

- If WithOne env vars are configured, HTTP `200` and token payload appears.
- If WithOne env vars are missing, controlled HTTP `500` with clear error, no crash.

### QA-ONE-003 - List Connections

Request:

```bash
curl -i http://localhost:3001/api/one/connections \
  -H "x-user-id: qa-user"
```

Pass criteria:

- HTTP `200`.
- Response shape: `{ "connections": [...] }`.
- No secrets/tokens exposed.

### QA-ONE-004 - Create And Delete Test Connection

Create:

```bash
curl -i -X POST http://localhost:3001/api/one/connections \
  -H "Content-Type: application/json" \
  -H "x-user-id: qa-user" \
  -d '{"platform":"google-sheets","connectionKey":"test::qa-google-sheets","displayName":"QA Google Sheets"}'
```

Delete:

```bash
curl -i -X DELETE http://localhost:3001/api/one/connections/test::qa-google-sheets \
  -H "x-user-id: qa-user"
```

Pass criteria:

- Create returns HTTP `200` and persisted connection.
- Delete returns HTTP `200` with `deleted: 1`.
- Re-list confirms connection is gone.

### QA-ONE-005 - Unsupported Platform Rejection

Request:

```bash
curl -i -X POST http://localhost:3001/api/one/connections \
  -H "Content-Type: application/json" \
  -H "x-user-id: qa-user" \
  -d '{"platform":"unsupported","connectionKey":"test::bad"}'
```

Pass criteria:

- HTTP `400`.
- Error lists supported platforms.

### QA-ONE-006 - Webhook Signature Validation

Request without signature:

```bash
curl -i -X POST http://localhost:3001/api/one/webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"connection.created"}'
```

Pass criteria:

- HTTP `401` when webhook secret is configured.
- Server does not accept unsigned webhook in protected mode.

If QA can generate a valid HMAC signature, submit a signed payload and verify HTTP `200` with `{ "accepted": true }`.

## Frontend Navigation QA

Start app:

```bash
npm run dev:all
```

Open `http://localhost:5173`.

### QA-UI-001 - Main Routes Load

Visit:

- `/`
- `/reservations`
- `/guests`
- `/rooms`
- `/maintenance`
- `/settings/integrations`

Pass criteria:

- Each route loads without blank page.
- Sidebar active state updates correctly.
- Browser console has no uncaught errors.
- Failed network calls, if any, are expected and documented.

### QA-UI-002 - Dashboard Data Rendering

On `/`, verify:

- KPI cards render.
- Occupancy chart renders.
- Today arrivals/departures sections render.
- Bookings panel appears at `xl` width.

Pass criteria:

- No NaN/undefined/null visible to users.
- Empty state is readable if database has no data.

### QA-UI-003 - Reservations Table Rendering

On `/reservations`, verify:

- Reservation rows render from backend reservations.
- Search filters by guest name.
- Status filter works.
- Property filter works.
- Pagination works.
- Sort by date/status columns does not crash.

Pass criteria:

- No UI crash for unassigned room.
- Unknown/legacy status maps safely to a visible badge.
- Empty result says `No reservations found`.

### QA-UI-004 - New Reservation Dialog Opens

Steps:

1. Open `/reservations`.
2. Click `New Reservation`.
3. Switch between `Manual Entry` and `CSV Upload` tabs.

Pass criteria:

- Dialog opens.
- Tabs switch correctly.
- Manual form fields render.
- Property and room selects are populated from current data.
- Console has no uncaught errors.

### QA-UI-005 - Manual Reservation Creation Is Clearly Disabled

Steps:

1. Open `New Reservation` dialog.
2. Fill manual fields.
3. Inspect `Create Reservation` button.

Pass criteria:

- Button is disabled.
- UI text clearly says manual creation backend endpoint is not implemented yet.
- No network request is sent for manual create.
- User cannot believe reservation was created.

### QA-UI-006 - Reservation CSV Dry Run Upload

Steps:

1. Open `New Reservation` dialog.
2. Go to `CSV Upload` tab.
3. Keep `Dry run` enabled.
4. Select valid QA reservations CSV.
5. Click `Upload CSV`.

Pass criteria:

- Request goes to `/api/ingest/reservations`.
- Response summary renders in dialog.
- Summary fields show processed/created/updated/skipped/dead letters/errors.
- Dry run does not mutate database.
- User receives useful error text if upload fails.

### QA-UI-007 - Reservation CSV Real Upload

Repeat QA-UI-006 with `Dry run` disabled.

Pass criteria:

- Valid rows appear in reservations table after refresh/refetch.
- Invalid rows are reported as dead letters or errors.
- Re-uploading same file is idempotent.

### QA-UI-008 - Integrations Page Smoke

Open `/settings/integrations`.

Pass criteria:

- Page renders without crash.
- WithOne connection UI state is understandable when backend/env is not configured.
- No secret values appear in UI.
- Any connection action either succeeds or returns controlled error.

## Visual And Responsive QA

Test at these viewport sizes:

- Desktop: `1440x900`
- Laptop: `1280x800`
- Tablet: `768x1024`
- Mobile: `390x844`

Required pages:

- `/`
- `/reservations`
- `/settings/integrations`

Pass criteria:

- No horizontal overflow on mobile.
- Dialog fits viewport and scrolls if needed.
- Table remains usable or gracefully scrolls.
- Buttons and inputs are reachable by keyboard.
- Text contrast remains readable in current theme.

## Accessibility QA

Minimum checks:

- Keyboard can open/close `New Reservation` dialog.
- Escape closes dialog.
- Tab order is logical inside dialog.
- File input has visible label.
- Switch has understandable adjacent text.
- Focus is not lost after tab switching.

Pass criteria:

- No keyboard traps.
- Dialog focus management works.
- Form controls are labeled well enough for screen readers.

## Security And Data Exposure QA

Check API and UI responses for:

- Room passcodes.
- Database URLs.
- API keys.
- WithOne secrets.
- Google credentials.
- Webhook secrets.

Pass criteria:

- No secrets are exposed in browser, API JSON, console logs, screenshots, or error messages.
- CORS rejects unapproved production origins if configured.
- Webhook route rejects unsigned/invalid payloads when secret is configured.

## Negative Testing Matrix

Run these negative cases and capture status/body:

| Test | Endpoint / UI | Expected |
|---|---|---|
| Missing dryRun | `/api/ingest/reservations` | HTTP 400 validation error |
| Non-boolean dryRun | `/api/ingest/listings` | HTTP 400 validation error |
| Missing sourceAccount | ingest endpoints | HTTP 400 validation error |
| Unsupported sourceType | ingest endpoints | HTTP 400 validation error |
| Malformed CSV | CSV upload | Controlled error, no crash |
| Unsupported pipeline mode | `/api/ingest/pipeline/run` | HTTP 400 validation error |
| Email mode missing connectionKey | `/api/ingest/pipeline/run` | HTTP 400 config error |
| WithOne unsupported platform | `/api/one/connections` | HTTP 400 validation error |
| WithOne webhook missing signature | `/api/one/webhook` | HTTP 401 when secret configured |
| Backend offline | frontend pages | Controlled loading/error state, no blank app |

## Required Final QA Report

QA agent must produce a markdown report under `docs/qa/` or `dogfood-output/` with:

1. Executive summary.
2. Environment details.
3. Commands run and exact pass/fail outcomes.
4. Test matrix with every QA ID above.
5. Defects found, ordered by severity.
6. Screenshots/videos paths for UI defects.
7. API response snippets for backend defects.
8. Clear final recommendation:
   - `PASS`
   - `PASS WITH KNOWN GAPS`
   - `FAIL`

## Release Gate

Do not mark implementation ready until all are true:

- `npm run typecheck` passes.
- `npm run build` passes.
- `cd backend && npm run build` passes.
- `cd backend && npm run db:generate` passes.
- `cd backend && npm run db:validate` passes.
- `cd backend && npm run db:verify:migration` passes.
- `cd backend && npm run verify-ingestion` passes or every failure is classified as environment-only with evidence.
- UI smoke tests pass for `/`, `/reservations`, and `/settings/integrations`.
- Reservation CSV upload is verified in dry-run mode and one QA-safe real run.
- WithOne routes are verified for validation/security behavior.
- No secrets are exposed.
- Manual reservation creation gap is documented and accepted.
