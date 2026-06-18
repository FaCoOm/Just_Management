import assert from "node:assert/strict";
import express, { type Express } from "express";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { registerStayRegistrationRoutes } from "../src/routes/stay-registrations.js";
import { registerTenantRoutes } from "../src/routes/tenants.js";
import {
  type StayRegistrationPrisma,
  type StayRegistrationRecord,
} from "../src/services/stay-registration-service.js";
import { type TenantPrisma, type TenantRecord } from "../src/services/tenant-service.js";

const driveMock = vi.hoisted(() => ({
  createFolder: vi.fn<
    (connectionKey: string, folderName: string, parentFolderId?: string) => Promise<{ id: string; webViewLink: string }>
  >(),
}));

vi.mock("../src/integrations/one/google/drive.js", () => ({
  createFolder: driveMock.createFolder,
}));

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
    emergency_contact_name: null,
    emergency_contact_phone: null,
    notes: null,
    status: "active",
    is_vip: false,
    created_at: new Date("2026-06-18T01:00:00.000Z"),
    updated_at: new Date("2026-06-18T01:00:00.000Z"),
    ...overrides,
  };
}

function makeStayRegistration(
  overrides: Partial<StayRegistrationRecord> = {},
): StayRegistrationRecord {
  return {
    id: "stay-1",
    property_id: "property-1",
    tenant_id: "tenant-1",
    room_id: null,
    guest_name: "Nguyen Van A",
    guest_count: 2,
    registration_date: new Date("2026-06-18T00:00:00.000Z"),
    registration_number: "SR-001",
    drive_folder_id: null,
    drive_folder_status: "pending",
    notes: null,
    created_at: new Date("2026-06-18T01:00:00.000Z"),
    updated_at: new Date("2026-06-18T01:00:00.000Z"),
    ...overrides,
  };
}

type CombinedPrisma = TenantPrisma & StayRegistrationPrisma;

function createPrismaMock(): CombinedPrisma {
  const tenants = new Map<string, TenantRecord>();
  const stays = new Map<string, StayRegistrationRecord>();

  return {
    properties: {
      findUnique: async ({ where }) => (where.id === "property-1" ? { id: where.id } : null),
    },
    tenants: {
      create: async ({ data }) => {
        const tenant = makeTenant({
          id: `tenant-${tenants.size + 1}`,
          ...data,
          lease_start: new Date(String(data.lease_start)),
          lease_end: new Date(String(data.lease_end)),
        } as Partial<TenantRecord>);
        tenants.set(tenant.id, tenant);
        return tenant;
      },
      findUnique: async ({ where }) => tenants.get(where.id) ?? null,
      findMany: async () => Array.from(tenants.values()),
      update: async ({ where, data }) => {
        const existing = tenants.get(where.id);
        if (!existing) throw new Error("missing tenant");
        const updated = makeTenant({ ...existing, ...data, id: where.id });
        tenants.set(where.id, updated);
        return updated;
      },
    },
    rooms: {
      findUnique: async ({ where }) => ({ id: where.id, property_id: "property-1" }),
    },
    stay_registrations: {
      create: async ({ data }) => {
        const stay = makeStayRegistration({
          id: `stay-${stays.size + 1}`,
          ...data,
          registration_date: new Date(String(data.registration_date)),
        } as Partial<StayRegistrationRecord>);
        stays.set(stay.id, stay);
        return stay;
      },
      findUnique: async ({ where }) => stays.get(where.id) ?? null,
      findMany: async () => Array.from(stays.values()),
      update: async ({ where, data }) => {
        const existing = stays.get(where.id);
        if (!existing) throw new Error("missing stay registration");
        const updated = makeStayRegistration({
          ...existing,
          ...data,
          id: where.id,
          registration_date:
            data.registration_date === undefined
              ? existing.registration_date
              : new Date(String(data.registration_date)),
        } as Partial<StayRegistrationRecord>);
        stays.set(where.id, updated);
        return updated;
      },
      delete: async ({ where }) => {
        const existing = stays.get(where.id);
        if (!existing) throw new Error("missing stay registration");
        stays.delete(where.id);
        return existing;
      },
    },
  };
}

interface TestServer {
  close(): Promise<void>;
  request(method: string, path: string, body?: unknown): Promise<{ status: number; body: unknown }>;
}

