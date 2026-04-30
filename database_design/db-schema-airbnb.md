# Database Schema Design: Airbnb & Multi-Channel Integration

## 1. Objective
Extend the existing `Latte Lounge` PostgreSQL schema to support external channel distribution (specifically Airbnb), multi-brand property grouping, and complex unit-to-listing mappings.

## 2. Current Schema Overview
The current system (`supabase/migrations/20260409044835_create_portfolio_schema.sql`) handles internal operations:
- **`properties`**: Physical locations/branches.
- **`rooms`**: Internal inventory units.
- **`guests`**: Internal booking records.
- **`maintenance_issues` / `guest_requests`**: Operational tasks.

## 3. Data Analysis: `airbnb-listings-2026-04-08.csv`
Analysis of the 55 listings reveals several key patterns:
- **Brand Identifiers**: Listings use prefixes like `MH` (Minh's Home), `TC` (The Crest), `CC` (Cochinchine), `LL` (Latte Lounge), `TheO` (The Opera), and `23`.
- **Unit Mappings**: 
    - *Simple*: `MH - 05` maps to Room 05 at Minh's Home.
    - *Composite*: `LL - Milk 2 & Coffee 2` maps to two physical rooms.
    - *Dynamic names*: `MH - Lotus` vs `MH - 01`.
- **External Metadata**: Includes Airbnb ID, Public URL, Status (`Listed`, `In progress`), and extraction timestamps.

## 4. Proposed Schema Extensions

### 4.1. Brands Table
Normalizes the property grouping.
```sql
CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  created_at timestamptz DEFAULT now()
);
```

### 4.2. Enhanced Properties
Linking properties to brands and adding location granularity.
```sql
ALTER TABLE properties 
ADD COLUMN brand_id uuid REFERENCES brands(id),
ADD COLUMN address text,
ADD COLUMN district text,
ADD COLUMN city text DEFAULT 'Ho Chi Minh City';
```

### 4.3. Channel Listings Table
Stores platform-specific data. This separates "What we sell on Airbnb" from "What we own internally".
```sql
CREATE TABLE channel_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'Airbnb',
  external_id text UNIQUE NOT NULL, -- The Airbnb ID
  property_id uuid NOT NULL REFERENCES properties(id),
  title text NOT NULL,
  internal_name text,
  public_url text,
  host_url text,
  status text NOT NULL DEFAULT 'Listed',
  last_sync_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

### 4.4. Listing-to-Room Mapping (Many-to-Many)
Handles composite listings where one Airbnb listing blocks multiple internal rooms.
```sql
CREATE TABLE listing_room_mapping (
  listing_id uuid REFERENCES channel_listings(id) ON DELETE CASCADE,
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  PRIMARY KEY (listing_id, room_id)
);
```

## 5. Implementation Roadmap

### Phase 1: Migration (`supabase/migrations/`)
Create a new migration file `20260430000000_airbnb_integration.sql`:
1. Define new tables (`brands`, `channel_listings`, `listing_room_mapping`).
2. Add RLS (Row Level Security) policies for public read and authenticated write.
3. Update existing `properties` table structure.

### Phase 2: Data Normalization & Seeding
1. **Initialize Brands**: Insert records for 'Minh''s Home', 'The Crest', etc.
2. **Backfill Properties**: Assign `brand_id` to existing property records.
3. **Import Listings**: Script or manual SQL to parse the CSV and populate `channel_listings`.
4. **Create Mappings**: Identify which `rooms.room_number` correlates to which `channel_listings.internal_name`.

### Phase 3: Frontend Type Updates
Update `src/types/database.ts` to include:
- `Brand` interface.
- `ChannelListing` interface.
- Updated `Property` interface.

## 6. Business Value
- **Inventory Sync**: Prevent overbooking by knowing exactly which physical rooms are tied to which Airbnb listing.
- **Brand Analytics**: Group revenue and occupancy metrics by Brand (e.g., How is "Cochinchine" performing vs "Latte Lounge"?).
- **Direct Navigation**: Allow staff to jump directly to the Airbnb Host Editor from the internal dashboard.
