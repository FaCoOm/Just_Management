# Frontend Pages Reference

Repo: `Just_Management`
Source of truth: `frontend/src/router.tsx`, `frontend/src/components/app-sidebar.tsx`, `frontend/src/components/*/*-page.tsx`, `frontend/src/pages/settings/integrations-page.tsx`
Audience: Business stakeholders, product owners, frontend developers, backend developers
Coverage: 17 currently routed frontend pages

## Purpose

This document translates the current frontend into stakeholder-readable user stories and developer-traceable Mermaid diagrams. It shows what each page is for, which user actions are currently implemented, and how each major user-visible flow moves from user interaction to frontend page logic and backend APIs.

## Scope

- Covers only pages currently routed in `frontend/src/router.tsx`
- Uses current code as truth
- Describes user-visible behavior only
- References backend/API touchpoints only where they affect visible outcomes

## Non-Goals

- This is not a future-state product roadmap
- This is not a full API specification
- This does not document internal hook/component implementation in exhaustive detail

## Business Area Navigation Map

```mermaid
flowchart LR
  Sidebar[App Sidebar] --> FrontOffice[Front Office]
  Sidebar --> Property[Property]
  Sidebar --> Revenue[Revenue]
  Sidebar --> Admin[Administration]

  FrontOffice --> Dashboard[/Dashboard/]
  FrontOffice --> Reservations[/Reservations/]
  FrontOffice --> CheckInOut[/Check-in / Check-out/]
  FrontOffice --> Guests[/Guest Profiles/]

  Property --> Rooms[/Rooms & Suites/]
  Property --> RoomTypes[/Room Types/]
  Property --> Availability[/Availability/]
  Property --> Housekeeping[/Housekeeping/]
  Property --> DiningEvents[/Dining & Events/]

  Revenue --> RateManager[/Rate Manager/]
  Revenue --> Billing[/Billing & Invoices/]
  Revenue --> Channels[/Channel Distribution/]
  Revenue --> TaxCompliance[/Tax & Compliance/]

  Admin --> Staff[/Staff & Roles/]
  Admin --> Maintenance[/Maintenance Logs/]
  Admin --> Security[/Security & Access/]
  Admin --> Integrations[/Integrations/]
```

## Route Inventory

| Route | Sidebar Group | Page Component | Purpose |
|---|---|---|---|
| `/` | Front Office | `DashboardPage` | Portfolio operations overview |
| `/reservations` | Front Office | `ReservationsPage` | Reservation management, creation, CSV ingest, tax export entry |
| `/check-in-out` | Front Office | `CheckInOutPage` | Daily arrivals and departures board |
| `/guests` | Front Office | `GuestsPage` | Guest and tenant operations hub |
| `/rooms` | Property | `RoomsPage` | Floor-plan and room status view |
| `/rooms/types` | Property | `RoomTypesPage` | Room category inventory and occupancy overview |
| `/rooms/availability` | Property | `AvailabilityPage` | 14-day room availability grid |
| `/housekeeping` | Property | `HousekeepingPage` | Cleaning and turnover operations board |
| `/dining-events` | Property | `DiningEventsPage` | Dining and events schedule |
| `/rate-manager` | Revenue | `RateManagerPage` | Multi-day rate grid by room type |
| `/billing` | Revenue | `BillingInvoicesPage` | Reservation-derived billing view |
| `/channels` | Revenue | `ChannelDistributionPage` | OTA channel and account status |
| `/tax-export` | Revenue | `TaxExportPage` | Tax export prep, review, and job history |
| `/staff` | Administration | `StaffRolesPage` | Staff directory and role view |
| `/maintenance` | Administration | `MaintenancePage` | Maintenance issue log and create flow |
| `/security` | Administration | `SecurityAccessPage` | Security audit log |
| `/settings/integrations` | Administration | `IntegrationsPage` | Integrations, connections, CSV upload, and pipeline operations |

## Shared Shell Pattern

All routed pages render inside the shared shell from `frontend/src/router.tsx`:

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant Sidebar as AppSidebar
  participant Router as TanStack Router
  participant Page as Routed Page

  U->>Sidebar: Click navigation item
  Sidebar->>Router: Link to route
  Router->>Page: Lazy-load page component
  Page-->>U: Render page inside SidebarInset
