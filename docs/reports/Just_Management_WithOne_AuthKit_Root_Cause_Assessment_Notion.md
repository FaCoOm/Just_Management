# Just Management — WithOne/AuthKit Root-Cause Assessment

**Assessment date:** 27 August 2026  
**Repository:** `FaCoOm/Just_Management`  
**Target branch:** `chore/migrate-uncommitted-snapshot-2026-08-27`  
**Branch HEAD assessed:** `194debf6d3914213530ebcef163c5a7ae21697b4`  
**Purpose:** Notion-importable root-cause report covering the current implementation, Hostinger deployment configuration, AuthKit architecture, documentation drift, and why the previous AI-agent remediation failed.

---

## Executive verdict

The WithOne integration problem is **not one root cause**. It is a sequence of independent failures that were repeatedly mixed together:

1. **The August 27 branch is internally inconsistent.**  
   The backend now requires a short-lived `x-one-grant` header before `/api/one/auth-token` will issue an AuthKit token, and the latest frontend test expects the browser to obtain and pass that grant. However, the actual `ConnectIntegrationButton.tsx` at the same branch HEAD still sends an empty headers object and does not implement the new `authenticated` prop. The test documents an intended design that the production component does not contain.

2. **The July durable deployment guide is stale relative to the August branch.**  
   `durable-one-auth-deployment-guide.md` describes the older `x-dev-token` / `ONE_DEV_TOKEN` gate. The branch has since replaced that flow with:
   `operator cookie -> /api/one/auth-grant -> x-one-grant -> /api/one/auth-token`.
   An agent following the July guide against the August code will test the wrong contract.

3. **The earlier “No integrations available” error was a different layer.**  
   In July, `/v1/authkit/token` returned HTTP 200 with `rows=[]` and `total=0`. That proved app-to-One transport and `ONE_SECRET_KEY` authentication worked, but no AuthKit connectors were visible in that key/environment context. The probable external causes were AuthKit connectors not enabled, project/organization key-scope mismatch, or Sandbox/Production mismatch.

4. **The current August branch can fail before it reaches that external AuthKit condition.**  
   Because the frontend does not send the now-required `x-one-grant`, `/api/one/auth-token` can return `401 auth grant required`. In that state, debugging One's dashboard connector activation is premature because the request is blocked by Just Management first.

5. **Hostinger configuration has drifted across several generations of the design.**  
   Historical deployment instructions still mention `ONE_DEV_TOKEN`, while the current branch uses `ONE_OPERATOR_PASSWORD`, `ONE_SESSION_SECRET`, `ONE_OPERATOR_IDENTITY`, and the signed grant flow. Deployment configuration must be reconciled against the runtime code rather than copied from an older handoff.

6. **Local One CLI connectivity and deployed AuthKit connectivity were incorrectly treated as equivalent.**  
   A local CLI vault can have working Gmail/Drive/Sheets connections while the deployed web app uses a different One API key, project, environment, identity, and persistence database. Local CLI success therefore does not prove the deployed AuthKit context is configured.

7. **The deployed app previously had no persisted One connection rows.**  
   The repository's Hostinger status report records `GET /api/one/connections -> {"connections":[]}` even though local CLI Google connections worked. This is a separate post-authentication problem: successful OAuth still needs its returned `connectionKey` persisted under the same application identity used by the deployed dashboard.

The practical resolution is therefore to repair the system **in dependency order**, not continue symptom-by-symptom patching.

---

# 1. Evidence baseline

## 1.1 Branch state

The requested migration branch currently points to:

`194debf6d3914213530ebcef163c5a7ae21697b4`

Commit message:

`test(frontend): assert AuthKit token shape and grant gating`

The branch is nine commits ahead of `main` at `6148ed3fbc36ac394c8fb5aea8d893a7d4e01215`.

The most relevant August changes introduced:

- a signed AuthKit grant contract on the backend;
- an `/api/one/auth-grant` endpoint;
- frontend repository/hook support intended to retrieve the grant;
- changes to integration-page calls that pass an `authenticated` prop;
- tests expecting `x-one-grant`;
- existing Hostinger/CORS/operator-auth changes inherited from main.

## 1.2 Source documents actually present in the assessed branch

The branch contains:

- `docs/reports/durable-one-auth-deployment-guide.md`
- `docs/reports/WithOne_API.md`
- `docs/reports/one-google-hostinger-integration-status.md`
- `docs/reports/hostinger-operator-auth-handoff.md`
- `hostinger_logs.md`
- `backend/.env.example`

The exact filenames requested as:

