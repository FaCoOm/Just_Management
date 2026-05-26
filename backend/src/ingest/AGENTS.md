# Ingestion Pipeline Guide

## Scope
- `backend/src/ingest/` owns Track B spreadsheet and provider ingestion.
- Routes validate contracts; services reconcile provider data into Track B tables.

## Layout
- `contracts.ts` defines source accounts, source types, file limits, summaries, and validation error shapes.
- `parser.ts` parses internal names into deterministic property/room hints.
- `normalizer.ts` converts spreadsheet rows into listing/reservation source rows.
- `routes.ts` owns `/api/ingest/listings`, `/api/ingest/reservations`, `/api/ingest/google-sheets`, multipart parsing, and `dryRun` validation.
- `services/listings.ts` syncs listing rows.
- `services/reservations.ts` syncs reservation rows.
- `services/sheets.ts` fetches Google Sheets data.

## Rules
- `dryRun` is mandatory for ingest endpoints; reject missing or non-boolean values.
- Normalize before writing. Parser ambiguity must dead-letter or skip, not create rooms/properties.
- Keep provider-specific identifiers, raw statuses, and raw payloads at provider edge.
- Use `provider_reservation_import_rows` for import traceability.
- Preserve `legacy_guest_reservation_backfills` compatibility when bridging guest-labeled surfaces.
- Keep `routes.ts` thin: request validation, upload parsing, service dispatch, response status.

## Anti-Patterns
- Bypassing `normalizer.ts` and writing raw spreadsheet cells directly to core tables.
- Mixing provider-specific reconciliation logic into route handlers.
- Treating ambiguous parser output as permission to create inventory.
- Adding `multer` handling outside `routes.ts`.
- Mutating business tables during `dryRun`.

## Verification
```bash
npm run verify-ingestion
npm run verify:all
```

Run endpoint manually for changed ingest route behavior and inspect summary fields: `processed`, `created`, `updated`, `skipped`, `deadLetters`, `errors`.