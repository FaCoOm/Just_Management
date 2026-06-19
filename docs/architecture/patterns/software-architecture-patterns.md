---
tags: [architecture, system-design, patterns]
---

# Software Architecture Patterns Analysis

## 1. What "System Design Architecture Pattern" Means

A **software architecture pattern** is a high-level structure for organizing a system. It defines:

- Where code lives
- How modules communicate
- Who owns data
- Where business rules live
- How deployment scales
- How changes are isolated
- How failure propagates

> [!NOTE]
> This differs from **code-level design patterns** such as Factory, Strategy, or Observer. Those operate inside classes/functions/modules. Architecture patterns operate at the **system or application structure** level.

---

## 2. Main Architecture Pattern Categories

### 2.1 Deployment / Runtime Topology Patterns

> *These answer: **how is the system deployed?***

#### Monolith

One deployable app. All features live in one codebase/runtime, often backed by one database.

**Examples:** Rails app, Django app, Express API, Laravel app.

| | |
|---|---|
| **Strengths** | Simple deployment · easy local development · straightforward transactions · fast early-stage delivery |
| **Weaknesses** | Can become tangled · scales all-or-nothing · weak boundaries become a big ball of mud |
| **Best for** | Early products, small/medium teams, and domains still changing |

#### Modular Monolith

One deployable app, internally split into **strong modules**.

**Example modules:** `Reservations`, `Guests`, `Billing`, `Ingestion`, `Reporting`.

Each module may own routes, services, domain logic, DTOs, and sometimes DB tables.

| | |
|---|---|
| **Strengths** | Monolith simplicity with microservice-like boundaries · easier future extraction |
| **Weaknesses** | Requires discipline · boundaries can rot if imports leak |
| **Best for** | Many serious SaaS and business systems (default recommendation) |

#### Microservices

Many independently deployable services, often with separate databases.

**Examples:** Auth Service, Booking Service, Billing Service, Notification Service.

| | |
|---|---|
| **Strengths** | Independent deploy/scaling · team autonomy · failure isolation |
| **Weaknesses** | Distributed systems complexity · network latency · consistency problems · observability burden · harder dev/prod parity |
| **Best for** | Large teams, clear bounded contexts, and independently scaling workloads |

#### Serverless / Function-Based

Each operation runs as a function triggered by HTTP, queue, cron, or event.

| | |
|---|---|
| **Strengths** | Pay-per-use · burst scaling · low ops burden |
| **Weaknesses** | Cold starts · vendor coupling · local development friction · orchestration complexity |
| **Best for** | Scheduled jobs, event handlers, lightweight APIs, and burst workloads |

---

### 2.2 Internal Code Organization Patterns

> *These answer: **how is code structured inside the app?***

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

| | |
|---|---|
| **Strengths** | Easy to understand · common · good fit for REST APIs and CRUD apps |
| **Weaknesses** | Business logic can leak into controllers · repositories can become thin wrappers · cross-domain workflows can get awkward |

#### Hexagonal Architecture / Ports and Adapters

Domain core is isolated from frameworks and infrastructure.

```text
REST Adapter → Port → Domain Core ← Port ← DB Adapter
```

A **port** is an interface the domain expects. An **adapter** is a concrete implementation for Express, Prisma, Stripe, Google, etc.

| | |
|---|---|
| **Strengths** | Testable · replaceable infrastructure · strong business isolation |
| **Weaknesses** | More files · more abstractions · overkill for simple CRUD |
| **Best for** | Complex business rules and external-provider-heavy systems |

#### Clean Architecture

Similar to Hexagonal, but with stricter dependency rings.

```text
Entities
  ↑
Use Cases
  ↑
Interface Adapters
  ↑
Frameworks / DB / UI
```

> [!IMPORTANT]
> **Rule:** Dependencies point **inward** — outer layers depend on inner layers, never the reverse.

| | |
|---|---|
| **Strengths** | Very testable · framework-agnostic · business rules independent |
| **Weaknesses** | Ceremony · can feel heavyweight · requires strict boundaries |
| **Best for** | Enterprise systems, mission-critical domains, and large teams |

#### MVC

**Model–View–Controller** separates data/model logic, UI/view rendering, and request/controller handling.

Common in Rails, Laravel, Django, ASP.NET MVC.

| | |
|---|---|
| **Strengths** | Productive · convention-heavy · good for server-rendered apps |
| **Weaknesses** | Fat models/controllers if unmanaged · less ideal for complex domains |