- `config.md`
- `withone-authkit-configuration-breakdown.md`

were **not found in the repository code search and are not present among the branch-vs-main changed files**. Therefore, this report does not invent their contents. Hostinger runtime configuration is reconstructed from the committed Hostinger deployment material and current environment template. If those two files are stored outside GitHub, they should be imported into this assessment before the final production change.

This absence is itself significant: an AI agent cannot reliably reconcile deployment state against documents that are not in the repository/context it is operating on.

---

# 2. Intended architecture

The current implementation is trying to create this chain:

```text
Operator/browser
    |
    | 1. authenticate to Just Management
    v
POST /api/one/operator-session
    |
    | HttpOnly one_operator_session cookie
    v
POST /api/one/auth-grant
    |
    | short-lived signed grant
    v
Browser receives { grant, expiresAt }
    |
    | x-one-grant: <grant>
    v
POST /api/one/auth-token
    |
    | ONE_SECRET_KEY -> x-one-secret
    v
POST https://api.withone.ai/v1/authkit/token
    |
    | AuthKit session + visible connectors
    v
@withone/auth modal
    |
    | Google OAuth
    v
One Vault
    |
    | returns connectionKey
    v
POST /api/one/connections
    |
    v
integration_connections table
    |
    | later
    v
One Passthrough API -> Gmail / Drive / Sheets
```

This architecture can work. The critical point is that the `x-one-grant` layer is **not a One requirement**; it is a Just Management security wrapper added to solve the cross-origin/operator-cookie problem. Since it is app-owned, the app must implement both producer and consumer consistently.

---

# 3. Root Cause A — backend/frontend AuthKit contract is broken at branch HEAD

## Backend behavior

At branch HEAD, `backend/src/routes/one.ts` implements:

- `POST /api/one/auth-grant`
  - requires valid operator session cookie;
  - signs `{ identity, identityType, exp }` with `ONE_SESSION_SECRET`;
  - returns `{ grant, expiresAt }`;
  - grant lifetime = 5 minutes.

- `POST /api/one/auth-token`
  - no longer accepts the operator cookie as the direct authorization;
  - requires header `x-one-grant`;
  - returns `401 {"error":"auth grant required"}` if absent;
  - validates signature and expiration;
  - then calls One's `/v1/authkit/token`.

This is a deliberate two-hop design.

## Frontend behavior at the same branch HEAD

`frontend/src/components/integrations/ConnectIntegrationButton.tsx` still has:

```ts
export function buildOneAuthHeaders(): Record<string, string> {
  return {};
}
```

and passes:

```ts
token: {
  url: absoluteTokenUrl(tokenUrl),
  headers: buildOneAuthHeaders(),
}
```

It therefore sends **no `x-one-grant` header**.

It also declares only:

```ts
ConnectIntegrationButton({ platform })
```

while the updated integrations page calls it using:

```tsx
<ConnectIntegrationButton
  platform="gmail"
  authenticated={authenticated}
/>
```

## Latest test contradicts production source

The branch HEAD test expects:

```ts
buildOneAuthHeaders("opaque-grant-token")
```

to return:

```ts
{ "x-one-grant": "opaque-grant-token" }
```

and expects the component to call a `useAuthGrant()` hook and accept an `authenticated` prop.

That behavior is absent from the production component.

## Consequence

The branch is not a coherent release snapshot.

Even before considering One dashboard configuration:

- TypeScript is likely to reject the unknown `authenticated` JSX prop.
- The latest test calls a zero-argument function with an argument.
- At runtime, an AuthKit token request made by the current component cannot satisfy the backend's `x-one-grant` requirement.

## Corrective action

Bring the production component into alignment with the intended test/route contract:

```ts
import { useAuthGrant, usePersistConnection } from "@/hooks/use-one-connections";

export function buildOneAuthHeaders(grant?: string): Record<string, string> {
  return grant ? { "x-one-grant": grant } : {};
}

export function ConnectIntegrationButton({
  platform,
  authenticated,
}: {
  platform: "google-sheets" | "google-drive" | "gmail";
  authenticated: boolean;
}) {
  const grantQuery = useAuthGrant(authenticated);
  const grant = grantQuery.data?.grant;

  const { open } = useOneAuth({
    token: {
      url: absoluteTokenUrl(import.meta.env.VITE_ONE_AUTH_TOKEN_URL),
      headers: buildOneAuthHeaders(grant),
    },
    selectedConnection: platformLabels[platform],
    // ...
  });

  // Disable/open only when grant is available.
}
```

