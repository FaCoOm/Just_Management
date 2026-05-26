# Sync Source And Google Sheets Clarification

> Generated: 2026-05-25  
> Scope: Track B backend sync source, empty Azure tables, and Google Sheets ingestion status.

## Sync Source Location

There is no agreed automatic folder/source like `database_design/` that backend watches.

Current agreed runtime source is **explicit API ingestion**:

```text
POST /api/ingest/listings
POST /api/ingest/reservations
POST /api/ingest/google-sheets
```

`database_design/` is local reference/source material. Files there can seed the system only when uploaded or moved through Google Sheets and then posted into ingest API.

## Can Source Be Updated?

Yes.

| Update target | How to update |
|---|---|
| CSV data | Edit CSV, then upload again to `/api/ingest/listings` or `/api/ingest/reservations` |
| Google Sheet data | Edit sheet, then call `/api/ingest/google-sheets` again |
| Google Sheet target | Pass different `spreadsheetId` and optional `sheetName` |
| Source account | Use one of current accepted values: `airbnb-main`, `airbnb-ruby`, `airbnb-manuka22` |
| Accepted source accounts | Code edit in `backend/src/ingest/contracts.ts` |
| Azure database target | Change `DATABASE_URL` database path, e.g. `/m_management` vs `/postgres` |

Current accepted source accounts from `backend/src/ingest/contracts.ts`:

```ts
["airbnb-main", "airbnb-ruby", "airbnb-manuka22"]
```

Likely file mapping:

```text
Mujo.csv   -> sourceAccount=airbnb-main
Ruby.csv   -> sourceAccount=airbnb-ruby
Manuka.csv -> sourceAccount=airbnb-manuka22
```

## Why `m_management` Tables May Be Empty

Most likely no successful `dryRun=false` ingest has happened.

Important behavior:

- `dryRun` is mandatory.
- If `dryRun=true`, service returns counts but does not persist business data.
- Schema migration creates empty tables only.
- There is no cron, scheduler, folder watcher, or auto-Google-Sheets polling.
- If API credentials were provided but no ingest endpoint was called, database remains empty.

Evidence from code:

- `backend/src/ingest/routes.ts:32-39` requires `dryRun`.
- `backend/src/ingest/services/listings.ts` writes only under `!isDryRun`.
- `backend/src/ingest/services/reservations.ts` writes only under `!isDryRun`.
- `README.md` setup includes migration/deploy/dev commands but no seed/load step.

Possible causes of empty tables:

| Cause | Explanation |
|---|---|
| Only migrations ran | Tables exist but contain no business data |
| Ingest ran with `dryRun=true` | No writes performed |
| Ingest request missing file | Listing/reservation routes return contract response, no processing |
| Google Sheets env missing | Sheets service cannot authenticate |
| Google Sheets request missing `spreadsheetId` | Route validation rejects request |
| Rows dead-lettered | Ambiguous/composite internal names rejected by parser |
| Wrong DB inspected | Backend targets `m_management`; inspecting default `postgres` can look empty |

## Google Sheets Integration Status

Google Sheets support exists in code, but runtime configuration must be present and the ingest endpoint must be called.

Current env check showed:

- `DATABASE_URL` present
- no visible `GOOGLE_SERVICE_ACCOUNT_FILE`
- no visible `GOOGLE_APPLICATION_CREDENTIALS`
- no visible `GOOGLE_SHEETS_SPREADSHEET_ID`

Expected env from `backend/.env.example`:

```env
GOOGLE_SERVICE_ACCOUNT_FILE=../credentials.json
# GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id
```

`backend/src/ingest/services/sheets.ts` accepts either:

```env
GOOGLE_SERVICE_ACCOUNT_FILE=/path/to/service-account.json
```

or:

```env
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

The Google API scope is read-only:

```text
https://www.googleapis.com/auth/spreadsheets.readonly
```

## Google Sheets Request Shape

Use JSON request:

```http
POST /api/ingest/google-sheets
Content-Type: application/json
```

For listing sync:

```json
{
  "dryRun": false,
  "sourceType": "google-sheets",
  "sourceAccount": "airbnb-main",
  "spreadsheetId": "YOUR_SPREADSHEET_ID",
  "sheetName": "OPTIONAL_SHEET_NAME",
  "targetKind": "listings"
}
```

For reservation sync:

```json
{
  "dryRun": false,
  "sourceType": "google-sheets",
  "sourceAccount": "airbnb-main",
  "spreadsheetId": "YOUR_SPREADSHEET_ID",
  "sheetName": "OPTIONAL_SHEET_NAME",
  "targetKind": "reservations"
}
```

Critical nuance: `sheets.ts` can fallback to `GOOGLE_SHEETS_SPREADSHEET_ID`, but `routes.ts` validation currently requires `spreadsheetId` in the request body before it calls `sheets.ts`. With current code, pass `spreadsheetId` explicitly.

## Google Sheets Flow

```text
POST /api/ingest/google-sheets
  |
  v
routes.ts validates:
  - dryRun
  - sourceType=google-sheets
  - sourceAccount
  - spreadsheetId
  - targetKind=listings|reservations
  |
  v
sheets.ts
  - resolve service account credential file
  - call Google Sheets API v4
  - read selected sheet range A:ZZ
  - convert values to CSV buffer
  |
  v
targetKind=listings      -> processListingSync()
targetKind=reservations  -> processReservationSync()
  |
  v
Prisma writes into Azure PostgreSQL database `m_management`
```

## Safe Dry Run Example

Run this first to prove Google Sheets credentials, spreadsheet access, and column shape work:

```bash
curl -X POST http://localhost:3001/api/ingest/google-sheets \
  -H "Content-Type: application/json" \
  -d "{\"dryRun\":true,\"sourceType\":\"google-sheets\",\"sourceAccount\":\"airbnb-main\",\"spreadsheetId\":\"YOUR_ID\",\"targetKind\":\"listings\"}"
```

If dry run returns processed rows and no config errors, run the same request with:

```json
"dryRun": false
```

That is the step that actually populates `m_management`.

## Current Truth

```text
Data source is not automatically database_design/.
Data source is API-provided CSV/XLSX upload or Google Sheets request.
Database target is Azure PostgreSQL database m_management.
Tables empty means no successful dryRun=false ingest has written data yet, or wrong DB/schema is being inspected.
Google Sheets code exists, but runtime env/request must be configured and endpoint must be called.
```
