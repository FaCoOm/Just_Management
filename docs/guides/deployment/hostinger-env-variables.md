# Hostinger Production Environment Guide

Canonical env setup for the production deployment on the Hostinger VPS (frontend + backend same host, Nginx reverse proxy). Derived from code truth (`backend/src/config/env-validator.ts`, `backend/src/routes/one.ts`, `backend/src/integrations/one/*`, `frontend/src/lib/repositories/rest-repositories.ts`, `frontend/src/components/integrations/ConnectIntegrationButton.tsx`) and the AuthKit root-cause report (§7 minimum set, §13 configuration matrix, §17.1 CORS evidence).

> The minimal production set is small. Everything not listed below is **not needed** for the signed-grant AuthKit runtime and can stay unset/commented.

---

## 1. Backend (`backend/.env` on the VPS)

| Variable | Functional value | Why / note |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Sets `Secure` on operator cookie + grant cookie (`routes/one.ts:151,162`). |
| `PORT` | `3001` | Express listener; Nginx proxies `/api/*` to it. |
| `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST.postgres.database.azure.com:5432/m_management?sslmode=require` | Azure PostgreSQL; `sslmode=require` is enforced by Azure Flexible Server (validator warns if missing). |
| `ALLOWED_ORIGINS` | `https://manage.mujosaigon.com,https://app.withone.ai,https://auth.withone.ai,https://api.withone.ai` | **Must include the WithOne origins** — AuthKit iframe is cross-origin and its preflight is proven working only with them (§17.1: production `OPTIONS /api/one/auth-token` from `auth.withone.ai` → 204). Dropping them re-breaks the widget. |
| `ONE_SECRET_KEY` | `<production One API key>` | Server-to-One authentication; **project-scoped key matching AuthKit config** (§13: Required). |
| `ONE_API_BASE` | `https://api.withone.ai/v1` | One API root; keep default. |
| `ONE_OPERATOR_PASSWORD` | `<strong operator passcode, ≥16 chars mixed>` | Unlocks the operator session (internal single-operator model; §13: Required). |
| `ONE_SESSION_SECRET` | `<≥32 random chars, high entropy>` | Signs operator cookie and signed grant. |
| `ONE_OPERATOR_IDENTITY` | `operator` | Stable One connection identity (single-operator design; §13: Required). |
| `ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE` | `user` | Connection ownership type; current default. |
| `SLOW_REQUEST_THRESHOLD_MS` | `500` | Slow-request logging threshold (`index.ts:35`). |
| `INGEST_PIPELINE_ENABLED` | `false` | Folder/file watcher switch (`ingest/watchers/folder.ts:69`); keep `false` unless actively ingesting from disk. |
| `INGEST_SHEETS_PROVIDER` | `withone` | WithOne passthrough — no service-account file needed. |
| `M_MANAGEMENT_IMPORT_ROOT` | `/home/deploy/Just_Management/backend/imports` | Linux path; folder must exist with read/write for the backend process (only relevant if `INGEST_PIPELINE_ENABLED=true`). |
| `M_MANAGEMENT_LISTINGS_CREATE_INVENTORY` | `false` | Never auto-create properties/rooms from listings. |
| `M_MANAGEMENT_BUILTIN_SOURCE_DIR` | `../database_design` | Seed/reset source root (CLI only). |
| `M_MANAGEMENT_EMAIL_IMPORT_ENABLED` | `false` | Email-import sync; enable only when configured. |
| `M_MANAGEMENT_EMAIL_IMPORT_PROVIDER` | `gmail` | Functional value when email import is enabled. |
| `M_MANAGEMENT_EMAIL_IMPORT_QUERY` | `has:attachment filename:csv newer_than:30d` | Functional value when email import is enabled. |

### Explicitly NOT required (leave unset/commented)

| Variable | Why it is unnecessary |
| :--- | :--- |
| `ONE_CONNECTION_KEY` | §13: prefer DB-backed per-connection rows (`integration_connections`) in production. A global fallback key is a development convenience only. |
| `ONE_WEBHOOK_SECRET` | Only needed if One webhooks are enabled (`routes/one.ts:296`); not part of the current runtime. |
| `GOOGLE_SERVICE_ACCOUNT_FILE` / `GOOGLE_APPLICATION_CREDENTIALS` | Legacy `google-sheets-direct` fallback only; unused with `INGEST_SHEETS_PROVIDER=withone`. |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Only read when provider is `google-sheets-direct` (validator gates on it). |
| `M_MANAGEMENT_WATCH_DIR` | Deprecated alias of `M_MANAGEMENT_IMPORT_ROOT`. |
| `ONE_DEV_TOKEN` / `VITE_ONE_DEV_TOKEN` | Deprecated pre-grant authorization; removed from the current design (§13). |

---

## 2. Frontend (`.env.production` at repo root, before `npm run build`)

| Variable | Functional value | Why / note |
| :--- | :--- | :--- |
| `VITE_TRACK_B_API_URL` | `https://manage.mujosaigon.com` | REST repository base (`rest-repositories.ts:38`); same-origin API calls through Nginx. |
| `VITE_ONE_AUTH_TOKEN_URL` | `/api/one/auth-token` | AuthKit token endpoint given to `@withone/auth` (`ConnectIntegrationButton.tsx:31`); same-origin via proxy is preferred (§13). |

---

## 3. Verification after applying

```bash
# Backend boot diagnostics print the config dashboard:
cd backend && npm run build && npm run dev
# Expect: DATABASE_URL 🟢, WithOne Keys 🟡 Not Set, Ingestion Mode WithOne Passthrough; "RECOMMENDED CREDENTIALS MISSING: ONE_CONNECTION_KEY" is EXPECTED (DB-backed rows preferred), no 🔴 MISSING / FATAL

# Deployed route existence (todo 11 gate):
curl -i https://manage.mujosaigon.com/api/one/auth-grant
# Expect 401 (route exists, unauthenticated) — NOT 404
```

Env alone is not sufficient: the deployed bundle must contain the signed-grant bridge (`/api/one/auth-grant` + `x-one-grant`). Deploy current workspace code after applying values (§17.1: deployed backend returned 404 on `auth-grant`).