Do not deploy until the frontend build, frontend tests, backend tests and typecheck all pass from this exact branch HEAD.

---

# 4. Root Cause B — documentation contract drift

`durable-one-auth-deployment-guide.md` is dated 11 July 2026.

It says the app used:

- frontend `VITE_ONE_DEV_TOKEN`;
- backend `ONE_DEV_TOKEN`;
- custom `x-dev-token`;
- `x-user-id`;
- direct request to `/api/one/auth-token`.

That is no longer the August 27 architecture.

The current architecture uses:

- `ONE_OPERATOR_PASSWORD`;
- `ONE_SESSION_SECRET`;
- `ONE_OPERATOR_IDENTITY`;
- HttpOnly operator session cookie;
- `/api/one/auth-grant`;
- `x-one-grant`;
- `/api/one/auth-token`.

Therefore the guide's HTTP verification command is obsolete.

## Why this caused agent failure

The agent accumulated fixes rather than re-baselining the contract:

```text
old dev-token design
    ->
operator-cookie design
    ->
popup cross-origin problem
    ->
signed grant design
```

but historical documentation remained authoritative-looking.

An agent reading several generations simultaneously can easily conclude that all of these are simultaneously required:

```text
x-dev-token
+ operator cookie
+ x-one-grant
+ WithOne CORS origins
```

when in fact the code has migrated from one scheme to another.

## Corrective action

Retire or explicitly archive old AuthKit guides.

Maintain one canonical file:

`docs/guides/deployment/withone-authkit-production-contract.md`

Its first section should state:

- current auth flow version;
- exact endpoints;
- exact headers;
- exact required environment variables;
- expected status codes;
- which older variables are deprecated.

Every auth-related code change should update this file in the same commit.

---

# 5. Root Cause C — “No integrations available” was external AuthKit visibility, not transport

The July durable guide captured a useful diagnostic result:

```text
POST /api/one/auth-token -> 200
One response -> rows: [], total: 0
```

It repeated the call for all four One identity types:

- `user`
- `team`
- `organization`
- `project`

and all returned no visible AuthKit connectors.

That proved:

- the backend could call One;
- the One API secret was accepted;
- the response shape was valid;
- changing identity type did not expose connectors.

It did **not** prove a code/UI problem.

The guide correctly identified these external hypotheses:

1. required integrations were not activated in AuthKit;
2. API key belonged to another organization/project scope;
3. Sandbox/Production environment mismatch.

The official One documentation supports this model:

- API keys are environment-scoped;
- Sandbox and Production are isolated;
- connectors are scoped to environment;
- project-scoped keys can address a specific project;
- `GET /v1/whoami` reveals organization/project scope;
- AuthKit-visible integrations can be tested with `GET /v1/available-connectors?authkit=true`.

## Correct diagnostic sequence

After Root Cause A is repaired, validate the One layer directly:

```bash
curl https://api.withone.ai/v1/whoami \
  -H "x-one-secret: $ONE_SECRET_KEY"
```

Record, without exposing the secret:

- environment;
- user/account;
- organization;
- project.

Then:

```bash
curl "https://api.withone.ai/v1/available-connectors?authkit=true&limit=100&page=1" \
  -H "x-one-secret: $ONE_SECRET_KEY"
```

Expected production prerequisite:

```text
Gmail          visible
Google Drive   visible
Google Sheets  visible
```

Then call `/v1/authkit/token` with the exact same secret.

Do not use successful local CLI connections as evidence unless `one whoami` / active CLI configuration proves it is using the same API key scope and environment.

---

# 6. Root Cause D — local One CLI vault and deployed web-app state were conflated

The branch report `one-google-hostinger-integration-status.md` shows:

Local One CLI:

- Gmail operational;
- Google Drive operational;
- Google Sheets operational;
- real Drive/Sheets reads succeeded.

Deployed app:

```json
GET /api/one/connections
{"connections":[]}
```

These facts are not contradictory.

They describe two different connection stores/identity contexts.

```text
local developer CLI
    -> local One config
    -> its API key/environment
    -> its Vault connections

deployed Just Management
    -> Hostinger ONE_SECRET_KEY
    -> operator identity
    -> app DB integration_connections
```

## Corrective action

Treat CLI as a diagnostic client, not as the application's persistence layer.

After an AuthKit OAuth success:

1. inspect the `onSuccess` payload;
2. extract `connectionKey`;
3. persist it through `/api/one/connections`;
4. verify the row exists for `ONE_OPERATOR_IDENTITY`;
5. verify environment derived from the key;
6. use that persisted key for later passthrough calls.

