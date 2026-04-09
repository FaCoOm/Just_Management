/*
  # Seed Portfolio Data

  1. Properties
    - Insert all 8 portfolio branches with realistic room counts
  2. Rooms
    - Insert sample rooms for each property
  3. Guests
    - Insert sample guest bookings with arrivals and departures
  4. Guest Requests
    - Insert sample room requests
  5. Maintenance Issues
    - Insert sample maintenance items across properties
*/

INSERT INTO properties (name, slug, total_rooms, location, status) VALUES
  ('Minh''s Home', 'minhs-home', 12, 'District 1, HCMC', 'active'),
  ('Sumo House', 'sumo-house', 18, 'District 3, HCMC', 'active'),
  ('Latte Lounge', 'latte-lounge', 24, 'District 7, HCMC', 'active'),
  ('Dabei', 'dabei', 10, 'District 2, HCMC', 'active'),
  ('The Alley', 'the-alley', 15, 'Binh Thanh, HCMC', 'active'),
  ('The Opera', 'the-opera', 20, 'District 1, HCMC', 'active'),
  ('The Crest', 'the-crest', 16, 'District 4, HCMC', 'active'),
  ('Cochinchine', 'cochinchine', 22, 'District 1, HCMC', 'active')
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  prop RECORD;
  room_id_var uuid;
  guest_id_var uuid;
  i integer;
  room_types text[] := ARRAY['Standard', 'Deluxe', 'Suite', 'Penthouse'];
  room_statuses text[] := ARRAY['Occupied', 'Vacant', 'Occupied', 'Check-In Pending', 'Occupied', 'Vacant', 'Checked Out', 'Occupied', 'Check-Out Pending', 'Occupied'];
  guest_names text[] := ARRAY['James Brown', 'Sarah Lee', 'Michael Chen', 'Emily Davis', 'Tom Wilson', 'Anna Park', 'David Kim', 'Lisa Wang', 'Robert Taylor', 'Marie Dubois', 'Carlos Garcia', 'Yuki Tanaka', 'Sophie Martin', 'Alex Nguyen', 'Hassan Ali', 'Priya Sharma', 'Liam O''Brien', 'Elena Popov', 'Marco Rossi', 'Fatima Khan', 'Oliver Smith', 'Chloe Zhang', 'Nathan Brown', 'Isabella Costa'];
  booking_sources text[] := ARRAY['Direct', 'Booking.com', 'Airbnb', 'Expedia', 'Agoda', 'Hotels.com'];
  request_types text[] := ARRAY['Extra Towels', 'Extra Toilet Paper', 'Late Check-out', 'Extra Pillows', 'Room Cleaning', 'Mini Bar Restock', 'Quiet Room', 'Early Check-in', 'Airport Transfer', 'Baby Cot'];
  maint_titles text[] := ARRAY['AC Unit Not Cooling', 'Leaking Faucet', 'Broken Light Fixture', 'WiFi Connectivity Issue', 'Door Lock Malfunction', 'TV Remote Missing', 'Stained Carpet', 'Noisy Plumbing', 'Window Seal Damaged', 'Elevator Maintenance'];
  severities text[] := ARRAY['Low', 'Medium', 'High', 'Critical'];
  maint_statuses text[] := ARRAY['Open', 'In Progress', 'Open', 'Resolved'];
BEGIN
  FOR prop IN SELECT id, total_rooms, name FROM properties LOOP
    FOR i IN 1..LEAST(prop.total_rooms, 12) LOOP
      room_id_var := gen_random_uuid();

      INSERT INTO rooms (id, property_id, room_number, room_name, room_type, status, passcode, floor)
      VALUES (
        room_id_var,
        prop.id,
        (100 + i)::text,
        prop.name || ' ' || room_types[1 + (i % 4)] || ' ' || (100 + i)::text,
        room_types[1 + (i % 4)],
        room_statuses[1 + (i % 10)],
        LPAD((1000 + floor(random() * 9000))::text, 4, '0'),
        1 + (i / 5)
      );

      IF i <= 8 THEN
        guest_id_var := gen_random_uuid();

        INSERT INTO guests (id, property_id, room_id, guest_name, eta, etd, check_in_status, booking_source, is_vip, guest_count)
        VALUES (
          guest_id_var,
          prop.id,
          room_id_var,
          guest_names[1 + ((i - 1 + (ascii(substring(prop.name, 1, 1))) ) % 24)],
          now() + ((i - 4) * interval '1 hour'),
          now() + ((i + 1) * interval '1 day'),
          CASE
            WHEN i <= 3 THEN 'Checked In'
            WHEN i <= 5 THEN 'Check-In Pending'
            WHEN i <= 7 THEN 'Check-Out Pending'
            ELSE 'Checked Out'
          END,
          booking_sources[1 + (i % 6)],
          (i % 5 = 0),
          1 + (i % 3)
        );

        IF i <= 4 THEN
          INSERT INTO guest_requests (guest_id, room_id, request_type, notes, is_completed)
          VALUES (
            guest_id_var,
            room_id_var,
            request_types[1 + (i % 10)],
            'Guest request for ' || request_types[1 + (i % 10)],
            (i % 3 = 0)
          );
        END IF;
      END IF;
    END LOOP;

    FOR i IN 1..LEAST(3, prop.total_rooms / 4) LOOP
      INSERT INTO maintenance_issues (property_id, room_id, title, description, severity, status)
      VALUES (
        prop.id,
        NULL,
        maint_titles[1 + ((i + ascii(substring(prop.name, 1, 1))) % 10)],
        'Reported by housekeeping staff',
        severities[1 + (i % 4)],
        maint_statuses[1 + (i % 4)]
      );
    END LOOP;
  END LOOP;
END $$;