async function startTestServer(prisma: CombinedPrisma): Promise<TestServer> {
  const app: Express = express();
  app.use(express.json());
  registerTenantRoutes(app, prisma);
  registerStayRegistrationRoutes(app, prisma);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
    async request(method: string, path: string, body?: unknown) {
      const init: RequestInit = { method, headers: { "Content-Type": "application/json" } };
      if (body !== undefined) init.body = JSON.stringify(body);
      const res = await fetch(`${baseUrl}${path}`, init);
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    },
  };
}

function tenantInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    property_id: "property-1",
    name: "Nguyen Van A",
    id_document_type: "passport",
    id_document_number: "AB1234567",
    lease_start: "2026-01-01",
    lease_end: "2026-12-31",
    monthly_rent: 5000000,
    ...overrides,
  };
}

function stayInput(tenantId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    property_id: "property-1",
    tenant_id: tenantId,
    guest_name: "Nguyen Van A",
    guest_count: 2,
    registration_date: "2026-06-18",
    registration_number: "SR-001",
    ...overrides,
  };
}

async function waitForDriveStatus(
  ts: TestServer,
  id: string,
  status: "created" | "failed",
): Promise<StayRegistrationRecord> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const res = await ts.request("GET", `/api/stay-registrations/${id}`);
    assert.equal(res.status, 200);
    const stay = res.body as StayRegistrationRecord;
    if (stay.drive_folder_status === status) return stay;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for drive_folder_status=${status}`);
}

describe("stay registration Drive folder integration", () => {
  let ts: TestServer | undefined;
  const previousConnectionKey = process.env.ONE_CONNECTION_KEY;

  beforeEach(() => {
    process.env.ONE_CONNECTION_KEY = "test-connection";
    driveMock.createFolder.mockReset();
  });

  afterEach(async () => {
    if (ts) await ts.close();
    ts = undefined;
    process.env.ONE_CONNECTION_KEY = previousConnectionKey;
  });

  it("creates tenant and stay, returns pending immediately, then persists Drive success", async () => {
    const prisma = createPrismaMock();
    let resolveDrive!: (folder: { id: string; webViewLink: string }) => void;
    driveMock.createFolder.mockReturnValue(
      new Promise((resolve) => {
        resolveDrive = resolve;
      }),
    );
    ts = await startTestServer(prisma);

    const tenantRes = await ts.request("POST", "/api/tenants", tenantInput());
    assert.equal(tenantRes.status, 201);
    const tenant = tenantRes.body as { id: string };

    const createRes = await ts.request("POST", "/api/stay-registrations", stayInput(tenant.id));
    assert.equal(createRes.status, 201);
    const created = createRes.body as StayRegistrationRecord;
    assert.equal(created.tenant_id, tenant.id);
    assert.equal(created.drive_folder_status, "pending");
    assert.equal(created.drive_folder_id, null);
    assert.equal(driveMock.createFolder.mock.calls.length, 1);

    resolveDrive({ id: "drive-folder-1", webViewLink: "https://drive.test/folder/1" });
    const afterDrive = await waitForDriveStatus(ts, created.id, "created");
    assert.equal(afterDrive.drive_folder_id, "drive-folder-1");
    assert.equal(afterDrive.drive_folder_status, "created");

    const updateRes = await ts.request("PUT", `/api/stay-registrations/${created.id}`, {
      guest_count: 4,
    });
    assert.equal(updateRes.status, 200);
    const updated = updateRes.body as StayRegistrationRecord;
    assert.equal(updated.guest_count, 4);
  });

  it("creates registration when Drive folder creation fails and later marks it failed", async () => {
    driveMock.createFolder.mockRejectedValue(new Error("Drive unavailable"));
    ts = await startTestServer(createPrismaMock());

    const tenantRes = await ts.request("POST", "/api/tenants", tenantInput({ name: "Failure Case" }));
    assert.equal(tenantRes.status, 201);
    const tenant = tenantRes.body as { id: string };

    const createRes = await ts.request(
      "POST",
      "/api/stay-registrations",
      stayInput(tenant.id, { guest_name: "Failure Case" }),
    );
    assert.equal(createRes.status, 201);
    const created = createRes.body as StayRegistrationRecord;
    assert.ok(created.id);
    assert.notEqual(createRes.status, 500);

    const afterDrive = await waitForDriveStatus(ts, created.id, "failed");
    assert.equal(afterDrive.drive_folder_id, null);
    assert.equal(afterDrive.drive_folder_status, "failed");
  });
});