Success criterion:

```text
AuthKit success
AND database persistence
AND Vault/connection ownership alignment
AND passthrough smoke test
```

OAuth success alone is insufficient.

---

# 7. Root Cause E — Hostinger environment configuration drift

The current branch's `backend/.env.example` expects the following relevant variables:

```env
PORT=3001
SLOW_REQUEST_THRESHOLD_MS=500
ALLOWED_ORIGINS=...

ONE_CONNECTION_KEY=...
ONE_SECRET_KEY=...
ONE_API_BASE=https://api.withone.ai/v1
ONE_WEBHOOK_SECRET=...
ONE_OPERATOR_PASSWORD=...
ONE_SESSION_SECRET=...
ONE_OPERATOR_IDENTITY=operator
ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE=user
```

Historical Hostinger deployment material still refers to the older:

```env
ONE_DEV_TOKEN=...
```

scheme.

That value is no longer the authorization mechanism used by the latest branch routes.

## Current minimum Hostinger set for the signed-grant implementation

```env
NODE_ENV=production
PORT=3001

DATABASE_URL=<production PostgreSQL connection>

ONE_SECRET_KEY=<production One API key>
ONE_API_BASE=https://api.withone.ai/v1

ONE_OPERATOR_PASSWORD=<strong operator password>
ONE_SESSION_SECRET=<strong random signing secret>
ONE_OPERATOR_IDENTITY=<stable identity>
ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE=user

VITE_TRACK_B_API_URL=
VITE_ONE_AUTH_TOKEN_URL=/api/one/auth-token
```

Add `ONE_WEBHOOK_SECRET` only when the webhook endpoint is actively configured.

`ONE_CONNECTION_KEY` should be considered a legacy/development fallback where possible; production user/account connections should be resolved from `integration_connections`.

## CORS

The current example includes:

```text
https://manage.mujosaigon.com
https://app.withone.ai
https://auth.withone.ai
https://api.withone.ai
```

Do not solve auth by indiscriminately expanding CORS.

CORS should be derived from the actual browser-origin requests observed in DevTools. `api.withone.ai` is primarily a server-to-server destination and generally does not need to be an allowed browser origin on Just Management merely because the backend calls it.

The durable guide's older verification of `https://auth.withone.ai -> 204` should be checked against the current `@withone/auth` network behavior rather than retained by tradition.

---

# 8. Root Cause F — the current operator-cookie design created the cross-origin problem it later had to work around

The original operator-session route creates:

```text
HttpOnly
Secure in production
SameSite=Strict
Path=/api/one
```

This is good protection for same-origin application routes.

However, AuthKit needs to fetch the token URL from hosted Auth UI context. Depending on browser/origin behavior, relying on the operator cookie directly from AuthKit is fragile.

The signed-grant architecture is an attempt to fix that correctly:

```text
same-origin browser request
  -> cookie-protected /api/one/auth-grant
  -> signed short-lived bearer-like grant
  -> AuthKit custom header
  -> /api/one/auth-token
```

That is a reasonable design because the browser first proves its app session in a same-origin call, then gives AuthKit only a short-lived restricted credential.

The failure is not the design; the failure is incomplete frontend migration.

---

# 9. Root Cause G — testing was added after partial refactors instead of acting as a deployment gate

At branch HEAD:

- the newest test describes the desired grant behavior;
- production component still describes the old behavior;
- GitHub shows no combined CI statuses for the HEAD commit.

This means there is no evidence that the exact deployable branch passed CI after the final migration.

## Required release gate

Before Hostinger deploy, enforce:

```text
npm ci
npm run build
npm run typecheck -w frontend
npm run test:frontend -w frontend
npm test -w backend
```

or the repository's canonical equivalents.

Additionally run a contract test that starts the backend and proves:

1. no cookie -> `/api/one/auth-grant` = 401;
2. operator login -> session cookie set;
3. cookie -> `/api/one/auth-grant` = 200;
4. no grant -> `/api/one/auth-token` = 401;
5. bad grant -> 401;
6. valid grant -> app reaches One and returns upstream AuthKit shape;
7. connector rows are non-empty only when One dashboard is configured.

The important distinction is:

```text
401 auth grant required
    = Just Management contract failure

200 + rows=[]
    = One AuthKit visibility/configuration failure
```

These must never be collapsed into the same error category.

---

# 10. Why the previous AI agent failed

## Failure mode 1 — symptom-driven patching

The commit history shows a sequence of local fixes:

