# WithOne AuthKit Configuration Breakdown

## Executive Summary

Google Drive, Google Sheets, and Gmail were not using different `x-one-grant` configurations.

`x-one-grant` is not connector-specific. It is MUJO's short-lived authorization mechanism for the AuthKit token proxy. Gmail, Google Drive, and Google Sheets all pass through the same grant, WithOne project, and AuthKit identity.

The production failure was an authorization transport problem:

1. The MUJO application ran at `https://manage.mujosaigon.com`.
2. The AuthKit iframe ran at `https://auth.withone.ai`.
3. The deployed token endpoint depended on MUJO's `SameSite=Strict` operator cookie.
4. The cross-origin AuthKit iframe could not send that cookie.
5. The deployed frontend did not send an `x-one-grant` header.
6. The token request was therefore unauthorized.
7. AuthKit displayed the misleading message: `No integrations available. Please activate integrations from the AuthKit dashboard.`

The connector catalog itself was correctly configured. An authenticated production request returned Gmail, Google Drive, and Google Sheets as active live connectors.

## Configuration Layers

| Layer | Purpose | Scope |
|---|---|---|
| WithOne connector catalog | Enables Gmail, Google Drive, and Google Sheets in AuthKit | WithOne project |
| WithOne vault connections | Stores OAuth-connected Google accounts | Identity-specific |
| `x-one-secret` | Authenticates the MUJO backend to WithOne | Server-only |
| `x-one-grant` | Authorizes the AuthKit iframe to call MUJO's token endpoint | MUJO session and identity |
| MUJO database rows | Stores returned connection-key references | MUJO operator identity |
| One CLI connections | Stores connections available to the CLI account/configuration | CLI account and key scope |

These layers are related but not interchangeable. A working CLI connection does not prove the MUJO browser flow is authorized. An enabled connector does not prove an OAuth account has been connected. A saved MUJO database row does not enable a connector in the WithOne project.

## Verified Production State

The authenticated production endpoint was tested directly:

```text
POST /api/one/auth-token?page=1&limit=100
HTTP 200
```

It returned:

```text
Gmail         active=true environment=live
Google Drive  active=true environment=live
Google Sheets active=true environment=live
```

This proves:

- `ONE_SECRET_KEY` reaches a WithOne project containing all three connectors.
- Gmail, Google Drive, and Google Sheets are enabled.
- The connectors are configured in the live environment.
- The WithOne connector catalog is not the root cause.
- Google Drive and Google Sheets are not split across different `x-one-grant` configurations.

## Root Cause

### Origin Boundary

The browser flow crosses two origins:

```text
MUJO application:
https://manage.mujosaigon.com

AuthKit iframe:
https://auth.withone.ai
```

The deployed frontend supplied this token URL to AuthKit:

```text
https://manage.mujosaigon.com/api/one/auth-token
```

AuthKit called that endpoint from the `auth.withone.ai` origin. The old production backend authorized the request using MUJO's operator-session cookie.

That cookie was intentionally protected with:

```text
HttpOnly
Secure
SameSite=Strict
Path=/api/one
```

`SameSite=Strict` prevents the cross-site AuthKit iframe from using the cookie. The effective failure path was:

```text
AuthKit iframe
  calls /api/one/auth-token
  lacks the MUJO operator cookie
  receives HTTP 401
  displays a misleading no-integrations state
```

The failure occurred before connector selection or Google OAuth. It was not caused by Drive, Sheets, or Gmail configuration.

## Purpose of `x-one-grant`

The grant safely bridges the first-party MUJO session into the cross-origin AuthKit token request.

Correct flow:

1. The operator signs into MUJO.
2. The browser receives the protected operator-session cookie.
3. The MUJO frontend calls `POST /api/one/auth-grant` on the same origin.
4. The backend validates the operator cookie.
5. The backend creates a short-lived signed grant.
6. The frontend passes the grant to AuthKit as `x-one-grant`.
7. The AuthKit iframe calls `POST /api/one/auth-token`.
8. The backend validates `x-one-grant` without requiring the cross-site cookie.
9. The backend calls WithOne using `x-one-secret`.
10. WithOne returns the Gmail, Google Drive, and Google Sheets inventory.
11. The operator completes OAuth for the selected connector.
12. MUJO saves the returned connection key.

