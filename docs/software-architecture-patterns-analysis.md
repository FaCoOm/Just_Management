---
tags: [architecture, system-design, patterns]
---

## 1. What “system design architecture pattern” means

A software architecture pattern is a high-level structure for organizing a system. It defines where code lives, how modules communicate, who owns data, where business rules live, how deployment scales, how changes are isolated, and how failure propagates.

This differs from code-level design patterns such as Factory, Strategy, or Observer. Those operate inside classes/functions/modules. Architecture patterns operate at system or application structure level.

## 2. Main architecture pattern categories

### Deployment / Runtime Topology Patterns

These answer: how is the system deployed?

#### Monolith

One deployable app. All features live in one codebase/runtime, often backed by one database.

Examples: Rails app, Django app, Express API, Laravel app.

Strengths: simple deployment, easy local development, straightforward transactions, fast early-stage delivery.

Weaknesses: can become tangled, scales all-or-nothing, weak boundaries become a big ball of mud.

Best for early products, small/medium teams, and domains still changing.

#### Modular Monolith

One deployable app, internally split into strong modules.

Example modules: Reservations, Guests, Billing, Ingestion, Reporting.

Each module may own routes, services, domain logic, DTOs, and sometimes DB tables.

Strengths: monolith simplicity with microservice-like boundaries; easier future extraction.

Weaknesses: requires discipline; boundaries can rot if imports leak.

Best default for many serious SaaS and business systems.

#### Microservices

Many independently deployable services, often with separate databases.

Examples: Auth Service, Booking Service, Billing Service, Notification Service.

Strengths: independent deploy/scaling, team autonomy, failure isolation.

Weaknesses: distributed systems complexity, network latency, consistency problems, observability burden, harder dev/prod parity.

Best for large teams, clear bounded contexts, and independently scaling workloads.

#### Serverless / Function-Based

Each operation runs as a function triggered by HTTP, queue, cron, or event.

Strengths: pay-per-use, burst scaling, low ops burden.

Weaknesses: cold starts, vendor coupling, local development friction, orchestration complexity.

Best for scheduled jobs, event handlers, lightweight APIs, and burst workloads.

### Internal Code Organization Patterns

These answer: how is code structured inside the app?

#### Layered Architecture

Classic vertical layers:

```text
Controller / Route
      ↓
Service / Business Logic
      ↓
Repository / Data Access
      ↓
Database / External API
```

Strengths: easy to understand, common, good fit for REST APIs and CRUD apps.

Weaknesses: business logic can leak into controllers; repositories can become thin wrappers; cross-domain workflows can get awkward.

#### Hexagonal Architecture / Ports and Adapters

Domain core is isolated from frameworks and infrastructure.

```text
REST Adapter → Port → Domain Core ← Port ← DB Adapter
```

A port is an interface the domain expects. An adapter is a concrete implementation for Express, Prisma, Stripe, Google, etc.

Strengths: testable, replaceable infrastructure, strong business isolation.

Weaknesses: more files, more abstractions, overkill for simple CRUD.

Best for complex business rules and external-provider-heavy systems.

#### Clean Architecture

Similar to Hexagonal, but stricter dependency rings.

```text
Entities
  ↑
Use Cases
  ↑
Interface Adapters
  ↑
Frameworks / DB / UI
```

Rule: dependencies point inward.

Strengths: very testable, framework-agnostic, business rules independent.

Weaknesses: ceremony, can feel heavyweight, requires strict boundaries.

Best for enterprise systems, mission-critical domains, and large teams.

#### MVC

Model–View–Controller separates data/model logic, UI/view rendering, and request/controller handling.

Common in Rails, Laravel, Django, ASP.NET MVC.

Strengths: productive, convention-heavy, good for server-rendered apps.

Weaknesses: fat models/controllers if unmanaged; less ideal for complex domains.

#### Feature-Based / Vertical Slice Architecture

Organize by feature instead of technical layer.

