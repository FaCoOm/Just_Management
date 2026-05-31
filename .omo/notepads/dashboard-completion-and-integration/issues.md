## 2026-05-31 Task: init
- LSP diagnostics unavailable because `biome` not installed in environment.
- Chrome DevTools unavailable earlier due missing `DevToolsActivePort`; prefer Playwright/browser later if needed.
- `package-lock.json` has large diff and still needs separate review.

## 2026-05-31 Task 37
- Repo snapshot of `backend/src/tax-export/routes.ts` still shows explicit default-field updates only, so frontend now reports save mismatch if API response does not confirm `schedule_enabled`, `schedule_time`, and `schedule_timezone`.
- Schedule persistence gap closed by adding those three fields to backend update payload; mismatch fallback removed from frontend save path.
- Service-layer GET shape previously omitted `schedule_enabled`, `schedule_time`, and `schedule_timezone`; added all three to interface, default object, existing-row return, and created-row return.

## 2026-05-31 Task 42
- Current tax-export schema has no dedicated manual scope key column, so retry-safety tagging stayed backend-only by encoding deterministic scope into `tax_export_jobs.triggered_by`.
- Reuse guard only applies to future completed manual jobs created with scoped `triggered_by`; older plain `manual` rows remain historical and non-reused.

## 2026-05-31 Task 38
- Tax-export settings API previously had no schema support for sheet metadata; fixed by adding `sheet_id`, `sheet_tab`, and `template_columns` to Prisma model plus migration.
- Backend route update path must omit `template_columns` entirely when request does not include it; reusing stored Prisma JSON directly in update payload caused TypeScript `JsonValue` mismatch.
- Frontend settings save now fails fast on invalid mapping JSON instead of sending malformed payloads to backend.

## 2026-05-31 Task 38 runtime fix
- Backend log at `C:/Users/OLLYTR~1/AppData/Local/Temp/opencode/atlas-backend-3001.log` showed `P2022` on `tax_export_settings.sheet_id`, confirming missing live DB column as immediate cause of GET/PUT `500`.
- Previous migration `20260528000000_watched_files_target_kind` had partial side effects: column existed, index did not, and `_prisma_migrations.finished_at` was null.
- After creating missing index, marking that migration applied, and deploying pending migrations, direct GET and PUT to `/api/tax-export/settings` returned `200` with persisted sheet fields.