#### Feature-Based / Vertical Slice Architecture

Organize by **feature** instead of technical layer.

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

| | |
|---|---|
| **Strengths** | High cohesion · easier navigation · reduced cross-feature coupling |
| **Weaknesses** | Shared logic placement needs care · duplication can emerge without conventions |

---

### 2.3 Domain Modeling Patterns

> *These answer: **how does business logic map to real-world concepts?***

#### Domain-Driven Design (DDD)

Design around business domains and business language.

**Core concepts:** Domain, Subdomain, Bounded Context, Entity, Value Object, Aggregate, Repository, Domain Event, Ubiquitous Language.

**Hospitality examples:**
`Reservation` · `Guest` · `Property` · `Room` · `MaintenanceIssue` · `CheckInWorkflow` · `TaxExport` · `IngestRun`

**Possible bounded contexts:**
`Reservations` · `Property Operations` · `Ingestion` · `Tax Reporting` · `External Integrations`

| | |
|---|---|
| **Strengths** | Good for complex business logic · aligns code with real operations · reduces ambiguity |
| **Weaknesses** | Requires domain understanding · easy to over-model · less valuable for pure CRUD |

#### Anemic Domain Model

Entities are mostly data containers; services hold logic.

| | |
|---|---|
| **Strengths** | Simple · common with ORMs · works for CRUD |
| **Weaknesses** | Business rules can become scattered · invariants are harder to enforce |

#### Rich Domain Model

Entities contain behavior and invariants.

**Example methods:** `reservation.checkIn()`, `reservation.cancel()`, `reservation.canRefund()`

| | |
|---|---|
| **Strengths** | Rules stay close to data · stronger invariants |
| **Weaknesses** | ORM friction · can be awkward in JavaScript/TypeScript backends |

---

### 2.4 Communication / Integration Patterns

> *These answer: **how do parts talk?***

#### Request/Response

Synchronous communication: frontend calls REST API, API returns response.

**Examples:** REST, GraphQL, RPC, gRPC.

| | |
|---|---|
| **Strengths** | Simple mental model · easy debugging |
| **Weaknesses** | Caller waits · cascading failures possible |

#### Event-Driven Architecture

Modules publish events and consumers react.

```text
ReservationCreated
      ↓
SendEmail
UpdateOccupancy
SyncCalendar
CreateAuditLog
```

| | |
|---|---|
| **Strengths** | Decouples workflows · good for async side effects · independently scalable consumers |
| **Weaknesses** | Eventual consistency · harder debugging · idempotency required |
| **Best for** | Notifications, ingestion, audit logs, sync pipelines, and booking lifecycle side effects |

#### CQRS

**Separate write model from read model.**

- **Commands** mutate state.
- **Queries** read optimized projections.

**Examples:** `CreateReservationCommand`, `UpdateRoomStatusCommand`, `DashboardSummaryQuery`, `OccupancyReportQuery`

| | |
|---|---|
| **Strengths** | Optimized reads · cleaner complex workflows · good for dashboards/reporting |
| **Weaknesses** | More moving parts · projection consistency issues |

#### Event Sourcing

Store events as source of truth. Current state is rebuilt by replaying events.

**Examples:** `ReservationCreated`, `GuestCheckedIn`, `ReservationExtended`, `ReservationCancelled`

| | |
|---|---|
| **Strengths** | Full audit trail · time travel/debugging · strong history |
| **Weaknesses** | High complexity · schema evolution difficulty · projection/query burden |
| **Best for** | Finance ledgers, audit-critical systems, and workflow history. Usually overkill for standard dashboards |

---

### 2.5 Data Ownership Patterns

> *These answer: **who owns the data?***

#### Shared Database

Many modules/services use the same database.

| | |
|---|---|
| **Strengths** | Simple transactions · easy reporting |
| **Weaknesses** | Tight coupling · harder microservice extraction |

Common in monoliths and modular monoliths.

#### Database per Service

Each microservice owns its database.

| | |
|---|---|
| **Strengths** | Strong autonomy · clear ownership |
| **Weaknesses** | Distributed transactions are hard · reporting requires pipelines |

#### Read Model / Projection

Derived data optimized for reads.

**Example:** `reservations` table feeds `occupancy_daily_summary` table.

Good for dashboards, analytics, search, and exports.

---

## 3. Categorization Map

