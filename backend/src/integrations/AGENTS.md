# Provider Integrations Guide

## Scope
- `backend/src/integrations/` is the seam between Track B core and external providers (currently `@withone` + Google Drive/Gmail/Sheets).
- Files here own provider auth, token refresh, webhook intake, and outbound API construction.

## Layout
- `provider-connector.ts` exposes `WithOneProviderConnector`, the abstract surface called by `src/index.ts` and ingestion services.
- `one/auth-token.ts` resolves and caches WithOne credentials.
- `one/client.ts`, `one/connections.ts`, `one/webhooks.ts` wrap WithOne API surface.
- `one/google/{drive,gmail,sheets}.ts` implement Google subprovider calls used by `ingest/services/sheets-one.ts` and `ingest/services/email.ts`.

## Rules
- All third-party HTTP construction belongs here; ingestion services consume typed provider methods, never raw fetch.
- Treat provider responses as untrusted: validate shape before passing to normalizers or Prisma writes.
- Persist provider raw payloads, raw statuses, and external IDs at provider edge tables; never project them into core booking columns.
- Read credentials through `auth-token.ts`; never read process.env directly inside `one/google/*`.
- Surface provider errors with provider name + endpoint context so ingestion summaries can attribute failures.

## Anti-Patterns
- Do not call `fetch` to `withone.*` or `googleapis.com` outside this directory.
- Do not log raw tokens, refresh tokens, OAuth codes, or full webhook payloads.
- Do not bypass `provider-connector.ts` from ingestion services for "just one quick call".
- Do not add Prisma writes here; integrations return data, services persist it.

## Verification
- Code change: `npm run build` from `backend/`.
- Behavior change: run affected ingest service or webhook endpoint with a sandbox account; do not test against production WithOne tenants.