The grant contains only authorization context:

```ts
{
  identity: "operator",
  identityType: "user",
  exp: number,
}
```

It does not contain:

- Google credentials
- OAuth tokens
- Connector configuration
- Connector selection
- The WithOne secret
- A saved connection key

Connector selection remains separate:

```ts
selectedConnection: "Gmail"
selectedConnection: "Google Drive"
selectedConnection: "Google Sheets"
```

## Required WithOne Configuration

All connectors must exist under the same WithOne project represented by `ONE_SECRET_KEY`.

Required project state:

```text
Environment: live
Gmail: active
Google Drive: active
Google Sheets: active
```

This state was already confirmed in production.

The backend key must belong to that exact project:

```env
ONE_SECRET_KEY=<matching WithOne project secret>
ONE_API_BASE=https://api.withone.ai/v1
```

`ONE_SECRET_KEY` must never be exposed through Vite, frontend code, browser storage, or API responses.

## Required MUJO Backend Configuration

The production backend requires:

```env
ONE_SECRET_KEY=<WithOne project secret>
ONE_API_BASE=https://api.withone.ai/v1

ONE_OPERATOR_IDENTITY=operator
ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE=user

ONE_OPERATOR_PASSWORD=<operator password>
ONE_SESSION_SECRET=<strong random persistent secret>

ALLOWED_ORIGINS=https://manage.mujosaigon.com,https://auth.withone.ai
```

Configuration roles:

| Variable | Role |
|---|---|
| `ONE_SECRET_KEY` | Selects and authenticates the WithOne project |
| `ONE_API_BASE` | Selects the WithOne API base URL |
| `ONE_OPERATOR_IDENTITY` | Binds AuthKit and saved MUJO rows to one stable identity |
| `ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE` | Selects the WithOne identity model |
| `ONE_OPERATOR_PASSWORD` | Protects MUJO operator controls |
| `ONE_SESSION_SECRET` | Signs the operator cookie and `x-one-grant` |
| `ALLOWED_ORIGINS` | Allows the MUJO page and AuthKit iframe to access permitted backend routes |

`ONE_SESSION_SECRET` must remain stable across backend restarts and instances. Changing it invalidates existing operator sessions and grants.

The current grant route is implemented in `backend/src/routes/one.ts`:

```text
POST /api/one/auth-grant
Authorization: MUJO operator cookie
Response: { grant, expiresAt }
```

The token route then accepts:

```text
POST /api/one/auth-token
x-one-grant: <signed grant>
Response: WithOne AuthKit inventory
```

The server-to-WithOne request is implemented in `backend/src/integrations/one/auth-token.ts`:

```text
POST https://api.withone.ai/v1/authkit/token
x-one-secret: ONE_SECRET_KEY
identity: operator
identityType: user
```

## Required MUJO Frontend Configuration

The production Vite build needs a token URL pointing to the matching backend:

```env
VITE_ONE_AUTH_TOKEN_URL=/api/one/auth-token
```

Because the frontend and backend share the same production origin, the relative URL is preferred. It avoids hard-coded environment drift.

An absolute equivalent is:

```env
VITE_ONE_AUTH_TOKEN_URL=https://manage.mujosaigon.com/api/one/auth-token
```

The frontend must:

1. Confirm that the MUJO operator is authenticated.
2. Call `/api/one/auth-grant` from the MUJO origin.
3. Pass the returned grant into AuthKit.
4. Disable connector buttons until the grant exists.
5. Use exact WithOne connector names.

The intended implementation lives in `frontend/src/components/integrations/ConnectIntegrationButton.tsx`:

