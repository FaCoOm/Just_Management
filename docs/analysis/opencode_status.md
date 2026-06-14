# OpenCode Terminal Agent Status

Captured from terminal process buffer `opencode` (PID: 33036) at 2026-06-10T22:25:00+10:00.

## 🔌 Tooling & MCP Service Status

### Connected MCP Services
* **`ast_grep`**: Connected
* **`context7`**: Connected
* **`grep_app`**: Connected
* **`lsp`**: Connected
* **`notion-mcp-server`**: Connected
* **`pencil`**: Connected
* **`websearch`**: Connected
* **`LSP (typescript)`**: Connected

### Disabled MCP Services
* `canva`
* `chrome-devtools`
* `figma`
* `MCP_DOCKER`
* `notebooklm`
* `one`
* `stitch`
* `supabase`

---

## 🛠️ Required External Admin Actions (User-Only)

These actions involve sensitive credentials and security tasks that can only be handled directly by the user:

1. **Rotate Leaked Secrets**:
   * **`DATABASE_URL`**: Rotate the Azure PostgreSQL server password.
   * **`ONE_SECRET_KEY`**: Rotate the server-side WithOne secret key.
   * *Note*: Both were exposed in plaintext in previous logs/transcripts.
2. **Configure WithOne Connection Key**:
   * Provision a real WithOne connection key (e.g., in `backend/.env`) to replace the default `conn_dev_replace_me` value, ensuring sheet and email passthroughs return `200`.
3. **Deploy Google Service Account Key**:
   * Place a valid Google Service Account credentials JSON file at `backend/credentials.json` (or update `GOOGLE_SERVICE_ACCOUNT_FILE` to point to a valid location). This is required for `google-sheets-direct` verification during ingestion.

---

## 📋 Post-Credential Ingestion Verification Checklist

Once credentials have been placed, run the following to verify the backend pipeline:

- [ ] **Run Ingestion Verification Harness**:
  ```bash
  cd backend
  npm run verify-ingestion
  ```
  Confirm that the Google Sheets happy-path successfully returns a `200` response.
- [ ] **Test Integrations Status Endpoint**:
  * Send a GET request to `/api/integrations/status` and expect a status of `connected`.
- [ ] **Test End-to-End Ingestion**:
  * Trigger a Gmail attachment sync and Google Sheets values fetch. Verify that the number of processed rows is greater than `0` with no errors.
- [ ] **Smoke Test Database Records**:
  * Query `/api/reservations` and `/api/channels` after syncing to confirm new rows appear.
