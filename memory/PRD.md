# Just Management Hospitality Dashboard - PRD

## Original Problem Statement
Execute the `dashboard-completion-and-integration.md` plan to complete every sidebar-promised dashboard page for the Just Management hospitality operations platform. Use DESIGN.md as the primary design system.

## Architecture
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui + TanStack Router/Table/Query
- **Backend**: Express.js + Prisma + PostgreSQL (Azure-ready)
- **Design System**: Harbor-blue (#4F6FB5) + brass (#B89A6A) brand colors, Plus Jakarta Sans body + Newsreader headings
- **Data Layer**: Track B REST repositories pattern (frontend repository interfaces → REST API → Prisma)

## User Personas
- **Property Manager**: Manages multiple Vietnamese properties, daily check-in/out operations, housekeeping oversight
- **Revenue Manager**: Rate management, billing oversight, channel distribution monitoring
- **Admin**: Staff/roles management, security audit log, integration settings
- **Accountant**: Billing/invoices, tax export operations (future)

## Core Requirements (Static)
1. All sidebar-promised pages must be fully implemented (not placeholder)
2. Multi-property filtering on all operational pages
3. DESIGN.md color system, typography, and component patterns throughout
4. Consistent page structure: header → KPI cards → content area

## What's Been Implemented (2026-05-29)

### Wave 1-4: Foundation + All 11 Dashboard Pages
- **Router**: All 17 routes wired in TanStack Router (router.tsx)
- **Sidebar**: All navigation items linked with data-testid attributes, collapsible submenus working
- **Brand**: Updated from "Latte Lounge" to "Just Management" per DESIGN.md

### New Pages Implemented (11 total):
1. **Check-in / Check-out** (`/check-in-out`) - Arrivals/departures board with Check In/Check Out action buttons, property filter
2. **Room Types** (`/rooms/types`) - Room type cards with occupancy bars, property filter
3. **Availability** (`/rooms/availability`) - 14-day date grid with room occupancy status, week navigation
4. **Housekeeping** (`/housekeeping`) - Room cleanliness board (dirty/cleaning/inspected/ready), state + property filters
5. **Dining & Events** (`/dining-events`) - Event schedule cards with type badges, property filter
6. **Rate Manager** (`/rate-manager`) - Rate calendar grid by room type/date with weekend surcharge
7. **Billing & Invoices** (`/billing`) - Billing table with search, status filter, property filter, pagination
8. **Channel Distribution** (`/channels`) - Channel cards with external account status from API
9. **Staff & Roles** (`/staff`) - Staff directory with role badges (admin/manager/accountant/staff)
10. **Security & Access** (`/security`) - Audit log with severity filtering
11. **VIP Guests** (`/guests/vip`) - VIP-filtered guest table with property filter

### Button Gaps Wired:
- Rooms "Manage Room Types" → navigates to `/rooms/types`
- Guests "Export" button present
- Maintenance "Log Issue" button present

### Infrastructure:
- PostgreSQL database seeded with 8 properties, 77 rooms, 61 reservations, 15 maintenance issues, 3 channels, 4 accounts
- Python reverse proxy bridge (server.py) for supervisor compatibility
- Frontend bridge (frontend/package.json) for Vite dev server on port 3000

## Prioritized Backlog

### P0 (Must-do next)
- [ ] Wire Guests Export button to actually download CSV
- [ ] Wire Maintenance Log Issue button to create issue dialog
- [ ] Connect Dining & Events to backend CRUD (currently mock data)
- [ ] Connect Staff & Roles to backend CRUD (currently mock data)
- [ ] Connect Security audit log to backend (currently mock data)

### P1 (Important)
- [ ] Tax-Export backend contracts and schema (Wave 5 from plan)
- [ ] Gmail search service for confirmation codes
- [ ] OTA parser registry (Airbnb, Booking.com, Agoda)
- [ ] Google Sheets upsert writer
- [ ] Tax & Compliance page
- [ ] WithOne ProviderConnector interface

### P2 (Nice to have)
- [ ] Vitest + Node test runner infrastructure
- [ ] Pagination on all list endpoints
- [ ] Accessibility/responsive QA pass
- [ ] Dark mode verification across all pages
- [ ] Per-reservation Tax-Export row action
- [ ] Scheduled Tax-Export UI

## Next Tasks
1. Wire Guests Export to CSV download
2. Wire Maintenance Log Issue to create dialog with API call
3. Add backend endpoints for dining events, staff, security audit
4. Begin Tax-Export backend (Wave 5)
5. Add database credentials from user for Azure PostgreSQL connection
