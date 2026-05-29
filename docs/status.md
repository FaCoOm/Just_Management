# Project Status — Just Management Hospitality Dashboard

**Last Updated**: 2026-05-29
**Branch**: `feature/dashboard-completion-tax-export`
**Base**: Track B (Azure PostgreSQL / Express / Prisma)

---

## Goal

Complete every sidebar-promised dashboard page, add same-day checkout Tax-Export with Vietnamese invoice template support, and prepare WithOne integration boundary for Gmail/Sheets enrichment — all without building a full PMS/accounting platform.

## Constraints & Preferences

- Track B uses Azure PostgreSQL Flexible Server (`webdbmujo.postgres.database.azure.com`)
- `supabase/migrations/` files are schema-intent reference only; do NOT deploy to Azure
- Prisma migrations are the canonical Azure deployment path
- No Supabase RLS (anon, authenticated roles) in Azure migration SQL
- Frontend must support env-based switching between Track A (Supabase) and Track B (REST API)
- DESIGN.md is the primary design system (Harbor-blue + brass hospitality theme)
- Tax-Export outputs `.xlsx` files following user-provided Vietnamese tax invoice template
- Pages first, tests afterward (per user decision)

---

## Progress

### Done

**Infrastructure (2026-05-29)**
- Azure PostgreSQL connected and operational (`DATABASE_URL` with `sslmode=require`)
- Prisma schema pushed with 3 new tax-export models (`tax_export_settings`, `tax_export_jobs`, `tax_export_items`)
- Backend build pipeline fixed: `"build": "prisma generate && tsc"` — 0 TS errors
- Pre-existing `@types/compression` Express type conflicts resolved
- Supervisor bridge: Python reverse proxy (uvicorn port 8001 → Express port 3001)
- Frontend bridge: Vite dev server on port 3000 via `frontend/package.json`
- Database seeded with 8 properties, 77 rooms, 61 reservations (local), Azure DB has production data

**Dashboard Pages — 11/11 complete (2026-05-29)**
1. Check-in / Check-out (`/check-in-out`) — arrivals/departures board, Check In/Out buttons, property filter
2. Room Types (`/rooms/types`) — room type cards with occupancy bars, property filter
3. Availability (`/rooms/availability`) — 14-day date grid, arriving/occupied/departing/vacant, week navigation
4. Housekeeping (`/housekeeping`) — cleanliness board (dirty/cleaning/inspected/ready), checkout-today badges
5. Dining & Events (`/dining-events`) — event schedule cards, type badges, venue info (mock data)
6. Rate Manager (`/rate-manager`) — rate calendar by room type/date, weekend surcharge
7. Billing & Invoices (`/billing`) — TanStack Table with search, status/property filters, pagination
8. Channel Distribution (`/channels`) — channel cards with external account status (real API data)
9. Staff & Roles (`/staff`) — staff directory with role badges, search, role filter (mock data)
10. Security & Access (`/security`) — audit log with severity filtering (mock data)
11. VIP Guests (`/guests/vip`) — VIP-filtered guest table with pagination

**Sidebar & Routing (2026-05-29)**
- All 18 routes wired in `src/router.tsx` with lazy loading
- Sidebar fully rewritten with collapsible groups (Front Office, Property, Revenue, Administration)
- Brand updated from "Latte Lounge" to "Just Management"
- "Manage Room Types" button on Rooms page → navigates to `/rooms/types`
- Guests Export button present (not yet wired to CSV)
- Maintenance Log Issue button present (not yet wired to dialog)

**Tax-Export — Wave 5-6 partial (2026-05-29)**
- Tax & Compliance page (`/tax-export`) with date picker, preview table, history tab, download
- Backend service: `backend/src/tax-export/service.ts` (309 lines) — preview, run, Excel generation
- Backend routes: `backend/src/tax-export/routes.ts` (207 lines) — 7 REST endpoints
- Excel output follows Vietnamese template exactly:
  - Columns F/J/L/P = defaults (buyer label, payment method, unit, VAT 8%)
  - Columns C/D/E/G/H/I = empty per user spec
  - Dynamic: A=Invoice#, B=Date, K=Service desc, M=Nights, N=Price, O=Total, Q=VAT
