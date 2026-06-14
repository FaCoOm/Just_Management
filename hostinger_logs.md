# Hostinger Deploy: "No output directory found after build"

## Nature of the Issue

The previous diagnosis in this file (missing `outDir` in `backend/tsconfig.json`,
build script not emitting to a known directory) is **wrong**. Verified evidence:

- `backend/tsconfig.json` already declares `"outDir": "./dist"`.
- `backend/dist/index.js` and the full compiled tree exist after `npm run build`.
- `backend/package.json` `build` = `prisma generate && tsc` and works correctly.

The TypeScript build is healthy. The error is a **deployment-config mismatch**,
not a TypeScript-config bug.

### What is actually happening

This repo is an npm-workspaces monorepo:

```
package.json          # workspaces: ["frontend", "backend"]
frontend/             # Vite build  -> frontend/dist/   (static HTML/JS/CSS)
backend/              # tsc build   -> backend/dist/    (Node.js server)
dist/                 # stale Vite output left at repo root (manual copy / legacy)
backend/server.py     # Hostinger Uvicorn supervisor; spawns tsx watch on backend/src/index.ts
```

Root `npm run build` =
`npm run build -w frontend && npm run build -w backend`
=> emits `frontend/dist/` AND `backend/dist/`. It does **not** produce a fresh
unified `dist/` at the repo root.

Hostinger's deploy pipeline raises *"No output directory found after build"*
when, after running its configured build command, it looks for the configured
**output directory** path and finds nothing fresh there. With this layout,
that happens whenever the Hostinger panel is pointed at the repo root and
its output directory is left at the default (`dist/`) instead of the
workspace-specific `frontend/dist` or `backend/dist`.

A second contributing factor: `backend/server.py` runs the backend via
`tsx watch src/index.ts`, so `backend/dist/` is never actually executed in
this deployment model. The build is being performed for a runtime that does
not use it, which makes the missing-output failure both noisy and non-fatal
at runtime, but still blocks Hostinger's pipeline.

## Resolution

Pick the path that matches what is actually being deployed.

### Path A: Static frontend on Hostinger Web Hosting

Use this if Hostinger should serve the React app as static files.

In the Hostinger panel for the site, set:

- **Application root**: `frontend`
- **Build command**: `npm install && npm run build`
- **Output directory**: `dist`     (relative to application root => `frontend/dist`)
- **Install command**: leave default

The backend then deploys separately (Path B or a separate Node app).

### Path B: Node.js backend on Hostinger Node hosting (current `server.py` model)

Use this if Hostinger runs the Express backend through `backend/server.py`.

In the Hostinger Node.js app config:

- **Application root**: `backend`
- **Application startup file**: `server.py`   (Uvicorn supervisor; spawns Node)
- **Build command**: `npm install && npm run build`
- **Output directory**: `dist`     (relative to application root => `backend/dist`)

`backend/server.py` currently spawns `tsx watch src/index.ts` and ignores
`backend/dist/`. If you want production to actually run the compiled output
(faster cold start, no `tsx` in prod), change the spawn line in `server.py`
to `node dist/index.js` after `npm run build` has run. Otherwise leave it,
but expect Hostinger's pipeline to still need a valid output-directory
setting just to clear the build step.

### Path C: Unified `dist/` at repo root (✅ IMPLEMENTED)

This is the path now wired into the repo. It preserves the monorepo
architecture (separate `frontend/` and `backend/` workspaces) AND produces a
single consolidated `dist/` at repo root that Hostinger can find.

**Why this works for both consumers**:

- `backend/src/index.ts` already serves the SPA from `path.resolve(__dirname,
  "../../dist")` — i.e. the repo-root `dist/`. So the same directory feeds
  Express runtime AND the Hostinger pipeline. No duplication.
- Root `dist/` is gitignored (`.gitignore` line 15) — nothing gets committed.

**What was added**:

1. `scripts/sync-dist.mjs` — a small Node helper that mirrors
   `frontend/dist/` to root `dist/` after the workspace builds finish.
2. `package.json` (root):

```json
"scripts": {
  "build": "npm run build -w frontend && npm run build -w backend && npm run sync:dist",
  "sync:dist": "node scripts/sync-dist.mjs"
}
```

**Resulting build flow** (root `npm run build`):

1. `npm run build -w frontend` → emits `frontend/dist/`.
2. `npm run build -w backend` → emits `backend/dist/`.
3. `npm run sync:dist` → mirrors `frontend/dist/` to root `dist/`.

**Hostinger panel config (with this layout)**:

- **Application root**: repo root
- **Build command**: `npm install && npm run build`
- **Output directory**: `dist`   (default; resolves to repo-root `dist/`)
- **Application startup file** (Node.js plan only): `backend/server.py`
  if using the Uvicorn supervisor, otherwise `backend/dist/index.js`.

## What NOT to do

- Do not "add" `outDir` to `backend/tsconfig.json`; it is already set.
- Do not change `backend/package.json` `build` to `tsc --outDir dist`; redundant
  and silently overrides `tsconfig.json`.