- gate connection controls;
- add operator session flow;
- remove browser secret;
- surface connector validation;
- point anonymous users to operator access;
- document Hostinger env handoff;
- widen CORS;
- then introduce a signed-grant redesign.

Each patch addressed a visible symptom, but the whole request chain was not re-proven after every architectural change.

## Failure mode 2 — no single source of truth

The agent had:

- July dev-token guide;
- later operator-cookie code;
- Hostinger handoff;
- CORS instructions;
- One CLI evidence;
- local connection keys;
- August signed-grant work.

Without a versioned contract document, older correct statements became newer incorrect instructions.

## Failure mode 3 — conflating app auth and One auth

There are two independent security domains:

```text
Just Management authorization
    -> may this browser ask for an AuthKit session?

One authorization
    -> which One project/environment/connectors does ONE_SECRET_KEY expose?
```

A successful fix in one domain cannot repair the other.

## Failure mode 4 — conflating connection availability and saved connections

Three states were mixed:

```text
available connector
    = One supports / AuthKit exposes Gmail

AuthKit session rows
    = connectors visible to this key/context

saved connection
    = a specific OAuth-authenticated account persisted for this identity
```

These are not interchangeable.

## Failure mode 5 — assuming CLI and production used the same One context

Local CLI success is only relevant after proving identical:

- secret scope;
- environment;
- organization/project;
- identity/connection.

## Failure mode 6 — tests documenting desired behavior but not proving deployed behavior

The branch HEAD is the strongest example: the test expects a migrated component that does not exist.

An AI agent should never declare an integration repaired until it reads the final production file after edits and executes the relevant tests against the final tree.

---

# 11. Recommended remediation plan

## P0 — restore branch coherence before touching Hostinger

1. Fix `ConnectIntegrationButton.tsx` to use `useAuthGrant`.
2. Accept `authenticated`.
3. Generate `x-one-grant`.
4. Disable Connect until the grant is available.
5. Correct branding (`companyName` should match Just Management / production brand rather than stale `"Latte Lounge"`).
6. Remove duplicate/accidental interface declarations introduced during refactor.
7. Run full frontend/backend tests and production build.
8. Commit only after the exact HEAD passes.

**Do not deploy the current HEAD unchanged.**

## P1 — establish one canonical AuthKit contract document

Replace stale instructions with one current flow:

```text
operator login
-> operator cookie
-> auth grant
-> x-one-grant
-> AuthKit token
-> OAuth
-> persist connection
```

Mark `ONE_DEV_TOKEN`, `VITE_ONE_DEV_TOKEN`, `x-dev-token`, and `x-user-id` troubleshooting paths as deprecated if they are no longer used.

## P2 — reconcile Hostinger environment

Compare every variable visible in Hostinger against the runtime code.

Classify each as:

- required;
- optional;
- deprecated;
- frontend build-time;
- backend runtime;
- secret;
- non-secret.

Restart/redeploy after changes. Hostinger environment changes are not proven active until the process restarts and an endpoint exposes behavior consistent with them.

## P3 — prove One scope

Using the exact production `ONE_SECRET_KEY`:

1. `/v1/whoami`
2. `/v1/available-connectors?authkit=true`
3. `/v1/authkit/token`

Record organization/project/environment metadata, not the secret.

If connectors are absent:

- enable Gmail/Drive/Sheets in AuthKit for that exact context;
- verify Production vs Sandbox;
- compare with a known project-scoped key if necessary.

## P4 — prove end-to-end persistence

After OAuth:

```text
onSuccess.connectionKey
-> POST /api/one/connections
-> DB row
-> GET /api/one/connections
-> passthrough call
```

Do not use global `ONE_CONNECTION_KEY` as the long-term source of truth for customer/user connections.

## P5 — production observability

Add a safe diagnostics endpoint visible only to an operator that reports booleans/metadata, never secrets:

```json
{
  "oneSecretConfigured": true,
  "oneApiBase": "https://api.withone.ai/v1",
  "operatorIdentity": "operator",
  "identityType": "user",
  "authGrantEnabled": true,
  "savedConnectionCount": 3,
  "platforms": ["gmail", "google-drive", "google-sheets"]
}
```

Separately log upstream One errors with:

- HTTP status;
- correlation/request ID;
- endpoint class;
- response type/message;

but never secret values or full connection keys.

---

# 12. Production verification runbook

## Layer 1 — application build

- frontend TypeScript passes;
- frontend tests pass;
- backend tests pass;
- root production build passes.

## Layer 2 — operator authorization

```text
POST /api/one/operator-session
-> 204
```

Then:

