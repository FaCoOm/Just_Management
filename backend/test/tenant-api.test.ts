import assert from "node:assert/strict";
import express, { type Express } from "express";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, it } from "vitest";
import { registerTenantRoutes } from "../src/routes/tenants.js";
import {
  type TenantPrisma,
  type TenantRecord,
} from "../src/services/tenant-service.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTenant(overrides: Partial<TenantRecord> = {}): TenantRecord {
  return {
    id: "tenant-1",
    property_id: "property-1",
    name: "Nguyen Van A",
    email: "a@example.com",
    phone: "+84901234567",
    id_document_type: "passport",
    id_document_number: "AB1234567",
    nationality: "Vietnamese",
    lease_start: new Date("2026-01-01T00:00:00.000Z"),
    lease_end: new Date("2026-12-31T00:00:00.000Z"),
    monthly_rent: 5000000,
    deposit_amount: 10000000,
    emergency_contact_name: "Nguyen Van B",
    emergency_contact_phone: "+84909876543",
    notes: "Test tenant",
    status: "active",
    is_vip: false,
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createPrismaMock(options: {
  tenant?: TenantRecord | null;
  tenants?: TenantRecord[];
  propertyExists?: boolean;
} = {}): TenantPrisma {
  const tenant = options.tenant !== undefined ? options.tenant : makeTenant();
  const tenants = options.tenants ?? (tenant ? [tenant] : []);
  const propertyExists = options.propertyExists ?? true;

  return {
    properties: {
      findUnique: async () =>
        propertyExists ? { id: tenant?.property_id ?? "property-1" } : null,
    },
    tenants: {
      create: async ({ data }) => {
        const merged: Record<string, unknown> = { ...data };
        if (merged.lease_start && typeof merged.lease_start === "string") {
          merged.lease_start = new Date(merged.lease_start);
        }
        if (merged.lease_end && typeof merged.lease_end === "string") {
          merged.lease_end = new Date(merged.lease_end);
        }
        return makeTenant({ id: "new-tenant-id", ...merged }) as unknown as TenantRecord;
      },
      findUnique: async ({ where }) => {
        if (options.tenant === null) return null;
        if (where.id === tenant.id) return tenant;
        return null;
      },
      findMany: async () => tenants,
      update: async ({ where, data }) =>
        makeTenant({ ...tenant, ...data, id: where.id }) as unknown as TenantRecord,
    },
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

async function startTestServer(prisma: TenantPrisma): Promise<TestServer> {
  const app: Express = express();
  app.use(express.json());
  registerTenantRoutes(app, prisma);

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

describe("POST /api/tenants", () => {
  let ts: TestServer;
  afterEach(async () => {
    if (ts) await ts.close();
  });

  it("returns 201 with masked detail DTO for valid input", async () => {
    ts = await startTestServer(createPrismaMock());
    const validInput = {
      property_id: "property-1",
      name: "Nguyen Van A",
      id_document_type: "passport",
      id_document_number: "AB1234567",
      lease_start: "2026-01-01",
      lease_end: "2026-12-31",
      monthly_rent: 5000000,
    };
    const res = await ts.request("POST", "/api/tenants", validInput);

    assert.equal(res.status, 201);
    const body = res.body as { id: string; id_document_number: string; name: string };
    assert.ok(body.id, "body should include id");
    assert.equal(body.name, "Nguyen Van A");
    assert.equal(body.id_document_number, "******567");
  });

  it("returns 400 when required fields are missing", async () => {
    ts = await startTestServer(createPrismaMock());
    const res = await ts.request("POST", "/api/tenants", { property_id: "property-1" });

    assert.equal(res.status, 400);
    const body = res.body as { error: string; errors: unknown[] };
    assert.ok(body.error);
    assert.ok(Array.isArray(body.errors));
    assert.ok(body.errors.length > 0);
  });

  it("returns 400 for invalid id_document_type", async () => {
    ts = await startTestServer(createPrismaMock());
    const res = await ts.request("POST", "/api/tenants", {
      property_id: "property-1",
      name: "X",
      id_document_type: "bad-type",
      id_document_number: "AB1234567",
      lease_start: "2026-01-01",
      lease_end: "2026-12-31",
      monthly_rent: 100,
    });

    assert.equal(res.status, 400);
  });

  it("returns 400 for negative monthly_rent", async () => {
    ts = await startTestServer(createPrismaMock());
    const res = await ts.request("POST", "/api/tenants", {
      property_id: "property-1",
      name: "X",
      id_document_type: "passport",
      id_document_number: "AB1234567",
      lease_start: "2026-01-01",
      lease_end: "2026-12-31",
      monthly_rent: -1,
    });

    assert.equal(res.status, 400);
  });

  it("returns 404 when property does not exist", async () => {
    ts = await startTestServer(createPrismaMock({ propertyExists: false }));
    const res = await ts.request("POST", "/api/tenants", {
      property_id: "missing",
      name: "X",
      id_document_type: "passport",
      id_document_number: "AB1234567",
      lease_start: "2026-01-01",
      lease_end: "2026-12-31",
      monthly_rent: 100,
    });

    assert.equal(res.status, 404);
  });

  it("accepts an empty body and returns 400", async () => {
    ts = await startTestServer(createPrismaMock());
    const res = await ts.request("POST", "/api/tenants", {});

    assert.equal(res.status, 400);
  });
});

describe("GET /api/tenants", () => {
  let ts: TestServer;
  afterEach(async () => {
    if (ts) await ts.close();
  });

  it("returns 200 with array (no raw id_document_number)", async () => {
    ts = await startTestServer(createPrismaMock());
    const res = await ts.request("GET", "/api/tenants?property_id=property-1");

    assert.equal(res.status, 200);
    const body = res.body as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(body));
    assert.ok(body.length > 0);
    for (const dto of body) {
      assert.ok(!("id_document_number" in dto), "list DTO must not expose id_document_number");
    }
  });

  it("returns 200 with empty array when no tenants", async () => {
    ts = await startTestServer(createPrismaMock({ tenants: [], tenant: null }));
    const res = await ts.request("GET", "/api/tenants");

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it("ignores non-numeric limit and offset", async () => {
    ts = await startTestServer(createPrismaMock());
    const res = await ts.request("GET", "/api/tenants?limit=notanumber&offset=NaN");

    assert.equal(res.status, 200);
  });
});

describe("GET /api/tenants/:id", () => {
  let ts: TestServer;
  afterEach(async () => {
    if (ts) await ts.close();
  });

  it("returns 200 with masked detail DTO when tenant exists", async () => {
    ts = await startTestServer(createPrismaMock());
    const res = await ts.request("GET", "/api/tenants/tenant-1");

    assert.equal(res.status, 200);
    const body = res.body as { id: string; id_document_number: string };
    assert.equal(body.id, "tenant-1");
    assert.equal(body.id_document_number, "******567");
  });

  it("returns 404 for missing tenant", async () => {
    ts = await startTestServer(createPrismaMock({ tenant: null }));
    const res = await ts.request("GET", "/api/tenants/nonexistent");

    assert.equal(res.status, 404);
    const body = res.body as { error: string };
    assert.ok(body.error);
  });
});

describe("PUT /api/tenants/:id", () => {
  let ts: TestServer;
  afterEach(async () => {
    if (ts) await ts.close();
  });

  it("returns 200 with updated masked DTO", async () => {
    ts = await startTestServer(createPrismaMock());
    const res = await ts.request("PUT", "/api/tenants/tenant-1", { name: "Updated Name" });

    assert.equal(res.status, 200);
    const body = res.body as { id: string; id_document_number: string; name: string };
    assert.equal(body.id, "tenant-1");
    assert.equal(body.name, "Updated Name");
    assert.equal(body.id_document_number, "******567");
  });

  it("returns 404 for missing tenant", async () => {
    ts = await startTestServer(createPrismaMock({ tenant: null }));
    const res = await ts.request("PUT", "/api/tenants/missing", { name: "X" });

    assert.equal(res.status, 404);
  });

  it("returns 400 for invalid status", async () => {
    ts = await startTestServer(createPrismaMock());
    const res = await ts.request("PUT", "/api/tenants/tenant-1", { status: "bad" });

    assert.equal(res.status, 400);
  });

  it("returns 400 for invalid id_document_type", async () => {
    ts = await startTestServer(createPrismaMock());
    const res = await ts.request("PUT", "/api/tenants/tenant-1", { id_document_type: "bad" });

    assert.equal(res.status, 400);
  });
});

describe("DELETE /api/tenants/:id", () => {
  let ts: TestServer;
  afterEach(async () => {
    if (ts) await ts.close();
  });

  it("returns 200 with masked DTO for active tenant (soft archive)", async () => {
    ts = await startTestServer(createPrismaMock());
    const res = await ts.request("DELETE", "/api/tenants/tenant-1");

    assert.equal(res.status, 200);
    const body = res.body as { id: string; id_document_number: string };
    assert.equal(body.id, "tenant-1");
    assert.ok(body.id_document_number);
  });

  it("returns 404 for missing tenant", async () => {
    ts = await startTestServer(createPrismaMock({ tenant: null }));
    const res = await ts.request("DELETE", "/api/tenants/missing");

    assert.equal(res.status, 404);
  });

  it("returns 409 if tenant is already archived", async () => {
    ts = await startTestServer(
      createPrismaMock({ tenant: makeTenant({ status: "archived" }) }),
    );
    const res = await ts.request("DELETE", "/api/tenants/tenant-1");

    assert.equal(res.status, 409);
  });
});
