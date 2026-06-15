# ADR: GitHub Actions CI and Hostinger deployment readiness

Date: 2026-06-15

## Status

Accepted.

## Context

The project has no existing GitHub Actions workflows. The repo is an npm workspaces app with a React/Vite frontend, Express/Prisma backend, and a Hostinger Node.js deployment model where `npm run build` produces both `backend/dist/` and a root `dist/` copied from `frontend/dist/` by `scripts/sync-dist.mjs`.

Hostinger deployment notes already identify Node.js `22` as the configured runtime for `manage.mujosaigon.com`. The app stack supports Node 22: Prisma Client requires Node `>=18.18`, Vite 7 is compatible with current LTS Node, and npm 10 ships with Node 22.

## Decision

Use Node.js `22.x` and npm `>=10` as the repository and CI runtime baseline. `.nvmrc` pins local/VPS shells to Node 22. Do not move to Node 24 yet because Hostinger and the backend dependency surface are already validated around Node 22, while Node 24 offers no deployment benefit for this app today.

Keep Prisma Client scoped to the backend workspace. The root package does not import Prisma, so the unused root `@prisma/client` dependency is removed to avoid a Prisma 7 root install conflicting with backend Prisma 6 generation.

Add `.github/workflows/ci.yml` as the first automation layer. It runs on pull requests and pushes to `main`, installs from the root lockfile with `npm ci`, and uses existing repository scripts rather than introducing new test runners.

The CI gates are:

- frontend typecheck: `npm run typecheck`
- frontend tests: `npm run test:frontend`
- backend Prisma schema validation: `npm run db:validate -w backend`
- Azure-safe migration validation: `npm run db:verify:migration -w backend`
- backend TypeScript check: `npx tsc --noEmit -p backend/tsconfig.json`
- backend tests: `npm run test -w backend`, with a PostgreSQL 16 service container available
- deploy artifact build: `npm run build`

The build job uploads two artifacts:

- `hostinger-root-dist` from `dist/`, the SPA output Hostinger can locate after `sync-dist`
- `backend-dist` from `backend/dist/`, the Express server output used by the Hostinger Node.js entry file `backend/dist/index.js`

These artifacts are merge evidence and rollback material, not the deploy path. Hostinger's current deployment remains git-based: it pulls the repository, runs the root build script, and starts `backend/dist/index.js` on its own Node 22 runtime.

## Hostinger deployment posture

The workflow intentionally stops short of automatic deployment. Hostinger should keep the existing git-based deploy flow until these operational inputs are confirmed in hPanel:

- app type: `Other`
- build script: `build`
- output directory: `dist`
- entry file: `backend/dist/index.js`
- Node version: `22`
- package manager: npm from the root `package-lock.json`

Production secrets remain in Hostinger environment variables, not GitHub workflow files. Required runtime values include the Azure PostgreSQL `DATABASE_URL`, WithOne keys, webhook/dev tokens, `ALLOWED_ORIGINS=https://manage.mujosaigon.com`, `NODE_ENV=production`, and same-origin Vite build values.

## Consequences

Pull requests now validate frontend, backend, Prisma schema, migration safety, backend tests, and full deploy artifact creation before merge.

Backend tests run with PostgreSQL available, avoiding a false sense that all backend specs are hermetic. The workflow does not run `scripts/verify-prod-env.mjs` yet because production `.env.production` files are gitignored and should not be recreated in PR CI without an explicit secret-fixture strategy.

Windows developers may still see `EPERM` during `prisma generate` if a local Node process holds `backend/node_modules/.prisma/client/query_engine-windows.dll.node`. This is a Windows file-lock issue; CI and Hostinger run on Linux and should regenerate Prisma normally.

Future deployment automation should be a separate workflow with a protected GitHub Environment and manual approval. That workflow can either trigger Hostinger's git deploy path or call Hostinger's Node.js build API after the required Hostinger credentials are stored as environment secrets.
