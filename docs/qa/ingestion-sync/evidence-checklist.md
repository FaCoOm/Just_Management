# Evidence Checklist

Use this checklist while testing. Store screenshots and logs in the QA agent's own evidence folder.

## Command Output

- [ ] `npm run classify:listings`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `cd backend && npm run db:generate`
- [ ] `cd backend && npm run db:validate`
- [ ] `cd backend && npm run db:verify:migration`
- [ ] `cd backend && npm run build`

## Browser Evidence

- [ ] Dashboard initial screenshot with `Sync Now` visible.
- [ ] Pending state screenshot after click.
- [ ] Success toast screenshot.
- [ ] Error toast screenshot for backend-unavailable test.
- [ ] Console output showing no unexpected errors on success path.

## Network Evidence

- [ ] Request URL: `/api/ingest/pipeline/run`.
- [ ] Request method: `POST`.
- [ ] Request payload:

```json
{
  "mode": "built-in",
  "targetKind": "listings",
  "dryRun": false
}
```

- [ ] Response body from successful sync.
- [ ] Response/error body from negative test.

## Database Evidence

- [ ] `SELECT COUNT(*) FROM channel_listings;`
- [ ] owner distribution query output.
- [ ] duplicate provider listing ID query output.
- [ ] subset tables absence query output.
- [ ] latest `seed_batches` or `sync_runs` row for the sync run, if needed.

## Required Final DB Values

```json
{
  "channel_listings": 59,
  "owners": {
    "mujo": 46,
    "ruby": 9,
    "manuka": 4
  },
  "duplicateProviderListingIds": 0,
  "subsetTablesRemaining": 0
}
```
