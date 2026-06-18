// ---------------------------------------------------------------------------
// Tenant Service — CRUD operations with safe DTOs
// ---------------------------------------------------------------------------

const VALID_ID_DOC_TYPES = new Set(["passport", "national_id", "drivers_license", "other"]);
const VALID_STATUSES = new Set(["active", "inactive", "archived"]);

const REQUIRED_CREATE_FIELDS = [
  "property_id",
  "name",
  "id_document_type",
  "id_document_number",
  "lease_start",
  "lease_end",
  "monthly_rent",
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TenantRecord = {
  id: string;
  property_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  id_document_type: string;
  id_document_number: string;
  nationality: string | null;
  lease_start: Date | string;
  lease_end: Date | string;
  monthly_rent: number;
  deposit_amount: number | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  status: string;
  is_vip: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

export type TenantPrisma = {
  properties: {
    findUnique(args: { where: { id: string } }): Promise<{ id: string } | null>;
  };
  tenants: {
    create(args: { data: Record<string, unknown> }): Promise<TenantRecord>;
    findUnique(args: { where: { id: string } }): Promise<TenantRecord | null>;
    findMany(args?: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, string>;
      take?: number;
      skip?: number;
    }): Promise<TenantRecord[]>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<TenantRecord>;
  };
};

type ServiceError = { status: 400 | 404 | 409; body: { error: string; errors?: Array<{ field: string; message: string }> } };
type ServiceCreated = { status: 201; body: TenantDetailDTO };
type ServiceOk = { status: 200; body: TenantDetailDTO };
type ServiceList = { status: 200; body: TenantListDTO[] };

// ---------------------------------------------------------------------------
// DTO helpers
// ---------------------------------------------------------------------------

export type TenantListDTO = Omit<TenantRecord, "id_document_number">;

export type TenantDetailDTO = Omit<TenantRecord, "id_document_number"> & {
  id_document_number: string;
};

export function maskIdDocumentNumber(value: string): string {
  if (value === "") return "";
  if (value.length <= 3) return "*".repeat(value.length);
  return "*".repeat(value.length - 3) + value.slice(-3);
}

export function toTenantListDTO(tenant: TenantRecord): TenantListDTO {
  const dto: TenantListDTO = { ...tenant };
  delete (dto as Record<string, unknown>).id_document_number;
  return dto;
}

export function toTenantDetailDTO(tenant: TenantRecord): TenantDetailDTO {
  return {
    ...toTenantListDTO(tenant),
    id_document_number: maskIdDocumentNumber(tenant.id_document_number),
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isValidDate(value: string): boolean {
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function validateCreateInput(input: Record<string, unknown>): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];

  for (const field of REQUIRED_CREATE_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === "") {
      errors.push({ field, message: `${field} is required` });
    }
  }

  if (input.id_document_type !== undefined && !VALID_ID_DOC_TYPES.has(String(input.id_document_type))) {
    errors.push({ field: "id_document_type", message: "Invalid id_document_type" });
  }

  if (input.lease_start !== undefined && !isValidDate(String(input.lease_start))) {
    errors.push({ field: "lease_start", message: "Invalid lease_start date" });
  }

  if (input.lease_end !== undefined && !isValidDate(String(input.lease_end))) {
    errors.push({ field: "lease_end", message: "Invalid lease_end date" });
  }

  if (
    input.lease_start !== undefined &&
    input.lease_end !== undefined &&
    isValidDate(String(input.lease_start)) &&
    isValidDate(String(input.lease_end)) &&
    new Date(String(input.lease_end)) < new Date(String(input.lease_start))
  ) {
    errors.push({ field: "lease_end", message: "lease_end must be on or after lease_start" });
  }

  if (input.monthly_rent !== undefined && (typeof input.monthly_rent !== "number" || input.monthly_rent < 0)) {
    errors.push({ field: "monthly_rent", message: "monthly_rent must be a non-negative number" });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function createTenant(
  prisma: TenantPrisma,
  input: Record<string, unknown>
): Promise<ServiceCreated | ServiceError> {
  const errors = validateCreateInput(input);
  if (errors.length > 0) {
    return { status: 400, body: { error: "Invalid tenant input", errors } };
  }

  const property = await prisma.properties.findUnique({ where: { id: String(input.property_id) } });
  if (!property) {
    return { status: 404, body: { error: "Property not found" } };
  }

  const data: Record<string, unknown> = {
    property_id: String(input.property_id),
    name: String(input.name),
    id_document_type: String(input.id_document_type),
    id_document_number: String(input.id_document_number),
    lease_start: new Date(String(input.lease_start)),
    lease_end: new Date(String(input.lease_end)),
    monthly_rent: Number(input.monthly_rent),
    status: "active",
    is_vip: false,
  };

  if (input.email !== undefined && input.email !== null) data.email = String(input.email);
  if (input.phone !== undefined && input.phone !== null) data.phone = String(input.phone);
  if (input.nationality !== undefined && input.nationality !== null) data.nationality = String(input.nationality);
  if (input.deposit_amount !== undefined && input.deposit_amount !== null) data.deposit_amount = Number(input.deposit_amount);
  if (input.emergency_contact_name !== undefined && input.emergency_contact_name !== null) data.emergency_contact_name = String(input.emergency_contact_name);
  if (input.emergency_contact_phone !== undefined && input.emergency_contact_phone !== null) data.emergency_contact_phone = String(input.emergency_contact_phone);
  if (input.notes !== undefined && input.notes !== null) data.notes = String(input.notes);

  const tenant = await prisma.tenants.create({ data });
  return { status: 201, body: toTenantDetailDTO(tenant) };
}

export async function getTenantById(
  prisma: TenantPrisma,
  id: string
): Promise<ServiceOk | ServiceError> {
  const tenant = await prisma.tenants.findUnique({ where: { id } });
  if (!tenant) {
    return { status: 404, body: { error: "Tenant not found" } };
  }
  return { status: 200, body: toTenantDetailDTO(tenant) };
}

export async function listTenants(
  prisma: TenantPrisma,
  options: { property_id?: string; limit?: number; offset?: number }
): Promise<ServiceList> {
  const where: Record<string, unknown> = {};
  if (options.property_id) where.property_id = options.property_id;

  const args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, string>;
    take?: number;
    skip?: number;
  } = { where, orderBy: { name: "asc" } };

  if (options.limit !== undefined) args.take = options.limit;
  if (options.offset !== undefined) args.skip = options.offset;

  const tenants = await prisma.tenants.findMany(args);
  return { status: 200, body: tenants.map(toTenantListDTO) };
}

export async function updateTenant(
  prisma: TenantPrisma,
  id: string,
  data: Record<string, unknown>
): Promise<ServiceOk | ServiceError> {
  if (data.id_document_type !== undefined && !VALID_ID_DOC_TYPES.has(String(data.id_document_type))) {
    return { status: 400, body: { error: "Invalid id_document_type" } };
  }

  if (data.status !== undefined && !VALID_STATUSES.has(String(data.status))) {
    return { status: 400, body: { error: "Invalid status" } };
  }

  const existing = await prisma.tenants.findUnique({ where: { id } });
  if (!existing) {
    return { status: 404, body: { error: "Tenant not found" } };
  }

  const updateData: Record<string, unknown> = { ...data };
  if (data.lease_start !== undefined) updateData.lease_start = new Date(String(data.lease_start));
  if (data.lease_end !== undefined) updateData.lease_end = new Date(String(data.lease_end));
  if (data.monthly_rent !== undefined) updateData.monthly_rent = Number(data.monthly_rent);

  const tenant = await prisma.tenants.update({ where: { id }, data: updateData });
  return { status: 200, body: toTenantDetailDTO(tenant) };
}

export async function archiveTenant(
  prisma: TenantPrisma,
  id: string
): Promise<ServiceOk | ServiceError> {
  const existing = await prisma.tenants.findUnique({ where: { id } });
  if (!existing) {
    return { status: 404, body: { error: "Tenant not found" } };
  }

  if (existing.status === "archived") {
    return { status: 409, body: { error: "Tenant is already archived" } };
  }

  const tenant = await prisma.tenants.update({ where: { id }, data: { status: "archived" } });
  return { status: 200, body: toTenantDetailDTO(tenant) };
}