```

---

# Front Office

## Dashboard

- **Route:** `/`
- **Primary users:** General manager, operations manager, front-office lead
- **Feature inventory:** KPI summary, occupancy chart, room calendar, revenue panel, arrivals, departures, checkouts, maintenance, bookings sidebar, dashboard/split layout toggle, manual sync trigger

### User Stories

- As an operations manager, I want one dashboard that summarizes occupancy, arrivals, departures, and maintenance so that I can assess hotel health quickly.
- As a manager, I want to switch between dashboard and split layouts so that I can optimize how much space bookings and calendar views receive.
- As a manager, I want to trigger a sync from the toolbar so that dashboard data can be refreshed without leaving the page.

### Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant Page as DashboardPage
  participant Clock as useVietnamClock
  participant Hook as useDashboardData
  participant Repo as Dashboard Repository
  participant API as GET /api/dashboard/summary

  U->>Page: Open dashboard
  Page->>Clock: Resolve Vietnam-local today
  Clock-->>Page: today
  Page->>Hook: Load summary for today
  Hook->>Repo: getSummary(today, 30)
  Repo->>API: Request dashboard summary
  API-->>Repo: Summary payload
  Repo-->>Hook: KPIs, arrivals, departures, bookings, maintenance, chart series
  Hook-->>Page: loading=false, data ready
  Page-->>U: Render dashboard panels and bookings sidebar
  U->>Page: Toggle Dashboard / Split layout
  Page-->>U: Re-render content grid
```

## Reservations

- **Route:** `/reservations`
- **Primary users:** Reservations agent, front-desk lead, finance support
- **Feature inventory:** Reservation KPIs, searchable/sortable table, status/property filters, manual reservation dialog, CSV upload with dry-run summary, row-level tax export trigger

### User Stories

- As a reservations agent, I want to search and filter bookings so that I can find guest records quickly.
- As a reservations agent, I want to create a reservation manually so that off-platform bookings can still be tracked.
- As an operations user, I want to upload reservation CSV files with a dry-run option so that I can validate imports before creating records.
- As a finance user, I want to trigger tax export from a reservation row so that tax documentation can start from booking data.

### Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant Page as ReservationsPage
  participant Hook as useReservationsPageData
  participant Repo as REST Repositories
  participant API as Reservations + Ingest + Tax Export APIs

  U->>Page: Open reservations page
  Page->>Hook: Load properties, rooms, reservations
  Hook->>Repo: getAll() datasets
  Repo->>API: GET properties/rooms/reservations
  API-->>Repo: Dataset payloads
  Repo-->>Hook: Data returned
  Hook-->>Page: Guests + reservations ready
  Page-->>U: Render KPI cards and table

  alt Manual reservation
    U->>Page: Open New Reservation dialog
    U->>Page: Submit reservation form
    Page->>Repo: reservations.create(input)
    Repo->>API: POST /api/reservations
    API-->>Repo: Created reservation
    Repo-->>Page: Success
    Page-->>U: Close dialog and refresh lists
  else CSV upload
    U->>Page: Upload reservations CSV
    Page->>Repo: ingest.uploadReservations(formData)
    Repo->>API: POST /api/ingest/reservations
    API-->>Repo: Ingest summary
    Repo-->>Page: Summary response
    Page-->>U: Show processed / created / skipped / dead-letter summary
  else Tax export
    U->>Page: Click row tax export action
    Page->>Repo: taxExport.run(...)
    Repo->>API: POST /api/tax-export/run
    API-->>Repo: Job id
    Repo-->>Page: Download URL lookup
    Page-->>U: Open exported file / job output
  end
