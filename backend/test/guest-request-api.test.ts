import assert from "node:assert/strict";
import express, { type Express } from "express";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, it } from "vitest";
import { registerGuestRequestRoutes } from "../src/routes/guest-requests.js";
import {
  type GuestRequestPrisma,
  type GuestRequestRecord,
} from "../src/services/guest-request-service.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGuestRequest(
  overrides: Partial<GuestRequestRecord> = {},
): GuestRequestRecord {
  return {
    id: "request-1",
    guest_id: null,
    room_id: null,
    request_type: "towels",
    notes: "Initial notes",
    description: "Need extra towels",
    status: "open",
    priority: "medium",
    assigned_to: null,
    is_completed: false,
    created_at: new Date("2026-06-18T01:00:00.000Z"),
    updated_at: new Date("2026-06-18T01:00:00.000Z"),
    completed_at: null,
    reservation_id: "reservation-1",
    property_id: "property-1",
    ...overrides,
  };
}

function createPrismaMock(
  options: {
    request?: GuestRequestRecord | null;
    requests?: GuestRequestRecord[];
    guestExists?: boolean;
    roomExists?: boolean;
    propertyExists?: boolean;
    reservationExists?: boolean;
  } = {},
): { prisma: GuestRequestPrisma; state: { current: GuestRequestRecord | null } } {
  let current: GuestRequestRecord | null =
    options.request === undefined ? makeGuestRequest() : options.request;
  const requests: GuestRequestRecord[] = options.requests ?? (current ? [current] : []);
  const guestExists = options.guestExists ?? true;
  const roomExists = options.roomExists ?? true;
  const propertyExists = options.propertyExists ?? true;
  const reservationExists = options.reservationExists ?? true;

  const prisma: GuestRequestPrisma = {
    properties: {
      findUnique: async (args: { where: { id: string } }) =>
        propertyExists ? { id: args.where.id } : null,
    },
    guests: {
      findUnique: async (args: { where: { id: string } }) =>
        guestExists ? { id: args.where.id, property_id: "property-1" } : null,
    },
    rooms: {
      findUnique: async (args: { where: { id: string } }) =>
        roomExists ? { id: args.where.id, property_id: "property-1" } : null,
    },
    reservations: {
      findUnique: async (args: { where: { id: string } }) =>
        reservationExists ? { id: args.where.id, property_id: "property-1" } : null,
    },
    guest_requests: {
      create: async ({ data }) => {
        const merged: Record<string, unknown> = { ...data };
        current = makeGuestRequest({
          id: "created-request",
          ...merged,
        } as Partial<GuestRequestRecord>);
        return current;
      },
      findUnique: async (args: { where: { id: string } }) => {
        if (options.request === null) return null;
        if (current && args.where.id === current.id) return current;
        return null;
      },
      findMany: async () => requests,
      update: async ({ where, data }) => {
        if (!current) throw new Error("missing current guest request");
        current = makeGuestRequest({
          ...current,
          ...data,
          id: where.id,
        } as Partial<GuestRequestRecord>);
        return current;
      },
      delete: async ({ where }) => {
        if (!current) throw new Error("missing current guest request");
        const deleted = current;
        current = null;
        return { ...deleted, id: where.id };
      },
    },
  };

  return { prisma, state: { get current() { return current; } } };
}

interface TestServer {
  server: Server;
  baseUrl: string;
  close(): Promise<void>;
  request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; body: unknown }>;
}

