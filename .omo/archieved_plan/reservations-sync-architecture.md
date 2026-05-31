# Reservations Sync Architecture Implementation Plan

**Goal:** Finalise reservations sync architecture and revise watched-folder design.

**Architecture:** Single M_MANAGEMENT_IMPORT_ROOT; subfolders per target kind; watcher wired at startup; reservation import traceability; shared Prisma singleton; listing auto-create guarded by env flag.

**Tech Stack:** Node.js, Express, Prisma 6, PostgreSQL, chokidar, TypeScript

**Spec:** docs/superpowers/specs/2026-05-28-reservations-sync-architecture-design.md

**Worktree:** C:/Users/Fate_Conqueror/.config/superpowers/worktrees/Just_Management/feature-reservations-sync-architecture

---

## TODOs

### Task 1: Prisma singleton extraction

- [x] Create backend/src/lib/prisma.ts exporting a single PrismaClient instance
- [x] Replace const prisma = new PrismaClient() in listings.ts with import from ../lib/prisma
- [x] Replace const prisma = new PrismaClient() in reservations.ts with import from ../lib/prisma
- [x] Replace const prisma = new PrismaClient() in watchers/folder.ts with import from ../../lib/prisma
- [x] Replace inline const prisma = new PrismaClient() in routes.ts with import from ../lib/prisma
- [x] Run cd backend && npm run build -- must pass

### Task 2: Schema migration -- watched_files target_kind + composite index

- [x] Add target_kind String field with default unknown to watched_files model in schema.prisma
- [x] Add composite index on (watch_dir, target_kind, status, last_seen_at) to watched_files model
- [x] Write migration SQL file at backend/prisma/migrations/20260528000000_watched_files_target_kind/migration.sql
- [x] Run cd backend && npm run db:generate -- must pass
- [x] Run cd backend && npm run db:validate -- must pass
- [x] Run cd backend && npm run build -- must pass

### Task 3: Watched folder redesign -- subfolder layout + M_MANAGEMENT_IMPORT_ROOT

- [x] Add M_MANAGEMENT_IMPORT_ROOT env var to pipeline.ts; keep M_MANAGEMENT_WATCH_DIR as deprecated alias
- [x] In watchers/folder.ts: watch {importRoot}/listings/inbox and {importRoot}/reservations/inbox
- [x] In recordWatchedFile(): accept explicit targetKind param from subfolder; store in watched_files.target_kind
- [x] In startFolderWatcher(): auto-create inbox/processed/quarantine subfolders using fs.mkdirSync recursive
- [x] Remove inferTargetKind() from watchers/folder.ts
- [x] Update backend/.env.example: add M_MANAGEMENT_IMPORT_ROOT, mark M_MANAGEMENT_WATCH_DIR deprecated
- [x] Run cd backend && npm run build -- must pass

### Task 4: Wire startFolderWatcher() into backend startup

- [x] Import startFolderWatcher from ./ingest/watchers/folder in backend/src/index.ts
- [x] Call startFolderWatcher() after app.listen() callback
- [x] Run cd backend && npm run build -- must pass

### Task 5: Update pipeline/run folder-watch route to use target_kind column

- [x] In folder-watch mode handler in routes.ts: query watched_files by target_kind=targetKind AND status=seen
- [x] Remove hardcoded targetPrefix regex from routes.ts
- [x] On successful file processing: move file from inbox/ to processed/ using fs.rename
- [x] On failed file processing: move file from inbox/ to quarantine/
- [x] Update pipeline status connector detail to reflect new subfolder design
- [x] Run cd backend && npm run build -- must pass

### Task 6: Reservation import traceability -- write provider_reservation_import_rows

- [x] Before resolution loop in reservations.ts: insert provider_reservation_import_rows row per source row with resolution_status=pending
- [x] After resolution: update row to resolution_status=resolved and set reservation_id
- [x] On dead-letter: update row to resolution_status=unresolved with resolution_notes
- [x] Run cd backend && npm run build -- must pass

### Task 7: Listing auto-create guard

- [x] Read M_MANAGEMENT_LISTINGS_CREATE_INVENTORY env flag (default false) in listings.ts
- [x] If flag false and property/room missing: dead-letter instead of creating
- [x] Add M_MANAGEMENT_LISTINGS_CREATE_INVENTORY=false to backend/.env.example with comment
- [x] Run cd backend && npm run build -- must pass

### Task 8: Update verify-ingestion and docs

- [x] Update verify-ingestion.ts pipeline status test for new subfolder connector detail
- [x] Update backend/src/ingest/AGENTS.md: document M_MANAGEMENT_IMPORT_ROOT, subfolder layout, target_kind
- [x] Update docs/ingestion-sync-reference.md section 2 for new folder design
- [x] Run cd backend && npm run build -- must pass

### Task 9: Full verification pass

- [x] Run cd backend && npm run db:generate && npm run db:validate && npm run build
- [x] Run npm run typecheck from repo root
- [x] Run npm run build from repo root
- [x] Confirm no new TypeScript errors introduced

## Final Verification Wave

- [x] F1: Backend build clean -- cd backend && npm run build exits 0
- [x] F2: Frontend typecheck clean -- npm run typecheck exits 0
- [x] F3: Schema valid -- cd backend && npm run db:validate exits 0
- [x] F4: AGENTS.md and docs updated to reflect new design