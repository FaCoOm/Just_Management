# QA Test Plan: Ingestion Sync Workflow

## Objective

Validate that the dashboard-driven ingestion sync correctly writes 59 unique central listings to Azure PostgreSQL, assigns owners from the Ruby/Manuka hierarchy, and provides clear UI feedback.

## Required Tools

- Playwright browser automation.
- Browserbase MCP if available, preferred to avoid local browser timeout/freeze.
- Read-only SQL access to Azure PostgreSQL.
- Shell access for build and verification commands.

## Safety Rules

- Do not commit, amend, push, or force-push.
- Do not expose `.env` secrets or database credentials in screenshots/logs.
- Do not run destructive SQL manually.
- The only allowed DB mutation is the approved sync endpoint or project migration command if specifically assigned.
- Prefer read-only DB queries for validation.

## Setup Commands

Run from repo root unless noted:

```bash
npm install
npm run classify:listings
npm run typecheck
npm run build
cd backend && npm run db:generate
cd backend && npm run db:validate
cd backend && npm run db:verify:migration
cd backend && npm run build
```

Start local runtime:

```bash
npm run dev:all
```

If local browser cannot reach localhost, use Browserbase MCP or run browser automation in the same network context as the app.

## Scenario 1: Classification Source Integrity

1. Run `npm run classify:listings`.
2. Inspect output summary.
3. Confirm:
   - `uniqueListingCount = 59`
   - `mujo_only = 46`
   - `ruby_mujo = 9`
   - `manuka_ruby_mujo = 4`
   - `manukaSubsetOfRuby = true`
   - `rubySubsetOfMujo = true`
   - duplicate lists are empty

Pass if all values match exactly.

## Scenario 2: Dashboard Sync Button

1. Open dashboard in browser.
2. Locate `Sync Now` in the dashboard header.
3. Click once.
4. Capture network request to `/api/ingest/pipeline/run`.
5. Confirm request method is `POST`.
6. Confirm request body is exactly:

```json
{
  "mode": "built-in",
  "targetKind": "listings",
  "dryRun": false
}
```

7. Confirm button is disabled while request is pending.
8. Confirm success toast on success.
9. Confirm no unexpected console errors.

Pass if only one POST is sent and UI feedback is correct.

## Scenario 3: Backend Endpoint Direct Check

POST directly to backend:

```bash
curl -X POST http://localhost:3001/api/ingest/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"mode":"built-in","targetKind":"listings","dryRun":false}'
```

Expected response on first run after clearing data:

```json
{
  "dryRun": false,
  "processed": 59,
  "created": 59,
  "updated": 0,
  "skipped": 0,
  "deadLetters": 0,
  "errors": []
}
```

If the manifest has already run, idempotency may return `skipped: 59`. That is acceptable if DB counts are already correct.

## Scenario 4: Azure DB State

Run read-only SQL:

```sql
SELECT COUNT(*) AS total_channel_listings
FROM channel_listings;

SELECT owner, COUNT(*) AS row_count
FROM channel_listings
GROUP BY owner
ORDER BY owner;

SELECT provider_listing_id, COUNT(*) AS duplicate_count
FROM channel_listings
GROUP BY provider_listing_id
HAVING COUNT(*) > 1;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('channel_listings_ruby', 'channel_listings_manuka')
ORDER BY table_name;
```

Expected:

- `total_channel_listings = 59`
- `manuka = 4`
- `ruby = 9`
- `mujo = 46`
- duplicate query returns no rows
- subset table query returns no rows

## Scenario 5: Idempotency

1. Run sync once.
2. Record DB counts.
3. Run sync again.
4. Record DB counts again.

Pass if counts stay stable and no duplicates appear.

## Scenario 6: Backend Unavailable UI Failure

1. Stop backend or point frontend to unavailable API in a safe local test.
2. Click `Sync Now`.
3. Confirm error toast appears.
4. Confirm no success toast appears.
5. Confirm console/network records expected failure.

Pass if failure is visible and not misreported as success.

## Scenario 7: Pending-State Duplicate Prevention

1. Throttle network or use Browserbase slow network if possible.
2. Click `Sync Now` rapidly multiple times.
3. Confirm button disables.
4. Confirm only one request is made while pending.

Pass if duplicate POSTs are prevented.

## Pass Criteria

All scenarios must pass, or failures must be documented with evidence. DB correctness is mandatory:

- 59 canonical rows in `channel_listings`
- owner distribution: 46 `mujo`, 9 `ruby`, 4 `manuka`
- zero duplicate `provider_listing_id`
- no `channel_listings_ruby` / `channel_listings_manuka` tables remaining
