<!-- intent-skills:start -->
## Skill Loading

Default OpenCode behavior:
- Load and apply local `opencode-karpathy-guidelines` by default for all coding-focused or repository-impacting interactions.
- Comply with `opencode-karpathy-guidelines` before planning, implementation, review, refactoring, or completion claims.
- Treat those guidelines as baseline behavior for all agents and sessions; skip only for casual non-technical chat with no repo or implementation impact.

Before substantial work:
- Run `npx @tanstack/intent@latest list`, or use skills already listed in context.
- If one local skill clearly matches, run `npx @tanstack/intent@latest load <package>#<skill>` and follow returned `SKILL.md`.
- In monorepo-style work, run skill check from workspace root and prefer package-specific local skill.
<!-- intent-skills:end -->

# PROJECT KNOWLEDGE BASE

## Runtime Truth
- Hospitality dashboard for 8 Vietnamese properties.
- Current runtime: React 19 + Vite 7 frontend -> REST repositories -> Express + Prisma backend -> Azure PostgreSQL.
- `reservations` is booking truth; `guests` is compatibility only.
- Older Track A/Supabase docs are historical. Do not revive Supabase frontend runtime without an explicit architecture decision.

## Entry Points
- Frontend: `frontend/src/main.tsx`, `frontend/src/router.tsx`, `frontend/src/hooks/use-dashboard-data.ts`, `frontend/src/lib/repositories/rest-repositories.ts`.
- Dashboard composition: `frontend/src/components/dashboard/dashboard-page.tsx`; visual tokens: `frontend/src/index.css`.
- Backend API: `backend/src/index.ts`; ingest routes: `backend/src/ingest/routes.ts`; One routes: `backend/src/routes/one.ts`.
- Schema truth: `backend/prisma/schema.prisma`; deployable migrations: `backend/prisma/migrations/`.

## Boundaries
- Frontend consumes REST via repository contracts; no backend/Prisma imports.
- Backend owns Prisma access, DTO shape, provider integration, and ingestion writes.
- Provider identifiers, raw statuses, raw payloads, tokens, and webhook details stay at provider edges.
- Business/data logic belongs in hooks/repositories/backend services, not UI primitives.

## Verification
- Frontend: `npm run typecheck`, `npm run build`; user-visible changes need app/browser check.
- Backend: from `backend/`, run `npm run build`; endpoint changes need actual route check.
- Prisma/schema: also run `npm run db:generate`, `npm run db:validate`, `npm run db:verify:migration`.
- Ingestion: also run `npm run verify-ingestion` or `npm run verify:all`.

## Notes
- Local subtree AGENTS files are delta-only guardrails; do not duplicate root rules there.
- Do not trust README/old docs over current code, Prisma schema, or package scripts.
- Do not hardcode secrets, DB URLs, API keys, passcodes, production origins, or raw tokens.
- Do not read `.understand-anything/`, `resources/`, or `logs.txt`; local scratch only.
