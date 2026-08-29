# One Auth Blank-Screen Investigation — Implementation Summary & Root-Cause Plan

**Status:** INVESTIGATION — root cause not yet confirmed
**Report date:** 29 August 2026
**Scope:** Prior One Auth (WithOne) connection implementation, runtime evidence, and the persisting "No integration available" failure in the AuthKit widget, plus a revised plan to confirm and resolve it.
**Companion report:** [`docs/reports/qa/one-auth-official-contract-audit-2026-08-28.md`](one-auth-official-contract-audit-2026-08-28.md)

---

## 1. Executive Summary

The app's own connection UI and signed-grant backend are implemented, tested, and passing. The persisting problem is **outside the app's source**: the external WithOne AuthKit iframe (`https://auth.withone.ai`) fails to bootstrap its token exchange against the local backend, so it renders its own empty/error state ("No integration available") and OAuth never completes. No `integration_connections` row is ever created.

Confirmed so far:

- Backend endpoints respond correctly to manual requests (grant `200`, session `200/204`, connections `200` empty, manual CORS preflight `204`).
- The AuthKit iframe document loads (`200`) but its `POST /api/one/auth-token` (and the accompanying `OPTIONS`) **never receive a terminal response status** inside the browser.
- Without the token response, AuthKit cannot load its connector catalog → blank/"No integration available" → OAuth aborted → nothing persisted.

Not yet confirmed (two active hypotheses, neither toggle-proven):

1. **Chrome Local Network Access (LNA)** — Chrome 151 gates the embedded HTTPS→loopback request; iframe lacks permission delegation.
2. **Duplicate Vite listeners** — two processes serve `:5173` (`::1` vs `:::5173`); some `localhost` resolution may reach the wrong root.

A secondary, tooling-level blocker: the browser-automation session (agent-browser via MCP) repeatedly wedges/times out, preventing the decisive A/B runs. The revised plan in §7 addresses both the browser-tooling instability and the toggle-proof requirement.

---

## 2. What Was Implemented (Prior Work)

### 2.1 Signed-grant bridge (security-correct One Auth identity)

Replaces the guide's raw `x-user-id` with a short-lived, server-verified grant so the One identity stays behind an authorization boundary.

| Piece | File | Behavior |
|---|---|---|
| Grant signing/verification (HMAC-SHA256, TTL 5 min) | `backend/src/routes/one.ts:35-81` | `signGrant` / `verifyGrant`; base64url body + signature; `timingSafeEqual`; exp/identity/identityType validated |
| Operator session (cookie, 12 h, `SameSite=Strict`) | `backend/src/routes/one.ts:83-167` | GET/POST/DELETE `/api/one/operator-session`; HMAC-signed expiry; `requireOperatorSession` gate |
| Grant minting (operator-cookie gated) | `backend/src/routes/one.ts:169-178` | `POST /api/one/auth-grant` → `{ grant, expiresAt }` |
| Token issuance (grant-header gated) | `backend/src/routes/one.ts:180-201` | `POST /api/one/auth-token`; `identityType` comes **only** from the verified grant (audit gap closed) |
| Upstream AuthKit token call | `backend/src/integrations/one/auth-token.ts` | Proxies `POST {ONE_API_BASE}/authkit/token` with `x-one-secret`; forwards `page`/`limit` |
| Connection persistence | `backend/src/routes/one.ts:203-283` | GET/POST/DELETE `/api/one/connections`; upsert by `connection_key`; platform allowlist |
| Webhook | `backend/src/routes/one.ts:286-313` | HMAC-verified, raw-body, ack-then-async |

### 2.2 Frontend

| Piece | File | Behavior |
|---|---|---|
| AuthKit button + token config | `frontend/src/components/integrations/ConnectIntegrationButton.tsx` | Absolute token URL from `VITE_ONE_AUTH_TOKEN_URL` (default `/api/one/auth-token`); `selectedConnection` display names; `x-one-grant` header via `buildOneAuthHeaders`; popup `authWindow`; `onSuccess` persists connection |
| Grant + connections hooks | `frontend/src/hooks/use-one-connections.ts` | `useAuthGrant` (4-min stale + refresh), `useOperatorSession`, `useConnections`, `usePersistConnection`, `useDisconnect`, login/logout mutations |
| Integrations page | `frontend/src/pages/settings/integrations-page.tsx` | Operator Access card, provider health, connector availability list, connect buttons, saved-connections list, manual CSV upload, pipeline run |

