# One Auth Official Contract Audit

**Audit date:** 29 August 2026  
**Official baseline:** `.agents/skills/one-auth/SKILL.md`  
**Scope:** Current local source, focused contract tests, prior runtime evidence, and prior root-cause reports.

## Verdict

The current local implementation substantially matches the official One Auth contract. The signed `x-one-grant` flow is a valid application-owned replacement for the guide's raw `x-user-id` example because it keeps the One identity behind a short-lived, server-verified authorization boundary.

One contract gap remains: `/api/one/auth-token` takes `identity` from the verified grant, but permits the request body to override `identityType`. The identity type should also come only from the verified grant or server configuration.

The prior CORS diagnosis was valid. Vite's CORS middleware intercepted local `OPTIONS /api/*` requests before the proxy and returned no `Access-Control-Allow-Origin`; `server.cors: false` delegates preflight handling to the Express CORS policy. The later Private Network Access middleware and self-signed Vite HTTPS plugin were speculative, not required by the official guide, and have been removed.

The official local-development remedies remain:

1. Disable Chrome's **Block insecure private network requests** flag for local testing.
2. Prefer a public HTTPS tunnel such as ngrok when browser policy still blocks localhost.

## Requirement Matrix

| Official requirement | Current evidence | Verdict |
|---|---|---|
| Frontend supplies a full token URL | `ConnectIntegrationButton.tsx:13-16, 35-37` resolves the configured or default route against `window.location.origin`; frontend test asserts the absolute URL | Pass |
| Token endpoint supports `POST` | `backend/src/routes/one.ts:180-202` registers `POST /api/one/auth-token` | Pass |
| Token endpoint supports CORS preflight | Express `cors` middleware is registered before routes in `backend/src/index.ts:62-83`; Vite now delegates `/api` preflight with `server.cors: false` | Pass, configuration-dependent |
| CORS allowlist includes the custom browser header | `backend/src/index.ts` includes `x-one-grant` in `allowedHeaders`; `backend/.env.example` includes `https://auth.withone.ai` in `ALLOWED_ORIGINS` | Pass |
| Widget `page` and `limit` are forwarded | `backend/src/routes/one.ts:194-196`; `auth-token.ts:32-35`; two focused tests assert forwarding | Pass |
| Backend calls `POST /v1/authkit/token` | `backend/src/integrations/one/auth-token.ts:32-46` | Pass |
| Backend sends `X-One-Secret` | `auth-token.ts:38-41` sends the case-insensitive HTTP equivalent `x-one-secret`; secret remains server-only | Pass |
| Backend controls `identity` and `identityType` | Verified grant controls `identity`; request body can override `identityType` at `backend/src/routes/one.ts:193` | Partial, fix required |
| Frontend identifies the user securely | App mints a cookie-gated, five-minute signed grant and sends `x-one-grant`; forged, missing, and tampered grants are tested | Pass, intentional deviation |
| `selectedConnection` uses display name | `platformLabels` maps to `Gmail`, `Google Drive`, and `Google Sheets`; frontend test asserts `Google Drive` | Pass |
| `onSuccess` stores the connection | `ConnectIntegrationButton.tsx:44-52` calls `persist.mutate`; repository posts to `/api/one/connections`; backend upserts the key | Pass, browser E2E pending |
| Visible apps are enabled in One Dashboard | Prior authenticated One responses returned eight rows, five active: Gmail, Google Docs, Google Drive, Google Places, Google Sheets | Pass for tested project key |
| Localhost browser restriction is handled per guide | No code workaround remains; official Chrome-flag/ngrok remedies are documented here | Pass as operational guidance |

## Security Deviation

The official example accepts `x-user-id` directly. Just Management instead uses:

```text
operator cookie
-> POST /api/one/auth-grant
-> signed { identity, identityType, exp }
-> x-one-grant
-> POST /api/one/auth-token
```

This is stronger than trusting a caller-supplied user ID. It also avoids depending on a `SameSite=Strict` operator cookie inside the cross-origin AuthKit request.

The remaining body override weakens that invariant:

```typescript
const identityType = getString(body, "identityType") ?? verified.identityType;
```

Required correction: use `verified.identityType` without consulting the AuthKit request body.

## CORS Finding

The local CORS failure was reproduced before this audit:

```text
AuthKit origin -> OPTIONS /api/one/auth-token through Vite
Vite CORS middleware -> 204 without Access-Control-Allow-Origin
Browser blocks token POST
```

With `frontend/vite.config.ts` setting `server.cors: false`, Vite proxies the preflight to Express. Express then applies the configured origin and custom-header policy. This is the smallest valid local fix and preserves the backend as the single CORS authority.

Production does not use the Vite development server. Production still requires the deployed backend's `ALLOWED_ORIGINS` to include the actual AuthKit browser origin and the deployed proxy to forward `OPTIONS` requests.

## Prior Analysis Assessment

| Prior claim | Assessment |
|---|---|
| Connector catalog caused the current empty state | Superseded. The tested key returned active connector rows. |
| Production failed on the old `SameSite=Strict` cookie contract | Supported by prior production evidence. The signed grant flow is the correct replacement. |
| Local Vite preflight handling caused a CORS failure | Confirmed. Retain `server.cors: false`. |
| Private Network Access response middleware was required | Unproven. Removed. The official guide recommends a Chrome flag or ngrok instead. |
| Self-signed Vite HTTPS was required | Unproven and incomplete because browser trust remains unresolved. Removed. |
| Gmail, Drive, and Sheets need separate grants | False. One grant authorizes token issuance for the server-controlled identity; connector selection is separate. |
| Local CLI connections prove app persistence | False. CLI vault state, AuthKit catalog visibility, and `integration_connections` rows are separate states. |

## Fresh Verification

Executed against the final audited tree:

```text
npm test -w backend -- test/auth-token.test.ts test/one-routes.test.ts
2 files passed; 13 tests passed

npm run test:frontend -w frontend -- src/components/integrations/ConnectIntegrationButton.test.tsx
1 file passed; 6 tests passed

npm run typecheck -w frontend
passed

npm run build -w frontend
passed; 2715 modules transformed

LSP diagnostics: backend/src/index.ts
no diagnostics

LSP diagnostics: frontend/vite.config.ts
no diagnostics
```

## Residual Risks

- Full AuthKit browser OAuth success and connection persistence were not re-run during this audit.
- Browser classification of the prior HTTPS-to-localhost status-zero failure remains unresolved.
- Production frontend/backend deployment parity was not rechecked.
- The verified connector catalog applies to the tested project key; deployed secret scope still needs release-time confirmation.
- `ONE_CONNECTION_KEY` and `ONE_WEBHOOK_SECRET` are optional for this AuthKit catalog flow; empty values affect passthrough fallback and webhooks, not connector visibility.

## Release Gate

Before production release:

1. Remove the request-body `identityType` override.
2. Deploy grant-enabled frontend and backend together.
3. Confirm `OPTIONS /api/one/auth-token` returns the required CORS headers in production.
4. Confirm operator login, grant minting, AuthKit token issuance, OAuth completion, DB persistence, and one read-only passthrough call.