- Settings API: configurable defaults (buyer label, payment method, unit, VAT rate, service template)
- `needs_review` status for items missing unit price
- Job history with per-job download

**Testing (2026-05-29)**
- Testing Agent Iteration 1: 11/11 frontend pages PASS, sidebar 11/11 navigation PASS
- Testing Agent Iteration 2: Tax-export backend 14/16 PASS (UUID validation fixed → 16/16), frontend 100% PASS, regression 11/11 PASS

### In Progress

- WithOne Gmail integration for confirmation code search (credentials provided: `sk_live_EXbAp...`)
- OTA email parser registry (Airbnb, Booking.com, Agoda)
- Google Sheets upsert writer
- Connecting mock-data pages to backend CRUD

### Not Started

- Test infrastructure (Vitest frontend, Node test runner backend)
- Per-reservation Tax-Export row action
- Scheduled Tax-Export automation
- Sheet settings and column mapping UI
- Needs-review correction workflow UI
- Integration dashboard hardening
- Accessibility and responsive QA pass
- Performance and pagination pass
- Full-system verification docs

---

## Key Decisions

- Prisma is the canonical schema source for Azure; `supabase/migrations/` are reference-only
- `VITE_TRACK=B` env var controls factory selection in the frontend repository layer
- Vite dev proxy handles `/api` → Express backend
- Tax-Export outputs `.xlsx` (user-uploaded template) rather than Google Sheets write (for now)
- Auth (Clerk/Auth0) deferred
- Pages built with real API data where available; frontend mock data where backend CRUD not yet built
- Tests deferred per user request — testing agent used for integration verification

## Next Steps

1. Wire Guests Export → CSV download
2. Wire Maintenance Log Issue → create dialog with API call
3. Add backend CRUD for Dining & Events, Staff & Roles, Security audit log
4. Integrate WithOne Gmail search for OTA confirmation codes
5. Build OTA email parsers (Airbnb, Booking.com, Agoda)
6. Add per-reservation Tax-Export row action on Reservations page
7. Set up Vitest + Node test runner infrastructure

## Relevant Files

### Frontend
- `src/router.tsx` — 18 lazy routes
- `src/components/app-sidebar.tsx` — Full sidebar navigation
- `src/components/check-in-out/check-in-out-page.tsx`
- `src/components/rooms/room-types-page.tsx`
- `src/components/rooms/availability-page.tsx`
- `src/components/housekeeping/housekeeping-page.tsx`
- `src/components/dining-events/dining-events-page.tsx`
- `src/components/revenue/rate-manager-page.tsx`
- `src/components/revenue/billing-invoices-page.tsx`
- `src/components/revenue/channel-distribution-page.tsx`
- `src/components/admin/staff-roles-page.tsx`
- `src/components/admin/security-access-page.tsx`
- `src/components/guests/vip-guests-page.tsx`
- `src/components/tax-export/tax-export-page.tsx`

### Backend
- `backend/src/index.ts` — Express server (tax-export routes registered)
- `backend/src/tax-export/service.ts` — Tax-export core service
- `backend/src/tax-export/routes.ts` — Tax-export REST API (7 endpoints)
- `backend/prisma/schema.prisma` — 3 new tax-export models
- `backend/fixtures/Tax_export_template.xlsx` — Vietnamese invoice template
- `backend/scripts/seed.ts` — Database seed script
- `backend/server.py` — Python reverse proxy bridge (uvicorn → Express)

### Config
- `backend/.env` — Azure PostgreSQL URL + WithOne API key
- `backend/package.json` — Build: `prisma generate && tsc`
- `frontend/package.json` — Vite dev bridge on port 3000
