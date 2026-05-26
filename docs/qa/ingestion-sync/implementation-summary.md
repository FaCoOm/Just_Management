# Ingestion Sync Implementation Summary

## Purpose

This package summarizes the current ingestion sync implementation and gives a third-party QA agent enough context to validate it independently.

## Final Data Model Intent

`channel_listings` is the single canonical listings table. It should contain one row per unique Airbnb listing ID from `database_design/listings.csv`, which represents the Mujo/main account superset.

Ownership is represented by `channel_listings.owner`:

- `manuka` when the listing appears in `database_design/Manuka.csv`
- `ruby` when the listing appears in `database_design/Ruby.csv` but not Manuka
- `mujo` when the listing appears only in `database_design/listings.csv`

There should be no active Ruby/Manuka subset tables. A prior migration created `channel_listings_ruby` and `channel_listings_manuka`, but the correction migration drops them and preserves ownership in the central table instead.

## Key Files

- `backend/scripts/classify-airbnb-listings.ts` reads `database_design/listings.csv`, `Ruby.csv`, and `Manuka.csv`, then writes `database_design/listing-account-classification.json`.
- `database_design/listing-account-classification.json` records hierarchy and visibility metadata.
- `backend/prisma/schema.prisma` defines `channel_listings.owner` and global `provider_listing_id` uniqueness.
- `backend/prisma/migrations/20260526000000_listings_owner_subsets/migration.sql` added the first owner/subset-table migration.
- `backend/prisma/migrations/20260526010000_central_channel_listing_owners/migration.sql` corrects the model by clearing listing data, dropping subset tables, and enforcing one canonical row per provider listing.
- `backend/src/ingest/services/seed-builtin.ts` writes one row per listing into `channel_listings` and derives owner from the hierarchy.
- `src/hooks/use-run-pipeline.ts` posts the dashboard sync payload and shows Sonner toast feedback.
- `src/components/dashboard/header.tsx` renders the `Sync Now` dashboard action.
- `src/main.tsx` mounts the Sonner `Toaster`.

## Expected Classification Summary

`npm run classify:listings` should produce:

```json
{
  "rowsByAccount": {
    "Mujo": 59,
    "Ruby": 13,
    "Manuka": 4
  },
  "uniqueListingCount": 59,
  "tierCounts": {
    "manuka_ruby_mujo": 4,
    "ruby_mujo": 9,
    "mujo_only": 46
  },
  "duplicateIdsByAccount": {},
  "hierarchyValidation": {
    "manukaSubsetOfRuby": true,
    "rubySubsetOfMujo": true,
    "missingFromRuby": [],
    "missingFromMujo": []
  }
}
```

## Expected Azure DB State After Corrected Sync

After applying migrations and running the built-in sync, expected DB state is:

```json
{
  "total": 59,
  "owners": {
    "manuka": 4,
    "ruby": 9,
    "mujo": 46
  },
  "duplicateProviderListingIds": 0,
  "subsetTablesRemaining": 0
}
```

The last verified sync result from implementation was:

```json
{
  "processed": 59,
  "created": 59,
  "updated": 0,
  "skipped": 0,
  "deadLetters": 0,
  "errors": []
}
```

## Dashboard Sync Behavior

The dashboard header has a `Sync Now` button. It triggers:

```http
POST /api/ingest/pipeline/run
Content-Type: application/json
```

```json
{
  "mode": "built-in",
  "targetKind": "listings",
  "dryRun": false
}
```

On success it shows a Sonner success toast. On error it shows a Sonner error toast. While pending, the button is disabled and shows a spinning refresh icon.

## Verification Already Completed During Implementation

The following commands passed during implementation:

```bash
npm run classify:listings
npm run typecheck
npm run build
cd backend && npm run db:generate
cd backend && npm run db:validate
cd backend && npm run db:verify:migration
cd backend && npm run build
cd backend && npm run db:deploy
```

Browser MCP smoke was attempted earlier but local browser-to-localhost connectivity was unreliable in this environment. QA should use Playwright and Browserbase MCP if available.
