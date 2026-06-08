## 2026-05-31 Task: init
- Task 39 accepted after manual review: dedicated review-queue UI exists on Tax & Compliance history tab.
- Task 41 scope should harden integrations dashboard UX, not expand into real Gmail/Sheets sync logic yet.

## 2026-05-31 Task 41
- Hardened integrations UX in `src/pages/settings/integrations-page.tsx` only. Kept fetch/mutation ownership in existing hooks and preserved current ingest endpoints and run behavior.

## 2026-05-31 Task 37
- Kept Task 37 surgical to `src/components/tax-export/tax-export-page.tsx`, extending local `TaxSettings` and reusing page-owned settings state instead of adding new hooks or backend changes.
- Follow-up fix stayed surgical too: updated `backend/src/tax-export/routes.ts` existing-row branch only, preserving default export field behavior while persisting schedule fields.
- Final acceptance fix stayed in `backend/src/tax-export/service.ts` only: aligned `TaxExportSettings` and `getOrCreateSettings()` response shape with Prisma schedule columns.

## 2026-05-31 Task 42
- Kept Task 42 backend-only and schema-free: added deterministic manual scope key in `backend/src/tax-export/service.ts`, stored as scoped `triggered_by`, and reused same-scope completed jobs instead of inserting duplicates.
- Route semantics now expose creation vs reuse directly: `POST /api/tax-export/run` returns `201` for new job and `200` for reused completed job.

## 2026-05-31 Task 38
- Chose additive schema path in `backend/prisma/schema.prisma` and new Prisma migration folder instead of frontend-only placeholders, because current schema truth had no sheet fields yet.
- Reused single existing tax-export settings card in `src/components/tax-export/tax-export-page.tsx` for both schedule and sheet metadata to keep schedule UI and review queue intact.
- Stored template mapping as plain JSON object in `template_columns`; frontend edits raw JSON text and backend normalizes to string-string map.

## 2026-05-31 Task 38 runtime fix
- Kept source code unchanged for runtime repair after log inspection proved failure came from unapplied DB schema, not route/service logic.
- Repaired Prisma migration history surgically in database instead of weakening Task 38 fields or adding fallback code for missing columns.

## 2026-06-08 Task 43 (Performance and pagination pass)
- Changed only `src/components/check-in-out/check-in-out-page.tsx` because it was the confirmed unbounded render hotspot; left already-paginated VIP and billing tables unchanged.
- Added local 10-row pagination to arrivals and departures boards to preserve existing cards/actions while preventing large DOM renders.
- Kept repository/backend contracts unchanged because endpoint pagination exists but switching hooks to server pagination would change current page counts, filtering, search, and export behavior beyond hardening scope.
