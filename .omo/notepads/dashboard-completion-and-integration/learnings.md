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
## 2026-06-01 Task 1 (Tasks 29-31: WithOne-first Gmail/Sheets fallback pipeline)
- Implemented complete `WithOneProviderConnector` with full `listEmails()` that fetches message details (subject, from, date) via WithOne Gmail passthrough.
- Added `appendSheetRows()` with idempotency-key-aware upsert: fetches existing sheet rows, maps key column, separates updates from appends, and performs batch append + individual updates.
- Created OTA parser registry with `registerOtaParser()`, `getOtaParsers()`, `findParserForEmail()` for runtime extensibility.
- Built-in parsers: `airbnbParser` (confirmation codes like HM-ABC123, guest name, dates, amount), `bookingComParser` (numeric confirmation codes, property name), `agodaParser` (booking IDs), `genericParser` (fallback that extracts any confirmation-like code).
- Each parser implements `canParse(from, subject)` for provider detection and `parseEmail()` for structured extraction into `ParsedOtaData`.
- Sheets upsert uses action IDs from WithOne connector module: `SHEETS_APPEND_ACTION_ID` for append/update operations, `SHEETS_GET_ACTION_ID` for reading existing values.
- Backend build verified: `cd backend && npm run build` passes with no TypeScript errors.
- Fallback modes available: WithOne connection via `ONE_SECRET_KEY` + `connectionKey`, direct Google service-account can be added as alternative connector implementing same `ProviderConnector` interface, disabled/no-credentials mode returns empty results or throws `OneConfigError`.


## 2026-06-01 Task 5 (Task 38: Sheet mapping UI verification)
- Verified Tax & Compliance sheet settings UI is fully implemented with `sheet_id`, `sheet_tab`, and `template_columns` JSON inputs.
- Backend routes (`PUT /api/tax-export/settings`) properly accepts and persists all three fields to database.
- Frontend `handleSaveSettings()` correctly sends all fields including parsed `template_columns` JSON.
- UI labels use WithOne-appropriate wording: "Destination spreadsheet identifier only. No write action yet." and "Tab name for future upsert target."
- Settings are displayed in summary section showing `sheet_id` and `sheet_tab` values or "Not set".
- Frontend typecheck passes, frontend build passes (14.84s), backend build passes.
- No changes needed - implementation was already complete and correct.

## 2026-06-08 Task 2 (Test fixtures and factories)
- Backend reusable fixtures now live in `backend/src/test/fixtures/hospitality.ts` and emit Prisma unchecked-create shapes plus Track B REST DTO mirrors for properties, rooms, reservations, guest compatibility views, maintenance, channels/accounts, provider refs/import rows, and tax-export jobs/items/settings.
- Frontend reusable fixtures now live in `src/test/fixtures/hospitality.ts` and emit hook/repository-facing `Property`, `Room`, `Reservation`, `Guest`, `MaintenanceIssue`, channel/account, and tax-export page response shapes.
- Fixture reservations remain booking source of truth; guest fixtures derive from reservations for dashboard compatibility instead of treating legacy guests as canonical booking data.
- Tax-export fixtures include same-day checkout (`2026-06-08`), confirmation-code refs (`HM123ABC`, `998877`), a missing-rate `needs_review` item, and an ambiguous-email/import-row case for later export tests.

## 2026-06-08 Task 1 (Test infrastructure and scripts)
- Frontend test infra uses `vitest run --passWithNoTests` plus `vitest.config.ts` with React plugin, `jsdom`, globals, `@` alias, and `src/test/setup.ts` importing `@testing-library/jest-dom/vitest`.
- Backend test infra uses Node built-in runner through `node --import tsx --import ./test/setup.ts --test` with explicit `*.test.ts`/`*.spec.ts` globs so no-tests state exits cleanly without treating setup as a test.
- Existing backend `src/test/fixtures` are support fixtures, not build source; backend `tsconfig.json` now excludes `src/test/**/*` from production build.

## 2026-06-08 Task 43 (Performance and pagination pass)
- Hotspot inspection found `src/components/check-in-out/check-in-out-page.tsx` was only audited page rendering unbounded heavy lists: all arrivals and all departures were mapped into `GuestCard` nodes at once.
- `src/components/guests/vip-guests-page.tsx` and `src/components/revenue/billing-invoices-page.tsx` already use TanStack pagination (`getPaginationRowModel`) with 12-row defaults, so render size was bounded there.
- Backend `/api/reservations` already supports optional `limit`/`page_size`/`pageSize`, `offset`/`page`, and `include_count`, but page-level hooks still need full reservation lists for current counts, search/filter UX, and export semantics.
- Check-in/out room/property lookups were per-card `Array.find()` calls; maps now make visible card lookup O(1) after bounded pagination.
