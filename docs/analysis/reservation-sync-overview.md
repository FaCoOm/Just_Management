# Reservation sync overview

## Scope

This doc describes current reservation read path, current ingest and sync path, dry run rules, manual reservation limits, operator workflow, and next requirements for real manual creation.

Source files:

- `src/components/reservations/reservations-page.tsx`
- `src/hooks/use-page-data.ts`
- `src/lib/repositories/rest-repositories.ts`
- `backend/src/index.ts`
- `backend/src/ingest/routes.ts`
- `backend/src/ingest/services/reservations.ts`
- `src/pages/settings/integrations-page.tsx`

## Current frontend read path

Reservations page reads data through Track B REST layer, not direct DB access.

Flow:

1. `src/components/reservations/reservations-page.tsx` calls `useReservationsPageData()`.
2. `src/hooks/use-page-data.ts` creates REST repositories with `createRestRepositories()` and loads properties, rooms, and reservations.
3. `src/lib/repositories/rest-repositories.ts` maps `reservations.getAll()` to `GET /api/reservations`.
4. `backend/src/index.ts` serves `GET /api/reservations` from Prisma queries.

Current UI still uses compatibility view models where needed.

- `useReservationsPageData()` maps reservations to legacy `Guest` rows with `toDashboardGuest()`.
- Those guest rows power table labels such as status, booking source, and ETA or ETD formatting.
- This is compatibility only, not a second source of truth.

## Current write and sync path

Current booking persistence happens through CSV upload, not manual create.

Flow:

1. Operator uploads CSV or XLSX from Settings, Integrations, Manual CSV Upload.
2. Frontend sends multipart request to `POST /api/ingest/reservations` with `dryRun` and `sourceAccount`.
3. `backend/src/ingest/routes.ts` validates request, parses multipart file, and dispatches to reservation sync service.
4. `backend/src/ingest/services/reservations.ts` parses file with `parseSourceFile()` and `extractReservations()`.
5. Service opens DB work in transaction and syncs to core tables.

Tables and records touched during live sync:

- `sync_runs`
- `channels`
- `external_accounts`
- `reservations`
- `reservation_external_refs`
- `reservation_room_allocations`
- `sync_dead_letters`

Supporting lookup and resolution steps:

- parser and normalizer derive canonical reservation rows from raw file rows
- channel upsert uses Airbnb channel key in current service path
- external account upsert uses uploaded `sourceAccount`
- listing resolution checks `channel_listing_aliases` first, then `channel_listings`
- room and property resolution comes from linked listing room mappings
- unresolved or ambiguous rows become dead letters, not partial writes

## Dry run behavior

`dryRun` is mandatory on ingest endpoints.

Why:

- route validation rejects missing, non boolean, or malformed `dryRun`
- contract stays explicit, so operator must state intent
- live write path and preview path stay separate
- dry run must not mutate business tables

Behavior:

- live mode creates `sync_runs`, upserts channel and external account, writes reservation records, refs, allocations, and dead letters, then finalizes run counts
- dry run parses and summarizes rows without mutating DB tables
- dry run still reports created or skipped counts from parsed rows, but no persistence happens

## Manual reservation limit

There is no server side manual create endpoint for reservations yet.

Current state:

- `backend/src/index.ts` exposes `GET /api/reservations`
- no `POST /api/reservations` exists today
- reservations UI can collect booking intent, but it cannot persist a new manual reservation yet

Result:

- operators cannot create a reservation from UI into DB through a manual form path
- current persistence route remains CSV ingest only

## Operator workflow today

Current practical workflow for a new booking entry:

1. Open Reservations page.
2. Click the `New Reservation` affordance in the header.
3. Note that this is only a UI affordance right now, not a working persistence flow.
4. For actual database write, go to Settings, Integrations.
5. Use Manual CSV Upload.
6. Choose `reservations` as kind, choose source account, attach CSV or XLSX, leave `dryRun` on for preview, then run live only when ready.
7. Review summary, dead letters, and counts after upload.

## Future requirements for real manual creation

A real manual reservation path needs a dedicated reservation create endpoint and matching UI submit flow.

Minimum requirements:

- accept validated reservation fields from UI
- create reservation, external refs, and room allocation records in one transaction
- resolve or require property and room before write
- honor reservation status mapping used by current sync path
- write audit or sync metadata so manual records stay distinguishable from imported records
- return clear validation errors for missing listing, room, or date fields
- keep existing GET paths and compatibility guest mapping unchanged

## Verification commands

Use these checks after doc or ingest changes:

```bash
npm run typecheck
npm run build
cd backend && npm run build
cd backend && npm run verify-ingestion
cd backend && npm run verify:all
```

For route behavior changes, run backend and hit the affected endpoint to confirm actual status and summary output.
