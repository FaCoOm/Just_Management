import assert from "node:assert/strict";
import express, { type Express } from "express";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { describe, it } from "vitest";
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
): { prisma: GuestRequestPrisma; state: { current: GuestRequestRecord | null }; ids: string[] } {
  let current: GuestRequestRecord | null =
    options.request === undefined ? makeGuestRequest() : options.request;
  const requests: GuestRequestRecord[] = options.requests ?? (current ? [current] : []);
  const guestExists = options.guestExists ?? true;
  const roomExists = options.roomExists ?? true;
  const propertyExists = options.propertyExists ?? true;
  const reservationExists = options.reservationExists ?? true;
  const createdIds: string[] = [];

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
        createdIds.push(current.id);
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

  return {
    prisma,
    state: { get current() { return current; } },
    get ids() { return createdIds; },
  };
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
// Valid Lifecycle Transitions (POST → PATCH)
// ---------------------------------------------------------------------------

describe("Guest Request E2E Lifecycle — valid transitions", () => {
  const lifecycleTransitions: Array<{
    from: GuestRequestRecord["status"];
    to: GuestRequestRecord["status"];
    assignedTo: string;
    expectedCompleted: boolean;
  }> = [
    { from: "open", to: "assigned", assignedTo: "staff-1", expectedCompleted: false },
    { from: "assigned", to: "in_progress", assignedTo: "staff-1", expectedCompleted: false },
    { from: "in_progress", to: "fulfilled", assignedTo: "staff-1", expectedCompleted: true },
    { from: "fulfilled", to: "closed", assignedTo: "staff-1", expectedCompleted: true },
    { from: "closed", to: "reopened", assignedTo: "staff-1", expectedCompleted: false },
    { from: "reopened", to: "assigned", assignedTo: "staff-2", expectedCompleted: false },
  ];

  for (const tc of lifecycleTransitions) {
    it(`POST creates request, then PATCH ${tc.from} → ${tc.to} succeeds`, async () => {
      const { prisma } = createPrismaMock();
      const ts = await startTestServer(prisma);

      try {
        // Create the request
        const createRes = await ts.request("POST", "/api/guest-requests", {
          reservation_id: "reservation-1",
          request_type: "towels",
          priority: "medium",
        });
        assert.equal(createRes.status, 201);
        const created = createRes.body as { id: string; status: string; is_completed: boolean };
        assert.equal(created.status, "open");
        assert.equal(created.is_completed, false);

        const id = created.id;

        // Seed the starting state by moving through prior transitions sequentially
        if (tc.from !== "open") {
          const seedChain = lifecycleTransitions
            .slice(0, lifecycleTransitions.findIndex((t) => t.from === tc.from))
            .map((t) => ({ to: t.to, assignedTo: t.assignedTo }));

          for (const step of seedChain) {
            const patchRes = await ts.request("PATCH", `/api/guest-requests/${id}`, {
              status: step.to,
              assigned_to: step.assignedTo,
            });
            assert.equal(patchRes.status, 200);
          }
        }

        // Execute the transition under test
        const res = await ts.request("PATCH", `/api/guest-requests/${id}`, {
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
      } finally {
        await ts.close();
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Invalid Transitions (must return 422)
// ---------------------------------------------------------------------------

describe("Guest Request E2E Lifecycle — invalid transitions", () => {
    it("rejects Open → Fulfilled with 422", async () => {
      const { prisma } = createPrismaMock({ request: makeGuestRequest({ status: "open" }) });
      const ts = await startTestServer(prisma);
      try {
        const res = await ts.request("PATCH", "/api/guest-requests/request-1", {
          status: "fulfilled",
          assigned_to: "staff-1",
        });
      assert.equal(res.status, 422);
      const body = res.body as { error: string };
      assert.equal(body.error, "Invalid state transition");
    } finally {
      await ts.close();
    }
  });

    it("rejects Fulfilled → In_Progress with 422", async () => {
      const { prisma } = createPrismaMock({
        request: makeGuestRequest({ status: "fulfilled", assigned_to: "staff-1", is_completed: true }),
      });
    const ts = await startTestServer(prisma);
    try {
      const res = await ts.request("PATCH", "/api/guest-requests/request-1", {
        status: "in_progress",
        assigned_to: "staff-1",
      });
      assert.equal(res.status, 422);
      const body = res.body as { error: string };
      assert.equal(body.error, "Invalid state transition");
    } finally {
      await ts.close();
    }
  });

    it("rejects Closed → Fulfilled with 422", async () => {
      const { prisma } = createPrismaMock({
        request: makeGuestRequest({
          status: "closed",
          assigned_to: "staff-1",
          is_completed: true,
          completed_at: new Date("2026-06-18T02:00:00.000Z"),
        }),
      });
    const ts = await startTestServer(prisma);
    try {
      const res = await ts.request("PATCH", "/api/guest-requests/request-1", {
        status: "fulfilled",
        assigned_to: "staff-1",
      });
      assert.equal(res.status, 422);
      const body = res.body as { error: string };
      assert.equal(body.error, "Invalid state transition");
    } finally {
      await ts.close();
    }
  });
});

// ---------------------------------------------------------------------------
// is_completed Backward Compatibility
// ---------------------------------------------------------------------------

describe("Guest Request E2E Lifecycle — is_completed backward compat", () => {
  it("derives is_completed=true for closed requests", async () => {
    const { prisma } = createPrismaMock({
      request: makeGuestRequest({
        status: "closed",
        assigned_to: "staff-1",
        is_completed: true,
        completed_at: new Date("2026-06-18T02:00:00.000Z"),
      }),
    });
    const ts = await startTestServer(prisma);
    try {
      const res = await ts.request("GET", "/api/guest-requests/request-1");
      assert.equal(res.status, 200);
      const body = res.body as { is_completed: boolean; status: string };
      assert.equal(body.status, "closed");
      assert.equal(body.is_completed, true);
    } finally {
      await ts.close();
    }
  });

  it("derives is_completed=false for open, assigned, in_progress, and reopened", async () => {
    const statuses: GuestRequestRecord["status"][] = [
      "open",
      "assigned",
      "in_progress",
      "reopened",
    ];
    for (const status of statuses) {
      const local = createPrismaMock({
        request: makeGuestRequest({ status, assigned_to: "staff-1", is_completed: false }),
      });
      const localTs = await startTestServer(local.prisma);
      try {
        const res = await localTs.request("GET", "/api/guest-requests/request-1");
        assert.equal(res.status, 200);
        const body = res.body as { is_completed: boolean; status: string };
        assert.equal(body.status, status);
        assert.equal(body.is_completed, false, `expected is_completed=false for ${status}`);
      } finally {
        await localTs.close();
      }
    }
  });

  it("derives is_completed=true for fulfilled", async () => {
    const { prisma } = createPrismaMock({
      request: makeGuestRequest({
        status: "fulfilled",
        assigned_to: "staff-1",
        is_completed: true,
        completed_at: new Date("2026-06-18T02:00:00.000Z"),
      }),
    });
    const ts = await startTestServer(prisma);
    try {
      const res = await ts.request("GET", "/api/guest-requests/request-1");
      assert.equal(res.status, 200);
      const body = res.body as { is_completed: boolean; status: string };
      assert.equal(body.status, "fulfilled");
      assert.equal(body.is_completed, true);
    } finally {
      await ts.close();
    }
  });
});
