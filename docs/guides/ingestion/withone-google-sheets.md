---
title: WithOne Google Sheets via WithOne
created: 2026-06-11T00:00:00+10:00
tags: []
---

# WithOne Google Sheets via WithOne

Yes. The backend already supports Google Sheets ingestion through WithOne passthrough.

## Verified wiring

- `backend/src/ingest/routes.ts` switches on `INGEST_SHEETS_PROVIDER`.
- `INGEST_SHEETS_PROVIDER=withone` routes to `backend/src/ingest/services/sheets-one.ts`.
- `backend/src/integrations/one/google/sheets.ts` calls Google Sheets v4 through WithOne passthrough.

## Runtime implication

Use a real WithOne connection key instead of a local Google service-account file.
The Sheets flow then uses the authenticated user's Google access through WithOne.
