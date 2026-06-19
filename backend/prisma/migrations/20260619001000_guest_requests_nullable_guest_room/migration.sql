-- Make guest_requests reservation-anchored by allowing legacy guest/room links to be absent.
ALTER TABLE "guest_requests" ALTER COLUMN "guest_id" DROP NOT NULL;
ALTER TABLE "guest_requests" ALTER COLUMN "room_id" DROP NOT NULL;

ALTER TABLE "guest_requests" DROP CONSTRAINT IF EXISTS "guest_requests_guest_id_fkey";
ALTER TABLE "guest_requests" DROP CONSTRAINT IF EXISTS "guest_requests_room_id_fkey";

ALTER TABLE "guest_requests"
  ADD CONSTRAINT "guest_requests_guest_id_fkey"
  FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "guest_requests"
  ADD CONSTRAINT "guest_requests_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