```ts
token: {
  url: absoluteTokenUrl(tokenUrl),
  headers: {
    "x-one-grant": grant,
  },
}
```

## Deployment Mismatch

Production was running an older contract.

Deployed frontend:

```text
- Did not call POST /api/one/auth-grant
- Did not send x-one-grant
- Expected the AuthKit token request to rely on the operator cookie
```

Deployed backend:

```text
- Returned HTTP 404 for POST /api/one/auth-grant
- Authorized /api/one/auth-token using the operator cookie
```

Current local source implements the newer contract.

Current frontend:

```text
- Mints x-one-grant
- Passes the grant to AuthKit
- Sends x-one-grant on the token request
```

Current backend:

```text
- Exposes POST /api/one/auth-grant
- Verifies x-one-grant on /api/one/auth-token
- Does not depend on the cross-site operator cookie for the AuthKit token call
```

Frontend and backend must be deployed together:

| Deployment combination | Result |
|---|---|
| New frontend and old backend | `/api/one/auth-grant` returns HTTP 404 |
| Old frontend and new backend | `/api/one/auth-token` returns HTTP 401 `auth grant required` |
| New frontend and new backend | Correct grant-enabled flow |
| Old frontend and old backend | Cross-site cookie authorization failure |

## Connector Availability Versus Connected Accounts

Three separate states must not be conflated:

```text
Connector available:
Google Drive appears in AuthKit.

Account connected:
An operator completed Google OAuth for Drive.

Connection saved:
MUJO stored the returned WithOne connection-key reference.
```

The token response reporting `total: 3` proves connector availability. It does not prove that MUJO has three connected OAuth accounts.

Each completed OAuth flow produces its own connection key:

```text
Gmail account        connectionKey A
Google Drive account connectionKey B
Google Sheets account connectionKey C
```

These keys may represent the same Google user, but they remain separate provider connections.

MUJO persists their references under:

```text
user_id = ONE_OPERATOR_IDENTITY
identity_type = ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE
```

The persistence route is implemented in `backend/src/routes/one.ts`.

## One CLI Versus MUJO

The working One CLI connections do not prove the MUJO AuthKit browser flow works.

The CLI uses:

```text
CLI configuration
CLI API key and account
CLI connection inventory
```

MUJO uses:

```text
Production ONE_SECRET_KEY
AuthKit identity: operator/user
MUJO grant flow
MUJO PostgreSQL connection references
```

The CLI and MUJO may target the same WithOne account while using different identity scopes or saved connection inventories. CLI connections are not automatically imported into MUJO.

The direct production API test proved that MUJO's project secret sees all three enabled connectors. It did not merge the CLI's saved connections into MUJO.

## Correct Final Configuration

```text
One WithOne project
  ONE_SECRET_KEY
  live environment
  Gmail active
  Google Drive active
  Google Sheets active

One MUJO AuthKit identity
  identity=operator
  identityType=user

One cross-origin authorization bridge
  operator cookie authorizes /api/one/auth-grant
  x-one-grant authorizes /api/one/auth-token

One deployment contract
  matching frontend and backend versions

Separate OAuth connection keys
  one per connected connector/account
  persisted in MUJO PostgreSQL
```

## Required Remediation

1. Configure production with the required backend variables.
2. Prefer `VITE_ONE_AUTH_TOKEN_URL=/api/one/auth-token` for the frontend build.
3. Ensure the permitted CORS origin configuration includes `https://auth.withone.ai` where the AuthKit request requires it.
4. Deploy the current grant-enabled backend and frontend together.
5. Confirm `POST /api/one/auth-grant` returns HTTP 200 after MUJO operator authentication.
6. Confirm AuthKit's `POST /api/one/auth-token` includes `x-one-grant` and returns HTTP 200.
7. Reconnect each required Google service through MUJO.
8. Confirm each successful OAuth result is persisted as a MUJO connection-key reference.

The principal correction is deployment parity: the current grant-enabled frontend and backend must be deployed as one compatible release.
