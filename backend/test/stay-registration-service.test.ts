import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  createStayRegistration,
  deleteStayRegistration,
  getStayRegistrationById,
  listStayRegistrations,
  retryDriveFolder,
  updateStayRegistration,
  type StayRegistrationPrisma,
  type StayRegistrationRecord,
} from "../src/services/stay-registration-service.js";

function makeStayRegistration(overrides: Partial<StayRegistrationRecord> = {}): StayRegistrationRecord {
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

function createPrismaMock(options: {
  stay?: StayRegistrationRecord | null;
  stays?: StayRegistrationRecord[];
  propertyExists?: boolean;
  tenantExists?: boolean;
  roomExists?: boolean;
} = {}): { prisma: StayRegistrationPrisma; calls: Array<{ op: string; args?: unknown }> } {
  const calls: Array<{ op: string; args?: unknown }> = [];
  let current = options.stay === undefined ? makeStayRegistration() : options.stay;
  const stays = options.stays ?? (current ? [current] : []);

  const prisma: StayRegistrationPrisma = {
    properties: {
      findUnique: async (args) => {
        calls.push({ op: "property.findUnique", args });
        return options.propertyExists === false ? null : { id: args.where.id };
      },
    },
    tenants: {
      findUnique: async (args) => {
        calls.push({ op: "tenant.findUnique", args });
        return options.tenantExists === false ? null : { id: args.where.id, property_id: "property-1" };
      },
    },
    rooms: {
      findUnique: async (args) => {
        calls.push({ op: "room.findUnique", args });
        return options.roomExists === false ? null : { id: args.where.id, property_id: "property-1" };
      },
    },
    stay_registrations: {
      create: async ({ data }) => {
        calls.push({ op: "stay.create", args: data });
        current = makeStayRegistration({
          id: "created-stay",
          ...data,
          registration_date: data.registration_date instanceof Date
            ? data.registration_date
            : new Date(String(data.registration_date)),
          drive_folder_id: null,
          drive_folder_status: "pending",
        } as Partial<StayRegistrationRecord>);
        return current;
      },
      findUnique: async (args) => {
        calls.push({ op: "stay.findUnique", args });
        return current;
      },
      findMany: async (args) => {
        calls.push({ op: "stay.findMany", args });
        return stays;
      },
      update: async ({ where, data }) => {
        calls.push({ op: "stay.update", args: { where, data } });
        if (!current) throw new Error("missing current stay");
        current = makeStayRegistration({ ...current, ...data, id: where.id } as Partial<StayRegistrationRecord>);
        return current;
      },
      delete: async ({ where }) => {
        calls.push({ op: "stay.delete", args: where });
        if (!current) throw new Error("missing current stay");
        const deleted = current;
        current = null;
        return deleted;
      },
    },
  };

  return { prisma, calls };
}

describe("createStayRegistration", () => {
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

  it("returns 201 pending before Drive folder worker finishes", async () => {
    const { prisma, calls } = createPrismaMock();
    let driveResolved = false;
    let releaseDrive!: () => void;
    const driveStarted = new Promise<void>((resolve) => {
      releaseDrive = resolve;
    });

    const result = await createStayRegistration(prisma, validInput, {
      connectionKey: "test-connection",
      createFolder: async () => {
        await driveStarted;
        driveResolved = true;
        return { id: "drive-folder-1", webViewLink: "https://drive.example/folder" };
      },
    });

    assert.equal(result.status, 201);
    assert.equal(result.body.drive_folder_status, "pending");
    assert.equal(result.body.drive_folder_id, null);
    assert.equal(driveResolved, false);
    assert.ok(!("connectionKey" in result.body));

    releaseDrive();
    await result.driveFolderTask;
    assert.equal(driveResolved, true);
    assert.ok(calls.some((call) => call.op === "stay.update"));
  });

  it("updates Drive fields when async folder create succeeds", async () => {
    const { prisma, calls } = createPrismaMock();
    const result = await createStayRegistration(prisma, validInput, {
      connectionKey: "test-connection",
      createFolder: async () => ({ id: "folder-123", webViewLink: "https://drive.example/folder" }),
    });

    await result.driveFolderTask;
    const update = calls.find((call) => call.op === "stay.update");
    assert.deepEqual((update?.args as { data: unknown }).data, {
      drive_folder_id: "folder-123",
      drive_folder_status: "created",
    });
  });

  it("marks Drive folder status failed when async folder create fails", async () => {
    const { prisma, calls } = createPrismaMock();
    const result = await createStayRegistration(prisma, validInput, {
      connectionKey: "test-connection",
      createFolder: async () => {
        throw new Error("Drive outage");
      },
    });

    assert.equal(result.status, 201);
    assert.equal(result.body.drive_folder_status, "pending");

    await result.driveFolderTask;
    const update = calls.find((call) => call.op === "stay.update");
    assert.deepEqual((update?.args as { data: unknown }).data, {
      drive_folder_status: "failed",
    });
  });

  it("returns 400 when required fields are missing", async () => {
    const { prisma } = createPrismaMock();
    const result = await createStayRegistration(prisma, { property_id: "property-1" });
    assert.equal(result.status, 400);
    assert.ok(Array.isArray(result.body.errors));
  });

  it("returns 400 for invalid guest_count", async () => {
    const { prisma } = createPrismaMock();
    const result = await createStayRegistration(prisma, { ...validInput, guest_count: 0 });
    assert.equal(result.status, 400);
  });

  it("returns 404 when property is missing", async () => {
    const { prisma } = createPrismaMock({ propertyExists: false });
    const result = await createStayRegistration(prisma, validInput);
    assert.equal(result.status, 404);
  });
});

describe("stay registration CRUD", () => {
  it("gets by id", async () => {
    const { prisma } = createPrismaMock();
    const result = await getStayRegistrationById(prisma, "stay-1");
    assert.equal(result.status, 200);
    assert.equal(result.body.id, "stay-1");
  });

  it("returns 404 for missing id", async () => {
    const { prisma } = createPrismaMock({ stay: null });
    const result = await getStayRegistrationById(prisma, "missing");
    assert.equal(result.status, 404);
  });

  it("lists with property, tenant, room filters", async () => {
    const { prisma, calls } = createPrismaMock();
    const result = await listStayRegistrations(prisma, {
      property_id: "property-1",
      tenant_id: "tenant-1",
      room_id: "room-1",
    });

    assert.equal(result.status, 200);
    const call = calls.find((entry) => entry.op === "stay.findMany");
    assert.deepEqual((call?.args as { where: unknown }).where, {
      property_id: "property-1",
      tenant_id: "tenant-1",
      room_id: "room-1",
    });
  });

  it("updates allowed fields", async () => {
    const { prisma, calls } = createPrismaMock();
    const result = await updateStayRegistration(prisma, "stay-1", {
      guest_name: "Updated Guest",
      guest_count: 3,
      registration_date: "2026-06-19",
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.guest_name, "Updated Guest");
    assert.ok(calls.some((entry) => entry.op === "stay.update"));
  });

  it("deletes existing registration", async () => {
    const { prisma, calls } = createPrismaMock();
    const result = await deleteStayRegistration(prisma, "stay-1");
    assert.equal(result.status, 200);
    assert.equal(result.body.id, "stay-1");
    assert.ok(calls.some((entry) => entry.op === "stay.delete"));
  });
});

describe("retryDriveFolder", () => {
  it("creates Drive folder for existing stay and marks created", async () => {
    const { prisma } = createPrismaMock();
    const result = await retryDriveFolder(prisma, "stay-1", {
      connectionKey: "test-connection",
      createFolder: async () => ({ id: "retry-folder", webViewLink: "https://drive.example/retry" }),
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.drive_folder_id, "retry-folder");
    assert.equal(result.body.drive_folder_status, "created");
  });

  it("marks failed and returns 200 when retry folder create fails", async () => {
    const { prisma } = createPrismaMock();
    const result = await retryDriveFolder(prisma, "stay-1", {
      connectionKey: "test-connection",
      createFolder: async () => {
        throw new Error("Drive outage");
      },
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.drive_folder_status, "failed");
  });

  it("returns 404 for missing stay", async () => {
    const { prisma } = createPrismaMock({ stay: null });
    const result = await retryDriveFolder(prisma, "missing", {
      connectionKey: "test-connection",
      createFolder: async () => ({ id: "x", webViewLink: "https://drive.example/x" }),
    });

    assert.equal(result.status, 404);
  });
});