```text
GET /api/one/operator-session
-> {"authenticated":true}
```

## Layer 3 — grant

```text
POST /api/one/auth-grant
-> 200
-> grant present
-> expiresAt about 5 minutes ahead
```

Do not print the grant in deployment logs.

## Layer 4 — AuthKit token proxy

With valid `x-one-grant`:

```text
POST /api/one/auth-token?page=1&limit=100
```

Interpret result precisely:

- 401 = Just Management grant failure;
- 5xx with upstream message = One/token-proxy failure;
- 200 + `rows=[]` = One AuthKit visibility/config scope failure;
- 200 + rows = token/connector discovery works.

## Layer 5 — One scope

Production secret:

```text
GET /v1/whoami
GET /v1/available-connectors?authkit=true
```

Confirm expected project/environment and connectors.

## Layer 6 — UI

Open Connect Gmail.

Confirm DevTools sequence:

```text
/api/one/auth-grant       200
/api/one/auth-token       200
One Auth modal            visible Gmail
Google OAuth              success
/api/one/connections      200
```

## Layer 7 — persistence

```text
GET /api/one/connections
```

Must contain the newly connected account under the expected identity.

## Layer 8 — execution

Run one read-only Gmail/Drive/Sheets passthrough operation using the persisted connection key.

That is the first point at which the integration should be considered end-to-end healthy.

---

# 13. Configuration matrix

| Setting | Owner | Current purpose | Production guidance |
|---|---|---|---|
| `ONE_SECRET_KEY` | One -> app | Server API authentication to One | Required; project/environment must match AuthKit configuration |
| `ONE_API_BASE` | app | One API root | Keep `https://api.withone.ai/v1` |
| `ONE_OPERATOR_PASSWORD` | Just Management | Unlock operator session | Required for current internal-operator model |
| `ONE_SESSION_SECRET` | Just Management | Signs operator cookie and Auth grant | Required; strong random value |
| `ONE_OPERATOR_IDENTITY` | Just Management | Stable One connection identity | Required under current single-operator design |
| `ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE` | Just Management | One connection ownership type | `user` is current default |
| `ONE_CONNECTION_KEY` | One / legacy app config | Global development/fallback connection | Prefer DB-backed per-connection rows in production |
| `ONE_WEBHOOK_SECRET` | shared webhook config | Verify One webhook signatures | Only when webhooks enabled |
| `VITE_ONE_AUTH_TOKEN_URL` | frontend | URL given to `@withone/auth` | Same-origin `/api/one/auth-token` is preferred |
| `ONE_DEV_TOKEN` | old app design | Previous auth-token gate | Deprecate/remove if signed grant fully replaces it |
| `VITE_ONE_DEV_TOKEN` | old frontend design | Previous `x-dev-token` source | Deprecate/remove |
| `ALLOWED_ORIGINS` | backend | Browser CORS policy | Keep minimum required browser origins only |

---

# 14. Architectural recommendation beyond the immediate fix

The current `operator` identity is acceptable for an internal single-operator PMS.

If Just Management becomes genuinely multi-user, migrate from:

```text
ONE_OPERATOR_IDENTITY=operator
```

to:

```text
authenticated app user/workspace ID
```

The official One model assigns every connection to the identity used when generating the AuthKit token. A multi-user product should therefore bind the token to the authenticated application user/team/organization rather than a global environment variable.

At that stage, replace the custom operator password/session with the application's normal authenticated user session and mint the short-lived AuthKit grant from that canonical identity.

---

# 15. Final root-cause hierarchy

```text
P0  Branch is internally inconsistent
    backend requires x-one-grant
    frontend does not send x-one-grant
    latest test expects code that is not present

P0  Documentation is version-inconsistent
    July x-dev-token guide != August signed-grant architecture

P1  One AuthKit visibility may still be misconfigured
    previously 200 + rows=[]
    verify exact production key with whoami + authkit connectors

P1  Production connection persistence was empty
    CLI connections != deployed app DB connections

P1  Hostinger configuration has historical variable drift
    reconcile against current runtime reads

P2  Identity architecture is single-operator
    acceptable internally, not final multi-user architecture

P2  Diagnostics/CI were insufficient
    no evidence final branch HEAD passed integrated release checks
```

The correct order is:

```text
repair code contract
-> pass build/tests
-> reconcile Hostinger env
-> prove One key scope/environment
-> prove AuthKit connector visibility
-> OAuth
-> persist connection
-> passthrough smoke test
```

Anything else risks repeating the previous agent's cycle of repairing one symptom while another layer remains broken.

---

