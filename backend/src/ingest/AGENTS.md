# Ingestion Pipeline Guide

## Rules
- `dryRun` is mandatory for ingest endpoints; reject missing or non-boolean values.
- Normalize before writing. Parser ambiguity must dead-letter or skip, not create rooms/properties.
- Keep provider-specific identifiers, raw statuses, and raw payloads at provider edge.
- Use `provider_reservation_import_rows` for import traceability.
- Preserve `legacy_guest_reservation_backfills` compatibility when bridging guest-labeled surfaces.
- Keep `routes.ts` thin: request validation, upload parsing, service dispatch, response status.
- Use `watched_files.target_kind` for folder-watch routing. Do not infer target kind from filename prefixes.
- `M_MANAGEMENT_WATCH_DIR` is a deprecated alias; prefer `M_MANAGEMENT_IMPORT_ROOT`.
- Listing imports must not create inventory unless `M_MANAGEMENT_LISTINGS_CREATE_INVENTORY=true` is explicitly set for trusted seed flows.
