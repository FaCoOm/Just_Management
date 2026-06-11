# M Management Ingestion Pipeline  -  Implementation Plan

> **Source spec:** [docs/m-management-ingestion-pipeline.md](../docs/m-management-ingestion-pipeline.md)
> **For agentic workers:** REQUIRED follow superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Complete every deferred user story in the M Management Ingestion Pipeline spec by incorporating the withone API as the OAuth/transport layer for Google Sheets, Google Drive, and Gmail; persist a built-in seeder from `database_design/`; deliver a runtime folder watcher; and expose an admin frontend page so all six user stories pass acceptance.

**Architecture (no major shift):** Express + Prisma + Azure PostgreSQL backend. React 19 + TanStack Router/Query frontend. Repository-layer data access. Add withone passthrough as a parallel auth/transport surface for Google services; keep service-account Sheets path as a feature-flag fallback during migration.

**Tech stack additions:** `@withone/auth` (frontend widget), `chokidar` (folder watcher), withone HTTP passthrough client written in-house (no SDK dependency).

---

## Executive Summary

Slice 1 of the spec is already shipped. Verified artifacts in the codebase:

- `backend/src/ingest/pipeline.ts`  -  `getPipelineStatus()` + `getGoogleCredentialStatus()` exporting safe metadata, 5 connectors (`admin-upload`, `folder-watch`, `email`, `built-in`, `google-sheets`), env-driven state.
- `backend/src/ingest/routes.ts`  -  `GET /api/ingest/pipeline/status` (200) and `POST /api/ingest/pipeline/run` returning `501` with `SYNC_NOT_IMPLEMENTED` and `dryRun` validation.
- `backend/src/ingest/contracts.ts`  -  `SYNC_NOT_IMPLEMENTED` already in `ingestErrorCodes`. `pipelineModes` defined.
- Existing endpoints: `POST /api/ingest/listings`, `/api/ingest/reservations`, `/api/ingest/google-sheets` all enforce `dryRun`, parse multipart via the shared `parseOptionalMultipart` middleware, and import their service modules dynamically.
- Schema: `sync_runs`, `sync_dead_letters`, `provider_reservation_import_rows` exist.

This plan covers the **deferred** items only:

1. Real folder watcher with file processing (Story 3 acceptance).
2. Email connector backed by withone Gmail (Story 4 acceptance).
3. Built-in CSV seed execution from `database_design/` (Story 5 acceptance).
4. Pipeline `run` endpoint that actually drives the connectors (replaces the 501 in matched modes).
5. Withone integration surface: connection lifecycle, vault, webhook, frontend connect button.
6. Frontend admin Pipeline Status + Upload page (Stories 1 & 2 UI).
7. Auth scaffold gate (Sprint 2 deferred per existing repo plan, but route guard hooks must be in place now).
8. Additive Prisma migrations for connector durability: `integration_connections`, `watched_files`, `email_import_messages`, `seed_batches`.

The plan is written so each Phase is self-contained and verifiable. Phases run in waves where independence allows.

---

## User Story -> Deliverable Map

| Story | Acceptance gate | Deliverable in this plan |
|---|---|---|
| **1. Admin reviews status** | Status response with safe metadata | Phase 6 (frontend page) consumes existing `GET /api/ingest/pipeline/status`; Phase 1 augments status with new connector fields (`hasGoogleSheetsConnection`, `hasGmailConnection`, `lastRunAt`, `lastRunStatus`). |
| **2. Admin uploads CSV** | `dryRun` enforced, separate listings/reservations | Phase 6 (frontend Upload UI). Backend already enforces; UI consumes `/api/ingest/listings` and `/api/ingest/reservations`. |
| **3. Folder watch** | Monitor folder, detect changed files, never auto-mutate | Phase 3  -  `chokidar` watcher + `watched_files` durability + dry-run preview endpoint + manual `apply` step. |
| **4. Email CSV ingest** | Email config explicit, deferred fetch routes through dryRun + summary | Phase 4  -  withone Gmail connector + `email_import_messages` idempotency + same `IngestSummaryResponse` shape. |
| **5. Built-in seed** | Seed `database_design/` into existing tables | Phase 5  -  seeder service that reads CSVs + classification JSON, writes channels/external_accounts/channel_listings, batched + idempotent. |
| **6. Failed-row review** | Dead letters surface bad rows | All connectors write through `services/listings.ts` and `services/reservations.ts`, which already populate `sync_dead_letters`. Phase 6 surfaces dead-letter counts. |

---

## Phase 0  -  Foundations (Wave 1)

**Wave 1 runs in parallel:** Phase 0 + Phase 1 + Phase 2.

