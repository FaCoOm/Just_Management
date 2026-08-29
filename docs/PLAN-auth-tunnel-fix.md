# PLAN: One Auth Operator Authentication & Dynamic Tunnel CORS Fix

## 1. Problem Statement & Root Cause Synthesis

### Root Cause 1: Backend CORS Origin Rejection for Tunnel Domains (HTTP 500)
- **Mechanism**: When accessing the frontend via a public tunnel (e.g. `https://tions-theory-dividend-studios.trycloudflare.com`), the browser sends an `Origin: https://tions-theory-dividend-studios.trycloudflare.com` header with every `POST` request.
- **Defect**: In `backend/src/index.ts`, `ALLOWED_ORIGINS` was a strict static list containing only `localhost`, `manage.mujosaigon.com`, and `withone.ai`. Because the dynamic tunnel domain was not in the array, the CORS callback invoked `callback(new Error("CORS origin not allowed"))`.
- **Consequence**: Express's CORS middleware translates an Error passed to `callback` into an unhandled middleware error, returning **`HTTP 500 Internal Server Error`** to the client.

### Root Cause 2: Misleading Frontend Error Display
- **Mechanism**: In `frontend/src/lib/repositories/rest-repositories.ts`, `loginOperator` did:
  ```typescript
  if (!res.ok) throw new Error("Invalid operator password");
  ```
- **Defect**: Any non-2xx response (including `HTTP 500 CORS Error`, `502 Bad Gateway`, or `504 Gateway Timeout`) threw the identical error message `"Invalid operator password"`.
- **Consequence**: The UI displayed *"Invalid operator password"* even though the credentials entered by the user were 100% correct, obscuring the underlying CORS/network error.

---

## 2. Solution Architecture & Task Breakdown

### Component 1: Backend Dynamic Tunnel Origin Recognition (`backend/src/index.ts`)
- Implement `isAllowedOrigin(origin: string): boolean` helper:
  - Exact match against `ALLOWED_ORIGINS` (`manage.mujosaigon.com`, `auth.withone.ai`, `app.withone.ai`, `localhost:*`, `127.0.0.1:*`, `host.docker.internal:*`).
  - Suffix matching for standard secure tunnel providers:
    - `.trycloudflare.com`
    - `.ngrok-free.app`
    - `.ngrok.io`
    - `.loca.lt`
  - In non-production environments or when origin matches, allow with `callback(null, true)`.
  - On disallowed origin, cleanly return `callback(null, false)` instead of throwing `new Error(...)` to prevent unhandled 500 errors.

### Component 2: Frontend Descriptive Error Differentiation
- Update `loginOperator` in `frontend/src/lib/repositories/rest-repositories.ts`:
  - When `res.status === 401`: throw `new Error("Invalid operator password. Please verify the credentials.")`.
  - When `res.status === 500`: throw `new Error("Server error or CORS rejection. Please check backend logs.")`.
  - On network failure: throw `new Error("Network error. Unable to reach the API server.")`.
- Update `frontend/src/pages/settings/integrations-page.tsx` to render `operatorLogin.error?.message` dynamically instead of a hardcoded string.

### Component 3: End-to-End Automated Browser Testing
- Execute `scripts/test-browser-login.mjs` via Chrome CDP:
  - Navigate to `https://tions-theory-dividend-studios.trycloudflare.com/settings/integrations`.
  - Fill password `XHXb4u4mfRHFq24L7Nbp`.
  - Click `Sign in`.
  - Validate that `POST /api/one/operator-session` returns `HTTP 204 No Content`.
  - Validate that `GET /api/one/operator-session` returns `{ authenticated: true }`.
  - Validate that the DOM displays the green **"Authenticated"** badge and unlocks all connection buttons.

---

## 3. Verification & Safety Gates
- Automated browser CDP execution test against the live HTTPS tunnel.
- Backend unit & integration test suite (`npm test -w backend`).
- Frontend vitest test suite (`npm run test:frontend -w frontend`).
- Typecheck & build validation (`npm run typecheck`, `npm run build`).
