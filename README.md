# Just Management: Current REST/Prisma/Azure Runtime

Hospitality operations dashboard for eight Vietnamese properties. The current runtime is no longer a switchable Track A/Track B split: the frontend uses REST repositories, the backend is Express + Prisma, and the database target is Azure PostgreSQL Flexible Server.

Historical Supabase SQL remains reference-only schema context. It is not an active frontend runtime and must not be deployed to Azure.

## Architecture

```text
React Frontend (frontend/)
  -> repository layer: createRestRepositories()
  -> /api/*
  -> Express Backend (backend/src/index.ts)
  -> Prisma Client
  -> Azure PostgreSQL Flexible Server
```

Local Vite development proxies `/api/*` to `http://localhost:3001`. Production can use same-origin API calls or set `VITE_TRACK_B_API_URL` when frontend and backend are hosted on separate origins.

## Directory Layout

```text
Just_Management/
├── frontend/                  # React 19 + Vite 7 app
│   └── src/lib/repositories/   # REST repository contracts + implementation
├── backend/                   # Express API, Prisma access, ingestion, integrations
│   ├── prisma/
│   │   ├── schema.prisma       # Canonical Azure PostgreSQL schema
│   │   └── migrations/         # Azure-safe Prisma migration history
│   ├── scripts/                # DB and ingestion verification scripts
│   └── src/                    # API routes and services
├── docs/                       # Current docs plus historical plans/reports
├── supabase/migrations/        # Reference-only schema-intent SQL
├── .env.example                # Root frontend env template
└── README.md
```

## Schema

The canonical database schema is `backend/prisma/schema.prisma`; deployable SQL lives under `backend/prisma/migrations/`.

Core tables include:

| Table | Purpose |
|---|---|
| `properties` | Portfolio branches |
| `rooms` | Physical inventory |
| `reservations` | Booking source of truth |
| `guests` | Legacy compatibility view/table |
| `guest_requests` | Room requests and lifecycle tracking |
| `maintenance_issues` | Maintenance queue |
| `channels` | Provider registry |
| `external_accounts` | Provider accounts |
| `channel_listings` | Listing identity |
| `listing_room_mappings` | Listing-to-room mapping |
| `reservation_external_refs` | Provider reservation refs |
| `reservation_room_allocations` | Multi-room allocation |
| `provider_reservation_import_rows` | CSV/import staging |

The migration history uses standard PostgreSQL features such as `pgcrypto` and `set_updated_at_timestamp()`. It intentionally avoids Supabase RLS roles/policies.

## Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env

# Edit backend/.env with Azure PostgreSQL:
DATABASE_URL="postgresql://USER:PASSWORD@HOST.postgres.database.azure.com:5432/m_management?sslmode=require"

npm run db:generate
npm run db:validate
npm run db:verify:migration
npm run db:deploy
npm run dev
```

### Frontend

```bash
# From repo root:
cp .env.example .env
npm install
npm run dev
```

The frontend uses `createRestRepositories()` directly. Leave `VITE_TRACK_B_API_URL` empty for same-origin/proxied API calls, or set it to the deployed backend origin when needed.

## Verify

```bash
# Backend
cd backend && npm run build

# Frontend
cd ../frontend && npm run typecheck && npm run build
```

Then open `http://localhost:5173`. The dashboard should load through the Express API and Azure PostgreSQL-backed Prisma layer.

## API Endpoints

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| GET | `/health` | - | Health check |
| GET | `/api/properties` | - | All properties |
| GET | `/api/reservations` | `property_id`, `status`, `start_date`, `end_date` | Filtered reservations |
| GET | `/api/reservations/:id` | - | Reservation + refs + allocations |
| GET | `/api/rooms` | `property_id` | Filtered rooms |
| PATCH | `/api/rooms/:id/status` | - | Room status update |
| GET | `/api/guest-requests` | `property_id`, `guest_id`, `reservation_id` | Filtered requests |
| GET | `/api/guests` | `property_id`, `room_id` | Legacy guest records |
| GET | `/api/maintenance` | `property_id`, `status` | Filtered maintenance |
| GET | `/api/channels` | - | Channels with accounts |
| GET | `/api/external-accounts` | `channel_id` | Filtered accounts |
| GET | `/api/integrations/status` | - | WithOne integration status |
| POST | `/api/ingest/reservations` | - | Reservation import |
| GET | `/api/tax-export/*` | varies | Tax export preview/run/download |

## Environment Variables

### Frontend (`.env` at repo root)

| Variable | Description |
|---|---|
| `VITE_TRACK_B_API_URL` | Optional Express backend origin. Empty means same-origin/proxied API calls. |
| `VITE_ONE_AUTH_TOKEN_URL` | Backend route for WithOne Connect AuthKit tokens. |

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Azure PostgreSQL connection string |
| `PORT` | Server port, default `3001` |
| `ALLOWED_ORIGINS` | Optional comma-separated CORS allowlist |
| `ONE_CONNECTION_KEY` | WithOne connection key |
| `ONE_SECRET_KEY` | WithOne secret key |
| `ONE_WEBHOOK_SECRET` | WithOne webhook secret |

## Historical Notes

- Earlier plans used “Track A” for direct Supabase and “Track B” for REST/Prisma/Azure.
- The active app is now the REST/Prisma/Azure runtime.
- `supabase/migrations/` remains schema-intent reference material only.
- Do not reintroduce Supabase frontend adapters or `VITE_TRACK=A` branches without an explicit architecture decision.
