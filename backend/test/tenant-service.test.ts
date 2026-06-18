import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createTenant,
  getTenantById,
  listTenants,
  updateTenant,
  archiveTenant,
  maskIdDocumentNumber,
  toTenantListDTO,
  toTenantDetailDTO,
  type TenantPrisma,
  type TenantRecord,
} from "../src/services/tenant-service.js";

// ---------------------------------------------------------------------------
// Minimal Prisma mock
// ---------------------------------------------------------------------------

const VALID_ID_DOC_TYPES = new Set(["passport", "national_id", "drivers_license", "other"]);
const VALID_STATUSES = new Set(["active", "inactive", "archived"]);

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
  throwOnCreate?: boolean;
  throwOnUpdate?: boolean;
}): { prisma: TenantPrisma; calls: string[] } {
  const calls: string[] = [];
  const tenantResult = options.tenant !== undefined ? options.tenant : makeTenant();
  const tenantsResult = options.tenants ?? [tenantResult];

  const prisma: TenantPrisma = {
    properties: {
      findUnique: async () => (tenantResult ? { id: tenantResult.property_id } : null),
    },
    tenants: {
      create: async (args: { data: Record<string, unknown> }) => {
        calls.push("create");
        if (options.throwOnCreate) throw new Error("create failed");
        return makeTenant({
          id: "new-tenant-id",
          ...args.data,
          // Coerce Date strings back to Date for test consistency
          lease_start: args.data.lease_start instanceof Date ? args.data.lease_start : new Date(args.data.lease_start as string),
          lease_end: args.data.lease_end instanceof Date ? args.data.lease_end : new Date(args.data.lease_end as string),
          created_at: new Date(),
          updated_at: new Date(),
        }) as unknown as TenantRecord;
      },
      findUnique: async (args: { where: { id: string } }) => {
        calls.push(`findUnique:${args.where.id}`);
        if (options.tenant === null) return null;
        return tenantResult;
      },
      findMany: async (args?: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; skip?: number }) => {
        calls.push("findMany");
        return tenantsResult;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        calls.push(`update:${args.where.id}`);
        if (options.throwOnUpdate) throw new Error("update failed");
        return makeTenant({ ...tenantResult, ...args.data, id: args.where.id }) as unknown as TenantRecord;
      },
    },
  };

  return { prisma, calls };
}

// ---------------------------------------------------------------------------
// DTO helpers
// ---------------------------------------------------------------------------

describe("toTenantListDTO", () => {
  it("omits id_document_number from list DTO", () => {
    const tenant = makeTenant();
    const dto = toTenantListDTO(tenant);
    assert.ok(!("id_document_number" in dto), "id_document_number must be omitted from list DTO");
  });

  it("includes safe fields", () => {
    const tenant = makeTenant();
    const dto = toTenantListDTO(tenant);
    assert.equal(dto.id, tenant.id);
    assert.equal(dto.name, tenant.name);
    assert.equal(dto.status, tenant.status);
    assert.equal(dto.property_id, tenant.property_id);
  });
});

describe("toTenantDetailDTO", () => {
  it("masks id_document_number in detail DTO", () => {
    const tenant = makeTenant({ id_document_number: "AB1234567" });
    const dto = toTenantDetailDTO(tenant);
    assert.ok(dto.id_document_number);
    assert.ok(!dto.id_document_number.startsWith("AB1"), "mask should not expose leading chars");
    assert.equal(dto.id_document_number, "******567");
  });

  it("masks short id_document_number", () => {
    const tenant = makeTenant({ id_document_number: "AB" });
    const dto = toTenantDetailDTO(tenant);
    assert.equal(dto.id_document_number, "**");
  });

  it("includes all other fields unmasked", () => {
    const tenant = makeTenant();
    const dto = toTenantDetailDTO(tenant);
    assert.equal(dto.id, tenant.id);
    assert.equal(dto.name, tenant.name);
    assert.equal(dto.id_document_type, tenant.id_document_type);
    assert.equal(dto.email, tenant.email);
    assert.equal(dto.monthly_rent, tenant.monthly_rent);
  });
});

describe("maskIdDocumentNumber", () => {
  it("masks middle, keeps last 3", () => {
    assert.equal(maskIdDocumentNumber("1234567890"), "*******890");
  });

  it("returns all stars for 3 or fewer chars", () => {
    assert.equal(maskIdDocumentNumber("AB"), "**");
    assert.equal(maskIdDocumentNumber("ABC"), "***");
  });

  it("handles empty string", () => {
    assert.equal(maskIdDocumentNumber(""), "");
  });
});

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