```

## Check-in / Check-out

- **Route:** `/check-in-out`
- **Primary users:** Front-desk staff
- **Feature inventory:** Arrivals/departures KPIs, property filter, separate paginated lists for arrivals and departures, card-level action buttons

### User Stories

- As front-desk staff, I want today's arrivals and departures on one board so that I can manage guest movement efficiently.
- As staff, I want to filter the board by property so that I can focus on the site I am currently operating.

### Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as Front Desk
  participant Page as CheckInOutPage
  participant Hook as useReservationsPageData
  participant Repo as REST Repositories
  participant API as Reservations APIs

  U->>Page: Open check-in / check-out page
  Page->>Hook: Load properties, rooms, reservations
  Hook->>Repo: getAll() datasets
  Repo->>API: GET properties/rooms/reservations
  API-->>Repo: Dataset payloads
  Repo-->>Hook: Data returned
  Hook-->>Page: Guest-compatible reservation view
  Page->>Page: Derive arrivals, departures, in-house, completed counts
  Page-->>U: Render KPI cards and two paginated guest lists
  Note over Page: Action buttons are visible in current code, but no mutation is wired yet
```

## Guests

- **Route:** `/guests`
- **Primary users:** Front-office staff, residence/tenant operations staff
- **Feature inventory:** Property selector, Stay Registration tab, Stay Records tab, Guest Requests tab

### User Stories

- As staff, I want a single guest operations hub so that registration, stay tracking, and requests are managed in one place.
- As staff, I want to register stays so that guest occupancy can be tracked by tenant and dates.
- As staff, I want to review stay history and tenant records so that long-term and short-term occupancy are both visible.
- As staff, I want to create and transition guest requests so that service issues can be managed through their lifecycle.

### Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as Staff
  participant Page as GuestsPage
  participant Tabs as Guest Tabs
  participant Repo as REST Repositories
  participant API as Guest / Tenant / Stay / Request APIs

  U->>Page: Open guest profiles page
  Page->>Repo: Load property list
  Repo->>API: GET /api/properties
  API-->>Repo: Properties
  Repo-->>Page: Properties loaded
  Page-->>U: Render tabs and selected property context

  alt Stay Registration
    U->>Tabs: Open Stay Registration
    Tabs->>Repo: Load tenants + stay registrations
    Repo->>API: GET stay registrations / tenants
    API-->>Repo: Datasets
    U->>Tabs: Submit registration form
    Tabs->>Repo: stayRegistrations.create(input)
    Repo->>API: POST stay registration
    API-->>Tabs: Created record
    Tabs-->>U: Reset form and refresh list
  else Stay Records
    U->>Tabs: Open Stay Records
    Tabs->>Repo: Load stays + tenants
    Repo->>API: GET stay records and tenants
    API-->>Tabs: Data sets
    Tabs-->>U: Render short-term / long-term views and tenant detail sheet
  else Guest Requests
    U->>Tabs: Open Guest Requests
    Tabs->>Repo: Load guest requests
    Repo->>API: GET /api/guest-requests
    API-->>Tabs: Request list
    U->>Tabs: Create or transition a request
    Tabs->>Repo: create / transitionStatus
    Repo->>API: POST or PATCH guest request
    API-->>Tabs: Updated request state
    Tabs-->>U: Refresh request list
  end
```

---

# Property

## Rooms & Suites

- **Route:** `/rooms`
- **Primary users:** Operations, housekeeping, front office
- **Feature inventory:** Property/status/type filters, KPI strip, floor-grouped room cards, room status chooser, navigation to room types page

### User Stories

- As operations staff, I want a floor-plan style room overview so that room state can be scanned visually.
- As staff, I want to update a room's status so that downstream dashboards reflect operational reality.

### Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant Page as RoomsPage
  participant Hook as useRoomsPageData
  participant Repo as REST Repositories
  participant API as Rooms + Reservations APIs
  participant Dialog as RoomStatusChooser

  U->>Page: Open rooms page
  Page->>Hook: Load properties, rooms, reservations
  Hook->>Repo: getAll() datasets
  Repo->>API: GET properties/rooms/reservations
  API-->>Repo: Dataset payloads
  Repo-->>Hook: Data returned
  Hook-->>Page: Datasets ready
  Page->>Page: Derive room display status and floor grouping
  Page-->>U: Render KPI cards and floor-plan room grid
  U->>Page: Click a room card
  Page->>Dialog: Open status chooser
  U->>Dialog: Select new status
  Dialog->>Repo: rooms.updateStatus(roomId, status)
  Repo->>API: PATCH room status
  API-->>Repo: Updated room payload
  Repo-->>Dialog: Success
  Dialog-->>Page: Invalidate rooms/reservations/dashboard summary queries
  Page-->>U: Updated room state shown
```

