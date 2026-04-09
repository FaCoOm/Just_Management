/*
  # Create Portfolio Dashboard Schema

  1. New Tables
    - `properties` - Portfolio branches (8 properties)
      - `id` (uuid, primary key)
      - `name` (text) - Property display name
      - `slug` (text, unique) - URL-friendly identifier
      - `total_rooms` (integer) - Total room count
      - `location` (text) - City/area
      - `status` (text) - active/inactive
      - `created_at` (timestamptz)

    - `rooms` - Individual rooms per property
      - `id` (uuid, primary key)
      - `property_id` (uuid, FK to properties)
      - `room_number` (text)
      - `room_name` (text)
      - `room_type` (text) - Standard, Deluxe, Suite, Penthouse
      - `status` (text) - Vacant, Occupied, Check-In Pending, Checked In, Check-Out Pending, Checked Out, Needs Attention
      - `passcode` (text) - Door access code
      - `floor` (integer)
      - `created_at` (timestamptz)

    - `guests` - Guest bookings
      - `id` (uuid, primary key)
      - `property_id` (uuid, FK)
      - `room_id` (uuid, FK)
      - `guest_name` (text)
      - `eta` (timestamptz) - Estimated arrival
      - `etd` (timestamptz) - Estimated departure
      - `check_in_status` (text)
      - `booking_source` (text)
      - `is_vip` (boolean)
      - `guest_count` (integer)
      - `created_at` (timestamptz)

    - `guest_requests` - Room requests and notes
      - `id` (uuid, primary key)
      - `guest_id` (uuid, FK)
      - `room_id` (uuid, FK)
      - `request_type` (text)
      - `notes` (text)
      - `is_completed` (boolean)
      - `created_at` (timestamptz)

    - `maintenance_issues` - Property maintenance queue
      - `id` (uuid, primary key)
      - `property_id` (uuid, FK)
      - `room_id` (uuid, FK, nullable)
      - `title` (text)
      - `description` (text)
      - `severity` (text) - Low, Medium, High, Critical
      - `status` (text) - Open, In Progress, Resolved
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Public read policies for dashboard demo (no auth required for MVP)
*/

CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  total_rooms integer NOT NULL DEFAULT 0,
  location text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for properties"
  ON properties FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  room_number text NOT NULL,
  room_name text NOT NULL DEFAULT '',
  room_type text NOT NULL DEFAULT 'Standard',
  status text NOT NULL DEFAULT 'Vacant',
  passcode text NOT NULL DEFAULT '',
  floor integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for rooms"
  ON rooms FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  room_id uuid REFERENCES rooms(id),
  guest_name text NOT NULL,
  eta timestamptz,
  etd timestamptz,
  check_in_status text NOT NULL DEFAULT 'Pending',
  booking_source text NOT NULL DEFAULT 'Direct',
  is_vip boolean NOT NULL DEFAULT false,
  guest_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for guests"
  ON guests FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS guest_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES guests(id),
  room_id uuid NOT NULL REFERENCES rooms(id),
  request_type text NOT NULL,
  notes text NOT NULL DEFAULT '',
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE guest_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for guest_requests"
  ON guest_requests FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS maintenance_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  room_id uuid REFERENCES rooms(id),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'Low',
  status text NOT NULL DEFAULT 'Open',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE maintenance_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for maintenance_issues"
  ON maintenance_issues FOR SELECT
  TO anon, authenticated
  USING (true);
