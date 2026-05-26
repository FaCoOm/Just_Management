---
title: One API Implementation Design — Google Sheets & Google Drive
created: 2026-05-25T13:00:00+10:00
tags: [withone, google-sheets, google-drive, integration, oauth, ingestion]
---

# One API Implementation Design — Google Sheets & Google Drive

## 1. Verdict (Direct Answer)

**Yes — withone fully enables integration of Google Sheets and Google Drive into the Track B webapp**, and is technically the better path than the current `googleapis` + service-account approach for one specific reason: **per-user OAuth at the edge** without handling refresh tokens, consent screens, or Google Cloud project verification.

But withone is a **passthrough, not a replacement for the Google APIs.** The path/method/query semantics that hit `https://api.withone.ai/v1/passthrough/...` are byte-for-byte the official Google REST API. Verified against:

- **Sheets** `GET /v4/spreadsheets/{spreadsheetId}/values:batchGet` — matches Google's documented contract exactly (path params, repeated `ranges` query, `majorDimension`, `valueRenderOption`, `dateTimeRenderOption`, response shape with `valueRanges[].values`). Source: `get_one_action_knowledge` for action `conn_mod_def::GJ30kpWG-z8::VMMRhQGBT_ei-wq4JK7Sow`.
- **Drive** `GET /drive/v3/files` — matches Google Drive v3 exactly (`q`, `corpora`, `pageSize`, `pageToken`, `orderBy`, `driveId`, `supportsAllDrives`, `nextPageToken`/`files[]` response). Source: `get_one_action_knowledge` for action `conn_mod_def::GJ6Rzy_a8J8::5DPVGp3fTXegRgMN4v11tA`.
- **Live MCP test** shows two active connections (`gmail`, `notion`) and 392 available platforms including `google-sheets`, `google-drive`, `google-docs`. Platform is reachable with identity model `default`/`live`.

withone gives **OAuth-as-a-service + a thin HTTP proxy with a fixed action ID**. Everything beyond that (payload shape, ranges, file IDs, error codes) is Google's contract — code still needs to know it.

## 2. Validation Against Official Google APIs

| Concern | Google native (`googleapis` / service account) | withone Passthrough |
|---|---|---|
| Auth surface | Service-account JSON file on disk, broad scope, single identity | OAuth-per-user via AuthKit widget; identity = `user`/`team`/`org`/`project`; no JSON file |
| Refresh tokens | Managed in code | One Vault auto-refreshes; only `connection.key` is held |
| Sheets `values:batchGet` | `sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges })` → typed `Schema$BatchGetValuesResponse` | `GET /v1/passthrough/v4/spreadsheets/{id}/values:batchGet?ranges=...` → identical JSON response, untyped |
| Drive `files.list` | `drive.files.list({ q, pageSize, pageToken, fields })` | `GET /v1/passthrough/drive/v3/files?q=...&pageSize=...` → identical JSON, `fields` partial-response works the same way |
| Drive `files.export` | Returns binary stream | Passthrough returns same binary response — needs explicit `Accept` header handling |
| Quota / rate-limit attribution | Counts against single GCP project | Counts against the end-user's Google quota (their OAuth token) |
| Failure modes | 401 from Google, 403 scope errors | Adds two failure surfaces: `connection key invalid`, `oauth.refresh failed`, plus all original Google errors |
| Webhook for revocation | Poll | `connection.deleted`, `oauth.failed` push events |
| Cost | Free at Google level (within quotas) | One pricing tier on top |
| Action discovery | Static SDK | Dynamic via `search_one_platform_actions` + `get_one_action_knowledge` |

**Critical finding:** passthrough URL semantics differ from the earlier report. The correct URL construction appends **only the third-party API path** to `https://api.withone.ai/v1/`:

```
https://api.withone.ai/v1/passthrough/v4/spreadsheets/{spreadsheetId}/values:batchGet?ranges=Sheet1!A1:Z
```

Not `/passthrough/google-sheets/v4/...` and not the full Google host. The platform is identified by `x-one-connection-key` (`live::google-sheets::default::...`) and the operation by `x-one-action-id`, not by the URL prefix.

