# One / Google / Hostinger Integration Status

Date: 2026-07-06

## Summary

The issues are not resolved yet. They are diagnosed.

One CLI access works locally, but the deployed app has no persisted One connections for its dashboard identity, and the built-in pipeline connector points at a missing Hostinger filesystem path.

## Confirmed Working

Local One CLI vault has operational connections:

- `gmail` operational
- `google-drive` operational: `live::google-drive::default::f022350e9000438298a3cc8f1e16365b`
- `google-sheets` operational: `live::google-sheets::default::a5d5eb63d2c14b2ea10f49d9dac51dca`

Verified read access:

- Google Drive list files succeeded.
- Google Drive found spreadsheet: `Manuka Latest ❤️❤️❤️❤️`
- Spreadsheet ID: `1WKRFBY6HWbrT3oolwktL9mW7x7FXZG8pK0LmHpvnAV4`
- Google Sheets read succeeded for `A1:Z5`.
- Returned range: `'Lịch Dọn'!A1:Z5`

## Deployed App State

Checked deployed URL:

`https://manage.mujosaigon.com/settings/integrations`

API results:

```json
GET /api/integrations/status
{"status":"connected","provider":"withone"}
```

```json
GET /api/one/connections
{"connections":[]}
```

```json
GET /api/ingest/pipeline/status
{
  "enabled": false,
  "phase": "scaffolded",
  "connectors": [
    {"mode":"admin-upload","enabled":false,"state":"ready"},
    {"mode":"folder-watch","enabled":false,"state":"not_configured"},
    {"mode":"email","enabled":false,"state":"not_configured"},
    {
      "mode":"built-in",
      "enabled":false,
      "state":"missing_path",
      "path":"/home/u247402862/domains/manage.mujosaigon.com/database_design"
    },
    {"mode":"google-sheets","enabled":false,"state":"not_configured"}
  ],
  "googleCredentials":{"configured":false,"readable":false}
}
```

## Root Causes

### `missing_path`

`missing_path` is not a One, Google, or Hostinger API auth issue.

It comes from backend filesystem readiness logic in `backend/src/ingest/pipeline.ts`. The `built-in` connector checks whether this path exists:

```text
/home/u247402862/domains/manage.mujosaigon.com/database_design
```

That path is missing or unreadable on Hostinger, so the connector reports:

```text
built-in -> missing_path
```

### Saved One Connections Empty

The local One CLI vault has working Google connections, but the deployed dashboard reads saved connection rows from the app database via:

```text
GET /api/one/connections
```

That endpoint returned:

```json
{"connections":[]}
```

So the deployed app has no persisted Google Drive / Google Sheets connection rows for its dashboard identity.

### Google Sheets Connector `not_configured`

The pipeline status reports:

```json
"googleCredentials":{"configured":false,"readable":false}
```

That only describes direct service-account credentials. WithOne passthrough can still work if a valid `google-sheets` connection key is supplied at run time.

## Required Fixes

1. Upload or mount `database_design` on Hostinger at:

```text
/home/u247402862/domains/manage.mujosaigon.com/database_design
```

Or set `M_MANAGEMENT_BUILTIN_SOURCE_DIR` to the actual deployed directory.

2. Set pipeline env if pipeline should be runnable:

```text
INGEST_PIPELINE_ENABLED=true
```

3. Persist One connection rows into the deployed app DB by either:

- using the deployed UI connect buttons, or
- seeding `integration_connections` with the live One connection keys for the same app user identity.

4. For Google Sheets ingestion through WithOne, run with the saved `google-sheets` connection key. Do not rely on `googleCredentials` unless using the direct service-account fallback.

## Current Verdict

Diagnosis complete. Fix not applied yet.

One/Google OAuth access works locally. Deployed app wiring is partially configured, but pipeline source path and persisted app connection rows are missing.
