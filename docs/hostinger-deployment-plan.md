# Hostinger Deployment Plan — Just_Management

## Executive summary
Deploy as a single-VPS, single-origin Node.js webapp on Hostinger VPS KVM2 (Ubuntu 24.04 LTS) with PostgreSQL 16 in Docker, Express + Prisma backend under PM2, and the React SPA built into `dist/` and served by nginx with `/api/*` reverse-proxied to Node.

## Decisions matrix
- Hostinger tier: VPS KVM2
- OS: Ubuntu 24.04 LTS
- Process manager: PM2 fork mode (single instance)
- Reverse proxy: nginx
- Frontend serving: nginx serves `dist/`, `/api/*` proxied to Node
- Database: self-hosted PostgreSQL 16 on same VPS
- Node runtime: Node 20 LTS via nvm
- Secrets storage: Hostinger panel env vars + `.env` on disk read by dotenv/config
- TLS: Let's Encrypt via certbot
- Domain: A record to VPS IPv4
- Build location: on the VPS

## Pre-deployment changes required
### Backend
- Add graceful shutdown handlers for SIGTERM/SIGINT calling `server.close()` and `prisma.$disconnect()`.
- Add `app.set('trust proxy', 1)` after `express()`.
- Make `/health` check DB connectivity.
- Generate and commit `backend/package-lock.json`.
- Add a production env file or PM2 ecosystem env for backend.
- Optional: add `helmet`.

### Frontend
- Set `VITE_TRACK_B_API_URL` for production build.
- Set `VITE_ONE_AUTH_TOKEN_URL=/api/one/auth-token`.
- Add `engines.node` to root `package.json`.
- Generate and commit root `package-lock.json`.
- Optional: remove unused `VITE_TRACK` from `.env.example`.

### Repo-wide
- Add a `deploy/` directory with PM2 ecosystem, nginx config, certbot helper, and backup cron template.
- Add `deploy/README.md`.

## Phase 0 — Pre-flight
- Implement the code changes above.
- Install dependencies and commit both lockfiles.
- Run root typecheck/build.
- Run backend db validation, migration verification, and build.
- Test `pg_dump` from Azure PostgreSQL.
- Provision Hostinger VPS KVM2.

## Phase 1 — VPS provisioning
- SSH as root.
- Create a non-root deploy user.
- Lock down SSH.
- Configure UFW.
- Install git, build tools, nginx, certbot, and Docker.
- Install Node 20 via nvm.
- Install PM2.

## Phase 2 — Database
- Provision PostgreSQL 16 via Docker Compose.
- Bind Postgres to localhost only.
- Create `pgcrypto` extension.
- Migrate data from Azure PostgreSQL with `pg_dump` / `pg_restore`.
- Set up backup cron.

## Phase 3 — Application deployment
- Clone the repo.
- Create frontend production env file.
- Create backend runtime env file.
- Build root frontend.
- Build backend and run Prisma migrate deploy.
- Create PM2 ecosystem config and start the app.

## Phase 4 — nginx, domain, TLS
- Point DNS A records to the VPS.
- Configure nginx to serve `dist/`, proxy `/api/`, and provide SPA fallback.
- Run certbot for HTTPS.

## Phase 5 — Verification
- Verify DNS, TLS, SPA routing, API health, frontend/backend round-trip, DB counts, watcher health, backups, reboot persistence, and cert renewal.

## Phase 6 — Operations
- Use PM2 and nginx logs.
- Deploy with git pull, npm ci, npm run build, prisma migrate deploy, and pm2 reload.
- Monitor disk, memory, and backups.

## Phase 7 — Rollback
- Roll back by git checkout + rebuild + pm2 reload if schema unchanged.
- Restore from pg_dump if DB migration broke.
- Revert to Azure PostgreSQL if needed.

## Cost summary
- VPS KVM2 promo: $8.99/mo
- Domain: about $1/mo amortized
- TLS: free
- PostgreSQL: included on VPS
- Total: about $10/mo first 24 months, about $16/mo after

## Risks and mitigations
- Vite build OOM -> build locally or increase memory.
- Chokidar watcher races -> disable during deploy windows if needed.
- Prisma binary mismatch -> regenerate before each reload.
- Webhook buffering -> set `proxy_request_buffering off` if necessary.
- Single VPS outage -> rely on off-site backups.

## What this plan does not do
- Authentication is out of scope.
- Auto-scaling is out of scope.
- CI/CD is manual for the first cut.
- Cloudflare is optional later.

## Needed to proceed
- Domain name.
- Confirmation on database choice.
- VPS purchase status.
- Approval for pre-deploy code changes.
- Cutover window.
<!-- OMO_INTERNAL_INITIATOR -->
