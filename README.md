# Track B: Azure/Node/Prisma Backend

This is the Sprint 1 Track B foundation -- an isolated worktree with a Node.js/Express backend using Prisma ORM on Azure PostgreSQL Flexible Server.

## Purpose

Track B provides a custom backend alternative to Track A's Supabase/BaaS approach. It mirrors the same balanced-core schema contract defined in `plans/Dual-Architecture PRD.md`.

**When Track B is fully deployed, the dashboard runs end-to-end on Azure PostgreSQL without any Supabase dependency.** The frontend repository layer abstracts the data source, switching between Track A (Supabase) and Track B (REST API) based on the `VITE_TRACK` env var.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    React Frontend (shared)                     │
│  VITE_TRACK=B → createRestRepositories() → fetch(/api/...) │
│  VITE_TRACK=A → createSupabaseRepositories() (default)       │
└──────────────────────────┬───────────────────────────────────┘
                           │ /api/*
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              Express Backend (backend/src/index.ts)            │
│  Prisma Client → PostgreSQL queries → JSON responses           │
└──────────────────────────┬───────────────────────────────────┘
                           │ Prisma Migrate
                           ▼
┌──────────────────────────────────────────────────────────────┐
│     Azure PostgreSQL Flexible Server                          │
│     backend/prisma/migrations/20260502000000_init_track_b/    │
│     migration.sql (15 tables, triggers, indexes, no RLS)      │
└──────────────────────────────────────────────────────────────┘
```

## Directory Layout

```text
track-b/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma              # 14-model schema (canonical for Azure)
│   │   └── migrations/
│   │       └── 20260502000000_init_track_b/
│   │           └── migration.sql       # Azure-ready DDL (no RLS)
│   ├── scripts/
│   │   └── verify-azure-migration.mjs  # Azure migration guard test
│   └── src/
│       └── index.ts                    # Express server + API endpoints
├── src/
│   ├── lib/repositories/
│   │   ├── types.ts                    # Branch-neutral repository interfaces
│   │   ├── supabase-repositories.ts    # Track A (Supabase) implementation
│   │   └── rest-repositories.ts        # Track B (REST API) implementation
│   ├── hooks/use-dashboard-data.ts     # Env-based factory selection
│   └── env.d.ts                        # TypeScript env var declarations
├── supabase/migrations/                # Schema-intent reference only (NOT deployed to Azure)
├── .env.example                        # Frontend env vars
└── README.md
```

## Schema

The Prisma migration at `backend/prisma/migrations/20260502000000_init_track_b/migration.sql` creates all 15 Track A v1 tables:

| Table | Purpose |
|---|---|
| `properties` | Portfolio branches |
| `rooms` | Physical inventory |
| `guests` | Legacy compatibility |
| `guest_requests` | Room requests |
| `maintenance_issues` | Maintenance queue |
| `channels` | Provider registry |
| `external_accounts` | Provider accounts |
| `channel_listings` | Listing identity |
| `channel_listing_aliases` | Title reconciliation |
| `listing_room_mappings` | Listing-to-room |
| `reservations` | Booking source of truth |
| `reservation_external_refs` | Provider refs |
| `reservation_room_allocations` | Multi-room allocation |
| `legacy_guest_reservation_backfills` | Guest migration bridge |
| `provider_reservation_import_rows` | CSV import staging |

The migration also creates:
- `pgcrypto` extension
- `set_updated_at_timestamp()` trigger function
- BEFORE UPDATE triggers on all 9 tables with `updated_at` columns

**No Supabase RLS.** The migration uses standard PostgreSQL. Auth/authorization is deferred to Sprint 2 (Clerk/Auth0 + middleware).

### supabase/migrations/ Are Reference-Only

The `supabase/migrations/` directory contains SQL files identical to Track A. They document schema intent but contain Supabase-only RLS policy syntax (`TO anon, authenticated`, `ENABLE ROW LEVEL SECURITY`) that **will fail on Azure PostgreSQL**.

**Do not apply these files to Azure.** They are for reading and understanding the business schema contract. The canonical Azure deployment path is `backend/prisma/migrations/`.

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env

# Edit .env with your Azure PostgreSQL connection string:
DATABASE_URL="postgresql://USER:PASSWORD@HOST.postgres.database.azure.com:5432/m_management?sslmode=require"

npx prisma generate
npm run db:validate
npm run db:verify:migration   # Confirms migration is Azure-safe (no RLS)
npm run db:deploy             # Creates all tables on Azure PostgreSQL
npm run dev                   # Starts Express on port 3001
```

### 2. Frontend

```bash
# From track-b root:
cp .env.example .env          # Already preset with VITE_TRACK=B
npm install
npm run dev                   # Starts Vite on port 5173
```

The `.env` file sets `VITE_TRACK=B`, which tells the repository layer to use `createRestRepositories()` calling the Express backend instead of Supabase. Vite's dev server proxies `/api/*` to `http://localhost:3001` (configured in `vite.config.ts`).

### 3. Verify

```bash
# Backend builds
cd backend && npm run build

# Frontend builds
cd .. && npm run typecheck && npm run build
```

Then open `http://localhost:5173`. The dashboard should load data from the Express backend → Azure PostgreSQL.

## API Endpoints

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| GET | `/health` | -- | Health check |
| GET | `/api/properties` | -- | All properties |
| GET | `/api/reservations` | `property_id`, `status`, `start_date`, `end_date` | Filtered reservations |
| GET | `/api/reservations/:id` | -- | Reservation + refs + allocations |
| GET | `/api/rooms` | `property_id` | Filtered rooms |
| GET | `/api/guest-requests` | `property_id`, `guest_id`, `reservation_id` | Filtered requests |
| GET | `/api/guests` | `property_id`, `room_id` | Legacy guest records |
| GET | `/api/maintenance` | `property_id`, `status` | Filtered maintenance |
| GET | `/api/channels` | -- | Channels with accounts |
| GET | `/api/external-accounts` | `channel_id` | Filtered accounts |

## Switching Between Track A and Track B

The repository layer in `src/lib/repositories/` abstracts the data source:

```typescript
// src/hooks/use-dashboard-data.ts
const repos = import.meta.env.VITE_TRACK === "B"
  ? createRestRepositories()    // Track B: calls Express backend
  : createSupabaseRepositories(); // Track A: calls Supabase directly
```

| Env Var | Value | Data Source |
|---|---|---|
| (unset) | default | Supabase (Track A) |
| `VITE_TRACK=A` | Track A | Supabase |
| `VITE_TRACK=B` | Track B | Express REST API |

## Environment Variables

### Frontend (`.env` at repo root)

| Variable | Track | Description |
|---|---|---|
| `VITE_TRACK` | Both | `"A"` or `"B"` (default: `"A"`) |
| `VITE_SUPABASE_URL` | A | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | A | Supabase anonymous key |
| `VITE_TRACK_B_API_URL` | B | Express backend URL (default: `http://localhost:3001`) |

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Azure PostgreSQL connection string |
| `PORT` | Server port (default: 3001) |

## Deferred to Sprint 2

- Authentication (Clerk/Auth0 + middleware)
- Real-time subscriptions (WebSocket/Socket.io)
- File uploads
- Full PMS lifecycle (stays, folios, room moves)
- Import/backfill routines (stored procedures from Track A's migration 7)