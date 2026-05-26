# Build Execution Guidelines (session)

## Why this exists

Long-running, silent commands like `tsc -b && vite build` can look frozen even when they are working. We had a real failure (TypeScript error in `reservations-page.tsx`) plus several false "freezes" where the command was actually running but produced no output for 5-10s. These guidelines avoid both.

## Principles

1. Treat silence under 60s as normal for `tsc`, `vite build`, and `prisma generate`.
2. Always run with a known timeout (default 120s, larger for full pipelines).
3. Always wrap with timing so we have evidence instead of guesses.
4. Prefer narrow validation (typecheck, single file build) before full pipelines.
5. Never use interactive flags. Never trigger watch mode in build paths.
6. If the same command "freezes" twice, do not retry; investigate per `systematic-debugging`.

## Approved build commands

Frontend:
- `npm run typecheck` (fast, silent on success)
- `npm run build` (`tsc -b && vite build`)
- `npm run preview` (only after `build`)

Backend:
- `cd backend && npm run build` (`tsc`)
- `cd backend && npm run db:generate`
- `cd backend && npm run db:validate`
- `cd backend && npm run db:verify:migration`
- `cd backend && npm run verify-ingestion`
- `cd backend && npm run verify:all`

Combined:
- `npm run build:all`

Disallowed inside build steps:
- `npm run dev`, `npm run dev:all`, `tsx watch`, `nodemon`, anything `--watch`.
- Interactive prompts (`-i`, `--interactive`).

## Anti-freeze rules

1. Always set a timeout. Defaults:
   - 120000 ms for typecheck or single build leg.
   - 180000 ms for `build:all`.
   - 240000 ms for `verify:all`.
2. Always wrap the command with `Measure-Command { ... }` (PowerShell) when investigating perceived freezes. The duration plus exit code is the evidence we need.
3. Run independent build legs in parallel tool calls when there is no dependency:
   - frontend `typecheck` + backend `build` can run together.
4. Never restart a command "to check if it is faster". Wait for the configured timeout, then read evidence.

## Failure triage

1. Read the last 30 lines of stderr/stdout before changing anything.
2. If the failure is a TypeScript error, use `lsp_diagnostics` (when connected) and the compiler output as truth. Do not guess.
3. If the build hangs past timeout, capture the running command tree, then proceed with `systematic-debugging` skill phases 1 and 2 before any new attempt.
4. After a fix, re-run only the smallest scope that proves the fix (`typecheck` -> single build -> `build:all`).

## Verification recipe

For any change touching code we own:
```bash
npm run typecheck
npm run build
cd backend
npm run build
```

For schema/migration changes:
```bash
cd backend
npm run db:generate
npm run db:validate
npm run db:verify:migration
```

For ingest changes:
```bash
cd backend
npm run verify-ingestion
```

## Logging discipline

When perceived-freeze is reported:
- Record the exact command, working directory, exit code, and total duration.
- Save evidence under `.omo/evidence/build-runs/` if useful for future triage.
- Do not edit application code based on a "feels slow" signal alone.

## Background and watch usage

Use background only for long-running observability commands that we want to keep running while we work (e.g. `tsx watch src/index.ts` for dev). Build pipelines must not be backgrounded; they must complete within their timeout and surface output to us.

## Notes for team-mode delegations

Each member must follow these rules. The lead must require evidence-style verification (commands run, durations, exit codes) before accepting "complete" from any member.
