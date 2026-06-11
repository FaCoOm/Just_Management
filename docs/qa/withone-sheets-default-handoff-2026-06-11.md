# QA Handoff: WithOne-Default Google Sheets Ingestion (2026-06-11)

**Status**: Implementation complete and Oracle-verified. Awaiting QA pass by user + agents.
**Branch**: `main`
**Commits in scope**:

- `2f9033d feat(ingest): default Google Sheets provider to WithOne passthrough`
- `af1a694 test(ingest): exercise WithOne Sheets path in verify-ingestion`
- `17fe974 docs(ingest): reconcile WithOne-default Sheets provider stance`

---

## What Changed

The Google Sheets ingestion provider now defaults to WithOne unified passthrough (`INGEST_SHEETS_PROVIDER=withone`) at three layers:

1. `backend/.env.example` documented default flipped to `withone`. Service-account credential vars demoted to a commented legacy fallback.
2. Runtime fallbacks aligned in `backend/src/ingest/routes.ts:387` and `backend/src/config/env-validator.ts:53`.
3. Legacy direct mode (`google-sheets-direct`) remains reachable when explicitly selected. Validator still warns when service-account file is missing in that mode.

Backend verification harness was extended:

- `backend/scripts/verify-ingestion.ts` now spawns the server with `INGEST_SHEETS_PROVIDER=withone`.
- New deterministic test asserts HTTP 400 + `CONFIG_AUTH_FAILURE` + `field=connectionKey` when WithOne mode receives no `connectionKey` in the request body.
- Optional live happy-path activates only when `ONE_CONNECTION_KEY`, `ONE_SECRET_KEY`, and `GOOGLE_SHEETS_SPREADSHEET_ID` are all set to non-placeholder, trimmed values.

Documentation reconciled across four files:

- `docs/m-management-ingestion-pipeline.md` env-var table + Google Credential Association section.
- `docs/plans/m-management-ingestion-pipeline-implementation-plan.md` route-level env description.
- `docs/plans/qa-testing-stack-implementation-2026-06-09.md` integration row + key-contracts bullet.
- `docs/analysis/ingestion-implementation-summary-report.md` env example comment.

---

## QA Scenarios

Each scenario lists the surface, the literal command, and the binary observable. Run from repo root unless noted.

### S1: Backend builds clean

```bash
cd backend
npm run build
```

Pass condition: exit 0, "Generated Prisma Client" success line, no `tsc` errors.

### S2: Backend unit tests pass

```bash
cd backend
npm test
```

Pass condition: `tests 11`, `pass 11`, `fail 0`. WithOneProviderConnector and Tax Export integration suites must remain green.

### S3: Frontend typecheck clean

```bash
npm run typecheck
```

Pass condition: exit 0, no `tsc` errors.

### S4: verify-ingestion full run

```bash
cd backend
npm run verify-ingestion
```

Pass condition: final line is `✅ All verification scenarios executed successfully.` and exit 0. Specifically the new "Google Sheets WithOne Validation" step must show `Status: 400` and the response body must include `"code": "CONFIG_AUTH_FAILURE"`, `"field": "connectionKey"`. The "Skipping Live WithOne Sheets Test" message must appear (placeholder credentials present).

### S5: Live API smoke (manual, server already running)

Start the server (port 3001):

```bash
cd backend
npm run dev
```

In a second terminal:

```bash
curl -s -X POST http://localhost:3001/api/ingest/google-sheets `
  -H "Content-Type: application/json" `
  -d '{"dryRun":true,"sourceAccount":"airbnb-main","sourceType":"google-sheets","spreadsheetId":"any","targetKind":"listings"}' `
  -w "`nHTTP %{http_code}`n"
