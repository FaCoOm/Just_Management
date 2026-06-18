import assert from "node:assert/strict";
import express, { type Express } from "express";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, it } from "vitest";
import { registerStayRegistrationRoutes } from "../src/routes/stay-registrations.js";
import {
  type StayRegistrationPrisma,
  type StayRegistrationRecord,
} from "../src/services/stay-registration-service.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStayRegistration(
  overrides: Partial<StayRegistrationRecord> = {},
): StayRegistrationRecord {
  return {
    id: "stay-1",
    property_id: "property-1",
    tenant_id: "tenant-1",
    room_id: "room-1",
    guest_name: "Nguyen Van A",
    guest_count: 2,
    registration_date: new Date("2026-06-18T00:00:00.000Z"),
    registration_number: "SR-001",
    drive_folder_id: null,
    drive_folder_status: "pending",
    notes: "Test stay",
    created_at: new Date("2026-06-18T01:00:00.000Z"),
    updated_at: new Date("2026-06-18T01:00:00.000Z"),
    ...overrides,
  };
}

function createPrismaMock(
  options: {
    stay?: StayRegistrationRecord | null;
    stays?: StayRegistrationRecord[];
    propertyExists?: boolean;
    tenantExists?: boolean;
    roomExists?: boolean;
  } = {},
): { prisma: StayRegistrationPrisma; state: { current: StayRegistrationRecord | null } } {
  let current: StayRegistrationRecord | null =
    options.stay === undefined ? makeStayRegistration() : options.stay;
  const stays: StayRegistrationRecord[] = options.stays ?? (current ? [current] : []);
  const propertyExists = options.propertyExists ?? true;
  const tenantExists = options.tenantExists ?? true;
  const roomExists = options.roomExists ?? true;

  const prisma: StayRegistrationPrisma = {
    properties: {
      findUnique: async (args: { where: { id: string } }) =>
        propertyExists ? { id: args.where.id } : null,
    },
    tenants: {
      findUnique: async (args: { where: { id: string } }) =>
        tenantExists ? { id: args.where.id, property_id: "property-1" } : null,
    },
    rooms: {
      findUnique: async (args: { where: { id: string } }) =>
        roomExists ? { id: args.where.id, property_id: "property-1" } : null,
    },
    stay_registrations: {
      create: async ({ data }) => {
        const merged: Record<string, unknown> = { ...data };
        if (merged.registration_date && typeof merged.registration_date === "string") {
          merged.registration_date = new Date(merged.registration_date);
        }
        current = makeStayRegistration({
          id: "created-stay",
          ...merged,
        } as Partial<StayRegistrationRecord>);
        return current;
      },
      findUnique: async (args: { where: { id: string } }) => {
        if (options.stay === null) return null;
        if (current && args.where.id === current.id) return current;
        return null;
      },
      findMany: async () => stays,
      update: async ({ where, data }) => {
        if (!current) throw new Error("missing current stay");
        const merged: Record<string, unknown> = { ...current, ...data };
        if (merged.registration_date && typeof merged.registration_date === "string") {
          merged.registration_date = new Date(merged.registration_date);
        }
        current = makeStayRegistration({
          ...current,
          ...data,
          id: where.id,
        } as Partial<StayRegistrationRecord>);
        return current;
      },
      delete: async ({ where }) => {
        if (!current) throw new Error("missing current stay");
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

async function startTestServer(prisma: StayRegistrationPrisma): Promise<TestServer> {
  const app: Express = express();
  app.use(express.json());
  registerStayRegistrationRoutes(app, prisma);

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

describe("POST /api/stay-registrations", () => {
  let ts: TestServer;
  afterEach(async () => {
    if (ts) await ts.close();
  });

  it("returns 201 with pending drive folder status", async () => {
    const { prisma } = createPrismaMock();
    ts = await startTestServer(prisma);
    const validInput = {
      property_id: "property-1",
      tenant_id: "tenant-1",
      room_id: "room-1",
      guest_name: "Nguyen Van A",
      guest_count: 2,
      registration_date: "2026-06-18",
      registration_number: "SR-001",
      notes: "Late arrival",
    };
    const res = await ts.request("POST", "/api/stay-registrations", validInput);

    assert.equal(res.status, 201);
    const body = res.body as {
      id: string;
      guest_name: string;
      drive_folder_status: string;
      drive_folder_id: string | null;
    };
    assert.ok(body.id);
    assert.equal(body.guest_name, "Nguyen Van A");
    assert.equal(body.drive_folder_status, "pending");
    assert.equal(body.drive_folder_id, null);
  });

  it("returns 400 when required fields are missing", async () => {
    const { prisma } = createPrismaMock();
    ts = await startTestServer(prisma);
    const res = await ts.request("POST", "/api/stay-registrations", {
      property_id: "property-1",
    });

    assert.equal(res.status, 400);
    const body = res.body as { error: string; errors: unknown[] };
    assert.ok(body.error);
    assert.ok(Array.isArray(body.errors));
    assert.ok(body.errors.length > 0);
  });

  it("returns 400 for invalid guest_count", async () => {
    const { prisma } = createPrismaMock();
    ts = await startTestServer(prisma);
    const res = await ts.request("POST", "/api/stay-registrations", {
      property_id: "property-1",
      guest_name: "X",
      guest_count: 0,
      registration_date: "2026-06-18",
    });

    assert.equal(res.status, 400);
  });

  it("returns 400 for invalid registration_date", async () => {
    const { prisma } = createPrismaMock();
    ts = await startTestServer(prisma);
    const res = await ts.request("POST", "/api/stay-registrations", {
      property_id: "property-1",
      guest_name: "X",
      guest_count: 1,
      registration_date: "not-a-date",
    });

    assert.equal(res.status, 400);
  });

  it("returns 404 when property is missing", async () => {
    const { prisma } = createPrismaMock({ propertyExists: false });
    ts = await startTestServer(prisma);
    const res = await ts.request("POST", "/api/stay-registrations", {
      property_id: "missing",
      guest_name: "X",
      guest_count: 1,
      registration_date: "2026-06-18",
    });

    assert.equal(res.status, 404);
  });

  it("returns 404 when tenant is missing", async () => {
    const { prisma } = createPrismaMock({ tenantExists: false });
    ts = await startTestServer(prisma);
    const res = await ts.request("POST", "/api/stay-registrations", {
      property_id: "property-1",
      tenant_id: "missing",
      guest_name: "X",
      guest_count: 1,
      registration_date: "2026-06-18",
    });

    assert.equal(res.status, 404);
  });

  it("returns 404 when room is missing", async () => {
    const { prisma } = createPrismaMock({ roomExists: false });
    ts = await startTestServer(prisma);
    const res = await ts.request("POST", "/api/stay-registrations", {
      property_id: "property-1",
      room_id: "missing",
      guest_name: "X",
      guest_count: 1,
      registration_date: "2026-06-18",
    });

    assert.equal(res.status, 404);
  });
});

describe("GET /api/stay-registrations", () => {
  let ts: TestServer;
  afterEach(async () => {
    if (ts) await ts.close();
  });

  it("returns 200 with array of stay registrations", async () => {
    const { prisma } = createPrismaMock();
    ts = await startTestServer(prisma);
    const res = await ts.request(
      "GET",
      "/api/stay-registrations?property_id=property-1&tenant_id=tenant-1&room_id=room-1",
    );

    assert.equal(res.status, 200);
    const body = res.body as Array<{ id: string; guest_name: string }>;
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
    assert.equal(body[0].id, "stay-1");
  });

  it("returns 200 with empty array when no stays", async () => {
    const { prisma } = createPrismaMock({ stays: [], stay: null });
    ts = await startTestServer(prisma);
    const res = await ts.request("GET", "/api/stay-registrations");

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it("ignores non-numeric limit/offset", async () => {
    const { prisma } = createPrismaMock();
    ts = await startTestServer(prisma);
    const res = await ts.request("GET", "/api/stay-registrations?limit=abc&offset=NaN");

    assert.equal(res.status, 200);
  });
});

describe("GET /api/stay-registrations/:id", () => {
  let ts: TestServer;
  afterEach(async () => {
    if (ts) await ts.close();
  });

  it("returns 200 with stay registration body", async () => {
    const { prisma } = createPrismaMock();
    ts = await startTestServer(prisma);
    const res = await ts.request("GET", "/api/stay-registrations/stay-1");

    assert.equal(res.status, 200);
    const body = res.body as { id: string; guest_name: string };
    assert.equal(body.id, "stay-1");
    assert.equal(body.guest_name, "Nguyen Van A");
  });

  it("returns 404 for missing stay", async () => {
    const { prisma } = createPrismaMock({ stay: null });
    ts = await startTestServer(prisma);
    const res = await ts.request("GET", "/api/stay-registrations/missing");

    assert.equal(res.status, 404);
  });
});

describe("PUT /api/stay-registrations/:id", () => {
  let ts: TestServer;
  afterEach(async () => {
    if (ts) await ts.close();
  });

  it("returns 200 with updated body", async () => {
    const { prisma } = createPrismaMock();
    ts = await startTestServer(prisma);
    const res = await ts.request("PUT", "/api/stay-registrations/stay-1", {
      guest_name: "Updated Guest",
      guest_count: 3,
      registration_date: "2026-06-19",
    });

    assert.equal(res.status, 200);
    const body = res.body as {
      id: string;
      guest_name: string;
      guest_count: number;
    };
    assert.equal(body.id, "stay-1");
    assert.equal(body.guest_name, "Updated Guest");
    assert.equal(body.guest_count, 3);
  });

  it("returns 404 for missing stay", async () => {
    const { prisma } = createPrismaMock({ stay: null });
    ts = await startTestServer(prisma);
    const res = await ts.request("PUT", "/api/stay-registrations/missing", {
      guest_name: "X",
    });

    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid guest_count", async () => {
    const { prisma } = createPrismaMock();
    ts = await startTestServer(prisma);
    const res = await ts.request("PUT", "/api/stay-registrations/stay-1", {
      guest_count: 0,
    });

    assert.equal(res.status, 400);
  });

  it("returns 400 for invalid registration_date", async () => {
    const { prisma } = createPrismaMock();
    ts = await startTestServer(prisma);
    const res = await ts.request("PUT", "/api/stay-registrations/stay-1", {
      registration_date: "not-a-date",
    });

    assert.equal(res.status, 400);
  });
});

describe("DELETE /api/stay-registrations/:id", () => {
  let ts: TestServer;
  afterEach(async () => {
    if (ts) await ts.close();
  });

  it("returns 200 with deleted registration body", async () => {
    const { prisma } = createPrismaMock();
    ts = await startTestServer(prisma);
    const res = await ts.request("DELETE", "/api/stay-registrations/stay-1");

    assert.equal(res.status, 200);
    const body = res.body as { id: string };
    assert.equal(body.id, "stay-1");
  });

  it("returns 404 for missing stay", async () => {
    const { prisma } = createPrismaMock({ stay: null });
    ts = await startTestServer(prisma);
    const res = await ts.request("DELETE", "/api/stay-registrations/missing");

    assert.equal(res.status, 404);
  });
});
