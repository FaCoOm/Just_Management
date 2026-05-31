## 2026-05-31 Task: init
- Actual WithOne credentials not present locally; code implementation must stay build-verifiable without live OAuth runtime.
- Backend runtime health beyond non-Prisma endpoints blocked by missing `DATABASE_URL`.

## 2026-05-31 Task 37
- Runtime proof of schedule-field persistence still depends on live backend + database; local verification for this task remains frontend `typecheck` and `build`.
- Existing settings rows previously dropped schedule edits because route update data omitted schedule fields.
- Reload state was still incomplete until service-layer settings DTO returned schedule fields on GET.

## 2026-05-31 Task 42
- No unique DB constraint exists for tax-export manual scope, so duplicate-run protection is best-effort via serializable transaction plus completed-job reuse check, not permanent database-enforced dedupe.
- Runtime route proof still depends on Prisma-backed backend; local acceptance remains `cd backend && npm run build` because `DATABASE_URL` is not available here.

## 2026-05-31 Task 38
- Exact `cd backend && npm run db:generate` remained environment-blocked by Windows `EPERM` rename lock on `node_modules/.prisma/client/query_engine-windows.dll.node` while repo Node processes were active.
- Exact backend `npm run build` hit same Prisma generate lock until rerun with `PRISMA_GENERATE_NO_ENGINE=1`, which confirmed TypeScript build correctness after schema and route changes.

## 2026-05-31 Task 38 runtime fix
- Runtime server was pointed at Azure DB with migration drift: `_prisma_migrations` showed `20260528000000_watched_files_target_kind` unfinished, which blocked normal `db:deploy` from reaching Task 38 migration.
- Exact backend `npm run build` still intermittently fails in this workspace from Prisma Windows DLL rename lock even after runtime fix; no-engine build path remains reliable for code verification.
