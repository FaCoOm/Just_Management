# Just Management Hospitality Dashboard - PRD

## Original Problem Statement
Execute the `dashboard-completion-and-integration.md` plan to complete every sidebar-promised dashboard page and implement the Tax-Export pipeline for the Just Management hospitality operations platform. Use DESIGN.md as the primary design system.

## Architecture
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui + TanStack Router/Table/Query
- **Backend**: Express.js + Prisma + Azure PostgreSQL
- **Design System**: Harbor-blue (#4F6FB5) + brass (#B89A6A) brand colors, Plus Jakarta Sans + Newsreader
- **Data Layer**: Track B REST repositories → Express API → Prisma → Azure PostgreSQL
- **Database**: Azure PostgreSQL at webdbmujo.postgres.database.azure.com

## What's Been Implemented

### Phase 1: Dashboard Pages (2026-05-29)
All 11 missing sidebar pages fully implemented:
1. Check-in / Check-out (/check-in-out)
2. Room Types (/rooms/types)
3. Availability (/rooms/availability)
4. Housekeeping (/housekeeping)
5. Dining & Events (/dining-events)
6. Rate Manager (/rate-manager)
7. Billing & Invoices (/billing)
8. Channel Distribution (/channels)
9. Staff & Roles (/staff)
10. Security & Access (/security)
11. VIP Guests (/guests/vip)

Button gaps wired: Manage Room Types, Export, Log Issue

### Phase 2: Tax Export (Wave 5-6) (2026-05-29)
- **Tax & Compliance page** (/tax-export) with preview/history tabs
- **Backend API**: Settings, Preview, Run, Download (xlsx), Jobs history, Item management
- **Prisma models**: tax_export_settings, tax_export_jobs, tax_export_items
- **Excel generation**: Follows Vietnamese tax invoice template exactly
  - Row 8: Headers (A-Q)
  - Row 9+: Data rows
  - Default values: F="Khách lẻ không lấy hóa đơn", J="Chuyển khoản", L="Đêm", P=8%
  - Dynamic: A=Invoice#, B=Date, K=Service desc, M=Nights, N-O=Amounts, Q=VAT
  - Empty: C, D, E, G, H, I (per user request)
- **Connected to Azure PostgreSQL** with real reservation data

## Testing Results
- Phase 1: 100% frontend pass (11/11 pages + navigation)
- Phase 2: 87.5% backend (14/16), 100% frontend. Minor: UUID validation (fixed)

## Prioritized Backlog

### P0 (Next)
- [ ] Wire Guests Export to CSV download
- [ ] Wire Maintenance Log Issue to create dialog
- [ ] Connect Dining/Staff/Security pages to backend CRUD
- [ ] Add nightly_rate to reservation data for accurate tax export pricing

### P1 (Wave 5 continued)
- [ ] WithOne Gmail integration for confirmation code search
- [ ] OTA email parser registry (Airbnb, Booking.com, Agoda)
- [ ] Google Sheets upsert writer (WithOne path)
- [ ] Per-reservation Tax-Export row action
- [ ] Scheduled Tax-Export automation

### P2 (Future)
- [ ] Vitest + Node test infrastructure
- [ ] Full accessibility/responsive QA pass
- [ ] Dark mode verification
- [ ] Integration dashboard hardening (Wave 7)
