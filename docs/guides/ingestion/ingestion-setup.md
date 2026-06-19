# Ingestion Influx and Data Setup Guide: User Stories & Configuration Blueprint

This document details the file directories, environment configurations, and setup procedures required to enable and operate the `Just_Management` ingestion pipeline. It also provides the user story framework for both end-users (webapp operators) and developers.

---

## 1. Directory Structure & File Locations

The ingestion pipeline supports multiple modes. Data files must be organized based on the ingestion mode you choose:

### A. Built-in Ingestion (SOT Seeders)
- **Path**: [docs/database_design/](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/database_design/)
- **Core Files**:
  - `listings.csv` — Primary listings database design.
  - `Ruby.csv` — Airbnb listing configurations for the Ruby account.
  - `Manuka.csv` — Airbnb listing configurations for the Manuka account.
  - `reservations.csv` — Complete reservation records containing guest details, checks-in/out, and prices.
  - `listing-account-classification.json` — Generated listing account mappings (run `npm run classify:listings` to update).

### B. Folder Watch Pipeline
- **Path**: Configured by the `M_MANAGEMENT_IMPORT_ROOT` environment variable.
- **Subdirectory Layout**:
  - `<M_MANAGEMENT_IMPORT_ROOT>/listings/inbox/` — Place fresh listings spreadsheets here.
  - `<M_MANAGEMENT_IMPORT_ROOT>/reservations/inbox/` — Place fresh reservations spreadsheets here.
  - `<M_MANAGEMENT_IMPORT_ROOT>/listings/processed/` — Automatically moves here on successful import.
  - `<M_MANAGEMENT_IMPORT_ROOT>/listings/quarantine/` — Automatically moves here if the file contains format errors.
  - `<M_MANAGEMENT_IMPORT_ROOT>/reservations/processed/` — Moves here on successful reservation import.
  - `<M_MANAGEMENT_IMPORT_ROOT>/reservations/quarantine/` — Moves here if reservation dates/titles fail to map.

---

## 2. Developer Activation Checklist

To run and validate the ingestion pipeline locally, perform the following steps:

1. **Configure Environment Variables**:
   In `backend/.env`, configure the following variables:
   ```bash
   # Root folder for local folder watch pipeline files
   M_MANAGEMENT_IMPORT_ROOT="C:/Users/Fate_Conqueror/GitHub/Just_Management/backend/fixtures"
   
   # Enable dynamic room/property creation from listing internal names when seeding
   M_MANAGEMENT_LISTINGS_CREATE_INVENTORY="true"
   
   # Provider for Google Sheets synchronization
   INGEST_SHEETS_PROVIDER="withone"
   ```

2. **Run Local Database Alignment Seeds**:
   Ensure your database is cleanly aligned with the target inventories:
   ```powershell
   # 1. Align rooms with canonical 45-room list
   npm --prefix backend run seed:rooms-sot -- --apply
   
   # 2. Wipe and load 59 canonical listings
   npm --prefix backend run seed:listings-sot -- --apply
   
   # 3. Import canonical reservations list
   npm --prefix backend run seed:reservations-sot -- --apply
   ```

3. **Verify Pipeline Harness**:
   Execute the verification script to run live payload imports against the API endpoints:
   ```powershell
   npm --prefix backend run verify-ingestion
   ```

---

## 3. Webapp Operator (End-User) User Stories

### Story 1: Manual CSV/Excel Upload
> **As a** Property Manager,  
> **I want to** drag and drop my monthly Airbnb reservations spreadsheet directly into the Admin dashboard,  
> **So that** check-in schedules, guest details, and VIP statuses are updated instantly in the web application.
- **Acceptance Criteria**:
  - The UI must accept both `.csv` and `.xlsx` formats.
  - The upload process must display a detailed progress breakdown (e.g., number of processed, created, and updated rows).
  - Multi-byte accented names (like `정찬 김` or `Gabriel Ştiufliuc`) must display cleanly without character corruption.
  - Guest check-out dates (like `01/07/2026`) must be correctly mapped to July 1st, 2026, on the Reservations dashboard.

### Story 2: Automatic Spreadsheet Sync
> **As a** Operations Supervisor,  
> **I want to** trigger a sync from my centralized Google Sheets dashboard with one click,  
> **So that** I do not have to manually export files and upload them.
- **Acceptance Criteria**:
  - Clicking the "Sync Sheets" button triggers `POST /api/ingest/google-sheets`.
  - Stale reservations belonging to the matching synced account must be cleanly overwritten without leaving duplicate guest entries.

---

## 4. Developer User Stories

### Story 1: Local Environment Setups
> **As a** Backend Developer,  
> **I want to** quickly initialize a clean local database matching the Vietnam property layouts,  
> **So that** I can write and verify new API features against accurate mocks.
- **Acceptance Criteria**:
  - Running `npm run seed:rooms-sot -- --apply` populates properties and rooms exactly matching the canonical list.
  - No surplus room formats (like `8.05` or `303 (301 cu)`) should ever be generated in the database.

### Story 2: Extension of File Parsers
> **As a** Integration Developer,  
> **I want to** safely parse spreadsheet date formats without timezone shifts or date-swapping offsets,  
> **So that** booking dates remain accurate regardless of client browser locales.
- **Acceptance Criteria**:
  - Preprocess SheetJS date cells to clean, timezone-stable strings.
  - Running unit tests via `npm run test` verifies robust parsing against short, long, dashed, and slashed date formats.