async function startTestServer(prisma: GuestRequestPrisma): Promise<TestServer> {
  const app: Express = express();
  app.use(express.json());
  registerGuestRequestRoutes(app, prisma);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const request = async (method: string, path: string, body?: unknown) => {
    const init: RequestInit = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(`${baseUrl}${path}`, init);
    const text = await res.text();
    let parsed: unknown = text;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    return { status: res.status, body: parsed };
  };

  return {
    server,
    baseUrl,
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
    request,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/guest-requests", () => {
  let ts: TestServer;
  afterEach(async () => {
    if (ts) await ts.close();
  });

  it("returns 201 with open status and is_completed false for valid input", async () => {
    ts = await startTestServer(createPrismaMock().prisma);
    const validInput = {
      reservation_id: "reservation-1",
      request_type: "towels",
      description: "Need extra towels",
      priority: "high",
    };
    const res = await ts.request("POST", "/api/guest-requests", validInput);

    assert.equal(res.status, 201);
      const body = res.body as {
        id: string;
        guest_id: string | null;
        room_id: string | null;
        reservation_id: string;
        property_id: string;
        status: string;
      is_completed: boolean;
      completed_at: string | null;
      priority: string;
    };
    assert.ok(body.id);
      assert.equal(body.status, "open");
      assert.equal(body.is_completed, false);
      assert.equal(body.completed_at, null);
      assert.equal(body.priority, "high");
      assert.equal(body.guest_id, null);
      assert.equal(body.room_id, null);
      assert.equal(body.reservation_id, "reservation-1");
      assert.equal(body.property_id, "property-1");
  });

  it("returns 400 when required fields are missing", async () => {
    ts = await startTestServer(createPrismaMock().prisma);
    const res = await ts.request("POST", "/api/guest-requests", {
      request_type: "towels",
    });

    assert.equal(res.status, 400);
    const body = res.body as { error: string; errors: Array<{ field: string }> };
    assert.ok(body.error);
    assert.ok(Array.isArray(body.errors));
    assert.ok(body.errors.length > 0);
  });

  it("returns 400 for invalid priority", async () => {
    ts = await startTestServer(createPrismaMock().prisma);
    const res = await ts.request("POST", "/api/guest-requests", {
      reservation_id: "reservation-1",
      guest_id: "guest-1",
      request_type: "towels",
      priority: "bogus",
    });

    assert.equal(res.status, 400);
  });

  it("returns 404 when guest is missing", async () => {
    ts = await startTestServer(createPrismaMock({ guestExists: false }).prisma);
    const res = await ts.request("POST", "/api/guest-requests", {
      reservation_id: "reservation-1",
      guest_id: "missing",
      request_type: "towels",
    });

    assert.equal(res.status, 404);
  });

  it("returns 404 when room is missing", async () => {
    ts = await startTestServer(createPrismaMock({ roomExists: false }).prisma);
    const res = await ts.request("POST", "/api/guest-requests", {
      reservation_id: "reservation-1",
      room_id: "missing",
      request_type: "towels",
    });

    assert.equal(res.status, 404);
  });

  it("returns 404 when property is missing", async () => {
    ts = await startTestServer(createPrismaMock({ propertyExists: false }).prisma);
    const res = await ts.request("POST", "/api/guest-requests", {
      reservation_id: "reservation-1",
      property_id: "missing",
      request_type: "towels",
    });

    assert.equal(res.status, 404);
  });

  it("returns 404 when reservation is missing", async () => {
    ts = await startTestServer(createPrismaMock({ reservationExists: false }).prisma);
    const res = await ts.request("POST", "/api/guest-requests", {
      reservation_id: "missing",
      request_type: "towels",
    });

    assert.equal(res.status, 404);
  });
});