### 2.3 CORS/local fix (kept)

- `frontend/vite.config.ts` sets `server.cors: false` so Vite **delegates** `/api/*` preflights to Express (Vite's own CORS middleware previously swallowed `OPTIONS` and returned no `Access-Control-Allow-Origin`).
- `backend/src/index.ts:62-83` registers Express `cors` before routes; allowlist includes `x-one-grant`; `backend/.env.example` includes `https://auth.withone.ai` and `https://app.withone.ai` in `ALLOWED_ORIGINS`.
- Removed (speculative, unproven): Private-Network-Access response middleware; self-signed Vite HTTPS plugin.

### 2.4 Regression tests (passing)

- `backend/test/one-routes.test.ts` — hostile-body `identityType` override regression; forged/missing/tampered grants.
- `backend/test/auth-token.test.ts` — `page`/`limit` forwarding.
- `frontend/src/components/integrations/ConnectIntegrationButton.test.tsx` — absolute URL, `selectedConnection`, empty-header/no-grant, disabled-while-fetching.
- `frontend/src/hooks/use-one-connections.test.tsx` — grant remint regression.

### 2.5 Validation history (all green)

```text
backend  npm test              254/254 pass
frontend npm test:frontend      46/46 pass
backend  npm run build         pass
frontend npm run typecheck     pass
frontend npm run build         pass (2715 modules)
LSP diagnostics on changed files: clean
```

---

## 3. Runtime Environment Snapshot (29 Aug 2026)

```text
Frontend  http://localhost:5173/settings/integrations
          PID 48608  vite                correct app root   -> listens ::1:5173
          PID 54892  vite --host         wrong-root runner  -> listens :::5173   (duplicate)
Backend   http://localhost:3001
          PID 3092   tsx src/index.ts    Express + Prisma
Browser   Chromium 151 (agent-browser 0.33.2), sessions: one-auth-live, one-auth-fresh-2
DB        integration_connections: 0 rows
```

> The duplicate `5173` listener (PID 54892) predates this session. Root `npm run dev` should own the port; a stray `vite --config frontend/vite.config.ts --host` instance is also bound. This is a candidate contributor, not the confirmed cause.

---

## 4. Confirmed Runtime Evidence (verbatim)

| # | Observation | Source |
|---|---|---|
| E1 | `GET /api/one/operator-session` → `200` / `204` | network |
| E2 | `POST /api/one/auth-grant` → `200` with `{ grant, expiresAt }` | network |
| E3 | `GET /api/one/connections` → `200` `{ connections: [] }` | network |
| E4 | AuthKit iframe document `https://auth.withone.ai/?data=...` → `200` | network |
| E5 | Iframe payload includes absolute `http://localhost:5173/api/one/auth-token` **and** signed `x-one-grant` | iframe body |
| E6 | Manual preflight `OPTIONS http://localhost:5173/api/one/auth-token?page=1&limit=100` → `204`, allows `https://auth.withone.ai`, `POST`, `Content-Type`, `x-one-grant` | manual curl |
| E7 | Browser: AuthKit `POST /api/one/auth-token` **and** its `OPTIONS` created **without a response status** (never terminated) | CDP network |
| E8 | Iframe initially has **no `allow` attribute** | DOM |
| E9 | `navigator.permissions.query({ name: "local-network-access" })` → `"prompt"` | console |
| E10 | `Browser.grantPermissions` accepted `localNetwork`, `loopbackNetwork`, `localNetworkAccess` for both `http://localhost:5173` and `https://auth.withone.ai` | CDP |
| E11 | A/B result after grants was **inconclusive** — token requests still showed no response status; shell text rendered but network did not confirm completion | CDP |
| E12 | agent-browser MCP calls on `one-auth-live` began timing out (`-32001`); fresh session also timed out on first `open` though the daemon launched | MCP |

---

## 5. Why "No Integration Available" Appears

The string is **not** in this repo (`rg` over `frontend/src`, `backend/src` finds only our own "No saved connections yet" and provider-health wording). It is rendered by the **WithOne AuthKit widget** when it cannot complete its token bootstrap:

```text
Operator logs in
  -> app mints signed grant (E2)
  -> AuthKit iframe loads (E4), reads token URL + x-one-grant from URL data (E5)
  -> iframe issues OPTIONS + POST /api/one/auth-token   (E7: never completes)
  -> no token -> AuthKit has no catalog -> "No integration available"
  -> OAuth aborted -> no onSuccess -> integration_connections stays empty (E3)
```

The backend token path is **not** proven broken: unit tests pass and the manual preflight (E6) is correct. The failure is in **how the browser/Chrome handles the cross-origin HTTPS→loopback request**, or how the request is routed through the duplicated `:5173` listeners.

---

## 6. Hypothesis Status

| # | Hypothesis | Status | Distinguishing evidence |
|---|---|---|---|
| H1 | Live frontend lacks the signed-grant contract (stale bundle) | **REFUTED** | Live source uses `useAuthGrant` + `x-one-grant` (E5) |
| H2 | Backend CORS rejects AuthKit | **REFUTED** | Manual matching preflight returns `204` with correct headers (E6) |
| H3 | Chrome Local Network Access blocks embedded HTTPS→loopback | **ACTIVE** | `permissions` state `prompt` (E9); no `allow` on iframe (E8); grants accepted but rerun inconclusive (E10/E11) |
| H4 | Duplicate `:5173` listeners misroute the iframe's `localhost` call | **ACTIVE** | PID 48608 `::1` vs PID 54892 `:::5173`; wrong-root response observable via `127.0.0.1` |
| H5 | Browser-automation transport wedges (agent-browser MCP) | **CONFIRMED (tooling)** | Repeated `-32001` timeouts (E12) — not the app bug, but blocks H3/H4 testing |

---

## 7. Revised Action Plan — Confirm Root Cause, Then Fix

### Guiding rules

- **Toggle proof required** (debugging skill Phase 6): a cause is confirmed only when flipping it flips the symptom both ways (baseline bad → change good → revert bad).
- **Runtime truth over code reading.** No claim without an observed value.
- **Preserve** the dirty worktree, PIDs `48608`, `54892`, `3092`; no commits; no source edits during investigation.
- **Bounded retries**: any tool that wedges gets max one retry, then switch tool, then stop.

### Phase A — Stabilize browser tooling (blocker, do first)

1. Abandon the MCP-typed agent-browser path for the remainder of this investigation. It has wedged twice.
2. Use **raw CDP over the already-running daemon** (works: permission grants were applied this way) with a short inline Node script and hard 10–20s timeouts; `Network.enable` + `Page.enable`; capture `Network.requestWillBeSent`, `Network.responseReceived`, `Network.loadingFailed` for the `auth-token` URL.
3. If raw CDP also wedges, fall back to a **separate Chromium launched with `--remote-debugging-port=9222`** driven via the `chrome-devtools_*` MCP, or a one-shot Playwright script (`page.on('response')` + `page.on('requestfailed')`), which the debugging skill mandates for browser bugs. Pick whichever is live, then stay on it.
4. Verify the toolchain with a trivial navigation + network capture before touching the bug.

**Pass:** token request now yields a terminal status or a `loadingFailed` errorText. **Fail:** tooling still wedges — stop, report infrastructure blocker, do not guess.

### Phase B — End-to-end backend proof without the browser (isolate backend)

1. `curl -c jar -X POST /api/one/operator-session` with the operator password → expect `204`.
2. `curl -b jar -X POST /api/one/auth-grant` → capture `grant` + `expiresAt`.
3. `curl -X POST "/api/one/auth-token?page=1&limit=100" -H "x-one-grant: $grant" -H "Origin: https://auth.withone.ai"` → expect `200` + JSON token; record `x-one-secret` correctness via backend logs.
4. Repeat the manual `OPTIONS` preflight with the **exact** `Access-Control-Request-Headers: content-type,x-one-grant` the browser sends (E6 did the happy path; verify the exact header set).

**Pass:** backend path proven end-to-end in runtime → all blame sits in the browser/transport layer (H3/H4). **Fail:** a real backend 4xx/5xx appears → root cause is backend; fix + regression test per Phase D.

### Phase C — Decisive LNA toggle (H3)

1. On the now-stable toolchain: reproduce once with **no grants** → confirm blank + statusless token call (baseline A).
2. Grant `localNetwork`, `loopbackNetwork`, `localNetworkAccess` to `https://auth.withone.ai` (the requesting origin), **reload only the iframe**, reproduce (B).
3. Clear permissions, reload, reproduce (A'). Expect `A=broke, B=works, A'=broke`.

**Confirmed:** LNA is the cause. **Refuted:** no change → move to Phase D.

### Phase D — Duplicate-listener toggle (H4), only if Phase C refuted

1. Baseline A (from Phase C) with both listeners.
2. Deliberately stop **only** the stray PID `54892` (`vite --host` wrong-root), keep PID `48608` + backend `3092`; reproduce (B).
3. Restart the stray listener the way it was running; reproduce (A').

**Confirmed:** duplicate-listener routing is the cause. **Refuted:** neither variable toggles the symptom → record both as rejected and escalate to the user with the full evidence set (H3/H4 neither toggle; options: ngrok HTTPS tunnel per official guide, or Chrome `--disable-features=PrivateNetworkAccessChecks` flag for local testing).

### Phase E — Fix (only after confirmation)

- If **LNA confirmed**: document and apply the official remedy — either Chrome flag for local dev (`Block insecure private network requests` off, or `--disable-features=PrivateNetworkAccessChecks`), or prefer an **HTTPS tunnel (ngrok)** so the AuthKit iframe calls a public HTTPS origin instead of loopback. For the deployed app this resolves naturally (production origin is HTTPS, same/allowlisted origin). No app code change expected; record in `docs/guides/` runbook.
- If **duplicate-listener confirmed**: stop the stray listener in the run scripts; guard the dev script (`server.host` pinning or a preflight port check) so only one process owns `:5173`. Add a one-line check to the local-dev guide.
- Either way: write **one failing-first regression test** at the seam that captures the mechanism (e.g. backend test asserting `auth-token` rejects without a grant header / with tampered grant — already covered; add the runtime-toggled scenario as a documented manual QA step in the runbook), then run the full suites.

### Phase F — Cleanup & handoff

1. Walk the journal: revert the temporary `.debug-journal.md` and its `.git/info/exclude` entry; close investigation browser sessions (`one-auth-live`, `one-auth-fresh-2`).
2. Verify PIDs `48608`, `54892`, `3092` and the dirty worktree are unchanged by the investigation.
3. Update this report: mark the confirmed hypothesis, paste the toggle evidence, and link the fix commit/PR when landed.
4. Keep `docs/reports/qa/one-auth-official-contract-audit-2026-08-28.md` as the contract baseline; this report is the runtime-failure companion.

---

## 8. References

- `docs/reports/qa/one-auth-official-contract-audit-2026-08-28.md` — contract audit, CORS finding, release gate
- `backend/src/routes/one.ts` — grant/session/token/connections/webhook routes
- `backend/src/integrations/one/auth-token.ts` — upstream `/v1/authkit/token` proxy
- `backend/src/index.ts:49-83` — CORS allowlist + `x-one-grant` header
- `frontend/src/components/integrations/ConnectIntegrationButton.tsx` — AuthKit config, absolute token URL
- `frontend/src/hooks/use-one-connections.ts` — grant refresh, connections hooks
- `frontend/src/pages/settings/integrations-page.tsx` — page composition and empty-state copy
- `https://developer.chrome.com/blog/local-network-access` — Chrome LNA behavior
- `https://chromedevtools.github.io/devtools-protocol/tot/Browser/` — CDP permission types