### 0.1 Withone HTTP client

- [ ] Create `backend/src/integrations/one/client.ts` exporting `passthrough<T>(opts)` per the design in [docs/analysis/one-api-implementation-design.md](../docs/analysis/one-api-implementation-design.md).
- [ ] Read `ONE_SECRET_KEY` from env; throw a typed `OneConfigError` if missing.
- [ ] `appendQuery` helper must emit repeated keys (`ranges=A&ranges=B`) using `URLSearchParams.append`.
- [ ] `OneApiError` class wraps fetch failures with three layers: connection (vault), oauth (refresh failure), upstream (Google). Each maps to an existing `IngestErrorCode`.
- [ ] Construct passthrough URL as `${ONE_API_BASE}/passthrough${pathStartingWithSlash}`  -  third-party path only, no platform slug prefix.
- [ ] Default `Accept: application/json`; allow override for binary attachment downloads.

### 0.2 Connection vault wrapper

- [ ] Create `backend/src/integrations/one/connections.ts` with:
  - `listConnections(identity, identityType)` -> `GET /v1/vault/connections`
  - `getConnection(connectionKey)` -> vault metadata
  - `deleteConnection(connectionKey)` -> revocation
- [ ] No business logic here; provider modules call these.

### 0.3 Auth-token endpoint (dev-gated)

- [ ] Create `backend/src/integrations/one/auth-token.ts` issuing `POST https://api.withone.ai/v1/authkit/token` with the authenticated user's id.
- [ ] Until Sprint 2 auth lands: gate the route behind `NODE_ENV !== "production"` AND a shared `ONE_DEV_TOKEN` header. Document the decision in `backend/AGENTS.md` once implemented.
- [ ] Reuse existing `ALLOWED_ORIGINS` CORS array  -  no wildcard.

### 0.4 Webhook handler (signature-verified)

- [ ] Create `backend/src/integrations/one/webhooks.ts`.
- [ ] Verify `X-Withone-Signature` against `ONE_WEBHOOK_SECRET` using constant-time HMAC compare (`crypto.timingSafeEqual`).
- [ ] Branch on `connection.deleted` -> mark `integration_connections.status = 'revoked'`. `oauth.failed` -> `status = 'failed_refresh'`, store `last_error`. `oauth.refreshed` -> bump `updated_at`. Ignore `passthrough.executed`.
- [ ] Respond 200 within 5s; defer heavy work via `setImmediate`.

### 0.5 Routes module + registration

- [ ] Create `backend/src/routes/one.ts` registering:
  - `POST /api/one/auth-token`
  - `GET /api/one/connections`
  - `DELETE /api/one/connections/:key`
  - `POST /api/one/webhook`
- [ ] Mount from `backend/src/index.ts` alongside `registerIngestRoutes(app)`.
- [ ] Use `express.raw({ type: 'application/json' })` ONLY on the webhook route so signature verification has the original byte buffer.

### 0.6 Environment variables

Add to `backend/.env.example`:

```bash
ONE_SECRET_KEY=sk_live_...
ONE_API_BASE=https://api.withone.ai/v1
ONE_WEBHOOK_SECRET=whsec_...
ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE=user
ONE_DEV_TOKEN=dev-only-shared-secret
```

Add to root `.env.example`:

```bash
VITE_ONE_AUTH_TOKEN_URL=http://localhost:3001/api/one/auth-token
```

### 0.7 Verification

- [ ] `cd backend && npm run build` exits 0.
- [ ] Hit `POST /api/one/auth-token` with the dev token -> returns 200 with token JSON.
- [ ] Hit `GET /api/one/connections` -> returns the existing two connections (`gmail`, `notion`) per the user's vault.

---

## Phase 1  -  Schema Additions (Wave 1)

Per `backend/prisma/AGENTS.md`: additive only, never edit applied migrations.

### 1.1 `integration_connections`

- [ ] Add model to `backend/prisma/schema.prisma`:

```prisma
model integration_connections {
  id             String    @id @default(uuid()) @db.Uuid
  user_id        String
  identity_type  String    @default("user")
  platform       String
  connection_key String    @unique
  display_name   String?
  environment    String    @default("live")
  status         String    @default("active")
  last_used_at   DateTime? @db.Timestamptz(6)
  last_error     String?
  metadata       Json      @default("{}")
  created_at     DateTime  @default(now()) @db.Timestamptz(6)
  updated_at     DateTime  @default(now()) @db.Timestamptz(6)

  @@index([user_id, platform])
  @@index([status])
}
```

### 1.2 `watched_files`

- [ ] Add model:

