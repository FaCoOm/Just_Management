# Track B: Azure/Node/Prisma Backend

This is the Sprint 1 Track B foundation - an isolated worktree with a Node.js/Express backend using Prisma as the ORM.

## Purpose

Track B provides a custom backend alternative to Track A's Supabase/BaaS approach. It mirrors the same balanced-core schema contract defined in `plans/Dual-Architecture PRD.md`.

## Schema Parity

The Prisma schema in `prisma/schema.prisma` mirrors:
- All v1 tables from `supabase/migrations/` (Track A)
- Same column names, types, relations, and indexes
- Provider edge tables: `channels`, `external_accounts`, `channel_listings`
- Reservation core: `reservations`, `reservation_external_refs`, `reservation_room_allocations`
- Operational tables: `guest_requests`, `maintenance_issues`

## Setup

```bash
cd backend
npm install
cp .env.example .env  # Edit DATABASE_URL for Azure PostgreSQL
npx prisma generate
npm run db:validate
npm run db:verify:migration
npm run db:deploy   # Creates tables from Prisma migrations
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /api/properties | List all properties |
| GET | /api/reservations | List reservations (filter by property_id, status, date range) |
| GET | /api/reservations/:id | Get reservation with refs and allocations |
| GET | /api/rooms | List rooms (filter by property_id) |
| GET | /api/maintenance | List maintenance issues (filter by property_id, status) |
| GET | /api/channels | List channels with accounts |
| GET | /api/external-accounts | List external accounts (filter by channel_id) |

## Repository Contract

Track B must satisfy the same repository interface as Track A. The frontend repository layer in `src/lib/repositories/` defines the contract:

```typescript
// src/lib/repositories/types.ts - shared interface
interface ReservationRepository {
  getAll(): Promise<Reservation[]>;
  getById(id: string): Promise<Reservation | null>;
  getByPropertyId(propertyId: string): Promise<Reservation[]>;
  getByDateRange(startDate: string, endDate: string): Promise<Reservation[]>;
  getByStatus(statuses: ReservationStatus[]): Promise<Reservation[]>;
}
```

Track B REST API must return responses compatible with these method signatures.

## Deferred to Sprint 2

- Authentication (Clerk/Auth0 integration)
- Real-time subscriptions
- File uploads
- Full PMS lifecycle (stays, folios, room moves)

## Branch Strategy

- Main branch (Track A): Supabase-first, direct DB access
- Track B worktree: Custom backend, Prisma ORM, REST API

## Environment Variables

See `.env.example` for required configuration.