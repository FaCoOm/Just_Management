import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveOccupancyMetrics } from "../src/dashboard/occupancy.js";

const property = { id: "prop-1", total_rooms: 3 };
const otherProperty = { id: "prop-2", total_rooms: 2 };

const rooms = [
  { id: "room-1", property_id: "prop-1" },
  { id: "room-2", property_id: "prop-1" },
  { id: "room-3", property_id: "prop-1" },
  { id: "room-4", property_id: "prop-2" },
];

function reservation(overrides: Partial<Parameters<typeof deriveOccupancyMetrics>[0]["reservations"][number]> = {}) {
  return {
    id: "reservation-1",
    primary_room_id: "room-1",
    check_in_date: "2026-06-12",
    check_out_date: "2026-06-14",
    reservation_room_allocations: [],
    ...overrides,
  };
}

describe("deriveOccupancyMetrics", () => {
  it("returns no occupied rooms when no reservation overlaps the date", () => {
    const metrics = deriveOccupancyMetrics({
      date: "2026-06-13",
      properties: [property],
      rooms: rooms.slice(0, 3),
      reservations: [],
    });

    assert.equal(metrics.perProperty.get("prop-1")?.occupiedRooms, 0);
    assert.equal(metrics.totalOccupied, 0);
    assert.equal(metrics.totalRooms, 3);
    assert.equal(metrics.occupancyRate, 0);
  });

  it("counts a primary-room reservation even when room.status is stale elsewhere", () => {
    const metrics = deriveOccupancyMetrics({
      date: "2026-06-13",
      properties: [property],
      rooms: rooms.slice(0, 3),
      reservations: [reservation()],
    });

    assert.equal(metrics.perProperty.get("prop-1")?.occupiedRooms, 1);
    assert.equal(metrics.totalOccupied, 1);
    assert.equal(metrics.occupancyRate, 33);
  });

  it("counts allocation rows when a reservation has no primary room", () => {
    const metrics = deriveOccupancyMetrics({
      date: "2026-06-13",
      properties: [property],
      rooms: rooms.slice(0, 3),
      reservations: [reservation({
        primary_room_id: null,
        reservation_room_allocations: [{ room_id: "room-1" }, { room_id: "room-2" }],
      })],
    });

    assert.equal(metrics.perProperty.get("prop-1")?.occupiedRooms, 2);
    assert.equal(metrics.totalOccupied, 2);
    assert.equal(metrics.occupancyRate, 67);
  });

  it("uses allocation rows instead of primary room when both exist", () => {
    const metrics = deriveOccupancyMetrics({
      date: "2026-06-13",
      properties: [property],
      rooms: rooms.slice(0, 3),
      reservations: [reservation({
        primary_room_id: "room-3",
        reservation_room_allocations: [{ room_id: "room-1" }, { room_id: "room-2" }],
      })],
    });

    assert.equal(metrics.perProperty.get("prop-1")?.occupiedRooms, 2);
    assert.deepEqual(metrics.perProperty.get("prop-1")?.occupiedRoomIds, new Set(["room-1", "room-2"]));
  });

  it("does not count checkout date as occupied", () => {
    const metrics = deriveOccupancyMetrics({
      date: "2026-06-14",
      properties: [property],
      rooms: rooms.slice(0, 3),
      reservations: [reservation()],
    });

    assert.equal(metrics.perProperty.get("prop-1")?.occupiedRooms, 0);
    assert.equal(metrics.totalOccupied, 0);
  });

  it("counts check-in date as occupied", () => {
    const metrics = deriveOccupancyMetrics({
      date: "2026-06-12",
      properties: [property],
      rooms: rooms.slice(0, 3),
      reservations: [reservation()],
    });

    assert.equal(metrics.perProperty.get("prop-1")?.occupiedRooms, 1);
    assert.equal(metrics.totalOccupied, 1);
  });

  it("scopes occupied rooms to their property", () => {
    const metrics = deriveOccupancyMetrics({
      date: "2026-06-13",
      properties: [property, otherProperty],
      rooms,
      reservations: [reservation({ primary_room_id: "room-4" })],
    });

    assert.equal(metrics.perProperty.get("prop-1")?.occupiedRooms, 0);
    assert.equal(metrics.perProperty.get("prop-2")?.occupiedRooms, 1);
    assert.equal(metrics.totalOccupied, 1);
  });
});