## Room Types

- **Route:** `/rooms/types`
- **Primary users:** Operations, revenue, management
- **Feature inventory:** KPI strip, property filter, per-room-type cards, occupancy percentage bars

### User Stories

- As management, I want to see room inventory by type so that I understand category distribution across properties.
- As management, I want occupancy by room type so that performance can be compared between categories.

### Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant Page as RoomTypesPage
  participant Hook as useRoomsPageData
  participant Repo as REST Repositories
  participant API as Rooms + Reservations APIs

  U->>Page: Open room types page
  Page->>Hook: Load properties, rooms, reservations
  Hook->>Repo: getAll() datasets
  Repo->>API: GET properties/rooms/reservations
  API-->>Repo: Dataset payloads
  Repo-->>Hook: Data returned
  Hook-->>Page: Datasets ready
  Page->>Page: Group rooms by room_type and compute occupancy per type
  Page-->>U: Render room-type KPI cards and occupancy bars
```

## Availability

- **Route:** `/rooms/availability`
- **Primary users:** Front office, reservations, management
- **Feature inventory:** 14-day room/date grid, property filter, week navigation, daily occupancy KPIs

### User Stories

- As a reservations user, I want a forward-looking availability grid so that I can plan occupancy by date and room.
- As a user, I want to navigate between date windows so that near-term availability can be reviewed quickly.

### Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant Page as AvailabilityPage
  participant Hook as useReservationsPageData
  participant Repo as REST Repositories
  participant API as Reservations APIs

  U->>Page: Open availability page
  Page->>Hook: Load properties, rooms, reservations
  Hook->>Repo: getAll() datasets
  Repo->>API: GET properties/rooms/reservations
  API-->>Repo: Dataset payloads
  Repo-->>Hook: Data returned
  Hook-->>Page: Datasets ready
  Page->>Page: Build 14-day room x date grid with vacant / arriving / occupied / departing states
  Page-->>U: Render availability matrix and occupancy KPI strip
  U->>Page: Click Prev / Today / Next or property filter
  Page-->>U: Recompute and render updated date window
```

## Housekeeping

- **Route:** `/housekeeping`
- **Primary users:** Housekeeping lead, operations lead
- **Feature inventory:** Dirty/cleaning/inspected/ready KPIs, property filter, state filter, priority-sorted room cards

### User Stories

- As a housekeeping lead, I want room cleaning states grouped in one board so that turnover can be prioritized.
- As a lead, I want rooms sorted by operational urgency so that the team works in the best order.

### Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as Housekeeping Lead
  participant Page as HousekeepingPage
  participant Hook as useRoomsPageData
  participant Repo as REST Repositories
  participant API as Rooms + Reservations APIs

  U->>Page: Open housekeeping page
  Page->>Hook: Load properties, rooms, reservations
  Hook->>Repo: getAll() datasets
  Repo->>API: GET properties/rooms/reservations
  API-->>Repo: Dataset payloads
  Repo-->>Hook: Data returned
  Hook-->>Page: Datasets ready
  Page->>Page: Derive clean state from room/reservation state and sort by priority
  Page-->>U: Render KPI cards and room cards ordered by urgency
  U->>Page: Filter by property or state
  Page-->>U: Filtered housekeeping board
```

## Dining & Events

- **Route:** `/dining-events`
- **Primary users:** F&B manager, events coordinator
- **Feature inventory:** Event KPIs, property filter, per-event cards with type, venue, guest count, and status

### User Stories

- As an F&B manager, I want the current dining and events schedule so that venue usage and guest volume are visible.
- As an events coordinator, I want to filter by property so that I can focus on one location at a time.

### Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as F&B Manager
  participant Page as DiningEventsPage
  participant Hook as useDiningEventsPageData
  participant Repo as REST Repositories
  participant API as Dining Events APIs

  U->>Page: Open dining & events page
  Page->>Hook: Load properties and events
  Hook->>Repo: properties.getAll + diningEvents.getAll
  Repo->>API: GET properties and dining events
  API-->>Repo: Datasets
  Repo-->>Hook: Data returned
  Hook-->>Page: Events ready
  Page-->>U: Render KPI cards and event cards
  U->>Page: Filter by property
  Page-->>U: Filtered schedule
  Note over Page: New Event button is visible in current code, but no create flow is wired yet
```

