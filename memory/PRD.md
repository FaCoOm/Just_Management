# Just Management Hospitality Dashboard — PRD

## Original Problem Statement

Execute the `dashboard-completion-and-integration.md` plan to complete every sidebar-promised dashboard page and implement the Tax-Export pipeline for the Just Management hospitality operations platform. Use DESIGN.md as the primary design system (Harbor-blue #4F6FB5 + Brass #B89A6A).

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + shadcn/ui + TanStack Router/Table/Query |
| Backend | Express.js + TypeScript + Prisma 6 |
| Database | Azure PostgreSQL Flexible Server (`webdbmujo.postgres.database.azure.com`) |
| Design System | DESIGN.md — Harbor-blue/brass hospitality theme, Plus Jakarta Sans + Newsreader |
| Data Pattern | Track B: REST repositories → Express API → Prisma → PostgreSQL |
| Tax Export | `.xlsx` generation from Vietnamese invoice template |
| Integrations | WithOne unified API (Gmail, Google Sheets) — credentials provided, not yet integrated |

## User Personas

| Persona | Primary Pages | Key Actions |
|---------|--------------|-------------|
| Property Manager | Dashboard, Check-in/out, Rooms, Availability, Housekeeping | Daily operations, room status, guest arrivals/departures |
| Revenue Manager | Rate Manager, Billing, Channel Distribution, Tax & Compliance | Pricing, billing oversight, OTA channel monitoring, tax export |
| Admin | Staff & Roles, Security & Access, Settings | Team management, audit logs, integration config |
| Accountant | Tax & Compliance, Billing & Invoices | Same-day checkout export, invoice status, VAT compliance |

## Core Requirements (Static)

1. All sidebar-promised pages must be fully implemented (not placeholder)
2. Multi-property filtering on all operational pages
3. DESIGN.md color system, typography, and component patterns throughout
4. Consistent page structure: header → KPI cards → content area
5. Tax-Export defaults to today's checkout date with Vietnamese template format
6. `needs_review` state for ambiguous/missing data
7. No Supabase runtime — Track B REST-only

## What's Been Implemented

### Phase 1: Dashboard Pages — 11/11 Complete (2026-05-29)

| # | Page | Route | Lines | Data Source |
|---|------|-------|-------|-------------|
| 1 | Check-in / Check-out | `/check-in-out` | 294 | REST API |
| 2 | Room Types | `/rooms/types` | 225 | REST API |
| 3 | Availability | `/rooms/availability` | 275 | REST API |
| 4 | Housekeeping | `/housekeeping` | 224 | REST API |
| 5 | Dining & Events | `/dining-events` | 235 | **MOCKED** |
| 6 | Rate Manager | `/rate-manager` | 233 | Partial (base rates) |
| 7 | Billing & Invoices | `/billing` | 247 | Derived from reservations |
| 8 | Channel Distribution | `/channels` | 173 | REST API |
| 9 | Staff & Roles | `/staff` | 197 | **MOCKED** |
| 10 | Security & Access | `/security` | 186 | **MOCKED** |
| 11 | VIP Guests | `/guests/vip` | 220 | REST API |

### Phase 2: Tax Export — Wave 5-6 (2026-05-29)

**Backend** (`backend/src/tax-export/`):
- `service.ts` (309 lines) — Core: preview, run, Excel generation, job management
- `routes.ts` (207 lines) — 7 REST endpoints with UUID validation

**Frontend** (`src/components/tax-export/`):
- `tax-export-page.tsx` (542 lines) — Date picker, preview/history tabs, download, settings

**Schema** (`backend/prisma/schema.prisma`):
- `tax_export_settings` — Configurable defaults (buyer label, payment method, unit, VAT rate)
- `tax_export_jobs` — Export run records with status tracking
- `tax_export_items` — Per-reservation invoice line items

**Excel Template Mapping** (Vietnamese tax invoice):
| Column | Content | Source |
|--------|---------|--------|
| A | Invoice number | Sequential |
| B | Invoice date | Checkout date |
| C, D, E | Buyer company, Tax ID, Address | Empty (per user spec) |
| F | Buyer label | Default: "Khách lẻ không lấy hóa đơn" |
| G, H, I | Email, Phone, Citizen ID | Empty (per user spec) |
| J | Payment method | Default: "Chuyển khoản" |
| K | Service description | "Dịch vụ thuê phòng (check_in - check_out)" |
| L | Unit | Default: "Đêm" |
| M | Quantity | Number of nights |
| N | Unit price | From reservation data |
| O | Total amount | M × N |
| P | VAT rate | Default: 8% |
| Q | VAT amount | O × P / 100 |

### Phase 3: Build Fixes (2026-05-29)

- `backend/package.json` build script: `prisma generate && tsc` (was just `tsc`)
- `backend/src/tax-export/routes.ts` — explicit type annotation for item parameter
- `backend/src/index.ts` — compression middleware type cast
- `backend/src/ingest/routes.ts` — multer upload type cast

### Infrastructure

- Router: 18 lazy routes in `src/router.tsx`
- Sidebar: Full rewrite with collapsible groups, "Just Management" branding
- Python reverse proxy: `backend/server.py` (uvicorn 8001 → Express 3001)
- Frontend bridge: `frontend/package.json` (Vite on port 3000)
- Seed script: `backend/scripts/seed.ts` (8 properties, 77 rooms, 61 reservations)
- Azure DB connected with production data

## Testing Results

| Iteration | Scope | Result |
|-----------|-------|--------|
| 1 | 11 dashboard pages, sidebar navigation, property filters | **100% PASS** (11/11 pages) |
| 2 | Tax-export backend + frontend, regression | **100% PASS** (after UUID fix) |

## Prioritized Backlog

### P0 — Immediate Next
- [ ] Wire Guests Export button → CSV download
- [ ] Wire Maintenance Log Issue button → create dialog with API call
- [ ] Add backend CRUD for Dining & Events, Staff & Roles, Security audit log
- [ ] Add `nightly_rate` to reservation data for accurate tax export pricing

### P1 — Wave 5 Completion
- [ ] WithOne Gmail integration for confirmation code search (key: `sk_live_EXbAp...`)
- [ ] OTA email parser registry (Airbnb, Booking.com, Agoda)
- [ ] Google Sheets upsert writer (WithOne path)
- [ ] Per-reservation Tax-Export row action on Reservations page
- [ ] Scheduled Tax-Export automation (backend trigger + UI)
- [ ] Sheet settings and column mapping UI
- [ ] Needs-review correction workflow UI

### P2 — Hardening
- [ ] Vitest + Node test runner infrastructure
- [ ] Integration dashboard hardening (WithOne readiness display)
- [ ] Scheduler and retry safety (duplicate-run protection, dead-letter)
- [ ] Performance and pagination pass
- [ ] Accessibility and responsive QA pass
- [ ] Dark mode verification across all pages
- [ ] Full-system verification docs and evidence index
