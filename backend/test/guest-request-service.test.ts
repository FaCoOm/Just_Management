import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  createRequest,
  deleteRequest,
  getRequestById,
  listRequests,
  transitionStatus,
  updateRequest,
  type GuestRequestPrisma,
  type GuestRequestRecord,
} from "../src/services/guest-request-service.js";

function makeGuestRequest(overrides: Partial<GuestRequestRecord> = {}): GuestRequestRecord {
  return {
    id: "request-1",
    guest_id: "guest-1",
    room_id: "room-1",
    request_type: "towels",
    notes: "",
    description: "Need extra towels",
    status: "open",
    priority: "medium",
    assigned_to: null,
    is_completed: false,
    created_at: new Date("2026-06-18T01:00:00.000Z"),
    updated_at: new Date("2026-06-18T01:00:00.000Z"),
    completed_at: null,
    reservation_id: null,
    property_id: "property-1",
    ...overrides,
  };
}

function createPrismaMock(options: {
  request?: GuestRequestRecord | null;
  requests?: GuestRequestRecord[];
  guestExists?: boolean;
  roomExists?: boolean;
  propertyExists?: boolean;
  reservationExists?: boolean;
} = {}): { prisma: GuestRequestPrisma; calls: Array<{ op: string; args?: unknown }> } {
  const calls: Array<{ op: string; args?: unknown }> = [];
  let current = options.request === undefined ? makeGuestRequest() : options.request;
  const requests = options.requests ?? (current ? [current] : []);

  const prisma: GuestRequestPrisma = {
    properties: {
      findUnique: async (args) => {
        calls.push({ op: "property.findUnique", args });
        return options.propertyExists === false ? null : { id: args.where.id };
      },
    },
    guests: {
      findUnique: async (args) => {
        calls.push({ op: "guest.findUnique", args });
        return options.guestExists === false ? null : { id: args.where.id, property_id: "property-1" };
      },
    },
    rooms: {
      findUnique: async (args) => {
        calls.push({ op: "room.findUnique", args });
        return options.roomExists === false ? null : { id: args.where.id, property_id: "property-1" };
      },
    },
    reservations: {
      findUnique: async (args) => {
        calls.push({ op: "reservation.findUnique", args });
        return options.reservationExists === false ? null : { id: args.where.id, property_id: "property-1" };
      },
    },
    guest_requests: {
      create: async ({ data }) => {
        calls.push({ op: "request.create", args: data });
        current = makeGuestRequest({ id: "created-request", ...data } as Partial<GuestRequestRecord>);
        return current;
      },
      findUnique: async (args) => {
        calls.push({ op: "request.findUnique", args });
        return current;
      },
      findMany: async (args) => {
        calls.push({ op: "request.findMany", args });
        return requests;
      },
      update: async ({ where, data }) => {
        calls.push({ op: "request.update", args: { where, data } });
        if (!current) throw new Error("missing current guest request");
        current = makeGuestRequest({ ...current, ...data, id: where.id } as Partial<GuestRequestRecord>);
        return current;
      },
      delete: async ({ where }) => {
        calls.push({ op: "request.delete", args: where });
        if (!current) throw new Error("missing current guest request");
        const deleted = current;
        current = null;
        return deleted;
      },
    },
  };

  return { prisma, calls };
}

describe("createRequest", () => {
  const validInput = {
    guest_id: "guest-1",
    room_id: "room-1",
    property_id: "property-1",
    request_type: "towels",
    description: "Need extra towels",
    priority: "high",
  };

  it("creates an open request with is_completed false", async () => {
    const { prisma } = createPrismaMock();
    const result = await createRequest(prisma, validInput);

    assert.equal(result.status, 201);
    assert.equal(result.body.status, "open");
    assert.equal(result.body.is_completed, false);
  });

  it("returns 400 when required fields are missing", async () => {
    const { prisma } = createPrismaMock();
    const result = await createRequest(prisma, { guest_id: "guest-1" });
    assert.equal(result.status, 400);
    assert.ok(Array.isArray(result.body.errors));
  });

  it("returns 404 when guest is missing", async () => {
    const { prisma } = createPrismaMock({ guestExists: false });
    const result = await createRequest(prisma, validInput);
    assert.equal(result.status, 404);
  });
});