- Do not commit root `dist/` to the repo; it is gitignored and is rebuilt by
  `npm run build`. Treat it strictly as a build artifact.
- Do not delete `backend/server.py` without confirming whether Hostinger's
  Node.js plan still requires a Python supervisor entry.

## Verification After Fix

1. Reproduce locally from a clean state:
   - Delete `frontend/dist/`, `backend/dist/`, `dist/`.
   - `npm run build` at repo root.
   - Confirm all three exist:
     - `frontend/dist/index.html`
     - `backend/dist/index.js`
     - `dist/index.html` (mirrored from `frontend/dist/`)
2. Sanity check the runtime path:
   `backend/dist/index.js` resolves `../../dist` to repo-root `dist/`.
   Verified — same directory `sync-dist.mjs` writes to.
3. Boot Express against the unified output:
   `node backend/dist/index.js`, hit `/` (SPA) and `/health` (API).
4. Trigger Hostinger redeploy; build log should no longer report
   *"No output directory found after build"*.

## Status (as of 2026-06-14)

- Build pipeline: ✅ unified. `npm run build` produces `frontend/dist/`,
  `backend/dist/`, and root `dist/` in one chain.
- TypeScript config: ✅ unchanged. Already correct.
- Express SPA serving: ✅ already pointed at repo-root `dist/`.
- Frontend build artifact: ✅ confirmed clean (no `localhost:3001` baked in;
  `.env.production` propagates `VITE_TRACK_B_API_URL=` for same-origin).
- Live site: ❌ `https://manage.mujosaigon.com/` returns Hostinger's default
  "This Page Does Not Exist" Angular 404. Backend never starts because
  Hostinger app is misconfigured — see Restoration Plan below.

## Restoration Plan (2026-06-14): switch framework from `Vite` to `Other` (Express.js)

### Why the live site is broken

Hostinger MCP `listJsDeployments` shows the latest 5 builds for
`manage.mujosaigon.com` all configured with:

```json
{ "app_type": "vite", "build_script": "build", "output_directory": "dist" }
```

`app_type: "vite"` tells Hostinger to treat the app as a **static-only** site.
After the build pipeline produces `dist/`, Hostinger serves those files via
its static web server. **The Node.js Express backend is never started**, so:

- `/api/*` returns 404 (no Express to handle it)
- SPA client-side routes other than `/` return 404 (no Express SPA fallback)
- The Hostinger default Angular 404 page leaks through because the static
  doc-root is not pointing at the freshly-built `dist/` directory under the
  `app_type=vite` model when it expects a different layout

### What to switch to

Change Hostinger's framework type from auto-detected `vite` to **Other** with
**Entry file** = `backend/dist/index.js`. Per Hostinger's official docs, the
`Other` type is the explicit selector for Node.js apps where auto-detect cannot
categorize a custom Express setup. The single Express process then:

1. Handles `/api/*` (already wired in `backend/src/index.ts:92-94`).
2. Serves the SPA from `path.resolve(__dirname, "../../dist")` at `/`
   with a catch-all SPA fallback (already wired around line 1320).
3. Trusts the Hostinger reverse-proxy hop (`app.set("trust proxy", 1)`,
   line 24) so `req.protocol`/`req.ip` reflect the real client over HTTPS.

**Source citation**: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/
(verbatim: "Backend-supported Applications: Next.js, Express.js, NestJS,
Nuxt.js, Fastify, Astro, SvelteKit" and "You can also select 'Other' manually
from the framework dropdown during setup").

**The git-based commit-from-repo deploy flow is preserved.** Hostinger keeps
pulling from git on every deploy; the only thing that changes is what it does
with the build output (run `node backend/dist/index.js` instead of serving
`dist/` statically).

### hPanel reconfiguration steps (validated against official Hostinger docs)

**Source**: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/

1. **hPanel → Websites → `manage.mujosaigon.com` → Manage → Node.js Apps**.
2. Click the existing app (currently typed as `Vite`). **Stop** if running.
3. **Settings → Build Settings**: change framework dropdown from `Vite` to **`Other`**.
   This unlocks the Entry file field. Per official docs:
   > "You can also select 'Other' manually from the framework dropdown during setup."
   > "Entry file - Enter the main file that starts your application (e.g.,
   > index.js, server.js). This is only required if your application needs it."
4. Set the build settings:
   - **Framework**: `Other`
   - **Build script**: `build` (already set; runs `npm run build` per root package.json)
   - **Output directory**: `dist` (already set; matches `sync-dist.mjs` target)
   - **Entry file**: **`backend/dist/index.js`** ⬅ this is the critical change
   - **Node version**: `22` (LTS; already set; auto-selected by Hostinger)
   - **Package manager**: leave auto (npm via root `package-lock.json`)
   - **Root directory**: leave empty (defaults to repo root, where
     workspace `package.json` lives)
