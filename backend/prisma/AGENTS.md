# Prisma Schema Guide

## Rules
- Edit `schema.prisma` first for schema changes.
- Keep schema and migration changes together; run generate/validate/verify from `backend/`.
- Preserve additive migration style during the REST/Prisma/Azure transition.
- Do not drop `guests`, `legacy_guest_reservation_backfills`, or provider import tables without explicit approved plan.
- Keep `reservations` as booking source of truth; `guests` remains compatibility surface.
- Keep Azure SQL free of Supabase RLS syntax: `anon`, `authenticated`, `service_role`, `ENABLE ROW LEVEL SECURITY`.
- Never edit an already-applied migration to hide drift; create a new migration.