```text
features/
├── reservations/
│   ├── routes.ts
│   ├── service.ts
│   ├── repository.ts
│   └── types.ts
├── guests/
└── maintenance/
```

Strengths: high cohesion, easier navigation, reduced cross-feature coupling.

Weaknesses: shared logic placement needs care; duplication can emerge without conventions.

### Domain Modeling Patterns

These answer: how does business logic map to real-world concepts?

#### Domain-Driven Design / DDD

Design around business domains and business language.

Core concepts: Domain, Subdomain, Bounded Context, Entity, Value Object, Aggregate, Repository, Domain Event, Ubiquitous Language.

Hospitality examples: Reservation, Guest, Property, Room, MaintenanceIssue, CheckInWorkflow, TaxExport, IngestRun.

Possible bounded contexts: Reservations, Property Operations, Ingestion, Tax Reporting, External Integrations.

Strengths: good for complex business logic, aligns code with real operations, reduces ambiguity.

Weaknesses: requires domain understanding; easy to over-model; less valuable for pure CRUD.

#### Anemic Domain Model

Entities are mostly data containers; services hold logic.

Strengths: simple, common with ORMs, works for CRUD.

Weaknesses: business rules can become scattered; invariants are harder to enforce.

#### Rich Domain Model

Entities contain behavior and invariants.

Example methods: reservation.checkIn(), reservation.cancel(), reservation.canRefund().

Strengths: rules stay close to data, stronger invariants.

Weaknesses: ORM friction, can be awkward in JavaScript/TypeScript backends.

### Communication / Integration Patterns

These answer: how do parts talk?

#### Request/Response

Synchronous communication: frontend calls REST API, API returns response.

Examples: REST, GraphQL, RPC, gRPC.

Strengths: simple mental model, easy debugging.

Weaknesses: caller waits, cascading failures possible.

#### Event-Driven Architecture

Modules publish events and consumers react.

Example:

```text
ReservationCreated
      ↓
SendEmail
UpdateOccupancy
SyncCalendar
CreateAuditLog
```

Strengths: decouples workflows, good for async side effects, independently scalable consumers.

Weaknesses: eventual consistency, harder debugging, idempotency required.

Best for notifications, ingestion, audit logs, sync pipelines, and booking lifecycle side effects.

#### CQRS

Separate write model from read model.

Commands mutate state. Queries read optimized projections.

Examples: CreateReservationCommand, UpdateRoomStatusCommand, DashboardSummaryQuery, OccupancyReportQuery.

Strengths: optimized reads, cleaner complex workflows, good for dashboards/reporting.

Weaknesses: more moving parts, projection consistency issues.

#### Event Sourcing

Store events as source of truth. Current state is rebuilt by replaying events.

Examples: ReservationCreated, GuestCheckedIn, ReservationExtended, ReservationCancelled.

Strengths: full audit trail, time travel/debugging, strong history.

Weaknesses: high complexity, schema evolution difficulty, projection/query burden.

Best for finance ledgers, audit-critical systems, and workflow history. Usually overkill for standard dashboards.

### Data Ownership Patterns

These answer: who owns the data?

#### Shared Database

Many modules/services use the same database.

Strengths: simple transactions, easy reporting.

Weaknesses: tight coupling, harder microservice extraction.

Common in monoliths and modular monoliths.

#### Database per Service

Each microservice owns its database.

Strengths: strong autonomy, clear ownership.

Weaknesses: distributed transactions are hard; reporting requires pipelines.

#### Read Model / Projection

Derived data optimized for reads.

Example: reservations table feeds occupancy_daily_summary table.

Good for dashboards, analytics, search, and exports.

## 3. Categorization Map

```text
Architecture patterns
├── Deployment topology
│   ├── Monolith
│   ├── Modular monolith
│   ├── Microservices
│   └── Serverless
│
├── Internal structure
│   ├── Layered
│   ├── Hexagonal
│   ├── Clean architecture
│   ├── MVC
│   └── Vertical slice
│
├── Domain modeling
│   ├── DDD
│   ├── Anemic domain model
│   └── Rich domain model
│
├── Communication
│   ├── REST/RPC request-response
│   ├── Event-driven
│   ├── CQRS
│   └── Event sourcing
│
└── Data ownership
    ├── Shared DB
    ├── DB per service
    └── Read projections
```