```text
Architecture Patterns
├── Deployment Topology
│   ├── Monolith
│   ├── Modular Monolith
│   ├── Microservices
│   └── Serverless
│
├── Internal Structure
│   ├── Layered
│   ├── Hexagonal
│   ├── Clean Architecture
│   ├── MVC
│   └── Vertical Slice
│
├── Domain Modeling
│   ├── DDD
│   ├── Anemic Domain Model
│   └── Rich Domain Model
│
├── Communication
│   ├── REST/RPC Request-Response
│   ├── Event-Driven
│   ├── CQRS
│   └── Event Sourcing
│
└── Data Ownership
    ├── Shared DB
    ├── DB per Service
    └── Read Projections
```

---

## 4. Can Architecture Patterns Be Combined?

**Yes.** They usually *should* be combined because they operate at different layers.

Example combination:

```text
Deployment:      Modular Monolith
Internal:        Layered + Vertical Slice
Domain:          DDD-lite Bounded Contexts
Communication:   REST sync + async events for side effects
Data:            Shared PostgreSQL + read projections
```

> [!NOTE]
> A system is rarely "just one pattern." Mixing complementary patterns from different categories is **normal and expected**.

---

## 5. Good Combinations

| Combination | Description |
|---|---|
| **Modular Monolith + Layered Architecture** | Common practical default. Each module follows `route → service → repository → database`. |
| **Modular Monolith + DDD-lite** | Use bounded contexts without excessive ceremony. Good contexts for this project: Reservations, Property Operations, Ingestion, Tax Export, Integrations. |
| **Hexagonal inside a Monolith** | Still one deployable, but external systems sit behind adapters. Excellent when the app integrates with Google Drive, WithOne, email, spreadsheets, payments, or other providers. |
| **Event-Driven inside a Modular Monolith** | Use in-process events or a job queue before introducing Kafka or distributed messaging. Example: `ReservationCreated` updates dashboard projections, queues email, and writes audit log. |
| **CQRS for Dashboards Only** | Normal write path; optimized read path for dashboard summaries and reports. |
| **Microservices + DDD + Event-Driven** | Powerful but expensive. Use only when team size, scaling pressure, and domain boundaries justify it. |

---

## 6. Bad Combinations / Danger Zones

> [!WARNING]
> These anti-patterns add complexity without proportional benefit. Avoid unless you have a specific, justified reason.

| Anti-Pattern | Why It's Dangerous |
|---|---|
| **Microservices without DDD boundaries** | Creates a distributed monolith where everything calls everything. |
| **Clean Architecture everywhere for CRUD** | Too much ceremony for simple reads/writes. |
| **Event sourcing without audit need** | Adds complexity when current state is enough. |
| **Shared DB across "microservices"** | If services share and mutate the same database, they are not truly autonomous. |

---

## 7. Pattern Maturity Ladder

```text
1. Monolith
   ↓
2. Layered Monolith
   ↓
3. Modular Monolith
   ↓
4. DDD-lite Bounded Contexts
   ↓
5. Add Events for Side Effects
   ↓
6. Add CQRS / Read Models for Dashboards
   ↓
7. Extract True Microservices Only When Pressure Exists
```

> [!TIP]
> **Most systems should stop at stages 3–6.** Extracting to microservices introduces significant distributed-systems overhead that only pays off at scale.

---

## 8. Applied to This Project

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
  Reservations, Properties, Ingestion, Integrations, Tax Export

Communication:
  REST request-response
  Batch/pipeline processing
  Not fully event-driven

Data:
  Shared PostgreSQL via Prisma
```

> [!IMPORTANT]
> **Best label:** Layered Modular Monolith with Repository/Adapter seams, DDD-lite domain boundaries, REST request-response, and batch/pipeline ingestion.

It is **not** microservices, not pure Clean Architecture, not event-sourced, not full CQRS, and not strict Hexagonal globally. Some adapter/port-like seams exist.

---

## 9. Recommended Target Pattern for This Project

> [!TIP]
> This is the recommended architectural target for the Just Management hospitality platform.

| Layer | Target Pattern |
|---|---|
| **Primary** | Modular Monolith |
| **Internal** | Layered + Vertical Slice by domain |
| **Domain** | DDD-lite bounded contexts |
| **External Systems** | Hexagonal adapters |
| **Async Workflows** | Event-driven / job queue where needed |
| **Read Side** | CQRS-lite projections for dashboard/reporting only |
| **Database** | Shared PostgreSQL, module-owned tables by convention |

### Concrete Directory Structure

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

> [!NOTE]
> This preserves simplicity while improving boundaries. It aligns with the project's current trajectory and avoids over-engineering.
