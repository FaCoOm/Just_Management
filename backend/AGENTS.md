# Backend Subsystem Guide

## Rules
- `src/index.ts` owns main API routes and response shapes; keep DTOs compatible with frontend repository types.
- Use typed request parsing and explicit validation before reading query/body values.
- Prisma access stays in backend; schema/migrations follow `prisma/AGENTS.md`.
- Do not bypass Prisma migrations with ad hoc DB changes or Supabase SQL.
- Do not leak room passcodes or privileged fields through public DTOs without protected route design.
- Configure origins through `ALLOWED_ORIGINS`; do not hardcode production origins.
