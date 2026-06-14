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

## Status

- Build pipeline: ✅ unified. `npm run build` produces `frontend/dist/`,
  `backend/dist/`, and root `dist/` in one chain.
- TypeScript config: ✅ unchanged. Already correct.
- Express SPA serving: ✅ already pointed at repo-root `dist/`.
- Hostinger panel config: action required — set Application root, Build
  command, and Output directory as listed under Path C above.

## Environment Notes

- On Windows, `prisma generate` can hit `EPERM: operation not permitted,
  rename ... query_engine-windows.dll.node.tmp...` if any `tsx watch` or
  prior `node` process is holding the engine DLL. This is a Windows file-
  lock issue, not a deploy issue. Stop dev processes and retry, or build
  in a clean shell. Linux/Hostinger build agents do not have this problem.