## 3. Architectural Fit With Track B

Current service-account-based Sheets ingestion in `backend/src/ingest/services/sheets.ts`:

```ts
const auth = new google.auth.GoogleAuth({
  keyFile: credentialFilePath,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});
```

This is **single-tenant**: one service account reads sheets shared with that account's email. It does not scale to "the operations team connects their own Google account." That is the gap withone closes.

Recommended posture: **dual-mode, additive, behind a feature flag.** Do not delete the service-account path. Grounded in AGENTS rules:

1. `backend/src/ingest/AGENTS.md` — "Keep routes.ts thin: request validation, upload parsing, service dispatch, response status." A new One-backed service slots in cleanly.
2. `backend/prisma/AGENTS.md` — "Preserve additive migration style during Track B transition." New tables/columns, not mutations.
3. Existing `processGoogleSheetsSync` converts rows to CSV buffer and reuses `processListingSync`/`processReservationSync`. One-backed variant produces the **same CSV buffer shape** so downstream normalizer and writer code is unchanged.

## 4. Component Design

### 4.1 New module layout

```
backend/src/
├── integrations/
│   └── one/
│       ├── client.ts                    # withone HTTP client (fetch wrapper)
│       ├── connections.ts               # Vault list/lookup/delete
│       ├── auth-token.ts                # /v1/authkit/token issuance
│       ├── webhooks.ts                  # signature verify, event router
│       └── google/
│           ├── sheets.ts                # values:batchGet, spreadsheets.get
│           └── drive.ts                 # files.list, files.export, files.get
├── ingest/
│   └── services/
│       ├── sheets.ts                    # existing, untouched
│       └── sheets-one.ts                # One-backed equivalent
└── routes/
    └── one.ts                           # /api/one/auth-token, /api/one/connections, /api/one/webhook
```

Frontend: single new file `src/components/integrations/ConnectIntegrationButton.tsx` plus hook `src/hooks/use-one-connections.ts`.

### 4.2 The withone client

```ts
// backend/src/integrations/one/client.ts
const BASE = process.env.ONE_API_BASE ?? "https://api.withone.ai/v1";

export interface PassthroughOptions {
  connectionKey: string;
  actionId: string;
  method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  path: string;                       // e.g. "/v4/spreadsheets/{id}/values:batchGet"
  query?: Record<string, string | number | string[] | undefined>;
  body?: unknown;
  accept?: string;                    // default "application/json"
  signal?: AbortSignal;
}

export async function passthrough<T = unknown>(opts: PassthroughOptions): Promise<T> {
  const secret = requireSecret();
  const url = new URL(BASE + "/passthrough" + ensureLeadingSlash(opts.path));
  appendQuery(url, opts.query);

  const response = await fetch(url, {
    method: opts.method,
    headers: {
      "x-one-secret": secret,
      "x-one-connection-key": opts.connectionKey,
      "x-one-action-id": opts.actionId,
      "Accept": opts.accept ?? "application/json",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  if (!response.ok) {
    throw await OneApiError.from(response, opts);
  }
  return (opts.accept?.startsWith("application/json") ?? true)
    ? await response.json() as T
    : await response.arrayBuffer() as unknown as T;
}
```

