# QA Handoff: Rooms SoT + Reservations Replace-Mode (2026-06-12)

**Status**: Implementation complete. Awaiting QA pass by user + agents.
**Branch**: `main`
**Commits in scope**:

- `7211eee feat(rooms): codify 45-room source-of-truth and idempotent seed`
- `c77bb0d feat(ingest): add replaceMode flag for reservations sync`
- `c854717 test(fixtures): align hospitality fixtures with rooms SoT`

---

## Goal of this work

The user asked for five things:

1. Validate the database mapping against the recently updated `docs/database_design/*.csv`.
2. Establish a Source of Truth (SoT) for accommodation. 45 rooms across 8 properties, sourced from `docs/database_design/Room Types.md`.
3. Validate the WithOne `ONE_CONNECTION_KEY` connection for Google Sheets/Drive.
4. Streamline reservation syncing so providing a `reservations.csv` can drop previous data atomically.
5. Poke holes for optimization and business-logic correctness.

Everything except item 3's live-OAuth handshake is delivered. Item 3 returned a clean 401 from WithOne (token not authorized) - that is an external auth state, not a bug.

---

## What changed

### 1. Rooms Source of Truth (commit `7211eee`)

- New file `backend/src/lib/rooms-source-of-truth.ts`.
- Defines 8 canonical properties and 45 rooms, with type codes resolved against the Notion Room Standards data source (`480a2381-4334-4119-8b8a-e0b7456d26e5`).
- A compile-time guard pins the total to 45.
- `Room Types.md` is now tracked in git for the first time. Header counts match the table contents (Mujo 19 = 7, The Alley = 4). Code adjustments: `1.2 -> 3.2` (MH/Kitchen, Ruby 3), `1.3 -> 3.3` (Alley 1), `Coffee 1 / Milk 1` demoted from code 1 to code 2 because the Standard label takes priority over the code.
- New script `backend/scripts/seed-rooms-sot.ts`, idempotent, two modes:
  - `npm run seed:rooms-sot` (no flag) - read-only `--check`, prints the create/update plan and exits 1 on drift.
  - `npm run seed:rooms-sot -- --apply` - writes via property + room upsert.
  - Refuses to mutate Azure databases without `JM_ROOMS_SOT_AZURE_OK=1` env opt-in.

### 2. Reservations replace-mode (commit `c77bb0d`)

- `POST /api/ingest/reservations` now accepts `replaceMode` (boolean in JSON, `"true"` string in multipart).
- When set, the (airbnb, sourceAccount) reservation scope is wiped before importing. FK cascade clears `reservation_external_refs`, `reservation_room_allocations`, `legacy_guest_reservation_backfills`.
- Tax-export safety: if any `tax_export_items` reference reservations in the delete scope, the service refuses the wipe and the route returns HTTP 409 with `REPLACE_BLOCKED_BY_TAX_EXPORT`. The user must clear the blocking tax-export job before retrying.
- `replaceMode + dryRun` rejected at the route with HTTP 400; preview is meaningless for a destructive op.
- Existing upsert behaviour unchanged when `replaceMode` is absent or false.

### 3. Test fixtures aligned (commit `c854717`)

- `backend/src/test/fixtures/hospitality.ts` and `src/test/fixtures/hospitality.ts` now use SoT slugs/names/counts for the small mock set.
- Backend 11/11, frontend 7/7 still pass.

---

## Verification already completed

| Gate | Command | Result |
|---|---|---|
| Backend build | `cd backend && npm run build` | exit 0 |
| Backend tests | `cd backend && npm test` | 11/11 pass |
| Frontend typecheck | `npm run typecheck` | exit 0 |
| Frontend tests | `npm run test:frontend` | 7/7 pass |
| Ingestion pipeline | `cd backend && npm run verify-ingestion` | All scenarios green |
| Rooms SoT plan | `cd backend && npm run seed:rooms-sot` | Drift detected: create=13, update=32, total=45 |
| WithOne live status | `GET /api/integrations/status` | 200 OK, `disconnected`, WithOne 401 (token not authorised) |
| CSV header bytes | `[System.IO.File]::ReadAllBytes(...)[0..31]` | `ID,Title,...` for listings, `"Confirmation code",...` for reservations. No BOM, no comment line. |

---

## QA scenarios for the user + assigned agents

Each scenario has a literal command and a binary observable.

### S1 - Backend builds clean

```bash
cd backend
npm run build
```

Pass: exit 0, "Generated Prisma Client" success line, no `tsc` errors.

### S2 - Frontend typecheck clean

```bash
npm run typecheck
```

Pass: exit 0.

### S3 - All tests pass

```bash
cd backend && npm test
cd .. && npm run test:frontend -- --run
```

Pass: backend 11/11, frontend 7/7.

