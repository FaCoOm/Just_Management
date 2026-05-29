# Reservations Sync Architecture Design

## Scope

Finalise Track B listing/reservation folder-watch ingestion by replacing one flat watch directory plus filename-prefix inference with one import root and target-specific subfolders.

## Approved watcher layout

```text
M_MANAGEMENT_IMPORT_ROOT/
  listings/
    inbox/
    processed/
    quarantine/
  reservations/
    inbox/
    processed/
    quarantine/
```

`M_MANAGEMENT_WATCH_DIR` remains a deprecated alias for one release, but new documentation and status output should prefer `M_MANAGEMENT_IMPORT_ROOT`.

## Design decisions

- Target kind comes from subfolder path, not filename prefix.
- Watcher only fingerprints files into `watched_files`; it does not write business tables.
- `folder-watch` pipeline runs execute ingestion and then move files to `processed/` or `quarantine/`.
- `watched_files.target_kind` stores the resolved target kind for durable routing.
- `provider_reservation_import_rows` records reservation import traceability before resolution.
- Listing imports do not create inventory by default; `M_MANAGEMENT_LISTINGS_CREATE_INVENTORY=true` is required for trusted seed flows.
- Ingest modules share a single Prisma client from `backend/src/lib/prisma.ts`.

## Verification expectations

- `cd backend && npm run db:generate`
- `cd backend && npm run db:validate`
- `cd backend && npm run build`
- `npm run typecheck`
- `npm run build`