describe("guest request CRUD", () => {
  it("gets by id", async () => {
    const { prisma } = createPrismaMock();
    const result = await getRequestById(prisma, "request-1");
    assert.equal(result.status, 200);
    assert.equal(result.body.id, "request-1");
  });

  it("lists with property, status, assignee filters", async () => {
    const { prisma, calls } = createPrismaMock();
    const result = await listRequests(prisma, {
      property_id: "property-1",
      status: "assigned",
      assigned_to: "staff-1",
      limit: 25,
      offset: 5,
    });

    assert.equal(result.status, 200);
    const call = calls.find((entry) => entry.op === "request.findMany");
    assert.deepEqual((call?.args as { where: unknown }).where, {
      property_id: "property-1",
      status: "assigned",
      assigned_to: "staff-1",
    });
    assert.equal((call?.args as { take: number }).take, 25);
    assert.equal((call?.args as { skip: number }).skip, 5);
  });

  it("updates non-status fields without state transition", async () => {
    const { prisma } = createPrismaMock();
    const result = await updateRequest(prisma, "request-1", {
      description: "Updated description",
      priority: "urgent",
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.description, "Updated description");
    assert.equal(result.body.priority, "urgent");
    assert.equal(result.body.status, "open");
  });

  it("deletes existing request", async () => {
    const { prisma, calls } = createPrismaMock();
    const result = await deleteRequest(prisma, "request-1");
    assert.equal(result.status, 200);
    assert.equal(result.body.id, "request-1");
    assert.ok(calls.some((entry) => entry.op === "request.delete"));
  });
});

describe("guest request status transitions", () => {
  const validCases: Array<{ from: GuestRequestRecord["status"]; to: GuestRequestRecord["status"]; assigned_to?: string | null; expectedCompleted: boolean }> = [
    { from: "open", to: "assigned", assigned_to: "staff-1", expectedCompleted: false },
    { from: "assigned", to: "in_progress", assigned_to: "staff-1", expectedCompleted: false },
    { from: "in_progress", to: "fulfilled", assigned_to: "staff-1", expectedCompleted: true },
    { from: "fulfilled", to: "closed", assigned_to: "staff-1", expectedCompleted: true },
    { from: "closed", to: "reopened", assigned_to: "staff-1", expectedCompleted: false },
    { from: "reopened", to: "assigned", assigned_to: "staff-2", expectedCompleted: false },
  ];

  for (const testCase of validCases) {
    it(`allows ${testCase.from} → ${testCase.to}`, async () => {
      const { prisma } = createPrismaMock({
        request: makeGuestRequest({ status: testCase.from, assigned_to: testCase.assigned_to ?? null }),
      });

      const result = await transitionStatus(prisma, "request-1", testCase.to, {
        assigned_to: testCase.assigned_to,
      });

      assert.equal(result.status, 200);
      assert.equal(result.body.status, testCase.to);
      assert.equal(result.body.is_completed, testCase.expectedCompleted);
      if (testCase.expectedCompleted) {
        assert.ok(result.body.completed_at instanceof Date);
      } else {
        assert.equal(result.body.completed_at, null);
      }
    });
  }

  it("rejects skipped transition open → fulfilled with 422", async () => {
    const { prisma } = createPrismaMock({ request: makeGuestRequest({ status: "open" }) });
    const result = await updateRequest(prisma, "request-1", { status: "fulfilled" });
    assert.equal(result.status, 422);
    assert.equal(result.body.error, "Invalid state transition");
  });

  it("requires assigned_to when moving open → assigned", async () => {
    const { prisma } = createPrismaMock({ request: makeGuestRequest({ status: "open", assigned_to: null }) });
    const result = await transitionStatus(prisma, "request-1", "assigned");
    assert.equal(result.status, 422);
    assert.equal(result.body.error, "assigned_to is required");
  });

  it("requires existing assigned_to when moving assigned → in_progress", async () => {
    const { prisma } = createPrismaMock({ request: makeGuestRequest({ status: "assigned", assigned_to: null }) });
    const result = await transitionStatus(prisma, "request-1", "in_progress");
    assert.equal(result.status, 422);
    assert.equal(result.body.error, "assigned_to is required");
  });

  it("derives is_completed true and completed_at for fulfilled", async () => {
    const { prisma, calls } = createPrismaMock({
      request: makeGuestRequest({ status: "in_progress", assigned_to: "staff-1" }),
    });

    const result = await updateRequest(prisma, "request-1", { status: "fulfilled" });

    assert.equal(result.status, 200);
    assert.equal(result.body.is_completed, true);
    const update = calls.find((entry) => entry.op === "request.update");
    assert.equal((update?.args as { data: { is_completed: boolean } }).data.is_completed, true);
    assert.ok((update?.args as { data: { completed_at: Date } }).data.completed_at instanceof Date);
  });
});