### S4 - Rooms SoT check (read-only)

```bash
cd backend
npm run seed:rooms-sot
```

Pass: prints "Total rooms expected: 45" and a per-property plan that sums to 45. Exits non-zero only if drift exists. The current Azure DB shows drift (create=13, update=32) which is expected.

### S5 - Rooms SoT apply (production sync, requires explicit opt-in)

```bash
cd backend
$env:JM_ROOMS_SOT_AZURE_OK = "1"
npm run seed:rooms-sot -- --apply
Remove-Item Env:JM_ROOMS_SOT_AZURE_OK
```

Pass: prints "SoT inventory size: 45 rooms across 8 properties." with no error lines. Re-run S4 afterwards: should print "ok=N" totals with create=0 update=0.

NOTE: this MUTATES the Azure DB. Run only when you are ready.

### S6 - Reservation upsert mode (regression)

Start the backend on port 3201 in a separate terminal:

```bash
cd backend
$env:PORT = "3201"
npm run dev
```

Then in another terminal:

```bash
curl -X POST http://127.0.0.1:3201/api/ingest/reservations `
  -F "sourceAccount=airbnb-main" `
  -F "dryRun=true" `
  -F "file=@backend/fixtures/Reservations-happy.csv;type=text/csv"
```

Pass: HTTP 200, body contains `"dryRun": true`, `"processed": 4`, no `replaceMode` errors. This proves the upsert path is unaffected.

### S7 - Reservation replace-mode + dryRun is rejected

```bash
curl -X POST http://127.0.0.1:3201/api/ingest/reservations `
  -F "sourceAccount=airbnb-main" `
  -F "dryRun=true" `
  -F "replaceMode=true" `
  -F "file=@backend/fixtures/Reservations-happy.csv;type=text/csv"
```

Pass: HTTP 400, body contains an error with `"code": "MISSING_DRY_RUN"` and `"field": "replaceMode"`. Proves the safety guard.

### S8 - Reservation replace-mode happy path (mutates DB)

```bash
curl -X POST http://127.0.0.1:3201/api/ingest/reservations `
  -F "sourceAccount=airbnb-main" `
  -F "dryRun=false" `
  -F "replaceMode=true" `
  -F "file=@backend/fixtures/Reservations-happy.csv;type=text/csv"
```

Pass: HTTP 200, body has `"replaceMode"` semantics applied (the existing reservations for `airbnb-main` are wiped before the file is re-imported). If any `tax_export_items` exist for the in-scope reservations, expect HTTP 409 with `REPLACE_BLOCKED_BY_TAX_EXPORT` instead - clear the blocking tax-export job first and retry.

### S9 - WithOne integration status

```bash
curl http://127.0.0.1:3201/api/integrations/status
```

Pass: HTTP 200 with `{"status": "disconnected", "provider": "withone", "error": "..."}`. The `error` field will say "Authentication required" until the underlying WithOne Gmail/Drive token is authorised. The connection key is configured; what is missing is the user-side OAuth grant.

### S10 - Frontend dashboard regression (optional, manual)

```bash
npm run dev:all
```

Open `http://localhost:5173`, walk `/`, `/reservations`, `/dashboard`, `/rooms`, `/rooms/types`, `/rooms/availability`. Expect: pages render with no console errors and `/api/reservations`, `/api/rooms` both return 200. After running S5, the rooms pages should show the new 45-room inventory across the 8 SoT properties.

---

## Known cleanup items

- Unrelated single-line `.gitignore` drift (`+.omo`) from a prior session was not authored here and is not staged. The `.omo/plans/track-b-*.md` and `.omo/tasks/T-*.json` files remain untracked across this session - decision still pending from earlier handoff.
- `docs/database_design/listings.csv` and `docs/database_design/reservations.csv` show as modified in `git status`. These are user-authored content and were not touched by this session. Confirm before committing.
- The legacy `backend/scripts/seed.ts` still references the old property names (Mujo Saigon, Ruby Da Nang, etc). It is not used in the SoT flow and can stay until the next dedicated cleanup pass.

---

## Reviewer checklist

- [ ] S1 backend build green.
- [ ] S2 frontend typecheck green.
- [ ] S3 all tests pass: 11/11 backend, 7/7 frontend.
- [ ] S4 SoT plan is exactly 45 rooms across 8 properties.
- [ ] S5 (when ready) applies cleanly and a follow-up S4 shows zero drift.
- [ ] S6 standard ingest still upserts.
- [ ] S7 replace + dryRun is rejected at 400.
- [ ] S8 (when ready) replace happy path returns 200 OR 409 with the documented payload.
- [ ] S9 integration status surfaces the WithOne 401 honestly.
- [ ] S10 (optional) dashboard renders the 45-room inventory.
- [ ] Legacy `.gitignore` drift handled out of band.