5. **Source**: keep existing git source (commit-from-repo flow preserved).
6. **Environment Variables** panel — paste each KEY=VALUE row from
   `backend/.env.production` (gitignored local file). Required keys per
   `backend/src/config/env-validator.ts`:
   - `DATABASE_URL` — Azure Postgres URL with `sslmode=require` (REQUIRED)
   - `PORT=3001`
   - `NODE_ENV=production`
   - `SLOW_REQUEST_THRESHOLD_MS=500`
   - `ALLOWED_ORIGINS=https://manage.mujosaigon.com`
   - `ONE_CONNECTION_KEY` — live WithOne keys (3 comma-separated)
   - `ONE_SECRET_KEY` — `sk_live_...`
   - `ONE_API_BASE=https://api.withone.ai/v1`
   - `ONE_WEBHOOK_SECRET` — placeholder until webhooks enabled
   - `ONE_DEV_TOKEN` — placeholder; replace before exposing /api/one/auth-token
   - `ONE_AUTHKIT_DEFAULT_IDENTITY_TYPE=user`
   - `INGEST_PIPELINE_ENABLED=false` — disabled day one (Linux import path
     not yet configured on Hostinger filesystem)
   - `INGEST_SHEETS_PROVIDER=withone`
   - `GOOGLE_SHEETS_SPREADSHEET_ID` — placeholder until sheets ingestion live
   - Optional: `M_MANAGEMENT_LISTINGS_CREATE_INVENTORY=false`,
     `M_MANAGEMENT_EMAIL_IMPORT_ENABLED=false`
7. Also add the two **frontend** VITE_* keys (Vite reads `process.env`
   during `vite build` and embeds the value into the static bundle):
   - `VITE_TRACK_B_API_URL=` (empty — same-origin)
   - `VITE_ONE_AUTH_TOKEN_URL=/api/one/auth-token`
8. **Save** environment variables.
9. Click **Deploy** (triggers fresh git pull + build + start under new framework type).

### Where Hostinger places build output (verified from docs)

Per Hostinger official docs, server-side Node.js apps (Express.js included)
have build output stored **outside** `public_html/`:

- Build files: `/home/u247402862/domains/manage.mujosaigon.com/nodejs/`
- Auto-generated routing: `/home/u247402862/domains/manage.mujosaigon.com/public_html/.htaccess`
  (Hostinger writes this on every deploy to forward public requests to the
  `nodejs/` directory; do not edit manually)

**Path math under this layout** (verified):

```
node backend/dist/index.js   →   __dirname = /home/.../nodejs/backend/dist
                                  __dirname/../../dist
                              =   /home/.../nodejs/dist
                              =   exactly where sync-dist.mjs mirrors frontend/dist/
```

Express SPA serving (`backend/src/index.ts:1320`) and the Hostinger build
directory align without any code change.

### Post-deploy verification

After the Hostinger panel restart, confirm via curl from any client:

```bash
curl -i https://manage.mujosaigon.com/health
# expect: HTTP/2 200 + body {"status":"ok","track":"B"}

curl -i https://manage.mujosaigon.com/api/dashboard/summary
# expect: HTTP/2 200 + JSON body ~46 KB starting with {"properties":[...

curl -fsS https://manage.mujosaigon.com/ | head -c 400
# expect: <!doctype html> with Vite-built <script type="module" src="/assets/...">

curl -i https://manage.mujosaigon.com/some-spa-route
# expect: HTTP/2 200 (SPA fallback serves index.html)
```

Or via Hostinger MCP:

```
hostinger-api_hosting_listJsDeployments(domain="manage.mujosaigon.com")
# expect: latest deployment state="completed" with new app_type

hostinger-api_hosting_getNodeJSBuildLogsV1(uuid="<latest>")
# expect: "Server listening on 3001" or equivalent in tail
```

### Rollback

If the Node.js app fails to start:

1. hPanel → Stop App.
2. Revert app_type to `vite` (frontend-only static serving will resume
   in the broken state, but at least the deploy pipeline runs).
3. Pull build logs via `getNodeJSBuildLogsV1` to diagnose.
4. Common failure modes to check first:
   - `DATABASE_URL` missing or wrong → startup logs show
     `❌ FATAL CONFIGURATION ERROR: DATABASE_URL`
   - `ALLOWED_ORIGINS` mismatched with public domain → CORS errors in
     browser console only (server still runs)
   - Port collision → Hostinger reverse-proxy expects PORT env to match
     what the app actually listens on

## Environment Notes

- On Windows, `prisma generate` can hit `EPERM: operation not permitted,
  rename ... query_engine-windows.dll.node.tmp...` if any `tsx watch` or
  prior `node` process is holding the engine DLL. This is a Windows file-
  lock issue, not a deploy issue. Stop dev processes and retry, or build
  in a clean shell. Linux/Hostinger build agents do not have this problem.
  Verified: latest Hostinger build `019ec59b...` cleanly emitted Prisma
  Client v6.19.3 in 193ms.

- Both `.env.production` (root) and `backend/.env.production` are local-only
  files. They are gitignored (`.gitignore:33` `.env.*`) and never reach
  Hostinger via the git pipeline. Their values must be configured in the
  Hostinger panel Environment Variables UI per the steps above. The local
  files exist as the source-of-truth template (and as the contract enforced
  by `scripts/verify-prod-env.mjs`).