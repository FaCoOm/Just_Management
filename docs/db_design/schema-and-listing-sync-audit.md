# Schema & Listing Sync Audit

> Investigation complete — no code changed.

---

## 1. Schema Concern: Current Migration Targets `public`, Not `m_management`

### Evidence

| Item | Location |
|------|----------|
| Prisma datasource only sets PostgreSQL URL, no multi-schema config | `backend/prisma/schema.prisma:9–12` |
| No `schemas = ["m_management"]` on the datasource | — |
| No `@@schema("m_management")` on models | — |
| Initial migration explicitly creates `public` | `backend/prisma/migrations/20260502000000_init_track_b/migration.sql:15–19` |
| `properties` table created as unqualified | `migration.sql:18–29` |
| `channel_listings` table created as unqualified | `migration.sql:122–142` |

### Meaning

- Database name in README is `m_management` (`README.md:105`).
- Inside that database, tables are created in PostgreSQL schema `public`.
- If the intended target is **database** `m_management` — current setup is acceptable.
- If the intended target is **PostgreSQL schema** `m_management` — current setup is wrong / incomplete.

**Current state:** database `m_management`, schema `public`.

---

## 2. Will the Program Function as Intended?

Mostly yes for the current Track B dashboard read path, assuming the DB contains expected data.

### Evidence

| Component | Detail | Location |
|-----------|--------|----------|
| Backend read endpoints | properties | `backend/src/index.ts:106–109` |
| | reservations list | `backend/src/index.ts:115–167` |
| | occupancy stats | `backend/src/index.ts:169–265` |
| | rooms | `backend/src/index.ts:283–288` |
| | maintenance | `backend/src/index.ts:294–304` |
| | guest requests | `backend/src/index.ts:326–337` |
| Frontend repository | REST-only Track B exports | `src/lib/repositories/index.ts:5–6` |
| | REST base API URL | `src/lib/repositories/rest-repositories.ts:21–24` |
| Dashboard hook | Always uses `createRestRepositories()` | `src/hooks/use-dashboard-data.ts:109–111` |
| Dashboard queries | properties, rooms, reservations, guest requests, maintenance, arrivals, departures | `src/hooks/use-dashboard-data.ts:111–142` |

### Risk

- README still claims an env-based Track A/Track B switch exists, but the current code does **not** implement that switch — it always uses REST:
  - README claim: `README.md:158–160`
  - Actual behavior: `src/hooks/use-dashboard-data.ts:109–111`

**Verdict:** Track B path can work, but README is stale about switching.

---

## 3. Listing Update + Sync Mechanism

Current program has **listing ingestion/sync**, not full live OTA sync.

### Existing Listing Sync Mechanism

**Ingestion routes registered:**

| Route | Location |
|-------|----------|
| Route registration | `backend/src/index.ts:48` |
| `POST /api/ingest/listings` | `backend/src/ingest/routes.ts:194–219` |
| `POST /api/ingest/reservations` | `backend/src/ingest/routes.ts:221–245` |
| `POST /api/ingest/google-sheets` | `backend/src/ingest/routes.ts:247–270` |

**Sync behavior:**

| Step | Function | Location |
|------|----------|----------|
| Parse uploaded CSV/XLSX | `parseSourceFile()` | `backend/src/ingest/normalizer.ts:102–111` |
| Extract listing rows | `extractListings()` | `backend/src/ingest/normalizer.ts:113–130` |
| Upsert channels | — | `backend/src/ingest/services/listings.ts:49–75` |
| Upsert properties | — | `backend/src/ingest/services/listings.ts:97–106` |
| Create rooms if missing | — | `backend/src/ingest/services/listings.ts:108–121` |
| Upsert channel listings | — | `backend/src/ingest/services/listings.ts:125–160` |
| Create listing-room mapping | — | `backend/src/ingest/services/listings.ts:162–174` |
| Record sync run (start) | — | `backend/src/ingest/services/listings.ts:30–43` |
| Record sync run (complete) | — | `backend/src/ingest/services/listings.ts:248–260` |
| Write failed rows to dead letters | — | `backend/src/ingest/services/listings.ts:242–246` |