describe("GET /api/guest-requests", () => {
  let ts: TestServer;
  afterEach(async () => {
    if (ts) await ts.close();
  });

  it("returns 200 with array of guest requests", async () => {
    ts = await startTestServer(createPrismaMock().prisma);
    const res = await ts.request(
      "GET",
      "/api/guest-requests?property_id=property-1&status=open&assigned_to=staff-1&limit=10&offset=0",
    );

    assert.equal(res.status, 200);
    const body = res.body as Array<{ id: string }>;
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
  });

  it("returns 200 with empty array when no requests", async () => {
    ts = await startTestServer(
      createPrismaMock({ requests: [], request: null }).prisma,
    );
    const res = await ts.request("GET", "/api/guest-requests");

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it("returns 400 for invalid status filter", async () => {
    ts = await startTestServer(createPrismaMock().prisma);
    const res = await ts.request("GET", "/api/guest-requests?status=bogus");

    assert.equal(res.status, 400);
  });

  it("ignores non-numeric limit and offset", async () => {
    ts = await startTestServer(createPrismaMock().prisma);
    const res = await ts.request("GET", "/api/guest-requests?limit=abc&offset=NaN");

    assert.equal(res.status, 200);
  });
});

describe("GET /api/guest-requests/:id", () => {
  let ts: TestServer;
  afterEach(async () => {
    if (ts) await ts.close();
  });

  it("returns 200 with request body", async () => {
    ts = await startTestServer(createPrismaMock().prisma);
    const res = await ts.request("GET", "/api/guest-requests/request-1");

    assert.equal(res.status, 200);
    const body = res.body as { id: string; status: string };
    assert.equal(body.id, "request-1");
    assert.equal(body.status, "open");
  });

  it("returns 404 for missing request", async () => {
    ts = await startTestServer(createPrismaMock({ request: null }).prisma);
    const res = await ts.request("GET", "/api/guest-requests/missing");

    assert.equal(res.status, 404);
  });
});

describe("PATCH /api/guest-requests/:id (non-status fields)", () => {
  let ts: TestServer;
  afterEach(async () => {
    if (ts) await ts.close();
  });

  it("returns 200 with updated body for non-status changes", async () => {
    ts = await startTestServer(createPrismaMock().prisma);
    const res = await ts.request("PATCH", "/api/guest-requests/request-1", {
      description: "Updated description",
      priority: "urgent",
    });

    assert.equal(res.status, 200);
    const body = res.body as {
      id: string;
      description: string;
      priority: string;
      status: string;
    };
    assert.equal(body.id, "request-1");
    assert.equal(body.description, "Updated description");
    assert.equal(body.priority, "urgent");
    assert.equal(body.status, "open");
  });

  it("returns 404 for missing request", async () => {
    ts = await startTestServer(createPrismaMock({ request: null }).prisma);
    const res = await ts.request("PATCH", "/api/guest-requests/missing", {
      description: "X",
    });

    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid priority", async () => {
    ts = await startTestServer(createPrismaMock().prisma);
    const res = await ts.request("PATCH", "/api/guest-requests/request-1", {
      priority: "bogus",
    });

    assert.equal(res.status, 400);
  });
});

describe("DELETE /api/guest-requests/:id", () => {
  let ts: TestServer;
  afterEach(async () => {
    if (ts) await ts.close();
  });

  it("returns 200 with deleted request body", async () => {
    ts = await startTestServer(createPrismaMock().prisma);
    const res = await ts.request("DELETE", "/api/guest-requests/request-1");

    assert.equal(res.status, 200);
    const body = res.body as { id: string };
    assert.equal(body.id, "request-1");
  });

  it("returns 404 for missing request", async () => {
    ts = await startTestServer(createPrismaMock({ request: null }).prisma);
    const res = await ts.request("DELETE", "/api/guest-requests/missing");

    assert.equal(res.status, 404);
  });
});

describe("PATCH /api/guest-requests/:id (state transitions)", () => {
  let ts: TestServer;
  afterEach(async () => {
    if (ts) await ts.close();
  });

  const validTransitions: Array<{
    from: GuestRequestRecord["status"];
    to: GuestRequestRecord["status"];
    assignedTo: string;
    expectedCompleted: boolean;
  }> = [
    { from: "open", to: "assigned", assignedTo: "staff-1", expectedCompleted: false },
    { from: "open", to: "in_progress", assignedTo: "staff-1", expectedCompleted: false },
    { from: "open", to: "closed", assignedTo: "staff-1", expectedCompleted: true },
    { from: "assigned", to: "in_progress", assignedTo: "staff-1", expectedCompleted: false },
    { from: "assigned", to: "closed", assignedTo: "staff-1", expectedCompleted: true },
    { from: "in_progress", to: "fulfilled", assignedTo: "staff-1", expectedCompleted: true },
    { from: "in_progress", to: "closed", assignedTo: "staff-1", expectedCompleted: true },
    { from: "fulfilled", to: "closed", assignedTo: "staff-1", expectedCompleted: true },
    { from: "fulfilled", to: "reopened", assignedTo: "staff-1", expectedCompleted: false },
    { from: "closed", to: "reopened", assignedTo: "staff-1", expectedCompleted: false },
    { from: "reopened", to: "assigned", assignedTo: "staff-2", expectedCompleted: false },
    { from: "reopened", to: "in_progress", assignedTo: "staff-2", expectedCompleted: false },
    { from: "reopened", to: "closed", assignedTo: "staff-2", expectedCompleted: true },
  ];

  for (const tc of validTransitions) {
    it(`allows ${tc.from} → ${tc.to} via PATCH and derives is_completed`, async () => {
      const { prisma } = createPrismaMock({
        request: makeGuestRequest({
          status: tc.from,
          assigned_to: tc.from === "reopened" ? "staff-1" : null,
        }),
      });
      ts = await startTestServer(prisma);
      const res = await ts.request("PATCH", "/api/guest-requests/request-1", {
        status: tc.to,
        assigned_to: tc.assignedTo,
      });

      assert.equal(res.status, 200);
      const body = res.body as {
        status: string;
        is_completed: boolean;
        completed_at: string | null;
      };
      assert.equal(body.status, tc.to);
      assert.equal(body.is_completed, tc.expectedCompleted);
      if (tc.expectedCompleted) {
        assert.ok(body.completed_at);
      } else {
        assert.equal(body.completed_at, null);
      }
    });
  }

  it("rejects skipped transition open → fulfilled with 422", async () => {
    ts = await startTestServer(
      createPrismaMock({ request: makeGuestRequest({ status: "open" }) }).prisma,
    );
    const res = await ts.request("PATCH", "/api/guest-requests/request-1", {
      status: "fulfilled",
    });

    assert.equal(res.status, 422);
    const body = res.body as { error: string };
    assert.equal(body.error, "Invalid state transition");
  });

  it("rejects backwards transition assigned → open with 422", async () => {
    ts = await startTestServer(
      createPrismaMock({
        request: makeGuestRequest({ status: "assigned", assigned_to: "staff-1" }),
      }).prisma,
    );
    const res = await ts.request("PATCH", "/api/guest-requests/request-1", {
      status: "open",
    });

    assert.equal(res.status, 422);
  });

  it("rejects invalid status string with 400", async () => {
    ts = await startTestServer(createPrismaMock().prisma);
    const res = await ts.request("PATCH", "/api/guest-requests/request-1", {
      status: "not-a-status",
    });

    assert.equal(res.status, 400);
  });

  it("rejects open → assigned when assigned_to is missing with 422", async () => {
    ts = await startTestServer(
      createPrismaMock({
        request: makeGuestRequest({ status: "open", assigned_to: null }),
      }).prisma,
    );
    const res = await ts.request("PATCH", "/api/guest-requests/request-1", {
      status: "assigned",
    });

    assert.equal(res.status, 422);
    const body = res.body as { error: string };
    assert.equal(body.error, "assigned_to is required");
  });

  it("returns 404 when transitioning on a missing request", async () => {
    ts = await startTestServer(createPrismaMock({ request: null }).prisma);
    const res = await ts.request("PATCH", "/api/guest-requests/missing", {
      status: "assigned",
      assigned_to: "staff-1",
    });

    assert.equal(res.status, 404);
  });
});

describe("is_completed derivation across full lifecycle", () => {
  let ts: TestServer;
  afterEach(async () => {
    if (ts) await ts.close();
  });

  it("derives is_completed false for open/assigned/in_progress/reopened", async () => {
    for (const status of ["open", "assigned", "in_progress", "reopened"] as const) {
      const { prisma, state } = createPrismaMock({
        request: makeGuestRequest({ status, assigned_to: "staff-1" }),
      });
      const localTs = await startTestServer(prisma);
      const res = await localTs.request("GET", "/api/guest-requests/request-1");
      assert.equal(res.status, 200);
      const body = res.body as { is_completed: boolean };
      assert.equal(body.is_completed, false, `expected is_completed=false for ${status}`);
      assert.ok(state.current, "mock should retain a current record");
      assert.equal(state.current.is_completed, false);
      await localTs.close();
    }
  });

  it("derives is_completed true for fulfilled/closed", async () => {
    for (const status of ["fulfilled", "closed"] as const) {
      const { prisma } = createPrismaMock({
        request: makeGuestRequest({ status, assigned_to: "staff-1", is_completed: true }),
      });
      const localTs = await startTestServer(prisma);
      const res = await localTs.request("GET", "/api/guest-requests/request-1");
      assert.equal(res.status, 200);
      const body = res.body as { is_completed: boolean; status: string };
      assert.equal(body.is_completed, true, `expected is_completed=true for ${status}`);
      await localTs.close();
    }
  });

  it("transitions fulfilled → closed preserve is_completed true via PATCH", async () => {
    const { prisma, state } = createPrismaMock({
      request: makeGuestRequest({
        status: "fulfilled",
        assigned_to: "staff-1",
        is_completed: true,
      }),
    });
    ts = await startTestServer(prisma);
    const res = await ts.request("PATCH", "/api/guest-requests/request-1", {
      status: "closed",
      assigned_to: "staff-1",
    });
    assert.equal(res.status, 200);
    const body = res.body as { status: string; is_completed: boolean };
    assert.equal(body.status, "closed");
    assert.equal(body.is_completed, true);
    assert.ok(state.current);
    assert.equal(state.current.status, "closed");
    assert.equal(state.current.is_completed, true);
  });
});
