## Research Synthesis (round 1 done)

### Pages: most exist already
- All 5 routed pages (`/`, `/reservations`, `/guests`, `/rooms`, `/maintenance`) FULLY IMPLEMENTED
- `/settings/integrations` FULLY IMPLEMENTED (One CLI wired)
- Sidebar advertises 11 routes that DO NOT EXIST: Check-in/out, VIP Guests, Room Types, Availability, Housekeeping, Dining and Events, Rate Manager, Billing and Invoices, Channel Distribution, Staff and Roles, Security and Access
- Minor button gaps: Guests Export, Rooms Manage Room Types, Maintenance Log Issue

### WithOne already integrated
- `backend/src/integrations/one/{client,connections,webhooks,auth-token}.ts`
- `backend/src/integrations/one/google/{sheets,gmail,drive}.ts`
- Routes registered: `/api/one/auth-token`, `/api/one/connections`, `/api/one/webhook`
- DB tables: `integration_connections`, `channels`, `external_accounts`, `email_import_messages`
- HMAC-verified inbound webhooks
- Gaps: hardcoded `sourceAccounts = [airbnb-main, airbnb-ruby, airbnb-manuka22]`, no generic ProviderConnector interface

### Tax-Export = email-driven enrichment, NOT a tax engine
User clarification: trace reservations via confirmation code through Gmail to extract payment details, then populate sheet rows.
Pipeline:
1. Match reservation by confirmation_code
2. Search Gmail (via WithOne) for that code
3. Parse payment details from email body or attachment
4. Append/update row in user-provided Google Sheet template

No tax calculation in v1. No new tax fields needed in v1. Schema already lacks rate or VAT fields.
Existing Sheets infra is READ-only - need WRITE path via `spreadsheets.values.batchUpdate`.

### Vietnamese tax context (from librarian)
- Standard VAT 10 percent for hospitality, temporary 8 percent reduction in effect through end of 2026 for eligible services per Resolution 174/2024/QH15
- CIT standard 20 percent
- No separate national occupancy or tourism tax; provincial fees may apply
- Environmental tax does not apply to ordinary lodging
- For sheet output: use locale vi_VN, RAW for numbers, USER_ENTERED for dates with explicit format
- Library recommendation: googleapis (~172.0.0) over google-spreadsheet wrapper for production
- Scopes: spreadsheets (sensitive) for writes, drive.file (non-sensitive) for template copy
- Auth: service account JSON, share template with service account email
- Rate limit: 300 reads/min/project, write quota similar; use batchUpdate for grouping

## Decisions Resolved Round 2
1. Tax-Export lives on a dedicated Tax & Compliance page, per-reservation row action, and scheduled/automated runs.
2. Primary trigger default: reservations whose checkout date equals the submission date/today.
3. Email parsers v1: Airbnb, Booking.com, Agoda, plus generic/pluggable parser registry.
4. Gmail account: use existing WithOne-linked Gmail connection now; future connection models remain extensible.
5. Settings storage: one shared sheet for all listings/accounts now; future per-user or per-tenant global model noted.
6. Missing pages: all 11 fully implemented.
7. Test framework: Vitest frontend; Node built-in test runner backend.
8. Schema: lean now, expand per page.

## Remaining Questions
- None blocking. Metis defaults accepted for timezone, idempotency, needs_review handling, privacy, and connector scope.