## 4. Can architecture patterns be incorporated with each other?

Yes. They usually should be combined because they operate at different layers.

Example combination:

```text
Deployment: Modular monolith
Internal: Layered + vertical slice
Domain: DDD-lite bounded contexts
Communication: REST sync + async events for side effects
Data: Shared PostgreSQL + read projections
```

This is normal. A system is rarely just one pattern.

## 5. Good combinations

### Modular Monolith + Layered Architecture

A common practical default. Each module follows route → service → repository → database.

### Modular Monolith + DDD-lite

Use bounded contexts without excessive ceremony. Good contexts for this project: Reservations, Property Operations, Ingestion, Tax Export, Integrations.

### Hexagonal inside a Monolith

Still one deployable, but external systems sit behind adapters. Excellent when the app integrates with Google Drive, WithOne, email, spreadsheets, payments, or other providers.

### Event-driven inside a Modular Monolith

Use in-process events or a job queue before introducing Kafka or distributed messaging.

Example: ReservationCreated updates dashboard projections, queues email, and writes audit log.

### CQRS for dashboards only

Normal write path; optimized read path for dashboard summaries and reports.

### Microservices + DDD + Event-Driven

Powerful but expensive. Use only when team size, scaling pressure, and domain boundaries justify it.

## 6. Bad combinations / danger zones

### Microservices without DDD boundaries

This creates a distributed monolith where everything calls everything.

### Clean Architecture everywhere for CRUD

Too much ceremony for simple reads/writes.

### Event sourcing without audit need

Adds complexity when current state is enough.

### Shared DB across “microservices”

If services share and mutate the same database, they are not truly autonomous.

## 7. Pattern maturity ladder

```text
1. Monolith
   ↓
2. Layered monolith
   ↓
3. Modular monolith
   ↓
4. DDD-lite bounded contexts
   ↓
5. Add events for side effects
   ↓
6. Add CQRS/read models for dashboards
   ↓
7. Extract true microservices only when pressure exists
```

Most systems should stop at stages 3–6.

## 8. Applied to this project

The current repo appears closest to:

```text
Frontend:
React SPA
Feature/page components
Hooks as data gateway
Repository pattern for REST access

Backend:
Layered Express + Prisma app
Modular-ish folders
Provider adapter seams
Ingestion pipeline pattern

Deployment:
Monolith / modular monolith direction

Domain:
DDD-lite emerging
Reservations, properties, ingestion, integrations, tax export

Communication:
REST request-response
Batch/pipeline processing
Not fully event-driven

Data:
Shared PostgreSQL via Prisma
```

Best label:

Layered Modular Monolith with Repository/Adapter seams, DDD-lite domain boundaries, REST request-response, and batch/pipeline ingestion.

It is not microservices, not pure Clean Architecture, not event-sourced, not full CQRS, and not strict Hexagonal globally. Some adapter/port-like seams exist.

## 9. Recommended target pattern for this project

Recommended target:

```text
Primary: Modular Monolith
Internal: Layered + Vertical Slice by domain
Domain: DDD-lite bounded contexts
External systems: Hexagonal adapters
Async workflows: Event-driven/job queue where needed
Read side: CQRS-lite projections for dashboard/reporting only
DB: Shared PostgreSQL, module-owned tables by convention
```

Concrete direction:

```text
backend/src/
├── modules/
│   ├── reservations/
│   │   ├── routes.ts
│   │   ├── service.ts
│   │   ├── repository.ts
│   │   ├── dto.ts
│   │   └── events.ts
│   ├── properties/
│   ├── maintenance/
│   ├── ingestion/
│   └── tax-export/
├── integrations/
│   ├── google/
│   └── withone/
└── shared/
```

This preserves simplicity while improving boundaries.
