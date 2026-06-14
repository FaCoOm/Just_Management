# QA Walkthrough Report — Just Management Application (2026-06-11)

**Validation Date**: 2026-06-11
**Branch**: `main`
**Validation Targets**: `docs/status.md` & `docs/qa/withone-sheets-default-handoff-2026-06-11.md`
**Status**: All QA scenarios executed and verified **PASS**.

---

## QA Scenarios Execution Summary

| Scenario | Title / Description | Status | Validation Result & Evidence |
|---|---|---|---|
| **S1** | Backend builds clean (`cd backend && npm run build`) | **PASS** | Completed without compile/Prisma errors. Prisma Client generated. |
| **S2** | Backend unit tests pass (`cd backend && npm test`) | **PASS** | `tests 11`, `pass 11`, `fail 0`. OTA email parsers & Tax Export suites green. |
| **S3** | Frontend typecheck clean (`npm run typecheck`) | **PASS** | Exit code 0, no compilation errors. |
| **S4** | verify-ingestion full run (`npm run verify-ingestion`) | **PASS** | All verification scenarios executed successfully (WithOne auth validation returned HTTP 400 + connectionKey error). |
| **S5** | Live API smoke test (missing connectionKey validation) | **PASS** | Returned HTTP 400 with `CONFIG_AUTH_FAILURE` for `connectionKey` field on POST. |
| **S6** | Legacy direct mode regression test | **PASS** | Returned HTTP 200 with `CONFIG_AUTH_FAILURE` for `credentials` field, verifying direct mode fallback. |
| **S7** | Pipeline status response validation | **PASS** | Returned HTTP 200, status shape verified, no private keys leaked. |
| **S8** | Frontend dashboard walkthrough & layout inspection | **PASS** | Verified 11 dashboard pages loading successfully. BookingsPanel visible at xl breakpoint. |

---

## Detailed Scenario Findings

### S1: Backend Builds Clean
The build script runs Prisma generation and type-checks the Express backend:
- Command: `npm run build` inside `backend/`
- Output: 
  ```text
  Generated Prisma Client (v6.19.3)
  TypeScript compiling clean with 0 TS errors
  ```

### S2: Backend Unit Tests
All 11 unit and integration tests passed:
- OTA Email Parsers (Airbnb, Booking.com, Agoda, Generic, selection logic) - **Pass**
- WithOneProviderConnector Mocking (status checks, sheet updates) - **Pass**
- Tax Export Orchestrator & Integration Service - **Pass**

### S4: Ingestion Verification Harness
Ran configuration checks and import dry-runs:
- Google Sheets WithOne Validation test successfully caught the missing connection key, throwing:
  ```json
  "errors": [
    {
      "code": "CONFIG_AUTH_FAILURE",
      "field": "connectionKey",
      "message": "connectionKey is required when INGEST_SHEETS_PROVIDER=withone."
    }
  ]
  ```

### S5: Live API Smoke Test
Triggered POST request manually via Node.js fetch tool:
- Status: `400`
- Response: `CONFIG_AUTH_FAILURE` pointing to `connectionKey` field, confirming WithOne default handler is active.

### S6: Legacy Direct Mode Regression
Flipped provider to `google-sheets-direct` and run the endpoint on port 3567:
- Status: `200`
- Response:
  ```json
  "errors": [
    {
      "code": "CONFIG_AUTH_FAILURE",
      "field": "credentials",
      "message": "Google Sheets integration requires a readable service-account credential file."
    }
  ]
  ```
Proves the request reached the legacy service-account path instead of WithOne.

### S7: Pipeline Status API
Checked connector scaffold:
- Output contains the 5 expected connectors: `admin-upload`, `folder-watch`, `email`, `built-in`, `google-sheets`.
- Verified that no sensitive credentials (`live::...`) were leaked in the json output.

### S8: Frontend Dashboard Walkthrough
Validated rendering of all pages:
- Dashboard layout splits nicely on screens wider than `xl` (1440px width verified), showing the `BookingsPanel` alongside main metrics.
- The property filter updates UI data correctly (e.g. updating arrivals/departures to filter by property).
- Rate Manager grid, Housekeeping board, and Tax Export settings loaded dynamically from the backend DB.

---

## Walkthrough Recording Location
The complete interactive walkthrough of the user interface was captured and saved locally at:
`C:\Users\Fate_Conqueror\.gemini\antigravity\brain\c9f2eeae-b6ba-4fd4-8282-f75229fb1b04\recording.webm`
