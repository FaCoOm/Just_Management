---
title: SaaS Feature Audit for Just_Management
created: 2026-06-17T00:00:00Z
tags: [saas, audit, frontend, backend]
---

# SaaS Feature Audit, Just_Management

## Executive summary

Just_Management is a Track B, REST only hospitality dashboard. The app covers the core operational shell for reservations, rooms, housekeeping, guests, maintenance, tax export, billing, channels, staff, security, and integrations, but many pages are still thin projections around read only or synthetic data. The strongest area is tax export, followed by reservations and room status updates. The weakest areas are edit flows, workflow actions, auth, and backend support for writable operations.

The product is usable as an internal operations console, but it is not yet a complete SaaS grade management surface. Several pages expose list views or buttons without handlers, and a few critical flows depend on placeholders, hard coded values, or derived projections instead of durable domain records. The main risk is not visual polish, it is incomplete state mutation support and inconsistent data freshness across the UI.

## Route inventory

| Route | Sidebar area | Surface type | Assessment |
|---|---|---|---|
| `/` | Dashboard | Summary page | Works, but revenue is a placeholder, header controls are inert, and freshness needs attention |
| `/reservations` | Reservations | Operational list page | Strongest core workflow, but missing edit, cancel, detail, and PATCH support |
| `/check-in-out` | Reservations | Action page | Buttons are not wired |
| `/guests` | Guests | Derived list page | Read only projection from reservations, CSV export only |
| `/guests/vip` | Guests | Segmented list page | Read only, same projection limits |
| `/rooms` | Rooms | Operational page | Floor plan status update works via PATCH `/api/rooms/:id/status` |
| `/rooms/types` | Rooms | Configuration page | Read only |
| `/rooms/availability` | Rooms | Availability page | Read only |
| `/housekeeping` | Housekeeping | Derived page | Read only |
| `/dining-events` | Dining events | Event page | New Event has no handler, page is effectively read only |
| `/rate-manager` | Revenue | Pricing page | Read only |
| `/billing` | Billing | Synthetic finance page | Uses hard coded VND rates, not a real folio or payment domain |
| `/channels` | Distribution | Channel page | Read only |
| `/staff` | Staff | People page | Add Staff has no handler, read only |
| `/maintenance` | Operations | Issue tracking page | Create/list only, no update |
| `/security` | Operations | Audit page | Read only |
| `/tax-export` | Finance | Export page | Most complete page, but has UTC date logic, disabled export path, console only errors, no scheduler |
| `/settings/integrations` | Settings | Integration control page | Pipeline/status/OAuth/upload exist, but data access breaks repository rules and uses hard coded dev inputs |

## Per page assessment by sidebar area

### Dashboard

The dashboard is present and functional enough for oversight, but it is not fully trustworthy as an operational cockpit. The revenue area is still a placeholder, some header controls do nothing, and freshness issues mean the page can look current when it is not fully synchronized. This page needs stronger query invalidation and a clear last updated signal.

### Reservations

Reservations is the best developed operational area. It supports create, list, CSV, and tax export related flows, which makes it the most useful production page after tax export. However, the page still lacks edit, cancel, detail, and PATCH paths, so users cannot complete a full reservation lifecycle from the UI. The adjacent check in and check out page exists, but the buttons are not wired, which leaves a major gap in front desk workflows.

### Guests

Guest views are derived from reservations rather than being a primary writable domain. That keeps the UI simple, but it also means the page is only a legacy projection. CSV export is available, yet there is no real guest record workflow. Multi room allocations are ignored by the guest mapper, so the projection can flatten real booking structure.

### Rooms

Rooms is mixed. The floor plan status update flow works through PATCH `/api/rooms/:id/status`, which gives the app one real write path with visible operational value. By contrast, room types and availability are still read only. This area is close to being a proper operational suite, but it needs write support for configuration and inventory planning.

### Housekeeping

Housekeeping is currently a derived, read only surface. It can support awareness, but not task execution. The page should eventually evolve from observation to action, otherwise it will remain a passive mirror of room state.

### Dining events

The dining events page is mostly a shell. The New Event action has no handler, so the page does not yet support actual event creation. It can be treated as a stub rather than a working feature.

