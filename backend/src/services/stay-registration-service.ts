import { createFolder as defaultCreateFolder } from "../integrations/one/google/drive.js";

export type DriveFolderStatus = "pending" | "created" | "failed";

export type StayRegistrationRecord = {
  id: string;
  property_id: string;
  tenant_id: string | null;
  room_id: string | null;
  guest_name: string;
  guest_count: number;
  registration_date: Date | string;
  registration_number: string | null;
  drive_folder_id: string | null;
  drive_folder_status: DriveFolderStatus | string;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type StayRegistrationPrisma = {
  properties: {
    findUnique(args: { where: { id: string } }): Promise<{ id: string } | null>;
  };
  tenants: {
    findUnique(args: { where: { id: string } }): Promise<{ id: string; property_id?: string } | null>;
  };
  rooms: {
    findUnique(args: { where: { id: string } }): Promise<{ id: string; property_id?: string } | null>;
  };
  stay_registrations: {
    create(args: { data: Record<string, unknown> }): Promise<StayRegistrationRecord>;
    findUnique(args: { where: { id: string } }): Promise<StayRegistrationRecord | null>;
    findMany(args?: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, string>;
      take?: number;
      skip?: number;
    }): Promise<StayRegistrationRecord[]>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<StayRegistrationRecord>;
    delete(args: { where: { id: string } }): Promise<StayRegistrationRecord>;
  };
};

type DriveDependency = (connectionKey: string, folderName: string, parentFolderId?: string) => Promise<{ id: string; webViewLink: string }>;

export type StayRegistrationServiceDeps = {
  connectionKey?: string;
  parentFolderId?: string;
  createFolder?: DriveDependency;
};

type ServiceError = { status: 400 | 404; body: { error: string; errors?: Array<{ field: string; message: string }> } };
type ServiceCreated = { status: 201; body: StayRegistrationRecord; driveFolderTask?: Promise<void> };
type ServiceOk = { status: 200; body: StayRegistrationRecord };
type ServiceList = { status: 200; body: StayRegistrationRecord[] };

const REQUIRED_CREATE_FIELDS = ["property_id", "guest_name", "guest_count", "registration_date"] as const;
const UPDATABLE_FIELDS = new Set(["tenant_id", "room_id", "guest_name", "guest_count", "registration_date", "registration_number", "notes"]);

function serviceDeps(deps: StayRegistrationServiceDeps = {}): Required<StayRegistrationServiceDeps> {
  return {
    connectionKey: deps.connectionKey ?? process.env.ONE_CONNECTION_KEY ?? "",
    parentFolderId: deps.parentFolderId ?? process.env.STAY_REGISTRATION_DRIVE_PARENT_FOLDER_ID ?? "",
    createFolder: deps.createFolder ?? defaultCreateFolder,
  };
}

function isObject(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === "object" && !Array.isArray(input);
}

function isValidDate(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function optionalString(input: Record<string, unknown>, field: string): string | null | undefined {
  if (!(field in input)) return undefined;
  const value = input[field];
  if (value === null || value === "") return null;
  return String(value);
}

function validateCreateInput(input: Record<string, unknown>): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];

  for (const field of REQUIRED_CREATE_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === "") {
      errors.push({ field, message: `${field} is required` });
    }
  }

  if (input.guest_count !== undefined && (!Number.isInteger(Number(input.guest_count)) || Number(input.guest_count) < 1)) {
    errors.push({ field: "guest_count", message: "guest_count must be a positive integer" });
  }

  if (input.registration_date !== undefined && !isValidDate(String(input.registration_date))) {
    errors.push({ field: "registration_date", message: "Invalid registration_date" });
  }

  return errors;
}

async function validateReferences(
  prisma: StayRegistrationPrisma,
  input: Record<string, unknown>,
): Promise<ServiceError | null> {
  const property = await prisma.properties.findUnique({ where: { id: String(input.property_id) } });
  if (!property) return { status: 404, body: { error: "Property not found" } };

  if (input.tenant_id) {
    const tenant = await prisma.tenants.findUnique({ where: { id: String(input.tenant_id) } });
    if (!tenant) return { status: 404, body: { error: "Tenant not found" } };
  }

  if (input.room_id) {
    const room = await prisma.rooms.findUnique({ where: { id: String(input.room_id) } });
    if (!room) return { status: 404, body: { error: "Room not found" } };
  }

  return null;
}

function toCreateData(input: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {
    property_id: String(input.property_id),
    guest_name: String(input.guest_name),
    guest_count: Number(input.guest_count),
    registration_date: new Date(String(input.registration_date)),
    drive_folder_status: "pending",
  };

  const tenantId = optionalString(input, "tenant_id");
  const roomId = optionalString(input, "room_id");
  const registrationNumber = optionalString(input, "registration_number");
  const notes = optionalString(input, "notes");

  if (tenantId !== undefined) data.tenant_id = tenantId;
  if (roomId !== undefined) data.room_id = roomId;
  if (registrationNumber !== undefined) data.registration_number = registrationNumber;
  if (notes !== undefined) data.notes = notes;

  return data;
}

