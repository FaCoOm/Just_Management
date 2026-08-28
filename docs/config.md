# Just Management — Final Environment Configuration (Hosted Server)

Canonical env reference for `manage.mujosaigon.com` (Hostinger VPS). Final set derived from the signed-grant runtime (analysis report §7 minimum set + §13 configuration matrix). Secrets remain `<redacted>` — never store live values in this repo.

## Backend (`backend/.env`)

| Variable | Value | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Secure cookies (operator + grant). |
| `PORT` | `3001` | Nginx proxies `/api/*` here. |
| `DATABASE_URL` | `<redacted>` | Azure PostgreSQL, `?sslmode=require`. |
| `ALLOWED_ORIGINS` | `https://manage.mujosaigon.com,https://auth.withone.ai,https://app.withone.ai,https://api.withone.ai` | WithOne origins required for cross-origin AuthKit (CORS preflight verified 204). |
| `ONE_SECRET_KEY` | `<redacted>` | Project-scoped live key; must match AuthKit config. |
| `ONE_API_BASE` | `https://api.withone.ai/v1` | Default; keep. |
| `ONE_OPERATOR_PASSWORD` | `<redacted>` | Operator session passcode (≥16 chars). |
| `ONE_SESSION_SECRET` | `<redacted>` | ≥32 random chars; signs cookie + grant. |
| `ONE_OPERATOR_IDENTITY` | `operator` | Single-operator design. |
| `ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE` | `user` | Connection ownership type. |
| `SLOW_REQUEST_THRESHOLD_MS` | `500` | Slow-request logging. |
| `INGEST_PIPELINE_ENABLED` | `false` | Disabled unless disk ingestion active. |
| `INGEST_SHEETS_PROVIDER` | `withone` | No service-account file needed. |
| `M_MANAGEMENT_BUILTIN_SOURCE_DIR` | `/home/u247402862/domains/manage.mujosaigon.com/database_design` | Seed/reset source (CLI only). |
| `M_MANAGEMENT_IMPORT_ROOT` | `/home/u247402862/domains/manage.mujosaigon.com/imports` | Only relevant if `INGEST_PIPELINE_ENABLED=true`. |
| `M_MANAGEMENT_LISTINGS_CREATE_INVENTORY` | `false` | Never auto-create inventory. |
| `M_MANAGEMENT_EMAIL_IMPORT_ENABLED` | `false` | Email sync disabled. |
| `M_MANAGEMENT_EMAIL_IMPORT_PROVIDER` | `gmail` | Functional value if enabled. |
| `M_MANAGEMENT_EMAIL_IMPORT_QUERY` | `has:attachment filename:csv newer_than:30d` | Functional value if enabled. |
| `NPM_CONFIG_INCLUDE` | `dev` | Host npm behavior; keep. |

## Frontend (`.env.production` at repo root — Vite `envDir: "../"`)

| Variable | Value | Notes |
| :--- | :--- | :--- |
| `VITE_TRACK_B_API_URL` | `https://manage.mujosaigon.com` | REST base; same-origin through Nginx. |
| `VITE_ONE_AUTH_TOKEN_URL` | `/api/one/auth-token` | Same-origin path preferred (§13); absolute `https://manage.mujosaigon.com/api/one/auth-token` also valid. |

## Explicitly NOT required (removed from prior config)

`ONE_CONNECTION_KEY` (DB-backed `integration_connections` rows preferred, §13) · `ONE_WEBHOOK_SECRET` (only if webhooks enabled) · `GOOGLE_SERVICE_ACCOUNT_FILE` / `GOOGLE_APPLICATION_CREDENTIALS` / `GOOGLE_SHEETS_SPREADSHEET_ID` (legacy `google-sheets-direct` path) · `ONE_DEV_TOKEN` (deprecated pre-grant scheme) · `M_MANAGEMENT_WATCH_DIR` (deprecated alias).

> ⚠️ **ROTATE NOW** — live-looking credentials previously stored in this file were replaced with `<redacted>` placeholders and must be treated as compromised.
> User action required: rotate the WithOne secret key (`ONE_SECRET_KEY`), the operator password (`ONE_OPERATOR_PASSWORD`), the session secret (`ONE_SESSION_SECRET`), the PostgreSQL password (`DATABASE_URL`), and any previously exposed `ONE_CONNECTION_KEY` at their respective providers, then update the live environment.
> Rotation is the user's responsibility; redacted values were never logged or stored.
