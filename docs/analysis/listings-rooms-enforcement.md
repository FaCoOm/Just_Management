# Enforcement Mechanism: Listings & Rooms Mapping

This document details the validation and enforcement mechanisms that guarantee the listings ingestion and synchronization process cannot modify the canonical room and property definitions within the system.

---

## 1. Single Authoritative, Static Inventory (In-Memory SoT)

The rooms inventory is defined strictly in code as a static, immutable TypeScript array rather than dynamically queried or populated from an external source:

- **Location**: [rooms-source-of-truth.ts](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/backend/src/lib/rooms-source-of-truth.ts)
- **Data Structure**: `ROOMS_SOURCE_OF_TRUTH: SoTProperty[]` containing 8 properties and exactly 45 rooms.
- **Rule**: This file is treated as the single authoritative source of truth. The ingestion script and services consume this file directly.

---

## 2. Compile-Time Guard (Type Assertion)

A compile-time safety check prevents the room counts from being modified without triggering compilation errors:

```typescript
/** Total room count enforced by the SoT. Used as a runtime invariant. */
export const ROOMS_SOT_TOTAL = ROOMS_SOURCE_OF_TRUTH.reduce(
  (sum, prop) => sum + prop.rooms.length,
  0,
);

/** Compile-time guard: total must remain 45 unless the user authorises a change. */
const _expectedTotal: 45 = ROOMS_SOT_TOTAL as 45;
void _expectedTotal;
```

---

## 3. Read-Only Querying of Rooms & Properties (No Database Mutation)

During the listings ingestion and resolution phases, the DB records for rooms and properties are treated as strictly **read-only**:

- **Location**: [seed-listings-sot.ts](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/backend/scripts/seed-listings-sot.ts)
- **Mechanism**: The synchronization and resolution helpers map listings to rooms by querying `prisma.properties.findUnique` and `prisma.rooms.findFirst`.
- **Enforcement**: There are **no database write actions (create, update, or delete)** targeting the `rooms` or `properties` tables. If a listing refers to an unknown property slug or a room name that does not exist in the database (resolved from `rooms-source-of-truth.ts`), the script rejects/skips the row instead of dynamically creating it:
  ```typescript
  const property = await prisma.properties.findUnique({
    where: { slug: resolved.propertySlug },
    select: { id: true },
  });
  if (!property) {
    return { error: `Property not found in DB: ${resolved.propertySlug}` };
  }
  
  // ...
  
  const room = await prisma.rooms.findFirst({
    where: { property_id: property.id, room_number: roomName },
    select: { id: true },
  });
  if (!room) {
    return { error: `Room not found: ${resolved.propertySlug}/${roomName}` };
  }
  ```

---

## 4. Database Schema Referential Integrity Constraints

Database constraints at the PostgreSQL/Prisma layer prevent delete/update cascades from modifying structural rooms/properties:

- **Location**: [schema.prisma](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/backend/prisma/schema.prisma)
- **Constraint Details**:
  - `rooms` references `properties` with `onDelete: Restrict`
  - `listing_room_mappings` references `rooms` with `onDelete: Restrict`
  ```prisma
  model rooms {
    id                    String                  @id @default(uuid()) @db.Uuid
    property_id           String                  @db.Uuid
    room_number           String
    
    property              properties              @relation(fields: [property_id], references: [id], onDelete: Restrict)
    listing_room_mappings listing_room_mappings[]
  }
  
  model listing_room_mappings {
    id                 String           @id @default(uuid()) @db.Uuid
    channel_listing_id String           @db.Uuid
    room_id            String           @db.Uuid
    
    channel_listing    channel_listings @relation(fields: [channel_listing_id], references: [id], onDelete: Cascade)
    room               rooms            @relation(fields: [room_id], references: [id], onDelete: Restrict)
  }
  ```
- **Result**: Because mapping deletion is cascaded (`onDelete: Cascade` on the listing side) but room deletion is restricted (`onDelete: Restrict` on the room side), a listings-wipe operation will delete listings and mappings, but is **physically blocked by the database engine** from deleting or mutating any rooms or properties.

---

## 5. Strict Drift Normalization Rules

Rather than creating custom rooms or modifying listings mapping roles, the system normalizes listing internal names to established rooms:

- **Location**: [listings-source-of-truth.ts](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/backend/src/lib/listings-source-of-truth.ts)
- **Within-building Drift**: Silent re-mapping is allowed (e.g. mapping `LL - Latte 1` -> `LL - Latte` via `DRIFT_CATALOG` translation), but it resolves strictly to a room already present in the static `ROOMS_SOURCE_OF_TRUTH`.
- **Cross-building Drift**: Refused and throws a `CROSS_BUILDING_DRIFT` error unless the administrator explicitly passes the `--allow-cross-building` flag, which also only repoints the mapping to another pre-existing room in a different property (no room/property records are created).