function folderNameFor(stay: StayRegistrationRecord): string {
  const dateKey = new Date(stay.registration_date).toISOString().slice(0, 10);
  const label = stay.registration_number || stay.id;
  return `${dateKey} - ${stay.guest_name} - ${label}`;
}

async function runDriveFolderWorker(
  prisma: StayRegistrationPrisma,
  stay: StayRegistrationRecord,
  deps: StayRegistrationServiceDeps,
): Promise<StayRegistrationRecord> {
  const resolvedDeps = serviceDeps(deps);
  try {
    if (!resolvedDeps.connectionKey) {
      throw new Error("ONE_CONNECTION_KEY not configured");
    }

    const folder = await resolvedDeps.createFolder(
      resolvedDeps.connectionKey,
      folderNameFor(stay),
      resolvedDeps.parentFolderId || undefined,
    );

    return await prisma.stay_registrations.update({
      where: { id: stay.id },
      data: {
        drive_folder_id: folder.id,
        drive_folder_status: "created",
      },
    });
  } catch {
    return await prisma.stay_registrations.update({
      where: { id: stay.id },
      data: { drive_folder_status: "failed" },
    });
  }
}

export async function createStayRegistration(
  prisma: StayRegistrationPrisma,
  rawInput: Record<string, unknown>,
  deps: StayRegistrationServiceDeps = {},
): Promise<ServiceCreated | ServiceError> {
  const input = isObject(rawInput) ? rawInput : {};
  const errors = validateCreateInput(input);
  if (errors.length > 0) {
    return { status: 400, body: { error: "Invalid stay registration input", errors } };
  }

  const referenceError = await validateReferences(prisma, input);
  if (referenceError) return referenceError;

  const stay = await prisma.stay_registrations.create({ data: toCreateData(input) });
  const driveFolderTask = runDriveFolderWorker(prisma, stay, deps).then(() => undefined);
  void driveFolderTask.catch(() => undefined);
  return { status: 201, body: stay, driveFolderTask };
}

export async function getStayRegistrationById(
  prisma: StayRegistrationPrisma,
  id: string,
): Promise<ServiceOk | ServiceError> {
  const stay = await prisma.stay_registrations.findUnique({ where: { id } });
  if (!stay) return { status: 404, body: { error: "Stay registration not found" } };
  return { status: 200, body: stay };
}

export async function listStayRegistrations(
  prisma: StayRegistrationPrisma,
  options: { property_id?: string; tenant_id?: string; room_id?: string; limit?: number; offset?: number },
): Promise<ServiceList> {
  const where: Record<string, unknown> = {};
  if (options.property_id) where.property_id = options.property_id;
  if (options.tenant_id) where.tenant_id = options.tenant_id;
  if (options.room_id) where.room_id = options.room_id;

  const args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, string>;
    take?: number;
    skip?: number;
  } = { where, orderBy: { registration_date: "desc" } };

  if (options.limit !== undefined) args.take = options.limit;
  if (options.offset !== undefined) args.skip = options.offset;

  const stays = await prisma.stay_registrations.findMany(args);
  return { status: 200, body: stays };
}

export async function updateStayRegistration(
  prisma: StayRegistrationPrisma,
  id: string,
  data: Record<string, unknown>,
): Promise<ServiceOk | ServiceError> {
  const existing = await prisma.stay_registrations.findUnique({ where: { id } });
  if (!existing) return { status: 404, body: { error: "Stay registration not found" } };

  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!UPDATABLE_FIELDS.has(key)) continue;
    updateData[key] = value === "" ? null : value;
  }

  if ("guest_count" in updateData && (!Number.isInteger(Number(updateData.guest_count)) || Number(updateData.guest_count) < 1)) {
    return { status: 400, body: { error: "guest_count must be a positive integer" } };
  }

  if ("registration_date" in updateData) {
    if (!isValidDate(String(updateData.registration_date))) {
      return { status: 400, body: { error: "Invalid registration_date" } };
    }
    updateData.registration_date = new Date(String(updateData.registration_date));
  }

  if ("guest_count" in updateData) updateData.guest_count = Number(updateData.guest_count);

  const stay = await prisma.stay_registrations.update({ where: { id }, data: updateData });
  return { status: 200, body: stay };
}

export async function deleteStayRegistration(
  prisma: StayRegistrationPrisma,
  id: string,
): Promise<ServiceOk | ServiceError> {
  const existing = await prisma.stay_registrations.findUnique({ where: { id } });
  if (!existing) return { status: 404, body: { error: "Stay registration not found" } };

  const deleted = await prisma.stay_registrations.delete({ where: { id } });
  return { status: 200, body: deleted };
}

export async function retryDriveFolder(
  prisma: StayRegistrationPrisma,
  id: string,
  deps: StayRegistrationServiceDeps = {},
): Promise<ServiceOk | ServiceError> {
  const stay = await prisma.stay_registrations.findUnique({ where: { id } });
  if (!stay) return { status: 404, body: { error: "Stay registration not found" } };

  const updated = await runDriveFolderWorker(prisma, stay, deps);
  return { status: 200, body: updated };
}