### Reservation Sync Depends on Listing Sync

Reservation sync resolves reservations to listings/rooms via aliases or exact listing title:

| Step | Location |
|------|----------|
| Alias lookup | `backend/src/ingest/services/reservations.ts:95–119` |
| Exact listing lookup | `backend/src/ingest/services/reservations.ts:120–140` |
| Unresolved listing → dead letter | `backend/src/ingest/services/reservations.ts:143–153` |
| Existing reservation lookup by external ref | `backend/src/ingest/services/reservations.ts:183–190` |
| Reservation update | `backend/src/ingest/services/reservations.ts:202–220` |
| New reservation create path | `backend/src/ingest/services/reservations.ts:257–300` |

---

## 4. Does Listing Sync Update Dashboard and DB?

| Layer | Updates? | Notes |
|-------|----------|-------|
| DB | **Yes** | If `dryRun=false` |
| Dashboard | **Yes, after refetch** | Not real-time |

### Evidence

| Action | Location |
|--------|----------|
| Listing ingest writes DB tables via Prisma transaction | `backend/src/ingest/services/listings.ts:94–225` |
| Reservation ingest writes reservation tables used by dashboard | `backend/src/ingest/services/reservations.ts:202–300` |
| Dashboard reads reservations/rooms/properties from REST endpoints | `src/hooks/use-dashboard-data.ts:113–140` |
| React Query config has `staleTime: 60_000`, no polling | `src/lib/query-client.ts:3–13` |

### Meaning

- After listing/reservation ingestion, the DB updates immediately.
- The dashboard updates only when queries invalidate, refetch, remount, or a manual refresh happens.
- No WebSocket/SSE push.
- No `refetchInterval` polling.
- No frontend mutation / invalidation flow observed.
- No listing management UI observed in repository contracts.

---

## 5. What Is Missing / Weak

### Missing Live OTA Sync

**Current sync sources:**

- Multipart file upload
- Google Sheets readonly import

**Evidence:**

| Item | Location |
|------|----------|
| Google Sheets readonly scope | `backend/src/ingest/services/sheets.ts:34–37` |
| Google Sheets routes to listing/reservation sync | `backend/src/ingest/services/sheets.ts:75–101` |

**No evidence of:**

- Airbnb API client
- Booking.com API client
- Scheduled job / cron worker
- Background queue
- Webhook receiver
- Push from provider into DB

### Missing Listing Read/Update API

Backend has `/api/channels` and `/api/external-accounts`, but **no** `/api/listings` GET/PATCH/PUT/DELETE.

**Evidence:**

| Item | Location |
|------|----------|
| Channels/external accounts read only | `backend/src/index.ts:306–320` |
| Ingest POST endpoints | `backend/src/ingest/routes.ts:194–270` |

### Schema Placement Mismatch Risk

If production already has tables in `public`, moving to `m_management` schema requires a migration plan — not just editing Prisma.

**Need to decide intended meaning:**

1. **Database name `m_management`** — current setup is acceptable.
2. **PostgreSQL schema `m_management`** — current setup needs schema migration + Prisma multi-schema config.

---

## Bottom Line

- Current code stores tables in **`public` schema** inside the DB, not a PostgreSQL schema named `m_management`.
- Current program has **batch listing/reservation ingestion sync** through file upload and Google Sheets.
- Current program does **not** have full automated/live provider sync.
- Dashboard sync is **read/refetch-based**, not real-time.
- Listing info can update the DB via `POST /api/ingest/listings` with `dryRun=false`; the dashboard indirectly reflects those effects once reservations/rooms are refetched.
- No listing CRUD API or listing dashboard UI is currently visible.