---

# Revenue

## Rate Manager

- **Route:** `/rate-manager`
- **Primary users:** Revenue manager
- **Feature inventory:** KPI strip, date window navigation, property filter, room-type x date rate grid, override indicator

### User Stories

- As a revenue manager, I want a multi-day rate grid so that I can compare room-type pricing over time.
- As a revenue manager, I want property filtering and week navigation so that I can review each site and date band quickly.

### Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as Revenue Manager
  participant Page as RateManagerPage
  participant Hook as useRatesPageData
  participant Repo as REST Repositories
  participant API as Rates APIs

  U->>Page: Open rate manager
  Page->>Hook: Load properties, rooms, rates for date window
  Hook->>Repo: properties.getAll + rooms.getAll + rates.getByDateRange
  Repo->>API: GET properties, rooms, rates
  API-->>Repo: Datasets
  Repo-->>Hook: Data returned
  Hook-->>Page: Rate grid ready
  Page-->>U: Render KPI cards and 7-day rate matrix
  U->>Page: Change week or property
  Page->>Hook: Re-query with new range / property
  Hook->>Repo: rates.getByDateRange(updated range)
  Repo-->>Page: Updated rate set
  Page-->>U: Re-rendered rate grid
```

## Billing & Invoices

- **Route:** `/billing`
- **Primary users:** Finance operations, management
- **Feature inventory:** Billing KPIs, search, status/property filters, sortable paginated invoice table

### User Stories

- As a finance user, I want a billing list view so that invoice-like reservation revenue can be reviewed operationally.
- As a user, I want to filter by status and property so that outstanding or paid revenue can be isolated.

### Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as Finance User
  participant Page as BillingInvoicesPage
  participant Hook as useReservationsPageData
  participant Repo as REST Repositories
  participant API as Reservations APIs

  U->>Page: Open billing & invoices page
  Page->>Hook: Load properties, rooms, reservations
  Hook->>Repo: getAll() datasets
  Repo->>API: GET properties/rooms/reservations
  API-->>Repo: Dataset payloads
  Repo-->>Hook: Data returned
  Hook-->>Page: Reservations-ready state
  Page->>Page: Generate invoice-like rows from reservations
  Page-->>U: Render KPI cards and billing table with filters
  Note over Page: Current code derives billing rows from reservation data; no true invoice/folio mutation exists yet
```

## Channel Distribution

- **Route:** `/channels`
- **Primary users:** Revenue operations, integrations operators
- **Feature inventory:** Channel/account KPIs, per-channel cards, account-level connection/error badges

### User Stories

- As a revenue operations user, I want to see channel and external account health so that OTA connectivity issues are visible.
- As an operator, I want account-level status badges so that I can spot failing channel accounts quickly.

### Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as Revenue Ops
  participant Page as ChannelDistributionPage
  participant Repo as Channels Repository
  participant API as GET /api/channels

  U->>Page: Open channel distribution page
  Page->>Repo: channels.getAll()
  Repo->>API: Request channels with external accounts
  API-->>Repo: Channel payload with external_accounts
  Repo-->>Page: Channel list
  Page-->>U: Render KPI cards and per-channel account status cards
