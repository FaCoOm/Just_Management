# WithOne Environment Configuration & Directory Agreement

## 1. Directory Roles & File Allocation Agreement

To organize and establish clear boundaries for file allocation moving forward, the roles of the `resources/` and `docs/` directories are defined as follows:

| Directory | Scope & Status | Git Tracked? | Primary Purpose |
|---|---|---|---|
| **`resources/`** | Agent & Local Scratch | **No** (in `.gitignore`) | Storing transient research outputs, execution logs, API analysis, test summaries, and temporary notes created by AI agents (Gemini, OpenCode, Sisyphus). Helps avoid polluting the git history with helper analysis files. |
| **`docs/`** | Project Documentation | **Yes** | Official codebase documentation, architecture guides (ADRs), API design specs, sprint planning, and developer guides. Version-controlled along with the codebase. |

---

## 2. Database Connection Status

* **Status**: 🟢 **Connected**
* **Verification Command**: `npx prisma migrate status` (executed successfully inside `backend/`)
* **Database Target**: Flexible Azure PostgreSQL `m_management` database at `webdbmujo.postgres.database.azure.com`
* **Schema Health**: Up-to-date (9 migrations applied successfully, matching backend datamodel).

---

## 3. WithOne API Environment Attributes & Credentials

The `backend/.env` file uses two different systems for third-party integrations (like Google Sheets and Gmail), depending on the configuration.

### WithOne Environment Variables Reference

| Environment Variable | Format / Prefix | Security Scope | Purpose |
|---|---|---|---|
| `ONE_SECRET_KEY` | `sk_live_...` or `sk_test_...` | **Server-side only** (Strictly Private) | The master API key to authenticate our backend server with WithOne's management API. Used to make backend-to-backend requests and issue AuthKit connection tokens. |
| `ONE_CONNECTION_KEY` | `conn_...` | **Vault Connection ID** | Represents a user/tenant's authorized external account link (e.g., a specific Gmail inbox or Google Sheets auth) inside the WithOne vault. Used to fetch and push data to that specific external connector. |
| `ONE_WEBHOOK_SECRET` | `whsec_...` | **Server-side only** (Private) | HMAC signing secret key used to verify incoming webhook events from WithOne (`/api/one/webhook`) ensuring request authenticity. |
| `ONE_DEV_TOKEN` | Any string (e.g., `dev-only-...`) | **Development gating** | Temporary token passed in the `x-dev-token` header by the frontend widget to request short-lived AuthKit connection tokens before Sprint 2 real authentication lands. |
| `ONE_API_BASE` | URL | Public / System | Base URL for WithOne API endpoint (defaults to `https://api.withone.ai/v1`). |

---

### Google Services Integration: Direct vs WithOne

The backend ingestion pipeline retrieves spreadsheets using one of two providers specified by `INGEST_SHEETS_PROVIDER`:

1. **`google-sheets-direct` (Direct Service Account)**
   * **Required Credentials**: A JSON key file from Google Cloud Console placed at `backend/credentials.json` (or referenced via `GOOGLE_SERVICE_ACCOUNT_FILE`).
   * **How it works**: The backend directly contacts Google API using the Service Account credentials.
2. **`withone` (OAuth Passthrough)**
   * **Required Credentials**: No local file required. Uses `ONE_CONNECTION_KEY` to retrieve data via WithOne's OAuth vault passthrough interface.