```prisma
model watched_files {
  id              String    @id @default(uuid()) @db.Uuid
  watch_dir       String
  relative_path   String
  size_bytes      BigInt
  mtime           DateTime  @db.Timestamptz(6)
  content_sha256  String
  last_seen_at    DateTime  @default(now()) @db.Timestamptz(6)
  last_processed_at DateTime? @db.Timestamptz(6)
  last_sync_run_id String?  @db.Uuid
  status          String    @default("seen")  // seen | processed | quarantined | skipped
  failure_reason  String?

  @@unique([watch_dir, relative_path, content_sha256])
  @@index([status])
}
```

### 1.3 `email_import_messages`

- [ ] Add model:

```prisma
model email_import_messages {
  id                  String    @id @default(uuid()) @db.Uuid
  connection_key      String
  provider            String    @default("gmail")
  provider_message_id String
  thread_id           String?
  internal_date       DateTime? @db.Timestamptz(6)
  subject             String?
  from_address        String?
  attachment_filename String?
  attachment_size     BigInt?
  attachment_sha256   String?
  status              String    @default("seen")  // seen | processed | quarantined | skipped
  last_sync_run_id    String?   @db.Uuid
  failure_reason      String?
  created_at          DateTime  @default(now()) @db.Timestamptz(6)
  updated_at          DateTime  @default(now()) @db.Timestamptz(6)

  @@unique([connection_key, provider_message_id, attachment_sha256])
  @@index([status])
}
```

### 1.4 `seed_batches`

- [ ] Add model:

```prisma
model seed_batches {
  id              String    @id @default(uuid()) @db.Uuid
  source_dir      String
  manifest_sha256 String
  status          String    @default("started") // started | completed | failed
  sync_run_id     String?   @db.Uuid
  started_at      DateTime  @default(now()) @db.Timestamptz(6)
  finished_at     DateTime? @db.Timestamptz(6)
  notes           String?

  @@index([source_dir, status])
}
```

### 1.5 `set_updated_at_timestamp` triggers

- [ ] Migration must add `BEFORE UPDATE` triggers on `integration_connections` and `email_import_messages` (the two tables with `updated_at`). Pattern already established in `20260502000000_init_track_b/migration.sql`.

### 1.6 Verification

- [ ] `cd backend && npm run db:generate` succeeds.
- [ ] `npm run db:validate` succeeds.
- [ ] `npm run db:verify:migration` confirms no Supabase RLS syntax leaked.
- [ ] `npm run build` exits 0 (Prisma client types regenerated).

---

## Phase 2  -  Withone Google Sheets Adapter (Wave 1)

### 2.1 Sheets adapter using passthrough

- [ ] Create `backend/src/integrations/one/google/sheets.ts`:
  - `fetchSheetValues(connectionKey, spreadsheetId, sheetName?)` returns `string[][]`.
  - Use action `conn_mod_def::GJ30kpWG-z8::VMMRhQGBT_ei-wq4JK7Sow` (`values:batchGet`).
  - Path: `/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet`.
  - Query: `ranges=[range]`, `valueRenderOption=UNFORMATTED_VALUE`, `dateTimeRenderOption=FORMATTED_STRING`.
  - When `sheetName` omitted, first call action `conn_mod_def::GJ30jpJCuBA::-7kldtebSUeO7_FYtT48JQ` (`get spreadsheet`) to resolve `sheets[0].properties.title`.
  - Coerce all cells to `string`; null/undefined -> `""`.

### 2.2 New service `services/sheets-one.ts`

- [ ] Mirror `services/sheets.ts` shape: `processGoogleSheetsSync(spreadsheetId, sheetName, targetKind, sourceAccount, dryRun, connectionKey)`.
- [ ] Internally: `fetchSheetValues` -> reuse existing `valuesToCsvBuffer` from `services/sheets.ts` (extract to a shared helper if not already exported) -> call `processListingSync` or `processReservationSync` with that buffer. Zero changes to normalizer or downstream services.

### 2.3 Feature flag in routes

- [ ] In `backend/src/ingest/routes.ts` `POST /api/ingest/google-sheets`:
  - Read `INGEST_SHEETS_PROVIDER` env (`withone` default | `google-sheets-direct` legacy fallback).
  - When `withone`: require `connectionKey` in body, validate it exists in `integration_connections` for the request user, dispatch to `services/sheets-one.ts`.
  - When `google-sheets-direct`: existing behavior.
  - Validation error if `withone` selected but no `connectionKey` provided -> `CONFIG_AUTH_FAILURE`.

### 2.4 Drive adapter (for folder auto-discovery in Phase 3)