```

Pass condition: `HTTP 400` and the JSON response contains:

```json
"errors": [
  {
    "code": "CONFIG_AUTH_FAILURE",
    "field": "connectionKey",
    "message": "connectionKey is required when INGEST_SHEETS_PROVIDER=withone."
  }
]
```

### S6: Legacy direct mode regression

In a separate shell, with backend running:

```bash
$env:INGEST_SHEETS_PROVIDER = "google-sheets-direct"
cd backend
npm run dev
```

In a second terminal:

```bash
curl -s -X POST http://localhost:3001/api/ingest/google-sheets `
  -H "Content-Type: application/json" `
  -d '{"dryRun":true,"sourceAccount":"airbnb-main","sourceType":"google-sheets","spreadsheetId":"any","targetKind":"listings"}'
```

Pass condition: response status is 200 and body contains `CONFIG_AUTH_FAILURE` with `field: "credentials"` (not `connectionKey`), proving the request reached the legacy direct service path. Restore `INGEST_SHEETS_PROVIDER=withone` after.

### S7: Pipeline status shape unchanged

```bash
curl -s http://localhost:3001/api/ingest/pipeline/status | ConvertFrom-Json | Select-Object phase, enabled
```

Pass condition: `phase=scaffolded`, `enabled=True`, the response includes a `connectors` array with five entries (`admin-upload`, `folder-watch`, `email`, `built-in`, `google-sheets`). No private credential material in the response (Test 8 in `verify-ingestion` already enforces this).

### S8: Frontend dashboard regression (optional, manual)

```bash
npm run dev:all
```

Open `http://localhost:5173` and walk through `/`, `/reservations`, `/dashboard`. Pass condition: pages render without console errors and `/api/reservations` returns 200 with rows.

---

## What Is Live-Verified vs Not

**Live-verified during implementation**

- All deterministic backend assertions in S1, S2, S3, S4, S7.
- The route returns 400 + `CONFIG_AUTH_FAILURE` + `field=connectionKey` (S5 equivalent ran inside `verify-ingestion`).

**Not live-verified, requires action**

- The full live happy-path through WithOne to a real Google spreadsheet. Blocked on a real, non-placeholder `ONE_CONNECTION_KEY` (current `.env` holds `conn_dev_replace_me`). Once a real AuthKit-issued connection key lands, run:

  ```bash
  $env:ONE_CONNECTION_KEY = "<real key>"
  $env:ONE_SECRET_KEY = "<real secret>"
  $env:GOOGLE_SHEETS_SPREADSHEET_ID = "<sheet id>"
  cd backend
  npm run verify-ingestion
  ```

  The "Live WithOne Sheets Test" step must run and produce `Status: 200` with `processed >= 1` and an empty `errors` array.

- A browser walkthrough across breakpoints by a human reviewer (S8 above).

---

## Known Cleanup Items (out of scope for this handoff)

- `.gitignore` has an unrelated single-line drift (`+.omo`) that I did not author. Recommend a separate one-line revert before any future commit. Does not affect tracked files.
- 26 untracked `.omo/plans/track-b-*.md` and `.omo/tasks/T-*.json` from prior sessions remain undecided. They are agent scratch and currently gitignored under `.omo/run-continuation/` only; the rest of `.omo/` is tracked.
- Live secret rotation (`DATABASE_URL` Azure password and `ONE_SECRET_KEY`) remains pending from the prior handoff because both values appeared in earlier transcripts. Out-of-band action.

---

## Reviewer Checklist

- [ ] S1, S2, S3 pass.
- [ ] S4 prints the green completion line and the WithOne validation step shows the 400 + CONFIG_AUTH_FAILURE response.
- [ ] S5 manual curl returns the documented 400 body.
- [ ] S6 confirms legacy direct mode is still selectable via explicit env override.
- [ ] S7 pipeline status has no credential leakage.
- [ ] (Optional) S8 frontend walkthrough has no console errors and the dashboard renders data.
- [ ] No regressions surface in the existing dashboard or tax-export suites.
- [ ] Once real WithOne credentials are available, the live happy-path verification produces `Status: 200`.
