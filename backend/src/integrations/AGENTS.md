# Provider Integrations Guide

## Rules
- All third-party HTTP construction belongs here; ingestion services consume typed provider methods, never raw fetch.
- Treat provider responses as untrusted: validate shape before passing to normalizers or Prisma writes.
- Persist provider raw payloads, raw statuses, and external IDs at provider edge tables; never project them into core booking columns.
- Read credentials through `auth-token.ts`; never read process.env directly inside `one/google/*`.
- Surface provider errors with provider name + endpoint context so ingestion summaries can attribute failures.
- Do not call `fetch` to `withone.*` or `googleapis.com` outside this directory.
- Do not log raw tokens, refresh tokens, OAuth codes, or full webhook payloads.
- Do not bypass `provider-connector.ts` from ingestion services for "just one quick call".
- Do not add Prisma writes here; integrations return data, services persist it.
