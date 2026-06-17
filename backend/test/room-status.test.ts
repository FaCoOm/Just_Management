import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyRoomStatusUpdate, type RoomStatusTransactionClient } from "../src/room-status.js";

const today = "2026-06-15";
const room = {
  id: "room-1",
  property_id: "property-1",
  room_number: "101",
  room_name: "Room 101",
  room_type: "Standard",
  status: "Vacant",
  floor: 1,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
};

const reservation = {
  id: "reservation-1",
  property_id: "property-1",
  primary_room_id: room.id,
  status: "pending",
  check_in_date: new Date("2026-06-14T00:00:00.000Z"),
  check_out_date: new Date("2026-06-18T00:00:00.000Z"),
  guest_name: "QA Guest",
  guest_phone: null,
  guest_email: null,
  adult_count: 1,
  child_count: 0,
  infant_count: 0,
  guest_count: 1,
  operational_notes: "",
  guest_notes: "",
  created_at: new Date("2026-06-01T00:00:00.000Z"),
  updated_at: new Date("2026-06-01T00:00:00.000Z"),
  reservation_room_allocations: [],
};

function createPrismaMock(options: {
  room?: typeof room | null;
  reservation?: typeof reservation | null;
  throwOnReservationUpdate?: boolean;
}) {
  const calls: string[] = [];
  const roomResult: typeof room | null = "room" in options ? options.room ?? null : room;
  const reservationResult: typeof reservation | null = "reservation" in options ? options.reservation ?? null : reservation;
  const tx: RoomStatusTransactionClient = {
    rooms: {
      update: async ({ data }: { data: { status: string } }) => {
        calls.push(`room:${data.status}`);
        return { ...(roomResult ?? room), status: data.status };
      },
    },
    reservations: {
      update: async ({ data }: { data: { status: string } }) => {
        calls.push(`reservation:${data.status}`);
        if (options.throwOnReservationUpdate) throw new Error("reservation update failed");
        return { ...(reservationResult ?? reservation), status: data.status };
      },
    },
  };

  return {
    calls,
    prisma: {
      rooms: {
        findUnique: async () => roomResult,
      },
      reservations: {
        findFirst: async () => reservationResult,
      },
      $transaction: async <T>(callback: (client: RoomStatusTransactionClient) => Promise<T>) => callback(tx),
    },
  };
}

describe("applyRoomStatusUpdate", () => {
  it("updates an active reservation when applying Checked In", async () => {
    const { prisma, calls } = createPrismaMock({});

    const result = await applyRoomStatusUpdate(prisma, room.id, "Checked In", today);

    assert.equal(result.status, 200);
    assert.deepEqual(calls, ["room:Checked In", "reservation:checked_in"]);
    assert.equal(result.body.room.status, "Checked In");
    assert.equal(result.body.reservation?.status, "checked_in");
  });

  it("returns 400 for an invalid room status", async () => {
    const { prisma, calls } = createPrismaMock({});

    const result = await applyRoomStatusUpdate(prisma, room.id, "Invalid", today);

    assert.equal(result.status, 400);
    assert.equal(result.body.error, "Invalid room status");
    assert.deepEqual(calls, []);
  });

  it("returns 409 when a reservation-bound status has no active reservation", async () => {
    const { prisma, calls } = createPrismaMock({ reservation: null });

    const result = await applyRoomStatusUpdate(prisma, room.id, "Checked In", today);

    assert.equal(result.status, 409);
    assert.equal(result.body.error, "No active reservation for room");
    assert.deepEqual(calls, []);
  });

  it("marks a room Needs Attention without changing the active reservation", async () => {
    const { prisma, calls } = createPrismaMock({});

    const result = await applyRoomStatusUpdate(prisma, room.id, "Needs Attention", today);

    assert.equal(result.status, 200);
    assert.deepEqual(calls, ["room:Needs Attention"]);
    assert.equal(result.body.room.status, "Needs Attention");
    assert.equal(result.body.reservation, null);
  });

  it("does not keep a room status write when reservation update fails", async () => {
    const { prisma, calls } = createPrismaMock({ throwOnReservationUpdate: true });

    await assert.rejects(
      () => applyRoomStatusUpdate(prisma, room.id, "Vacant", today),
      /reservation update failed/
    );
    assert.deepEqual(calls, ["room:Vacant", "reservation:checked_out"]);
  });
});
