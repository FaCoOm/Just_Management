---
title: Ingestion Sync Reference
created: 2026-05-26T00:00:00Z
tags: []
---

# Ingestion Sync Reference

## 1. How to sync with Azure DB

There are **two separate routes** depending on what you want to write.

**For the canonical hierarchy seed** (Mujo + Ruby + Manuka deduplicated), POST to the pipeline endpoint with `dryRun=false`:

```http
POST http://localhost:3001/api/ingest/pipeline/run
Content-Type: application/json

{
  "mode": "built-in",
  "targetKind": "listings",
  "dryRun": false
}
```

That hits `backend/src/ingest/routes.ts:246-252` which calls `processBuiltInSeed(sourceDir, dryRun)`. With `dryRun=true` the service computes counts but writes nothing (`backend/src/ingest/services/seed-builtin.ts:106-112`). With `dryRun=false` it upserts `channels`, `external_accounts`, `channel_listings`, and records a `seed_batches` row.

**For raw CSV uploads** (e.g. Mujo.csv as-is), use the multipart endpoints:

```http
POST /api/ingest/listings        # listings CSV
POST /api/ingest/reservations    # reservations CSV
```

Both require `file` (multipart), `sourceAccount` (one of `airbnb-main`, `airbnb-ruby`, `airbnb-manuka22`), and `dryRun=false` to actually write. Validation is in `backend/src/ingest/routes.ts:325-375`. The frontend at `/settings/integrations` already wires this up via the Manual CSV Upload card.

`dryRun` is mandatory on every ingest endpoint per the ingest contract; missing or non-boolean values get rejected with `MISSING_DRY_RUN` (`backend/src/ingest/routes.ts:41-53`).

Quick start command (PowerShell):

```powershell
$body = @{ mode = "built-in"; targetKind = "listings"; dryRun = $false } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/ingest/pipeline/run" -ContentType "application/json" -Body $body
```

## 2. Agreed watcher folder

**There is no hardcoded folder.** The watcher path is whatever you set in `M_MANAGEMENT_WATCH_DIR` (env var). `backend/src/ingest/watchers/folder.ts:53-62` reads it on backend startup; if unset, the watcher silently does not start. Same env var gates the `folder-watch` pipeline mode in `backend/src/ingest/routes.ts:269-275`.

Behavior:

- The watcher only **records fingerprints** into `watched_files`. It never writes to business tables on its own.
- Filenames must start with `listings_`, `listings.`, `listings-`, `reservation_`, etc. (regex in `backend/src/ingest/watchers/folder.ts:11-15`). Other names get marked `skipped`.
- To actually ingest, you still POST `/api/ingest/pipeline/run` with `mode=folder-watch`, which then reads pending `watched_files` rows and pushes them through the listing/reservation processors.

Set it in `backend/.env`, e.g.

```bash
M_MANAGEMENT_WATCH_DIR=C:\Users\Fate_Conqueror\GitHub\Just_Management\database_design
```

The defaults in `backend/src/ingest/pipeline.ts:100` set `M_MANAGEMENT_BUILTIN_SOURCE_DIR` to `../database_design` (resolved relative to `backend/`), but **that's the built-in seed source, not the watcher**. The watcher has no default; you choose.

## 3. listing-account-classification.json — generated, not manual

It's **generated** by a script. The npm script is `classify:listings` in `backend/package.json`:

```bash
cd backend
npm run classify:listings
```

That runs `backend/scripts/classify-airbnb-listings.ts` which:

1. Reads `database_design/Mujo.csv`, `Ruby.csv`, `Manuka.csv` (line 222).
2. Deduplicates by `ID` per account.
3. Validates the hierarchy invariant (Manuka subset of Ruby subset of Mujo).
4. Classifies each listing into a visibility tier (`mujo_only`, `ruby_mujo`, `manuka_ruby_mujo`).
5. Writes `database_design/listing-account-classification.json` (line 284).

The script exits with code 1 if hierarchy validation fails (a Manuka or Ruby ID missing from its parent). So the workflow is: replace/update the three CSV files in `database_design/`, rerun `npm run classify:listings`, then run the built-in seed against Azure.

## Recommended sequence to populate Azure now

```powershell
cd backend
npm run classify:listings        # only if Mujo/Ruby/Manuka CSVs changed
npm run dev                      # start backend on :3001
```

Then in another shell:

```powershell
$body = @{ mode = "built-in"; targetKind = "listings"; dryRun = $false } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/ingest/pipeline/run" -ContentType "application/json" -Body $body
```

Expected result per the report's math: ~76 `channel_listings` rows (46 mujo_only + 9x2 ruby_mujo + 4x3 manuka_ruby_mujo) and one `seed_batches` row with status `completed`. The seed is idempotent — the manifest hash is checked first, so re-running a second time with the same JSON returns `skipped` (`backend/src/ingest/services/seed-builtin.ts:107-111`).