### Rate manager

Rate Manager is read only. It displays pricing related information, but there is no edit workflow. For a hospitality SaaS, this is a material gap because rate control is a core revenue lever.

### Billing

Billing is synthetic and built from reservations with hard coded VND rates. That is useful for a rough summary, but it is not a true billing or folio domain. The page should be treated as an accounting view stub until payment, folio, and invoice logic exist.

### Channels

Channels is read only. The page can surface distribution relationships, but it does not yet manage them. Without write support, it cannot become an actual channel manager.

### Maintenance

Maintenance supports create and list only. There is no update path, so tickets cannot move through a full lifecycle in the UI. That limits the page to intake, not operations management.

### Security

Security is read only and functions as an audit surface. This is acceptable for a first pass, but it is not yet an enforcement or administration surface.

### Staff

Staff includes Add Staff UI affordances, but there is no handler behind them. The page is effectively read only and cannot manage personnel records yet.

### Tax export

Tax Export is the most complete feature area. It has the strongest end to end intent, but the implementation still has several sharp edges. The date logic uses UTC `getToday`, the empty preview disables Run Export, errors are console only, and there is no scheduler even though settings suggest export automation should exist. This page is close to production intent, but it still needs durable execution semantics.

### Settings, integrations

Integrations is a useful control point because it includes pipeline, status, OAuth, and upload flows. The problem is architectural. It uses raw fetch in a way that violates the repository rule, and it relies on hard coded sourceAccounts and a dev user. This makes the page brittle and hard to maintain. It should be centralized behind repository abstractions and real integration options.

## Backend and API support assessment

The backend supports the parts of the UI that have already been made real, but coverage is uneven. The clearest working mutation is room status patching. Reservations still lack PATCH, DELETE, and status endpoints, which is why the front desk flows stall. Maintenance has no PATCH support. Rates, dining, staff, and channels have no CRUD depth. Guests are still a legacy projection layer, and guest requests remain orphaned. The channel listing schema is not exposed cleanly, operational_notes is overloaded, and multi room allocations are ignored by the guest mapper.

There are also platform level gaps. Auth is missing, rate limiting is missing, and there is no reliable backend policy around protected operations. The net result is a system that can render data, but cannot yet enforce a mature SaaS permission model or mutation model.

## Cross cutting product and technical shortcomings

- Data freshness is inconsistent, especially on dashboard and operational summaries.
- Many pages expose UI affordances without handlers, which creates false affordances.
- The app relies too heavily on derived projections, especially guests, billing, and some finance views.
- Writable domain coverage is narrow, so most operational workflows stop at list views.
- Integration logic is too close to page code and not consistently mediated by repositories.
- There is no auth or RBAC layer, which is a serious SaaS gap.
- There is no rate limiting or similar abuse protection.
- Export and automation flows lack scheduler support and durable error handling.
- Several domains need a real source of truth, not synthetic or hard coded values.

## Prioritized recommendations

1. Add reservation PATCH, DELETE, and status endpoints, then wire the check in and check out page so front desk actions work end to end.
2. Build a real folio and payment domain, then replace the synthetic billing view and hard coded VND assumptions.
3. Add auth and RBAC before exposing more writable flows.
4. Make housekeeping writable where it matters, so tasks can be executed instead of only observed.
5. Add editable room types and rate manager flows, since pricing and inventory are core hospitality controls.
6. Centralize integration options behind repository based access, remove raw fetch from the integrations page, and eliminate hard coded sourceAccounts and dev user state.
7. Fix dashboard data freshness with better invalidation, clearer update timestamps, and less placeholder content.
8. Add not found and error routes so broken paths fail gracefully.
9. Introduce a reservation detail or drawer experience that can bridge guest, room, and action context in one place.

## Verification commands

Use these commands to validate the repo after feature work:

```bash
npm run typecheck
npm run build
cd backend && npm run build
cd backend && npm run verify:all
```

For UI specific changes, run the app and exercise the affected routes, especially `/reservations`, `/check-in-out`, `/rooms`, `/tax-export`, and `/settings/integrations`.
