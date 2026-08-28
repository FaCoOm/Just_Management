# Final Environment Configuration — Hosted Server (manage.mujosaigon.com)

Status: final. Date: 2026-08-28. This report supersedes earlier env guidance; it is the single source for the env applied on the Hostinger VPS for the signed-grant AuthKit runtime. Secrets are shown as `<redacted>` — values live only in the VPS `.env` files, never in this repo.

## 1. Final backend env — `backend/.env`

```env
# --- Runtime ---
NODE_ENV=production
PORT=3001
SLOW_REQUEST_THRESHOLD_MS=500
ALLOWED_ORIGINS=https://manage.mujosaigon.com,https://auth.withone.ai,https://app.withone.ai,https://api.withone.ai

# --- Database ---
DATABASE_URL=<redacted>   # Azure PostgreSQL, ?sslmode=require suffix

# --- WithOne signed-grant runtime ---
ONE_SECRET_KEY=<redacted>             # project-scoped live key, matches AuthKit config
ONE_API_BASE=https://api.withone.ai/v1
ONE_OPERATOR_PASSWORD=<redacted>      # >=16 chars mixed
ONE_SESSION_SECRET=<redacted>         # >=32 random chars
ONE_OPERATOR_IDENTITY=operator
ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE=user

# --- Ingestion (project-defined; disabled in production) ---
INGEST_PIPELINE_ENABLED=false
INGEST_SHEETS_PROVIDER=withone
M_MANAGEMENT_BUILTIN_SOURCE_DIR=/home/u247402862/domains/manage.mujosaigon.com/database_design
M_MANAGEMENT_LISTINGS_CREATE_INVENTORY=false
M_MANAGEMENT_EMAIL_IMPORT_ENABLED=false
M_MANAGEMENT_EMAIL_IMPORT_PROVIDER=gmail
M_MANAGEMENT_EMAIL_IMPORT_QUERY=has:attachment filename:csv newer_than:30d

# --- Host-specific ---
NPM_CONFIG_INCLUDE=dev
```

`M_MANAGEMENT_IMPORT_ROOT=/home/u247402862/domains/manage.mujosaigon.com/imports` — add only if `INGEST_PIPELINE_ENABLED=true`.

## 2. Final frontend env — `.env.production` at repo root (Vite `envDir: "../"`)

```env
VITE_TRACK_B_API_URL=https://manage.mujosaigon.com
VITE_ONE_AUTH_TOKEN_URL=/api/one/auth-token
```

## 3. Not required (verified against code + analysis §13)

| Variable | Reason removed |
| :--- | :--- |
| `ONE_CONNECTION_KEY` | Production prefers DB-backed `integration_connections` rows. |
| `ONE_WEBHOOK_SECRET` | Only when One webhooks enabled. |
| `GOOGLE_SERVICE_ACCOUNT_FILE` / `GOOGLE_APPLICATION_CREDENTIALS` / `GOOGLE_SHEETS_SPREADSHEET_ID` | Legacy `google-sheets-direct` path; unused with `withone`. |
| `ONE_DEV_TOKEN` | Deprecated pre-grant scheme; remove if present on VPS. |
| `M_MANAGEMENT_WATCH_DIR` | Deprecated alias. |

## 4. Apply on the VPS

1. `cd /home/deploy/Just_Management` (or the actual deploy path) → `git pull --ff-only`
2. `cd backend && npm ci && npm run build`
3. Write `backend/.env` exactly as §1 (values from your store)
4. Write `.env.production` at repo root exactly as §2 → `cd frontend && npm ci && npm run build`
5. `cd backend && pm2 restart <app>` — **cwd must be `backend/`** (dotenv loads `backend/.env` from cwd); `pm2 save`
6. No migration step — `schema.prisma` unchanged since `b1aaca3` (already deployed)

## 5. Verification

```bash
curl -i https://manage.mujosaigon.com/api/one/auth-grant        # expect 401 (route exists) — NOT 404
curl -s https://manage.mujosaigon.com/health                    # expect {"status":"ok","track":"B"}
```

Boot log must show: `DATABASE_URL 🟢 Configured`, `WithOne Keys: 🟡 Not Set` plus `⚠️ RECOMMENDED CREDENTIALS MISSING: ONE_CONNECTION_KEY` — **expected when the key is unset** (DB-backed `integration_connections` rows are preferred); no `🔴 MISSING` / FATAL, "Configuration validation passed".

## 6. Deployment caveat

Env alone is insufficient: the deployed bundle must contain the signed-grant bridge (`/api/one/auth-grant` route + `x-one-grant` header). Pre-deploy probe (2026-08-28) confirmed drift: `POST /api/one/auth-grant` → 404. Redeploy current code after applying env (see `.omo/evidence/just-management-runtime-resolution/11/vps-deploy-runbook.md`).
