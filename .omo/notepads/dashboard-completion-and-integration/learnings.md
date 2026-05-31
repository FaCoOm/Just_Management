## 2026-05-31 Task: init
- Frontend build passes with current tax-review UI and integrations health badge changes.
- Backend build passes with `/api/integrations/status` and tax-export reservation scoping.
- `src/hooks/AGENTS.md` says data hooks own fetch/query logic; page components should consume hooks, not build repository clients.
- Local runtime Prisma routes blocked without `backend/.env` `DATABASE_URL`.

## 2026-05-31 Task 41
- Added explicit withone guidance for `connected`, `disconnected`, `checking`, and unavailable fetch-failure states.
- Disconnect action now exposes pending button state and page-level error feedback without changing backend contracts.
- Manual pipeline run form now explains exact connection-key requirement: needed for `email` and `google-sheets`, not for `folder-watch` or `built-in`.

## 2026-05-31 Task 37
- Tax export schedule UI can stay page-local in `src/components/tax-export/tax-export-page.tsx`; existing settings fetch path and `PUT /api/tax-export/settings` call are enough for build-verifiable frontend wiring.
- Existing settings-row persistence needed explicit backend field passthrough for `schedule_enabled`, `schedule_time`, and `schedule_timezone` on `PUT /api/tax-export/settings`.
- `getOrCreateSettings()` also had to expose schedule fields or reloads would collapse back to default-only settings shape after successful saves.

## 2026-05-31 Task 42
- `runTaxExport()` can stay lean and manual-safe without cron by splitting scope derivation, completed-job reuse lookup, and normal preview/item creation inside one serializable transaction.
- Existing job items can be mapped back into `TaxExportItemPreview` shape, so reused runs return same payload contract as new runs plus explicit `runStatus` and `createdNewJob` metadata.

## 2026-05-31 Task 38
- Smallest real Task 38 slice needed three additive `tax_export_settings` columns only: `sheet_id`, `sheet_tab`, and `template_columns` JSON.
- Existing settings service/route flow from Tasks 37 and 42 was enough once GET DTO and PUT passthrough included those fields.
- Tax page can stay lean with plain inputs plus JSON textarea mapping editor; no drag/drop builder or sheet-write logic needed for build-verifiable scope.
- On this Windows workspace, Prisma engine DLL may stay locked by running Node processes, so `prisma generate --no-engine` can unblock type refresh when exact `npm run db:generate` fails with `EPERM`.

## 2026-05-31 Task 38 runtime fix
- `500` settings failures were not caused by JSON serialization code; backend log showed Prisma `P2022` because live `tax_export_settings` table was missing `sheet_id`.
- `db:deploy` was blocked by older partial migration state: `20260528000000_watched_files_target_kind` had added column `target_kind` in DB but never finished because index creation had not landed.
- Safe repair path was: create missing `watched_files_target_kind_idx`, mark that older migration applied, then run `npm run db:deploy` so only `20260531153000_add_tax_export_sheet_settings` applied.