```

## Tax & Compliance

- **Route:** `/tax-export`
- **Primary users:** Finance, tax operations
- **Feature inventory:** Same-day checkout preview, ready/review KPIs, export job history, item review workflow, settings management

### User Stories

- As a finance operator, I want a preview of same-day checkout tax-export items so that I know what is ready or blocked.
- As a finance operator, I want to run export jobs and download results so that regulatory output can be produced.
- As a reviewer, I want to edit or mark review items so that blocked invoice lines can be resolved.
- As an administrator, I want to save export settings so that recurring export behavior remains consistent.

### Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as Finance Operator
  participant Page as TaxExportPage
  participant Repo as Tax Export Repository
  participant API as Tax Export APIs

  U->>Page: Open tax & compliance page
  Page->>Repo: getSettings() and getJobs()
  Repo->>API: GET settings and jobs
  API-->>Repo: Settings + job history
  Repo-->>Page: Initial tax export state
  Page->>Repo: getPreview(selectedDate)
  Repo->>API: GET preview for date
  API-->>Repo: Preview items
  Repo-->>Page: Preview table and KPI counts
  Page-->>U: Render Preview / History tabs + settings card

  alt Run export
    U->>Page: Click Run Export
    Page->>Repo: run({ date })
    Repo->>API: POST export run
    API-->>Repo: Job id
    Repo-->>Page: Job created
    Page-->>U: Switch to history and offer download
  else Review item
    U->>Page: Open review job
    Page->>Repo: getJob(jobId)
    Repo->>API: GET job details
    API-->>Repo: Job items
    U->>Page: Save price / skip / mark reviewed
    Page->>Repo: patchItem(itemId, payload)
    Repo->>API: PATCH job item
    API-->>Repo: Updated item state
    Repo-->>Page: Refresh preview and history
  else Save settings
    U->>Page: Update schedule/timezone/sheet fields/template mapping
    Page->>Repo: updateSettings(settings)
    Repo->>API: PUT tax export settings
    API-->>Repo: Updated settings
    Repo-->>Page: Success
  end
```

---

# Administration

## Staff & Roles

- **Route:** `/staff`
- **Primary users:** Admin, HR/operations support
- **Feature inventory:** Staff KPIs, search, role filter, staff rows with avatars, role badges, assigned property names

### User Stories

- As an administrator, I want a staff directory with role context so that role coverage is easy to review.
- As an administrator, I want to filter by role so that admin, manager, and team counts can be inspected separately.

### Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as Admin
  participant Page as StaffRolesPage
  participant Hook as useStaffPageData
  participant Repo as REST Repositories
  participant API as Staff APIs

  U->>Page: Open staff & roles page
  Page->>Hook: Load properties and staff
  Hook->>Repo: properties.getAll + staff.getAll
  Repo->>API: GET properties and staff
  API-->>Repo: Datasets
  Repo-->>Hook: Data returned
  Hook-->>Page: Staff directory ready
  Page-->>U: Render KPI cards and searchable staff table
  Note over Page: Add Staff button is visible, but no create flow is wired yet
```

## Maintenance Logs

- **Route:** `/maintenance`
- **Primary users:** Maintenance lead, operations lead
- **Feature inventory:** Issue KPIs, search, property/status/severity filters, sorted issue table, create issue dialog

### User Stories

- As a maintenance lead, I want a filtered issue log so that open and critical issues are easy to prioritize.
- As staff, I want to log a maintenance issue from the UI so that operational defects can enter the queue immediately.

### Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as Maintenance Lead
  participant Page as MaintenancePage
  participant Hook as useMaintenancePageData
  participant Repo as REST Repositories
  participant API as Maintenance APIs
  participant Dialog as Log Issue Dialog

  U->>Page: Open maintenance page
  Page->>Hook: Load properties, rooms, maintenance issues
  Hook->>Repo: properties/rooms/maintenance.getAll
  Repo->>API: GET properties, rooms, maintenance
  API-->>Repo: Datasets
  Repo-->>Hook: Data returned
  Hook-->>Page: Maintenance state ready
  Page-->>U: Render KPI cards and filtered issue table
  U->>Page: Click Log Issue
  Page->>Dialog: Open form
  U->>Dialog: Submit title, description, priority, property
  Dialog->>Repo: maintenance.create(input)
  Repo->>API: POST maintenance issue
  API-->>Repo: Created issue
  Repo-->>Dialog: Success
  Dialog-->>Page: Refresh maintenance list
```

## Security & Access

- **Route:** `/security`
- **Primary users:** Security officer, administrator
- **Feature inventory:** Audit KPIs, search, severity filter, chronological log list

### User Stories

- As a security officer, I want a searchable access log so that suspicious or critical events can be reviewed quickly.
- As an administrator, I want KPI counts by severity so that audit volume is easy to summarize.

### Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as Security Officer
  participant Page as SecurityAccessPage
  participant Hook as useSecurityAuditPageData
  participant Repo as REST Repositories
  participant API as Security Audit API

  U->>Page: Open security & access page
  Page->>Hook: Load audit entries
  Hook->>Repo: securityAudit.getAll()
  Repo->>API: GET security audit entries
  API-->>Repo: Audit events
  Repo-->>Hook: Entries returned
  Hook-->>Page: Audit list ready
  Page-->>U: Render KPI cards and searchable severity-filtered audit log
```

## Integrations

- **Route:** `/settings/integrations`
- **Primary users:** Admin, integrations operator
- **Feature inventory:** WithOne provider health, saved connections list, disconnect flow, pipeline status table, manual CSV upload, manual pipeline run, ingest summary panels

### User Stories

- As an integrations operator, I want to see provider health and saved connections so that I know whether Google-based ingest can run.
- As an operator, I want to upload source CSVs manually so that emergency ingest can happen from one screen.
- As an operator, I want to run pipeline modes manually so that email, folder-watch, and Google Sheet ingestion can be tested and executed on demand.
- As an admin, I want to disconnect saved connections so that obsolete or broken authorizations can be removed.

### Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as Admin / Operator
  participant Page as IntegrationsPage
  participant Hooks as useIntegrationStatus + usePipelineStatus + useConnections
  participant Repo as REST / direct ingest requests
  participant API as Integrations + Ingest APIs
  participant OAuth as WithOne OAuth Window

  U->>Page: Open integrations page
  Page->>Hooks: Load provider health, pipeline state, and saved connections
  Hooks->>Repo: GET status endpoints
  Repo->>API: GET /api/integrations/status, /api/ingest/pipeline/status, /api/one/connections
  API-->>Repo: Health + connectors + saved connections
  Repo-->>Hooks: Current integration state
  Hooks-->>Page: Rendered operations surface
  Page-->>U: Show provider health, connections, CSV upload, pipeline run forms

  alt Connect provider
    U->>Page: Click Connect Google service
    Page->>OAuth: window.open(auth flow)
    OAuth-->>U: Complete authorization outside app
    U->>Page: Refresh / return to page
    Page-->>U: Saved connection appears if auth succeeded
  else Disconnect
    U->>Page: Click Disconnect
    Page->>Repo: disconnect(connectionKey)
    Repo->>API: DELETE saved connection
    API-->>Repo: Success
    Repo-->>Page: Refresh connections list
  else Upload CSV
    U->>Page: Choose ingest kind + file + dry-run flag
    Page->>API: POST /api/ingest/:kind
    API-->>Page: Ingest summary
    Page-->>U: Show processed / created / skipped / dead-letter summary
  else Manual pipeline run
    U->>Page: Choose mode, target, source, connection key, dry-run
    Page->>API: POST /api/ingest/pipeline/run
    API-->>Page: Pipeline summary
    Page-->>U: Show run results
  end
```

---

## Coverage Matrix

| Check | Status |
|---|---|
| 17 routed frontend pages covered | Yes |
| 4 sidebar business groups represented | Yes |
| Every routed page has at least 1 user story | Yes |
| Every routed page has a Mermaid sequence diagram | Yes |
| Shared shell/navigation flow documented | Yes |

## Implementation Notes For Developers

- Current frontend runtime is Track B REST-first. Use `createRestRepositories()` and existing page hooks as the canonical data access pattern.
- Pages that primarily read data generally use `frontend/src/hooks/use-page-data.ts` or `frontend/src/hooks/use-dashboard-data.ts`.
- Current code contains several visible CTA stubs without implemented mutations: check-in/check-out actions, new event, add staff. These are documented as visible-but-not-wired, not as completed flows.
- `frontend/src/components/guests/vip-guests-page.tsx` exists but is not routed in `frontend/src/router.tsx`; it is intentionally excluded from the 17-page coverage count.

## Stakeholder Notes

- The application already exposes a broad operational surface across front office, property, revenue, and administration.
- Many pages are read-only insight surfaces today; the strongest implemented write flows are reservations create/import, guest-request lifecycle, room-status update, maintenance issue logging, tax export review/run, and integrations operations.
- Billing remains reservation-derived in the UI rather than a dedicated folio/accounting model.
