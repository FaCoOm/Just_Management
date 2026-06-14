# Implementation Plan — Dashboard Tests and Completion

Validate the current stage of implementation, set up test harnesses, and complete the remaining WithOne tax-export backend integration (Gmail search, parser registry, and Sheets writer) with tests and verification first.

## User Review Required

> [!IMPORTANT]
> We will connect the tax-export service flow to WithOne's Gmail and Google Sheets APIs. The following strategic decisions need confirmation:
> 1. **Google Sheets Idempotency**: If a reservation is modified or cancelled after being written to the sheet, should the app update/delete the row in Google Sheets (using the idempotency key), or keep the original record for tax audit compliance?
> 2. **Gmail Search Date Buffer**: Payment emails might arrive slightly before or after checkout (e.g. due to timezone differences or early payouts). Should Gmail search use a +/- 1 day buffer around the checkout date, or search only on the checkout date?
> 3. **Local Dev DB/WithOne keys**: We will use the configured Azure DB and WithOne keys for backend verification, but we need to ensure the local ports and CORS origins are aligned.

## Proposed Changes

### [Component 1] Integration & CORS Setup
Add `http://127.0.0.1:5173` to allowed CORS origins to resolve local dev connection issues.

#### [MODIFY] [index.ts](file:///c:/Users/Olly%20Troyfan/Documents/GitHub/Just_Management/backend/src/index.ts)
- Add `http://127.0.0.1:5173` to `DEFAULT_ALLOWED_ORIGINS`.

#### [MODIFY] [.env](file:///c:/Users/Olly%20Troyfan/Documents/GitHub/Just_Management/backend/.env)
- Append `http://127.0.0.1:5173` to `ALLOWED_ORIGINS` configuration.

---

### [Component 2] Backend Test Harness & Tests
Create robust mock/test infrastructure to test the WithOne API wrappers, parsers, and the tax-export orchestrator.

#### [NEW] [provider-connector.test.ts](file:///c:/Users/Olly%20Troyfan/Documents/GitHub/Just_Management/backend/src/test/provider-connector.test.ts)
- Unit tests for Gmail email retrieval (mocked `listMessages`, `getMessage`).
- Unit tests for OTA email parsers (Airbnb, Booking.com, Agoda, generic) checking extraction accuracy, date parsing, currency, and boundary rules.
- Unit tests for Google Sheets row upsert checking append vs update routing.

#### [NEW] [tax-export-service.test.ts](file:///c:/Users/Olly%20Troyfan/Documents/GitHub/Just_Management/backend/src/test/tax-export-service.test.ts)
- Integration tests for `runTaxExport()` and `previewTaxExport()` under mocked Prisma/WithOne client.
- Test scenarios: Same-day checkout, matching payout emails, mismatch handling (`needs_review`), and sheet export trigger.

---

### [Component 3] Frontend Page & Routing Tests
Verify routing and UI state transitions using Vitest and React Testing Library.

#### [NEW] [tax-export-page.test.tsx](file:///c:/Users/Olly%20Troyfan/Documents/GitHub/Just_Management/src/test/tax-export-page.test.tsx)
- Tests for `TaxExportPage` loading states, date picking, preview table rendering, and edit/PATCH review queue flows.

#### [NEW] [router.test.tsx](file:///c:/Users/Olly%20Troyfan/Documents/GitHub/Just_Management/src/test/router.test.tsx)
- Sidebar contract verification checking that all sidebar links map to active, lazy-loaded routes in TanStack router.

---

### [Component 4] Tax-Export Service Completion (Gmail + Sheets Integration)
Wire the provider connector features to the main `runTaxExport` execution flow.

#### [MODIFY] [service.ts](file:///c:/Users/Olly%20Troyfan/Documents/GitHub/Just_Management/backend/src/tax-export/service.ts)
- Update `runTaxExport` to:
  1. Retrieve Gmail messages for the checkout date via `listEmails()`.
  2. Map messages to OTA parsers and extract OTA confirmation codes, amounts, and currency.
  3. Enrich the checkout reservations database records with confirmation codes and pricing if found.
  4. Write the finalized export items into Google Sheets using the settings' spreadsheet details (`sheet_id`, `sheet_tab`, `template_columns`) and `appendSheetRows()`.

---

### [Component 5] Status & Plan Alignment
Update local tracking assets to reflect completed tasks.

#### [MODIFY] [dashboard-completion-and-integration.md](file:///c:/Users/Olly%20Troyfan/Documents/GitHub/Just_Management/.omo/plans/dashboard-completion-and-integration.md)
- Update Task 43 status to `[x]`.

#### [MODIFY] [dashboard_implementation_report.md](file:///c:/Users/Olly%20Troyfan/Documents/GitHub/Just_Management/docs/dashboard_implementation_report.md)
- Log Task 43 completion, the CORS origin additions, and the active test-first orchestration plan.

## Verification Plan

### Automated Tests
- Run backend test suite: `cd backend && npm run test`
- Run frontend test suite: `npm run test:frontend`
- Build verification: `npm run build:all`

### Manual Verification
- Launch local servers via `npm run dev:all` and verify that no CORS errors occur when hitting pages from the browser.
