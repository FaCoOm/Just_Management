---
tags: [architecture, system-design, patterns, comparison]
---

# Software Architecture Patterns Categories and Combinations

## Core Idea

Architecture pattern categories differ by **which design question they answer**.

A single system can use many patterns at once because different categories operate at different layers:

```text
Deployment pattern answers: how many deployables?
Code-structure pattern answers: how code is organized inside each deployable?
Domain pattern answers: how business concepts are modeled?
Communication pattern answers: how parts talk?
Data pattern answers: who owns/persists data?
```

They are not mutually exclusive.

## 1. Category Differences

| Category | Main question | Example patterns | Scope |
|---|---|---|---|
| Deployment / topology | How is the system deployed? | Monolith, Modular Monolith, Microservices, Serverless | Whole system runtime |
| Internal code organization | How is code structured inside an app/service? | Layered, MVC, Clean Architecture, Hexagonal, Vertical Slice | One app/service/codebase |
| Domain modeling | How are business concepts represented? | DDD, Aggregates, Entities, Value Objects, Domain Events | Business logic |
| Communication / integration | How do components talk? | REST, RPC, GraphQL, Event-Driven, Pub/Sub, CQRS | Runtime interaction |
| Data ownership | Who owns data and consistency? | Shared DB, DB-per-service, Event Store, Read Projections | Persistence layer |

## 2. Deployment / Topology Patterns

### Monolith

One deployable app.

```text
Frontend/API/Auth/Billing/Admin
              ↓
          one backend
              ↓
           one DB
```

Good when team is small, product changes fast, transactions are simple, and delivery speed matters more than distributed scaling.

### Modular Monolith

Still one deployable, but internally split by modules.

```text
Single backend deployable
├── accounts
├── payments
├── reservations
├── notifications
└── reporting
```

Good when you want strong boundaries without microservice overhead.

### Microservices / SOA

Many independently deployable services.

```text
User Service       → user DB
Reservation Svc    → reservation DB
Payment Service    → payment DB
Notification Svc   → notification DB
```

Good when teams are large, domains are clear, and services need independent scaling and deploys.

### Serverless

Functions triggered by HTTP, queue, cron, or event.

Good for scheduled jobs, async handlers, and bursty workloads.

## 3. Internal Code Organization Patterns

### Layered Architecture

```text
Route / Controller
      ↓
Service
      ↓
Repository
      ↓
Database
```

Good for CRUD APIs, dashboards, and ordinary business apps.

### MVC

Model–View–Controller separates data, rendering, and request handling.

Common in Rails, Laravel, Django, ASP.NET MVC.

### Hexagonal / Ports and Adapters

Business core in the center; external systems are adapters.

```text
REST Adapter → Port → Domain Core ← Port ← DB Adapter
```

Good when the domain must be insulated from frameworks and providers.

### Clean Architecture

Stricter ring-based dependency rule: outer layers depend inward only.

Good for enterprise systems and mission-critical business logic.

### Vertical Slice / Feature-Based

Organize by feature rather than layer.

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

Good for feature ownership and navigation.

## 4. Domain Modeling Patterns

### DDD

Design around business language and bounded contexts.

Examples:

- Bank: `Account`, `LedgerEntry`, `Transfer`, `FraudCase`
- Airbnb: `Guest`, `Host`, `Listing`, `Reservation`, `Payout`
- Spotify: `User`, `Playlist`, `Track`, `PlaybackSession`

DDD can live inside a monolith, modular monolith, or microservices.

### Anemic Domain Model

Entities are mostly data containers; services hold logic.

### Rich Domain Model

Entities contain behavior and invariants.

Example:

```text
reservation.checkIn()
reservation.cancel()
reservation.canRefund()
```

## 5. Communication / Integration Patterns

### Request/Response

Synchronous communication: client calls API and waits for response.

### Event-Driven Architecture

```text
ReservationCreated
      ↓
SendEmail
UpdateOccupancy
SyncCalendar
CreateAuditLog
```

Good for async side effects, decoupling, and pipelines.

### CQRS

Separate write model from read model.

- Commands mutate state.
- Queries read optimized projections.

### Event Sourcing

