# Analysis & Execution: Surplus and Duplicate Rooms in Database ("The Crest" & "CC")

This document details why certain surplus rooms (e.g., `8.05` / `C 8.05` in "The Crest" and `303 (301 cu)` in "CC") exist in the current database, and how the system is designed to merge and delete them.

---

## 1. Why do both `8.05` and `C 8.05` exist?

### The Cause
Historically, prior to enforcing the [rooms-source-of-truth.ts](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/backend/src/lib/rooms-source-of-truth.ts) logic:
- Ingestion scripts or manual database seeds imported raw listings directly without strict normalization.
- A listing from the provider with the internal name part `8.05` caused a room with the literal name `8.05` to be created or seeded in the database.
- A separate listing or standard definition caused `C 8.05` to be created.
- In the clean, canonical Rooms Source of Truth (`ROOMS_SOURCE_OF_TRUTH` in code), only `C 8.05` is valid. `8.05` is considered **surplus (drifted) data** that should not be a separate physical entity.

---

## 2. Why does `303 (301 cu)` exist?

### The Cause
Similarly, under the property `cc`:
- A legacy record with `303 (301 cu)` (and its UTF-8 encoding variant `303 (301 c&Atilde;&ordm;)`) was created in the database.
- In the canonical Rooms Source of Truth, the room is simply `303`. The extra label text `(301 cu)` is a legacy description/comment that drifted into the room number field in the database.

---

## 3. The Resolution Mechanism: `merge-surplus-rooms.ts`

To clean up these database-level duplicates and align the database with the strict in-memory source of truth, a dedicated cleanup script is provided:

- **Script Location**: [merge-surplus-rooms.ts](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/backend/scripts/merge-surplus-rooms.ts)
- **Configuration**:
  ```typescript
  const SURPLUS_ROOM_SPECS: SurplusRoomSpec[] = [
    {
      kind: "merge",
      surplusPropertySlug: "tc",
      surplusRoomNumber: "8.05",
      canonicalPropertySlug: "tc",
      canonicalRoomNumber: "C 8.05",
    },
    {
      kind: "merge",
      surplusPropertySlug: "tc",
      surplusRoomNumber: "C12.02",
      canonicalPropertySlug: "tc",
      canonicalRoomNumber: "C 12.02",
    },
    {
      kind: "merge",
      surplusPropertySlug: "cc",
      surplusRoomNumber: "303 (301 cu)",
      canonicalPropertySlug: "cc",
      canonicalRoomNumber: "303",
    },
    // ...
  ];
  ```

### How the Script Works (in `--apply` mode)
1. **Find Room Rows**: Locates the database record of the surplus room (e.g. `8.05`) and the canonical room (e.g. `C 8.05`).
2. **Reassign References**: Updates foreign keys in all referencing tables so they point to the canonical room instead of the surplus room:
   - `listing_room_mappings`
   - `reservation_room_allocations`
   - `reservations.primary_room_id`
3. **Delete Surplus Room**: Deletes the surplus room record from the database table `rooms`.

---

## 4. Execution Details & Results (2026-06-13)

The script was executed successfully in `--apply` mode:

```powershell
$env:JM_ROOMS_SOT_AZURE_OK="1"; npm run merge:surplus-rooms -- --apply
```

### execution output:
```text
  [SKIP]  Surplus room tc / "C12.02" not found in DB; skipping.
  [SKIP]  Surplus room ll / "coffee 3" not found in DB; skipping.
  [SKIP]  Surplus room ll / "Latte 1" not found in DB; skipping.
  [SKIP]  Surplus room theo / "B20.12A Main" not found in DB; skipping.
  [SKIP]  Surplus room cc / "303 (301 cÅ©)" not found in DB; skipping.
  [SKIP]  Surplus room ta / "The Alley 1" not found in DB; skipping.
  [SKIP]  Surplus room ll / "C2-M2" not found in DB; skipping.

Merge surplus rooms
  Mode: APPLY
  Configured surplus rooms: 9
  Planned surplus rooms: 2
  Merge targets: 2
  Delete-only targets: 0

=== Planned room actions ===
  MERGE   tc / "8.05"  id=85461c6d-9bfb-4bb6-b502-d308a039f2f0  ->  tc / "C 8.05"  id=d70f6e8f-0a71-43e1-bea9-581679ff08ca
          refs  listing_room_mappings=0  reservation_room_allocations=1  reservations.primary_room_id=1
  MERGE   cc / "303 (301 cu)"  id=96934c2c-4fc2-44db-9597-e6b4c97e716e  ->  cc / "303"  id=c2af2e09-8c8a-4d7b-a7d7-1b881b432a16
          refs  listing_room_mappings=0  reservation_room_allocations=0  reservations.primary_room_id=0

Apply complete.
```

### Verified Post-State in database:
- **"The Crest" (tc)** has only `C 8.05` and `C 12.02` present. `8.05` was successfully merged (transferring its reservations & allocations) and deleted.
- **"CC" (cc)** has only `301`, `303`, `401`, `403`, `302`, `404`, `402`, and `304` present. `303 (301 cu)` was successfully merged and deleted.