Contract details from action knowledge:
- `appendQuery` must emit `ranges=A1:B2&ranges=D1:E2` (repeated keys) for Sheets `batchGet`. `URLSearchParams.append` per array element handles this.
- `path` must start with `/v4/...` or `/drive/v3/...` (Google's path), not with the platform slug.
- Error envelope: One forwards Google's `{ error: { code, message, status } }` shape. Map to existing `IngestErrorCode` set:
  - `connection key invalid` / `connection deleted` → `CONFIG_AUTH_FAILURE`
  - Google `403`/`401` after token refresh → `CONFIG_AUTH_FAILURE`
  - Google `400 INVALID_ARGUMENT` → `MALFORMED_FILE`
  - Google `404 spreadsheet not found` → `UNSUPPORTED_SOURCE`
  - Anything else → `MALFORMED_FILE` with full message

### 4.3 Sheets adapter

```ts
// backend/src/integrations/one/google/sheets.ts
const ACTION_BATCH_GET = "conn_mod_def::GJ30kpWG-z8::VMMRhQGBT_ei-wq4JK7Sow";
const ACTION_GET_SPREADSHEET = "conn_mod_def::GJ30jpJCuBA::-7kldtebSUeO7_FYtT48JQ";

export async function fetchSheetValues(
  connectionKey: string,
  spreadsheetId: string,
  sheetName: string | undefined,
): Promise<string[][]> {
  const range = sheetName ? `${sheetName}!A:ZZ` : await resolveFirstSheetRange(connectionKey, spreadsheetId);

  const data = await passthrough<{ valueRanges: { values?: unknown[][] }[] }>({
    connectionKey,
    actionId: ACTION_BATCH_GET,
    method: "GET",
    path: `/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet`,
    query: { ranges: [range], valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING" },
  });

  const rows = data.valueRanges[0]?.values ?? [];
  return rows.map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
}
```

`services/sheets-one.ts` mirrors `processGoogleSheetsSync` but takes a `connectionKey` instead of a credential file path, feeds output through existing `valuesToCsvBuffer` → `processListingSync`/`processReservationSync` chain. Zero changes to `normalizer.ts`, `parser.ts`, `services/listings.ts`, `services/reservations.ts`.

`UNFORMATTED_VALUE` + `FORMATTED_STRING` keeps numeric values numeric and dates as ISO-ish strings rather than serial numbers — avoids a class of normalizer bugs.

### 4.4 Drive adapter

```ts
const ACTION_LIST_FILES = "conn_mod_def::GJ6Rzy_a8J8::5DPVGp3fTXegRgMN4v11tA";

export async function listSpreadsheetsInFolder(connectionKey: string, folderId: string) {
  return passthrough<{ files: DriveFile[]; nextPageToken?: string }>({
    connectionKey,
    actionId: ACTION_LIST_FILES,
    method: "GET",
    path: "/drive/v3/files",
    query: {
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
      pageSize: 100,
      fields: "nextPageToken,files(id,name,modifiedTime,owners(emailAddress))",
      orderBy: "modifiedTime desc",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    },
  });
}
```

Unlocks auto-discovery: ops user picks a folder once, system discovers new spreadsheets daily, ingests delta. The `fields` partial-response parameter is essential — without it `files.list` returns ~80 fields per file.

### 4.5 Connection persistence schema

Per `backend/prisma/AGENTS.md`: additive migration, provider-specific metadata stays at provider edge.

```prisma
model integration_connections {
  id             String   @id @default(uuid()) @db.Uuid
  user_id        String
  identity_type  String   @default("user")          // user | team | organization | project
  platform       String                              // google-sheets | google-drive | gmail | notion
  connection_key String   @unique                    // live::google-sheets::default::xxxxx
  display_name   String?
  environment    String   @default("live")
  status         String   @default("active")         // active | revoked | failed_refresh
  last_used_at   DateTime? @db.Timestamptz(6)
  last_error     String?
  metadata       Json?
  created_at     DateTime @default(now()) @db.Timestamptz(6)
  updated_at     DateTime @default(now()) @db.Timestamptz(6)

  @@index([user_id, platform])
  @@index([status])
}
```

Paired migration adds `set_updated_at_timestamp` trigger — pattern already established. Do not put connection key into `external_accounts.metadata` (that table is for channel-provider accounts).

### 4.6 Auth token endpoint

```ts
POST /api/one/auth-token
  - CORS: use existing ALLOWED_ORIGINS (NOT wildcard)
  - Identity comes from authenticated session, not a client header
  - Gate behind NODE_ENV !== "production" until real auth is added (Sprint 2)
```

### 4.7 Webhook handler

Required. Dashboard must show if a connection's OAuth was revoked.

```ts
POST /api/one/webhook
  - Verify HMAC signature in X-Webhook-Signature against ONE_WEBHOOK_SECRET
  - Branch on event type:
      connection.deleted -> mark status = 'revoked'
      oauth.failed       -> mark status = 'failed_refresh', store last_error
      oauth.refreshed    -> noop
  - Respond 200 within 5s; async for heavy work
```

Ignore `passthrough.executed` — high-volume, low-value for a hospitality dashboard.

## 5. Environment & Configuration

Add to `backend/.env.example`:

```bash
ONE_SECRET_KEY=sk_live_...            # server-only, never frontend
ONE_API_BASE=https://api.withone.ai/v1
ONE_WEBHOOK_SECRET=whsec_...
ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE=user
```

Add to root `.env.example`:

```bash
VITE_ONE_AUTH_TOKEN_URL=http://localhost:3001/api/one/auth-token
```

## 6. Security Posture

- **Identity model is irreversible-ish.** After 50 connections are scoped to `identity=userId`, switching requires re-onboarding. For 8 properties with small staff, `identityType: "user"` keyed to operator's account ID is the right default.
- **Scope minimization at AuthKit level.** Enable read-only scope (`spreadsheets.readonly`) in `app.withone.ai/settings/authkit` explicitly. Protects against accidental writes to customer sheets.
- **Vault is encrypted at rest in One; `connection.key` useless without `ONE_SECRET_KEY`.** Still: do not log it, do not return in client responses, treat like a database connection string.
- **Webhook signature verification is mandatory.** Without it, anyone can POST and mark connections revoked. Use constant-time HMAC compare.

## 7. Verification & Rollout Plan

### Phase 1 — Backend foundation (4-6 hours)
1. Add `integration_connections` model + migration; verify: `npm run db:generate`, `npm run db:validate`, `npm run db:verify:migration`.
2. Implement `integrations/one/client.ts` and `google/sheets.ts`. Unit-test `appendQuery` repeated-key behavior and error mapping.
3. Manual passthrough test using existing live `gmail` connection to validate client wrapper before touching Sheets.
4. Run `npm run verify-ingestion` and `npm run verify:all`.

### Phase 2 — Connect to ingest pipeline
1. Add `services/sheets-one.ts` mirroring `services/sheets.ts`. Reuse `valuesToCsvBuffer` and existing listing/reservation services.
2. Feature flag `INGEST_SHEETS_PROVIDER=google-sheets-direct|withone` in the existing `/api/ingest/google-sheets` handler.
3. Manual endpoint test with `dryRun=true` against a real spreadsheet ID. Inspect `processed`, `created`, `updated`, `skipped`, `deadLetters`, `errors`.

### Phase 3 — Frontend connect button + connection list
1. Add `@withone/auth` to root `package.json`.
2. Build `ConnectIntegrationButton` and `useOneConnections` hook in `src/hooks/`.
3. Delegate UI work to `visual-engineering` category.

### Phase 4 — Webhook + observability
1. Implement webhook handler and signature verification.
2. Surface connection status in integration page. Prompt reconnect on `failed_refresh`.

## 8. What This Design Does Not Cover

- **Writes to Sheets.** Same client supports it via update/append actions. Default to read-only until product requirement exists.
- **Real-time sync.** Google APIs are pull-only via withone. Drive `changes.watch` channel lifecycle (7-day renewal) is messy through a passthrough layer. Defer.
- **Auth on `/api/one/*` routes.** Clerk/Auth0 is Sprint 2. Gate auth-token endpoint behind dev-only check until then.
- **Batching multiple sheets in one ingest run.** Possible via Drive `files.list` → loop → `values:batchGet`. Worth doing, not in v1.

---

## Bottom Line

withone's API enables the integration and Google Sheets/Drive coverage is real, complete for ingestion needs, and contract-stable with Google's official APIs. The work is additive — sits next to existing service-account ingest path, respects all Track B repository/Prisma/ingest boundaries, and leaves the dashboard data contract untouched.

Two things that will bite if not done upfront:
1. **Fix passthrough URL semantics** — path is the third-party path, not platform slug + path.
2. **Decide identity tenancy model on day one** — `user` is right default for this scale.