# 16. Verification plan and execution record — 2026-08-28

This section records the follow-up plan before presenting its results. It is additive and supersedes only time-sensitive statements in earlier sections where newer runtime evidence is more precise.

## 16.1 Plan

```text
1. Preserve existing report findings and repository changes.
2. Reconfirm the production AuthKit request contract.
3. Separate AuthKit catalog health from token authorization and app persistence.
4. Validate Prisma schema and Azure-safe migration SQL locally.
5. Inspect applied migration state against the connected PostgreSQL database.
6. Run SELECT-only connectivity and representative table queries.
7. Exercise deployed health and DB-backed GET endpoints.
8. Classify each claim as direct evidence, strong inference, or unknown.
9. Append evidence and verdict to this report without exposing credentials.
```

Pass criteria:

- AuthKit diagnosis identifies the first failing boundary and rules out tested alternatives.
- `prisma validate` and Azure migration verification exit successfully.
- `prisma migrate status` reports no failed, divergent, or unapplied migrations.
- `SELECT 1` and representative table reads succeed through Prisma.
- deployed DB-backed endpoints return successful responses with expected record shapes.
- no database write, migration-deploy, seed, secret, production configuration, or mutating Git operation occurs.

Forbidden during assessment:

- `prisma migrate dev`, `prisma migrate deploy`, `prisma db push`, `prisma db reset`, or seeding;
- `INSERT`, `UPDATE`, `DELETE`, `UPSERT`, or DDL;
- printing `DATABASE_URL`, usernames, passwords, One keys, or session secrets.

---

# 17. Updated WithOne/AuthKit finding

## 17.1 Direct evidence

The `No integrations available` symptom is not caused by an empty AuthKit catalog for the tested project key:

- One CLI resolves the project-scoped identity to organization `MUJO`, project `Just_Management`, environment `live`.
- `POST /v1/authkit/token?page=1&limit=100` returned eight catalog rows, five active.
- `GET /v1/available-connectors?authkit=true&limit=300&page=1` returned the same five active connectors: Gmail, Google Docs, Google Drive, Google Places, and Google Sheets.
- production `OPTIONS /api/one/auth-token` from origin `https://auth.withone.ai` returned `204` and allowed the origin, method, and `content-type`; CORS preflight is not the failing boundary.
- production `POST /api/one/auth-token?page=1&limit=100` without a grant returned `401 {"error":"operator session required"}`.
- production `POST /api/one/auth-grant` returned `404`, proving the deployed backend does not expose the current signed-grant bridge.
- the deployed frontend bundle uses `/api/one/auth-token` and does not contain `/api/one/auth-grant` or `x-one-grant`.

## 17.2 Root cause

```text
deployed frontend opens cross-origin AuthKit
-> token request carries no x-one-grant
-> deployed backend requires operator-session cookie
-> operator cookie is SameSite=Strict
-> cross-origin AuthKit context cannot present that cookie
-> /api/one/auth-token returns 401
-> connector catalog never reaches the widget
-> widget renders No integrations available
```

The proximate failure is token authorization, not connector visibility. The current local source contains the intended replacement contract: obtain a short-lived grant, send `x-one-grant` to the token endpoint, then persist the returned connection key. Production still runs the older operator-cookie contract.

## 17.3 Remaining deployment unknown

The project-scoped One key was verified locally only. The value and project scope of Hostinger's deployed `ONE_SECRET_KEY` were not inspected and remain unverified. This does not alter the demonstrated 401 failure, which occurs before a connector catalog can be returned.

---

# 18. PostgreSQL assessment — read-only

## 18.1 Scope

The assessment tested the currently configured Prisma connection to Azure PostgreSQL without changing data or schema. It distinguishes static validity, direct database behavior, deployed API behavior, and business-data completeness.

## 18.2 Evidence matrix

