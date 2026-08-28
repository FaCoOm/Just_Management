# Hostinger Operator Auth Env Handoff

Generated: 2026-08-27

These are the required env vars for the WithOne operator-auth flow on `manage.mujosaigon.com`. Paste each `KEY=VALUE` row into Hostinger's Environment Variables panel and restart the Node.js app.

## Required (must set, was previously missing or placeholder)

```
ONE_OPERATOR_PASSWORD=<your-passphrase>
ONE_SESSION_SECRET=<redacted>
ONE_OPERATOR_IDENTITY=operator
```

- `ONE_OPERATOR_PASSWORD` — operator-chosen passphrase. Any string (no length check). Pick something memorable.
- `ONE_SESSION_SECRET` — 64-char hex string generated via `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Same value as local `backend/.env`. Rotating it invalidates all existing operator sessions.
- `ONE_OPERATOR_IDENTITY` — stable label. Defaults to `operator` if unset.

## Already configured in repo (verify Hostinger matches)

```
ONE_CONNECTION_KEY=<redacted>
ONE_SECRET_KEY=<redacted>
ONE_API_BASE=https://api.withone.ai/v1
ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE=user
```

## Optional / replace placeholder

```
ONE_WEBHOOK_SECRET=<replace when webhooks wired up — currently placeholder>
GOOGLE_SHEETS_SPREADSHEET_ID=<your spreadsheet ID>
```

## Removed (do not set)

```
ONE_DEV_TOKEN   # retired in commit 719c0c4; /api/one/auth-token is now operator-session gated
VITE_ONE_DEV_TOKEN   # removed from frontend env in commit 802abd0
```

## Smoke test on local backend (verified 2026-08-27)

```
curl -i -X POST http://localhost:3001/api/one/operator-session \
  -H "Content-Type: application/json" \
  -d '{"password":"<your-passphrase>"}'
# → 204 + Set-Cookie: one_operator_session=...; HttpOnly; SameSite=Strict; Path=/api/one

curl --cookie "one_operator_session=<value>" \
  http://localhost:3001/api/one/connections
# → 200 {"connections":[...]}

curl -X POST http://localhost:3001/api/one/auth-token \
  --cookie "one_operator_session=<value>" \
  -H "Content-Type: application/json" -d '{}'
# → 200 {rows:[Gmail, Google Drive, Google Sheets], total:3, ...}

curl -X POST http://localhost:3001/api/one/operator-session \
  -H "Content-Type: application/json" \
  -d '{"password":"wrong"}'
# → 401 {"error":"invalid operator credentials"}
```

## Restart after change

`hPanel → Node.js Apps → manage.mujosaigon.com → Restart`. Wait for "Server listening on 3001" in `getNodeJSBuildLogsV1`.

## Frontend behavior after restart

- Anonymous: Operator Access card shows login form, Connector Availability list shows 3 connectors with `Locked` badge and the "Authenticate via the Operator Access card above" hint.
- After correct password: card flips to `Authenticated / Sign out`, badges flip to `Not validated`, Connect buttons appear.
- After successful WithOne OAuth: persisted rows appear under each connector as `Validated`.

> ⚠️ **ROTATE NOW** — live credentials in this file were replaced with `<redacted>`. Treat them as compromised; rotation is the user's responsibility (see the notice in `docs/config.md`).