Store events as the source of truth and rebuild state by replaying them.

Best for finance ledgers, audit-critical systems, and workflow history.

## 6. Data Ownership Patterns

### Shared Database

Many modules/services use the same DB.

Good for monoliths and modular monoliths.

### Database per Service

Each microservice owns its own DB.

Good for autonomy, but reporting and transactions become harder.

### Read Projections

Derived data optimized for reads.

Good for dashboards, analytics, search, and exports.

## 7. Can Different Patterns Be Combined?

**Yes.** They usually should be combined because they operate at different layers.

Example combination:

```text
Deployment:      Modular Monolith
Internal:        Layered + Vertical Slice
Domain:          DDD-lite Bounded Contexts
Communication:   REST sync + async events for side effects
Data:            Shared PostgreSQL + read projections
```

A system is rarely just one pattern. Mixing complementary patterns is normal.

## 8. Good Combinations

| Combination | Description |
|---|---|
| Modular Monolith + Layered Architecture | Common practical default. Each module follows route → service → repository → database. |
| Modular Monolith + DDD-lite | Use bounded contexts without excessive ceremony. |
| Hexagonal inside a Monolith | External systems sit behind adapters while staying in one deployable. |
| Event-Driven inside a Modular Monolith | Use in-process events or a job queue before Kafka/distributed messaging. |
| CQRS for Dashboards Only | Normal write path; optimized read path for summaries and reports. |
| Microservices + DDD + Event-Driven | Powerful but expensive; use only when scale and team structure justify it. |

## 9. Bad Combinations / Danger Zones

| Anti-Pattern | Why It's Dangerous |
|---|---|
| Microservices without DDD boundaries | Creates a distributed monolith. |
| Clean Architecture everywhere for CRUD | Too much ceremony for simple reads/writes. |
| Event sourcing without audit need | Adds complexity when current state is enough. |
| Shared DB across microservices | Services are not truly autonomous. |

## 10. Familiar-System Examples

### Spotify

Public engineering posts show strong use of microservices and event delivery / Pub/Sub style systems.

Illustrative flow:

```text
User plays song
   ↓ request/response
Playback service validates playback
   ↓ event
PlaybackStarted event
   ↓
Analytics pipeline
Recommendation features
Royalty/reporting systems
```

Likely pattern mix: microservices, event-driven, request/response, data pipelines, read projections.

### Airbnb

Public engineering posts describe a move from monolithic Rails toward SOA/service-oriented development.

Illustrative flow:

```text
Guest books stay
   ↓
Reservation service creates reservation
   ↓
Payment service authorizes payment
   ↓ event
Host notification sent
Calendar synced
Trust/safety updated
Analytics recorded
```

Likely pattern mix: service-oriented architecture, DDD-style bounded contexts, RPC/request-response, async events.

### Bank / Fintech

Banks often mix multiple patterns because different subsystems need different guarantees.

Illustrative flow:

```text
Mobile app → Transfer API
   ↓
Transfer use case validates rules
   ↓
Ledger aggregate records debit/credit
   ↓
Transaction committed
   ↓
Outbox event published
   ↓
Fraud service consumes event
Notification service consumes event
Statement projection updates
```

Likely pattern mix: Clean/Hexagonal for critical services, DDD aggregates, CQRS for statements, event sourcing for ledger history, event-driven for fraud/notifications.

## 11. How Patterns Are Combined

1. Choose deployment topology.
2. Choose internal structure.
3. Choose domain boundaries.
4. Choose communication style.
5. Choose data ownership.

Example:

```text
System deployment: Microservices
Inside each service: Hexagonal Architecture
Business modeling: DDD aggregates/entities/value objects
Communication: REST for user-facing requests, events for async side effects
Data: Database per service, plus read projections for dashboards
```

## 12. Why Combine Patterns?

- Different subsystems have different needs.
- Different team boundaries need different ownership models.
- Different workloads need different scaling and consistency guarantees.
- Different operations need different latency, audit, and failure-handling behaviors.

## 13. Short Rule of Thumb

Do not ask: "Which one pattern should we use?"

Ask: **Which pattern fits each layer of this system?**