- [ ] Create `backend/src/integrations/one/google/drive.ts`:
  - `listSpreadsheetsInFolder(connectionKey, folderId)` returns `{ files: { id, name, modifiedTime }[]; nextPageToken? }`.
  - Action `conn_mod_def::GJ6Rzy_a8J8::5DPVGp3fTXegRgMN4v11tA` (`files.list`).
  - `q` param: `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`.
  - `fields` param: `nextPageToken,files(id,name,modifiedTime,owners(emailAddress))`.

### 2.5 Verification

- [ ] Build passes.
- [ ] Manual test: with the existing `gmail` connection (already in vault, used as a known-working connection key), call passthrough through the client wrapper -> confirm 200 response. This validates the client BEFORE we depend on Google Sheets.
- [ ] Manual test against a real Google Sheets spreadsheet with a fresh withone connection key (operator connects via frontend in Phase 6, but a manual `curl` against `/api/one/auth-token` + browser flow is acceptable for this phase's QA).

---

## Phase 3  -  Folder Watcher (Wave 2)

**Wave 2 runs in parallel:** Phase 3 + Phase 4 + Phase 5. All three depend only on Phases 0-2.

### 3.1 Watcher module

- [ ] Add `chokidar` to `backend/package.json` dependencies.
- [ ] Create `backend/src/ingest/watchers/folder.ts`:
  - On startup, if `INGEST_PIPELINE_ENABLED=true` and `M_MANAGEMENT_WATCH_DIR` exists, instantiate `chokidar.watch(dir, { ignoreInitial: false, awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 200 } })`.
  - Listen for `add` and `change` events.
  - On event: compute SHA-256 of file contents, look up `watched_files` by `(watch_dir, relative_path, content_sha256)`. If the row exists with `status = 'processed'`, skip. Otherwise insert/update with `status = 'seen'`.
  - **Never** auto-mutate business tables. The watcher only updates `watched_files`.

### 3.2 Pipeline `run` endpoint  -  folder mode

- [ ] In `routes.ts` `POST /api/ingest/pipeline/run`:
  - When `mode === 'folder-watch'`:
    - Require `dryRun: true` for any preview; allow `dryRun: false` only with `sourceAccount` and a list of `watchedFileIds` to apply.
    - List `watched_files` with `status = 'seen'` matching `targetKind` filename pattern (`listings*.csv`, `reservations*.csv`).
    - For each: read file from disk, dispatch to `processListingSync` or `processReservationSync` with the `dryRun` flag.
    - On success: update `watched_files.status = 'processed'`, `last_processed_at = now()`, `last_sync_run_id = summary.syncRunId`.
    - On failure: `status = 'quarantined'`, `failure_reason = error.message`.
  - Return aggregated `IngestSummaryResponse` (sum `processed`, `created`, `updated`, `skipped`, `deadLetters`).

### 3.3 Filename-to-target inference

- [ ] In `backend/src/ingest/watchers/folder.ts`, expose `inferTargetKind(filename)`:
  - `^listings?[._-]` (case-insensitive) -> `listings`
  - `^reservations?[._-]` -> `reservations`
  - default -> `unknown` (status `skipped`, never auto-applied).
- [ ] Filenames matching neither pattern remain `seen` and are not advanced to `processed`.

### 3.4 Status augmentation

- [ ] Extend `getPipelineStatus()` in `pipeline.ts`:
  - Add `folder.watchedFiles: { seen: number; processed: number; quarantined: number }` (counts only).
  - Read counts from `watched_files` grouped by `watch_dir`.

### 3.5 Verification

- [ ] Drop a known-good `listings-airbnb-main.csv` into the watch dir.
- [ ] Hit `GET /api/ingest/pipeline/status` -> confirm `watchedFiles.seen >= 1`.
- [ ] Hit `POST /api/ingest/pipeline/run { mode: 'folder-watch', targetKind: 'listings', dryRun: true }` -> returns summary with `processed > 0` and `created/updated/skipped` populated; no DB mutation.
- [ ] Repeat with `dryRun: false, watchedFileIds: [...]` -> mutations applied; `watched_files.status` advances to `processed`.
- [ ] Drop the same file again -> idempotent: status stays `processed`, no new mutations.

---

## Phase 4  -  Email Connector via Withone Gmail (Wave 2)

### 4.1 Gmail provider

- [ ] Create `backend/src/integrations/one/google/gmail.ts`:
  - `listMessages(connectionKey, query, pageToken?)`  -  action `conn_mod_def::GJ3odOE-fdw::ijLww5s-SCSplLQtLpxkrw`. Path `/gmail/v1/users/me/messages`. Query parameters: `q`, `maxResults`, `pageToken`.
  - `getMessage(connectionKey, messageId)`  -  action `conn_mod_def::GJ3ocvMGOS8::D__3BgQSSzWtDUoOqLuX2A`. Path `/gmail/v1/users/me/messages/${messageId}`. `format=full` to get payload tree.
  - `getAttachment(connectionKey, messageId, attachmentId)`  -  action `conn_mod_def::GJ3ocG2ED_w::LGrrJyM-QFmKBaHwvMWwzQ`. Path `/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`. Response is `{ size: number, data: string }` where `data` is base64url-encoded.

### 4.2 Email service

- [ ] Create `backend/src/ingest/services/email.ts`:
  - `processEmailSync(connectionKey, targetKind, sourceAccount, dryRun)`:
    - Build search query: `from:airbnb OR from:bookings has:attachment filename:csv newer_than:30d`.
    - Page through `listMessages` (max 50 messages per run).
    - For each message: `getMessage`, walk `payload.parts` recursively to find parts where `filename` ends in `.csv` and `body.attachmentId` exists.
    - Compute SHA-256 of decoded attachment bytes; check `email_import_messages` for `(connection_key, provider_message_id, attachment_sha256)`  -  skip if `status = 'processed'`.
    - Otherwise: `getAttachment`, base64url-decode the `data` field.
    - Dispatch to `processListingSync` or `processReservationSync` based on `targetKind` (or filename inference).
    - Persist `email_import_messages` with status reflecting outcome.

### 4.3 Pipeline `run`  -  email mode

- [ ] Extend `POST /api/ingest/pipeline/run` to handle `mode === 'email'`:
  - Require `connectionKey` (Gmail connection in `integration_connections`) and `targetKind`.
  - Call `processEmailSync`.
  - Return aggregated `IngestSummaryResponse`.

### 4.4 Status augmentation

- [ ] In `pipeline.ts`, `email` connector:
  - When a Gmail connection exists in `integration_connections` for the requesting user (via header lookup until auth lands), report `state: 'ready'` and include `last_used_at` from `integration_connections`.
  - Include `emailMessages: { seen, processed, quarantined }` from `email_import_messages` grouped by connection key.

### 4.5 Verification

- [ ] User connects Gmail via frontend (Phase 6)  -  produces a `connection_key` in `integration_connections`.
- [ ] `POST /api/ingest/pipeline/run { mode: 'email', targetKind: 'reservations', sourceAccount: 'airbnb-main', connectionKey, dryRun: true }` -> returns non-zero `processed` if matching messages exist; `email_import_messages` rows appear with `status = 'seen'`.
- [ ] Same call with `dryRun: false` -> mutations apply; rows advance to `processed`.
- [ ] Re-run is idempotent.

---

## Phase 5  -  Built-In Seeder from `database_design/` (Wave 2)

### 5.1 Seed source contract

The classification JSON is the truth source; CSVs are raw provider exports. Verified shape:

```json
{
  "listings": [
    {
      "id": "33825990",
      "canonicalAccount": "Mujo",
      "visibilityTier": "ruby_mujo",
      "visibleInAccounts": ["Mujo", "Ruby"],
      "title": "Deluxe condo Queen bed with Bathtub #Central #D1",
      "internalName": "LL - Milk 2 & Coffee 2",
      "statusByAccount": { "Mujo": "Listed", "Ruby": "Da dang" },
      "sourceRows": { "Mujo": "...", "Ruby": "..." }
    }
  ]
}
```

- `Da dang` is Vietnamese for `Listed` (mojibake from cp1252-encoded source). Both should normalize to canonical `active` in `external_accounts.status`.

### 5.2 Account mapping

| Source account in CSV | Normalized `external_accounts.account_key` | Channel |
|---|---|---|
| `Mujo` | `airbnb-main` | `airbnb` |
| `Ruby` | `airbnb-ruby` | `airbnb` |
| `Manuka` | `airbnb-manuka22` | `airbnb` |

These match the existing `sourceAccounts` enum in `contracts.ts`.

### 5.3 Seeder service

- [ ] Create `backend/src/ingest/services/seed-builtin.ts` exporting `processBuiltInSeed(sourceDir, dryRun)`:
  1. Compute SHA-256 of `listing-account-classification.json`. If a `seed_batches` row already exists for this `(source_dir, manifest_sha256)` with `status = 'completed'`, return summary with `processed = 0, skipped = N` (idempotent no-op).
  2. Open a `sync_runs` row: `source_type = 'built-in'`, `source_account = null`, `endpoint = '/api/ingest/pipeline/run'`, `is_dry_run`.
  3. Upsert `channels` row for `airbnb` if missing.
  4. Upsert `external_accounts` rows for the 3 source accounts.
  5. Iterate `listings[]`:
     - Determine which `external_accounts` the listing is visible in (`visibleInAccounts`).
     - For each visible account: upsert a `channel_listings` row keyed `(external_account_id, provider_listing_id = listing.id)` with `title`, `internal_name`, `listing_type`, `location`.
     - **Hierarchy preservation:** When a listing has `canonicalAccount = 'Manuka'`, the upsert into Mujo and Ruby accounts uses the same `provider_listing_id`. This matches the `Manuka subset-of Ruby subset-of Mujo` truth. No duplicate canonical listings created.
     - Skip rows where `internalName` is empty or `id` is missing -> write to `sync_dead_letters` with `failure_code = 'AMBIGUOUS_LISTING_MATCH'`.
  6. Close `sync_runs` with counts.
  7. Insert `seed_batches` row with `status = 'completed'` and the manifest hash.

### 5.4 Pipeline `run`  -  built-in mode

- [ ] In `routes.ts`, when `mode === 'built-in'`:
  - Resolve `sourceDir` via `M_MANAGEMENT_BUILTIN_SOURCE_DIR ?? '../database_design'`.
  - Call `processBuiltInSeed(sourceDir, dryRun)`.
  - Return summary.

### 5.5 Status augmentation

- [ ] In `pipeline.ts`, `built-in` connector:
  - Check `seed_batches` for the configured `sourceDir`. Report `lastBatchStatus`, `lastFinishedAt`, `manifestSha256` (truncated to 12 chars for display).

### 5.6 Verification

- [ ] `POST /api/ingest/pipeline/run { mode: 'built-in', targetKind: 'listings', dryRun: true }` -> returns non-zero `processed`; no DB mutations except the `seed_batches` row in `started` state (or no row at all if dryRun is fully read-only  -  choose the latter).
- [ ] Same call with `dryRun: false` -> channels, external_accounts, channel_listings rows populated; `seed_batches` row marked `completed`.
- [ ] Re-run is idempotent: returns 0 created, all skipped.
- [ ] Verify hierarchy: a listing with `canonicalAccount = 'Manuka'` produces 3 `channel_listings` rows (one per source account), all with the same `provider_listing_id`.

---

## Phase 6  -  Frontend Admin Page (Wave 3)

**Wave 3 depends on Phases 0-5 backend.** Delegate this entire phase to `visual-engineering` category with `frontend-ui-ux` skill  -  visual work goes there per AGENTS rules.

### 6.1 Withone connect button

- [ ] Add `@withone/auth` to root `package.json`.
- [ ] Create `src/components/integrations/ConnectIntegrationButton.tsx` accepting `platform` prop (`google-sheets | google-drive | gmail`).
- [ ] On click: fetch token from `VITE_ONE_AUTH_TOKEN_URL`, open AuthKit widget, on success POST `{ connectionKey, platform, displayName }` to `/api/one/connections` to persist.

### 6.2 Connection list hook

- [ ] Create `src/hooks/use-one-connections.ts` with:
  - `useConnections()`  -  TanStack Query wrapper around `GET /api/one/connections`.
  - `useDisconnect()`  -  mutation around `DELETE /api/one/connections/:key`.

### 6.3 Pipeline status hook

- [ ] Create `src/hooks/use-pipeline-status.ts` wrapping `GET /api/ingest/pipeline/status` (TanStack Query, 30s `staleTime`).

### 6.4 Settings -> Integrations page

- [ ] Add route `/settings/integrations` to `src/router.tsx`.
- [ ] Create `src/pages/settings/integrations-page.tsx`:
  - Section 1: Pipeline status table  -  one row per connector with state, detail, path/connection.
  - Section 2: Connections list  -  connected accounts grouped by platform with disconnect button.
  - Section 3: CSV upload  -  separate cards for listings and reservations with `dryRun` toggle and `sourceAccount` picker. Submits to `/api/ingest/listings` or `/api/ingest/reservations`. Shows summary panel after response.
  - Section 4: Manual run  -  drop-down for mode (`folder-watch | email | built-in | google-sheets`), target kind, source account, dryRun toggle. Submits to `/api/ingest/pipeline/run`. Shows summary panel.

### 6.5 Visual treatment

- [ ] Follow Harbor/Brass design tokens established in `src/index.css`. Newsreader for headings, Plus Jakarta Sans for body. No purple-on-white default.
- [ ] Use existing shadcn primitives from `src/components/ui/`. No new primitives unless absolutely required.
- [ ] Verify mobile + desktop rendering.

### 6.6 Verification

- [ ] `npm run typecheck` exits 0.
- [ ] `npm run build` exits 0.
- [ ] Manual: load `/settings/integrations` -> all four sections render. Connect Google Sheets -> connection appears. Run a built-in dryRun seed -> summary appears with non-zero processed.

---

## Phase 7  -  Auth Scaffold Hook (Wave 3)

This phase does NOT implement auth. Per `plans/track-b-technical-validation-plan.md`, real auth is Sprint 2. This phase only adds the seam so it can drop in cleanly.

### 7.1 Request-scoped user context

- [ ] Add `backend/src/middleware/user-context.ts`:
  - Reads `X-User-Id` header in dev mode (or `req.user.id` once Clerk/Auth0 lands).
  - Attaches `req.userContext = { userId, identityType }` for downstream handlers.
  - Returns 401 from `/api/ingest/*` and `/api/one/*` if no user context present AND `NODE_ENV === 'production'`.

### 7.2 Wire context into routes

- [ ] Pass `req.userContext` into `processBuiltInSeed`, `processEmailSync`, `processGoogleSheetsSync` so `integration_connections.user_id` lookups are scoped correctly.

### 7.3 Verification

- [ ] In dev: request with `X-User-Id: dev-admin-1` succeeds.
- [ ] In dev: request without header succeeds (warns once in console).
- [ ] When run with `NODE_ENV=production` and no header: returns 401.

---

## Phase 8  -  Verification Gate (Wave 4)

Final gate before declaring complete. Runs after all phases.

### 8.1 Backend verification

- [ ] `cd backend && npm run db:generate`
- [ ] `cd backend && npm run db:validate`
- [ ] `cd backend && npm run db:verify:migration`
- [ ] `cd backend && npm run build`
- [ ] `cd backend && npm run verify-ingestion`
- [ ] `cd backend && npm run verify:all`

### 8.2 Frontend verification

- [ ] `npm run typecheck`
- [ ] `npm run build`

### 8.3 End-to-end manual QA per user story

| Story | Manual QA step | Pass criteria |
|---|---|---|
| 1 | `GET /api/ingest/pipeline/status` | All 5 connectors present; no secrets leaked; new fields populated. |
| 2 | Frontend Upload card with valid CSV, `dryRun=true` | Summary shows non-zero `processed`; no DB mutations. Then `dryRun=false` mutates. |
| 3 | Drop CSV in `M_MANAGEMENT_WATCH_DIR`; run `/api/ingest/pipeline/run mode=folder-watch dryRun=true` | Preview summary correct. With `dryRun=false` and `watchedFileIds`, mutations applied. Re-run is idempotent. |
| 4 | Connect Gmail; run `/api/ingest/pipeline/run mode=email dryRun=true` | Summary returns; `email_import_messages` rows appear. With `dryRun=false`, mutations apply. Re-run is idempotent. |
| 5 | `/api/ingest/pipeline/run mode=built-in dryRun=true` then `dryRun=false` | First run populates Mujo/Ruby/Manuka data. Second run is no-op. Hierarchy preserved (Manuka listings appear in all three accounts with same `provider_listing_id`). |
| 6 | Force a malformed row by feeding bad CSV | `sync_dead_letters` rows appear with structured `failure_code` and `failure_reason`; no rooms or properties auto-created. |

### 8.4 Sign-off

- [ ] Update `docs/m-management-ingestion-pipeline.md`:
  - Move "Deferred" items now completed into "Implemented".
  - Update "Current Verified State" with the new endpoints, schemas, and connector capabilities.
- [ ] Update `README.md` if Track A/B switching guidance changed (likely yes  -  the new dual-mode Sheets path means Track B is the only runtime, but withone is now an alternative auth path within Track B).
- [ ] Run `npm run dev:all` and screenshot the integration page rendering Harbor design tokens.

---

## Wave Schedule (Parallel Execution)

```
Wave 1 (parallel, ~4-6 hours):
  +-- Phase 0: Withone foundations (client, vault, auth-token, webhooks)
  +-- Phase 1: Schema migrations
  L-- Phase 2: Sheets/Drive adapters

Wave 2 (parallel, depends on 0+1+2, ~6-8 hours):
  +-- Phase 3: Folder watcher
  +-- Phase 4: Email/Gmail connector
  L-- Phase 5: Built-in seeder

Wave 3 (parallel, depends on Wave 2, ~4-6 hours):
  +-- Phase 6: Frontend admin page (delegate to visual-engineering)
  L-- Phase 7: Auth scaffold hook

Wave 4 (sequential, ~1-2 hours):
  L-- Phase 8: End-to-end verification
```

Total estimated effort: **15-22 focused engineering hours** across the four waves.

---

## Out of Scope (Explicit Non-Goals)

- Real authentication implementation (Clerk/Auth0). Phase 7 only stubs the seam.
- Real-time Drive `changes.watch` push notifications (channel renewal complexity not justified for hospitality cadence).
- Writing back to Google Sheets (read-only scope only).
- Streaming attachment downloads above 10 MB (existing `ingestFileContract.maxFileSizeBytes` cap applies).
- Multi-tenant org/team identity scoping (default `identityType: 'user'` chosen per the architecture design).

---

## Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Withone passthrough URL semantics misunderstood (path prefix bug) | Medium | Verified action knowledge already; client builds URL from `path` only, no platform slug. Unit-test in Phase 0. |
| Gmail attachment base64url decoding edge cases (padding) | Medium | Use Node's built-in `Buffer.from(data, 'base64url')` (Node 18+); never hand-roll padding. |
| Folder watcher fires while file is being written | Low | `chokidar` `awaitWriteFinish: { stabilityThreshold: 2000 }` covers this. SHA-256 dedupe is the safety net. |
| Built-in seeder runs twice and creates duplicates | Low | `seed_batches.manifest_sha256` idempotency + composite unique on `channel_listings(external_account_id, provider_listing_id)`. |
| OAuth tokens silently expire on Gmail connection | Medium | Webhook handler marks `failed_refresh`; UI prompts reconnect. |
| Schema additions deployed to Azure but not migration-validated | High if skipped | `db:verify:migration` runs in CI gate before each merge per `prisma/AGENTS.md`. |
| `googleapis` SDK and withone path coexist forever | Medium | Document `INGEST_SHEETS_PROVIDER` deprecation timeline once Phase 6 is in production for 30 days. Service-account file becomes read-only operator escape hatch. |

---

## Acceptance Verification Matrix

| Spec acceptance criterion | Verification step in this plan |
|---|---|
| Status response shows enabled/disabled state for all connectors | Phase 0.7 + Phase 3.4 + Phase 4.4 + Phase 5.5 |
| Status never exposes secrets | Existing `pipeline.ts` honors this; Phase 1 + Phase 5 status augmentations only return safe metadata |
| Upload requires `dryRun` | Existing `routes.ts` enforces `MISSING_DRY_RUN`; unchanged |
| Upload supports listings and reservations separately | Existing endpoints unchanged; Phase 6 surfaces both |
| Upload returns sync summary | Existing `IngestSummaryResponse` unchanged |
| Watch folder reports enabled state and folder existence | Existing `pipeline.ts` does this; Phase 3.4 augments |
| Watcher must not mutate DB until applied | Phase 3.1 + 3.2 enforce this  -  watcher only writes `watched_files`; `pipeline/run` is the apply step |
| Missing folder is config issue, not crash | Existing `pipeline.ts` returns `state: 'missing_path'`  -  no crash |
| Email connector has explicit env-driven state | Existing `pipeline.ts` reads `M_MANAGEMENT_EMAIL_IMPORT_ENABLED`; Phase 4.4 augments with connection-derived state |
| Email credentials never exposed | Withone vault holds tokens; we only store `connection_key` |
| Future email sync routes through dryRun + summary | Phase 4.3 enforces same `IngestSummaryResponse` |
| Built-in source points at `database_design/` | Existing default `M_MANAGEMENT_BUILTIN_SOURCE_DIR=../database_design` |
| Status shows whether source files present | Existing `pipeline.ts` checks `directoryExists`; Phase 5.5 augments |
| Future seed writes through current channel/listing tables | Phase 5.3 explicitly uses `channels`, `external_accounts`, `channel_listings` |
| `sync_dead_letters` remains failure sink | Existing `services/listings.ts` and `reservations.ts` write here; new connectors reuse them |
| Parser ambiguity does not auto-create rooms/properties | Existing `normalizer.ts` rule preserved; Phase 5.3 explicitly emits `AMBIGUOUS_LISTING_MATCH` for missing names |
| Pipeline status links to dead-letter counts | Phase 6.4 surface |

All 6 user stories traceable to verifiable phases.

---

## Notes On Plan Discipline

- Every phase keeps `routes.ts` thin (validation + dispatch) per `backend/src/ingest/AGENTS.md`.
- Every new service follows the dry-run / summary contract.
- No bypass of `normalizer.ts`  -  all new ingestion paths feed buffers through the existing service entry points.
- No drops of compatibility tables (`guests`, `legacy_guest_reservation_backfills`).
- No Supabase RLS syntax in new migrations.
- No frontend imports of Prisma or backend internals.
- No hardcoded secrets, origins, or production URLs.