| Layer | Check | Observed result | Verdict | What it proves |
|---|---|---|---|---|
| Local configuration | `backend/.env` presence and `DATABASE_URL` declaration, values withheld | File and variable present; `sslmode=require`; database name `m_management` | Pass | A database target is configured locally |
| Prisma schema | `npm run db:validate` | `prisma/schema.prisma` is valid | Pass | Prisma can parse the canonical schema |
| Migration SQL policy | `npm run db:verify:migration` | 15 migrations found; 33 `CREATE TABLE` statements; required `pgcrypto` and timestamp trigger present; banned Supabase roles/RLS absent | Pass | Deployable SQL matches Azure/PostgreSQL policy |
| Applied migration state | `npm exec -- prisma migrate status` | Connected successfully; 15 migrations found; schema reported up to date | Pass | Database is reachable and migration history is current, non-divergent, and non-failed |
| Direct connectivity | Prisma `SELECT 1 AS ok` | Returned `1` | Pass | Prisma can establish a session and execute SQL |
| Core data reads | SELECT-only counts | 8 properties, 45 rooms, 30 reservations | Pass | Core hospitality tables exist, contain data, and are readable |
| Extended data reads | SELECT-only counts | 0 tenants, 1 stay registration, 1 folio, 0 tax export items | Pass with data caveat | Newer domain tables exist and are readable; sparse rows reflect data state, not connectivity failure |
| App connection persistence | SELECT-only grouped read of `integration_connections` | 0 rows | Functional table; integration state incomplete | Database works, but no WithOne connection has been persisted by the application |
| Latest migrations | Read last three `_prisma_migrations` rows | All three finished; each applied one step | Pass | Recent migrations completed successfully |
| Deployed process | `GET https://manage.mujosaigon.com/health` | HTTP 200, `{"status":"ok","track":"B"}` | Pass, limited | Backend process is running; this route alone is not a DB check |
| Deployed property read | `GET /api/properties` | HTTP 200, eight records, expected private cache header | Pass | Deployed backend successfully performs a Prisma-backed database read |
| Deployed reservation read | `GET /api/reservations?limit=1` | HTTP 200, one record, `no-store` | Pass | A second deployed Prisma-backed read succeeds against booking truth |

## 18.3 Database verdict

**The connected PostgreSQL database is functioning correctly for the assessed runtime paths.** Direct Prisma connectivity succeeds, the canonical schema validates, all 15 migrations are applied, representative tables are readable, core records are present, and deployed DB-backed endpoints return successful responses.

The empty `integration_connections` table is not a PostgreSQL fault. It corroborates the WithOne diagnosis: AuthKit authorization fails before OAuth completion and application persistence, so no connection row has been saved.

## 18.4 Limits

- The assessment was read-only; write paths, transactions that mutate state, backup restoration, failover, connection-pool saturation, and sustained load were not tested.
- `GET /health` is process health only. The successful `/api/properties` and `/api/reservations` reads provide the deployed database evidence.
- Hostinger's deployed `DATABASE_URL` value was not exposed or compared byte-for-byte. The deployed API results nevertheless prove that its active backend can read its configured database.
- Data completeness is domain-specific. Zero-row tables may require operational setup, but do not indicate database malfunction.

## 18.5 Combined conclusion

```text
PostgreSQL infrastructure and Prisma read path: healthy
AuthKit connector catalog: healthy for tested project key
Application-saved WithOne connections: empty
Production AuthKit token authorization: broken on legacy cookie contract
Required repair: deploy matched signed-grant frontend/backend, align deployed One key, complete OAuth, verify integration_connections persistence
```

---

# Sources

## Repository evidence

- Branch HEAD: `194debf6d3914213530ebcef163c5a7ae21697b4`
- `backend/src/routes/one.ts`
- `frontend/src/components/integrations/ConnectIntegrationButton.tsx`
- `frontend/src/components/integrations/ConnectIntegrationButton.test.tsx`
- `frontend/src/hooks/use-one-connections.ts`
- `frontend/src/lib/repositories/rest-repositories.ts`
- `frontend/src/lib/repositories/types.ts`
- `frontend/src/pages/settings/integrations-page.tsx`
- `backend/.env.example`
- `docs/reports/durable-one-auth-deployment-guide.md`
- `docs/reports/WithOne_API.md`
- `docs/reports/one-google-hostinger-integration-status.md`
- `hostinger_logs.md`

## Official One documentation

- Auth setup: `https://www.withone.ai/docs/auth/setup`
- Auth management: `https://www.withone.ai/docs/auth/management`
- Authentication/environments: `https://www.withone.ai/docs/api-reference/authentication`
- Who Am I: `https://www.withone.ai/docs/api-reference/identity/whoami`
- List Connectors: `https://www.withone.ai/docs/api-reference/connectors/list_connectors`
- Organizations and Projects: `https://www.withone.ai/docs/organization-and-projects`

---

## Evidence gap requiring follow-up

The requested `config.md` and `withone-authkit-configuration-breakdown.md` are not discoverable in the assessed GitHub repository state. If they exist only on the Hostinger filesystem, a local workstation, or Notion, add them to the repository (redacted where necessary) or provide them directly. The exact production-variable comparison should then be appended to this report as a value-presence matrix without exposing secret values.