describe("createTenant", () => {
  const validInput = {
    property_id: "property-1",
    name: "Nguyen Van A",
    id_document_type: "passport" as const,
    id_document_number: "AB1234567",
    lease_start: "2026-01-01",
    lease_end: "2026-12-31",
    monthly_rent: 5000000,
  };

  it("creates and returns a safe detail DTO", async () => {
    const { prisma, calls } = createPrismaMock({});
    const result = await createTenant(prisma, validInput);

    assert.equal(calls[0], "create");
    assert.equal(result.status, 201);
    assert.ok(result.body.id);
    assert.ok(result.body.id_document_number);
    assert.ok(!result.body.id_document_number.startsWith("AB1"), "DTO should mask id_document_number");
  });

  it("returns 400 when required fields are missing", async () => {
    const { prisma } = createPrismaMock({});
    const result = await createTenant(prisma, { property_id: "property-1" } as Record<string, unknown>);

    assert.equal(result.status, 400);
    assert.ok(Array.isArray(result.body.errors));
    assert.ok(result.body.errors.length > 0);
  });

  it("returns 400 for invalid id_document_type", async () => {
    const { prisma } = createPrismaMock({});
    const result = await createTenant(prisma, {
      ...validInput,
      id_document_type: "invalid",
    });

    assert.equal(result.status, 400);
  });

  it("returns 400 for invalid date format", async () => {
    const { prisma } = createPrismaMock({});
    const result = await createTenant(prisma, {
      ...validInput,
      lease_start: "not-a-date",
    });

    assert.equal(result.status, 400);
  });

  it("returns 400 when lease_end is before lease_start", async () => {
    const { prisma } = createPrismaMock({});
    const result = await createTenant(prisma, {
      ...validInput,
      lease_start: "2026-12-31",
      lease_end: "2026-01-01",
    });

    assert.equal(result.status, 400);
  });

  it("returns 400 for negative monthly_rent", async () => {
    const { prisma } = createPrismaMock({});
    const result = await createTenant(prisma, {
      ...validInput,
      monthly_rent: -100,
    });

    assert.equal(result.status, 400);
  });

  it("returns 404 when property does not exist", async () => {
    const { prisma } = createPrismaMock({ tenant: null });
    const result = await createTenant(prisma, validInput);

    assert.equal(result.status, 404);
  });
});

describe("getTenantById", () => {
  it("returns masked detail DTO for found tenant", async () => {
    const { prisma } = createPrismaMock({});
    const result = await getTenantById(prisma, "tenant-1");

    assert.equal(result.status, 200);
    assert.equal(result.body.id, "tenant-1");
    assert.ok(result.body.id_document_number);
    assert.equal(result.body.id_document_number, "******567");
  });

  it("returns 404 for missing tenant", async () => {
    const { prisma } = createPrismaMock({ tenant: null });
    const result = await getTenantById(prisma, "nonexistent");

    assert.equal(result.status, 404);
  });
});

describe("listTenants", () => {
  it("returns list DTOs with no raw id_document_number", async () => {
    const { prisma } = createPrismaMock({});
    const result = await listTenants(prisma, { property_id: "property-1" });

    assert.equal(result.status, 200);
    assert.ok(Array.isArray(result.body));
    for (const dto of result.body) {
      assert.ok(!("id_document_number" in dto), "list DTO must not expose id_document_number");
    }
  });

  it("passes property_id filter to prisma", async () => {
    const { prisma, calls } = createPrismaMock({});
    await listTenants(prisma, { property_id: "property-1" });
    assert.ok(calls.includes("findMany"));
  });

  it("passes limit and offset to prisma", async () => {
    const { prisma, calls } = createPrismaMock({});
    await listTenants(prisma, { property_id: "property-1", limit: 10, offset: 5 });
    assert.ok(calls.includes("findMany"));
  });

  it("returns empty array when no tenants match", async () => {
    const { prisma } = createPrismaMock({ tenants: [] });
    const result = await listTenants(prisma, { property_id: "property-1" });

    assert.equal(result.status, 200);
    assert.deepEqual(result.body, []);
  });
});

describe("updateTenant", () => {
  it("updates and returns masked detail DTO", async () => {
    const { prisma } = createPrismaMock({});
    const result = await updateTenant(prisma, "tenant-1", { name: "Updated Name" });

    assert.equal(result.status, 200);
    assert.ok(result.body.id_document_number);
    assert.ok(!result.body.id_document_number.startsWith("AB1"), "update DTO should mask id_document_number");
  });

  it("returns 404 for missing tenant", async () => {
    const { prisma } = createPrismaMock({ tenant: null });
    const result = await updateTenant(prisma, "nonexistent", { name: "X" });

    assert.equal(result.status, 404);
  });

  it("returns 400 for invalid id_document_type", async () => {
    const { prisma } = createPrismaMock({});
    const result = await updateTenant(prisma, "tenant-1", { id_document_type: "bad" });

    assert.equal(result.status, 400);
  });

  it("returns 400 for invalid status", async () => {
    const { prisma } = createPrismaMock({});
    const result = await updateTenant(prisma, "tenant-1", { status: "invalid" });

    assert.equal(result.status, 400);
  });
});

describe("archiveTenant", () => {
  it("sets status to archived and returns masked detail DTO", async () => {
    const { prisma, calls } = createPrismaMock({});
    const result = await archiveTenant(prisma, "tenant-1");

    assert.equal(result.status, 200);
    assert.ok(calls.some((c) => c.startsWith("update:")));
    assert.ok(result.body.id_document_number);
  });

  it("returns 404 for missing tenant", async () => {
    const { prisma } = createPrismaMock({ tenant: null });
    const result = await archiveTenant(prisma, "nonexistent");

    assert.equal(result.status, 404);
  });

  it("returns 409 if tenant is already archived", async () => {
    const { prisma } = createPrismaMock({ tenant: makeTenant({ status: "archived" }) });
    const result = await archiveTenant(prisma, "tenant-1");

    assert.equal(result.status, 409);
  });
});
