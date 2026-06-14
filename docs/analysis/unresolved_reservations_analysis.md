# Analysis Report: Causes for Reservations Failing to Sync to Database

This document details the root causes behind reservation sync failures (dead letters) based on database query diagnostics and ingestion logs.

---

## 📊 Summary of Dead Letters (Database Status)

The database's `sync_dead_letters` table contains records from both test suite runs and actual ingestion attempts. 

| Failure Code | Cause | Occurrences in DB | Source File Origin |
| :--- | :--- | :---: | :--- |
| **`MISSING_CONFIRMATION_CODE`** | The reservation row is missing a unique `Confirmation code`. | **22** | `backend/fixtures/Reservations-happy.csv` (Integration Test) |
| **`UNRESOLVED_LISTING`** | The reservation's listing title cannot be mapped to a single listing in the database. | **62** | Mixed (`Reservations-happy.csv` + user syncs) |
| **`AMBIGUOUS_LISTING_MATCH`** | The reservation's listing title matched multiple duplicate listings in the database. | **30** | Mixed |

---

## 🔍 Ingestion Simulation of `docs/database_design/reservations.csv`

To clarify how the production design file [reservations.csv](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/database_design/reservations.csv) behaves, we ran a simulated listing resolution pass. Out of the 30 reservation rows:

* **1 Row Resolved Successfully** (Row 9: Guest `Andrei Hapeyenka` successfully mapped to Room `04f48687-fee4-457e-bc8e-f15b718b0503`).
* **2 Rows Failed with `UNRESOLVED_LISTING`** (Row 2: `Quoc Le` & Row 3: `Zay Zaki` due to branding differences).
* **27 Rows Failed with `AMBIGUOUS_LISTING_MATCH`** (Due to duplicate listing titles in `channel_listings`).
* **0 Rows Failed with `MISSING_CONFIRMATION_CODE`** (All 30 records possess valid confirmation codes).

---

## 🔍 Detailed Root Causes & Concrete Examples

### 1. `UNRESOLVED_LISTING` (2 occurrences)
* **The Issue:** The reservation references a listing title that does not exactly match any existing `title` in `channel_listings` nor any `alias_value` in `channel_listing_aliases` under the target account.
* **Exemplification (Row 2 - Guest: Quoc Le):**
  * **Reservation Title:** `MUJO- Deluxe condo @District1 #BenThanh`
  * **Database Listings:** The built-in seed loaded this listing from [listing-account-classification.json](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/docs/database_design/listing-account-classification.json) where it was normalized and registered as `Latte Lounge - Deluxe condo @District1 #BenThanh`.
  * **The Result:** The resolver cannot find an exact match for the prefix `MUJO- Deluxe...` and because `channel_listing_aliases` contains **0** entries, resolution fails.

### 2. `AMBIGUOUS_LISTING_MATCH` (27 occurrences)
* **The Issue:** The reservation listing title exactly matches **multiple** records under the same external account (`airbnb-main`), making it impossible to determine the correct target room automatically.
* **Exemplification (Row 7 - Guest: Obi Ihej):**
  * **Reservation Title:** `Street view - Saigon busy life - balcony Studio`
  * **Database Listings:** There are **four** listings in the `channel_listings` table with this exact title under the `airbnb-main` account, each with different provider listing IDs:
    * ID: `3c58bd86-...` | Provider ID: `626377907415079569` (Owner: `ruby`)
    * ID: `84552986-...` | Provider ID: `1128539993344845174` (Owner: `mujo`)
    * ID: `0159ec4f-...` | Provider ID: `626377907415079600` (Owner: `mujo`)
    * ID: `6128c135-...` | Provider ID: `1128539993344845200` (Owner: `mujo`)
  * **The Result:** Because the query returns 4 matching listings under `airbnb-main`, the sync script aborts mapping to prevent assigning the reservation to the wrong room.

---

## 🛠️ Actionable Recommendations

1. **Seed Listing Aliases:** Map prefix variations in `channel_listing_aliases` to allow translation of branding differences.
2. **Deduplicate Listings:** Deduplicate title entries in `channel_listings` so that matches resolve uniquely to a single listing ID.
