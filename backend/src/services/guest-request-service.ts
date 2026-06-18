export type GuestRequestStatus = "open" | "assigned" | "in_progress" | "fulfilled" | "closed" | "reopened";
export type GuestRequestPriority = "low" | "medium" | "high" | "urgent";

export type GuestRequestRecord = {
  id: string;
  guest_id: string;
  room_id: string;
  request_type: string;
  notes: string;
  description: string | null;
  status: GuestRequestStatus | string;
  priority: GuestRequestPriority | string;
  assigned_to: string | null;
  is_completed: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  completed_at: Date | string | null;
  reservation_id: string | null;
  property_id: string | null;
};

export type GuestRequestPrisma = {
  properties: {
    findUnique(args: { where: { id: string } }): Promise<{ id: string } | null>;
  };
  guests: {
    findUnique(args: { where: { id: string } }): Promise<{ id: string; property_id?: string } | null>;
  };
  rooms: {
    findUnique(args: { where: { id: string } }): Promise<{ id: string; property_id?: string } | null>;
  };
  reservations: {
    findUnique(args: { where: { id: string } }): Promise<{ id: string; property_id?: string } | null>;
  };
  guest_requests: {
    create(args: { data: Record<string, unknown> }): Promise<GuestRequestRecord>;
    findUnique(args: { where: { id: string } }): Promise<GuestRequestRecord | null>;
    findMany(args?: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, string>;
      take?: number;
      skip?: number;
    }): Promise<GuestRequestRecord[]>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<GuestRequestRecord>;
    delete(args: { where: { id: string } }): Promise<GuestRequestRecord>;
  };
};

type ServiceError = { status: 400 | 404 | 422; body: { error: string; errors?: Array<{ field: string; message: string }> } };
type ServiceCreated = { status: 201; body: GuestRequestRecord };
type ServiceOk = { status: 200; body: GuestRequestRecord };
type ServiceList = { status: 200; body: GuestRequestRecord[] };

const REQUIRED_CREATE_FIELDS = ["guest_id", "room_id", "request_type"] as const;
const VALID_STATUSES = new Set<GuestRequestStatus>(["open", "assigned", "in_progress", "fulfilled", "closed", "reopened"]);
const VALID_PRIORITIES = new Set<GuestRequestPriority>(["low", "medium", "high", "urgent"]);
const COMPLETED_STATUSES = new Set<GuestRequestStatus>(["fulfilled", "closed"]);
const ALLOWED_TRANSITIONS: Record<GuestRequestStatus, GuestRequestStatus[]> = {
  open: ["assigned"],
  assigned: ["in_progress"],
  in_progress: ["fulfilled"],
  fulfilled: ["closed"],
  closed: ["reopened"],
  reopened: ["assigned"],
};
const UPDATABLE_FIELDS = new Set(["request_type", "notes", "description", "priority", "assigned_to", "reservation_id", "property_id"]);

function isValidStatus(value: unknown): value is GuestRequestStatus {
  return typeof value === "string" && VALID_STATUSES.has(value as GuestRequestStatus);
}

function isCompletedStatus(status: GuestRequestStatus): boolean {
  return COMPLETED_STATUSES.has(status);
}

function validateCreateInput(input: Record<string, unknown>): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];

  for (const field of REQUIRED_CREATE_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === "") {
      errors.push({ field, message: `${field} is required` });
    }
  }

  if (input.priority !== undefined && !VALID_PRIORITIES.has(String(input.priority) as GuestRequestPriority)) {
    errors.push({ field: "priority", message: "Invalid priority" });
  }

  return errors;
}

function buildUpdateData(input: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (const field of UPDATABLE_FIELDS) {
    if (input[field] !== undefined) {
      data[field] = input[field] === null ? null : String(input[field]);
    }
  }

  return data;
}

function applyDerivedStatusFields(data: Record<string, unknown>, status: GuestRequestStatus, now = new Date()): void {
  data.status = status;
  data.is_completed = isCompletedStatus(status);
  if (status === "fulfilled" || status === "closed") {
    data.completed_at = now;
  } else {
    data.completed_at = null;
  }
}

export async function createRequest(
  prisma: GuestRequestPrisma,
  input: Record<string, unknown>
): Promise<ServiceCreated | ServiceError> {
  const errors = validateCreateInput(input);
  if (errors.length > 0) {
    return { status: 400, body: { error: "Invalid guest request input", errors } };
  }

  const guest = await prisma.guests.findUnique({ where: { id: String(input.guest_id) } });
  if (!guest) return { status: 404, body: { error: "Guest not found" } };

  const room = await prisma.rooms.findUnique({ where: { id: String(input.room_id) } });
  if (!room) return { status: 404, body: { error: "Room not found" } };

  if (input.property_id !== undefined && input.property_id !== null) {
    const property = await prisma.properties.findUnique({ where: { id: String(input.property_id) } });
    if (!property) return { status: 404, body: { error: "Property not found" } };
  }

  if (input.reservation_id !== undefined && input.reservation_id !== null) {
    const reservation = await prisma.reservations.findUnique({ where: { id: String(input.reservation_id) } });
    if (!reservation) return { status: 404, body: { error: "Reservation not found" } };
  }

  const data: Record<string, unknown> = {
    guest_id: String(input.guest_id),
    room_id: String(input.room_id),
    request_type: String(input.request_type),
    notes: input.notes === undefined || input.notes === null ? "" : String(input.notes),
    status: "open",
    priority: input.priority === undefined || input.priority === null ? "medium" : String(input.priority),
    is_completed: false,
    completed_at: null,
  };

  if (input.description !== undefined) data.description = input.description === null ? null : String(input.description);
  if (input.assigned_to !== undefined) data.assigned_to = input.assigned_to === null ? null : String(input.assigned_to);
  if (input.reservation_id !== undefined) data.reservation_id = input.reservation_id === null ? null : String(input.reservation_id);
  if (input.property_id !== undefined) data.property_id = input.property_id === null ? null : String(input.property_id);

  const request = await prisma.guest_requests.create({ data });
  return { status: 201, body: request };
}

export async function getRequestById(prisma: GuestRequestPrisma, id: string): Promise<ServiceOk | ServiceError> {
  const request = await prisma.guest_requests.findUnique({ where: { id } });
  if (!request) return { status: 404, body: { error: "Guest request not found" } };
  return { status: 200, body: request };
}

export async function listRequests(
  prisma: GuestRequestPrisma,
  options: { property_id?: string; status?: string; assigned_to?: string; limit?: number; offset?: number }
): Promise<ServiceList | ServiceError> {
  if (options.status !== undefined && !VALID_STATUSES.has(options.status as GuestRequestStatus)) {
    return { status: 400, body: { error: "Invalid status" } };
  }

  const where: Record<string, unknown> = {};
  if (options.property_id) where.property_id = options.property_id;
  if (options.status) where.status = options.status;
  if (options.assigned_to) where.assigned_to = options.assigned_to;

  const args: { where?: Record<string, unknown>; orderBy?: Record<string, string>; take?: number; skip?: number } = {
    where,
    orderBy: { created_at: "desc" },
  };
  if (options.limit !== undefined) args.take = options.limit;
  if (options.offset !== undefined) args.skip = options.offset;

  const requests = await prisma.guest_requests.findMany(args);
  return { status: 200, body: requests };
}

export async function transitionStatus(
  prisma: GuestRequestPrisma,
  id: string,
  nextStatus: unknown,
  input: Record<string, unknown> = {}
): Promise<ServiceOk | ServiceError> {
  if (!isValidStatus(nextStatus)) {
    return { status: 400, body: { error: "Invalid status" } };
  }

  const existing = await prisma.guest_requests.findUnique({ where: { id } });
  if (!existing) return { status: 404, body: { error: "Guest request not found" } };
  if (!isValidStatus(existing.status)) return { status: 422, body: { error: "Invalid state transition" } };

  if (!ALLOWED_TRANSITIONS[existing.status].includes(nextStatus)) {
    return { status: 422, body: { error: "Invalid state transition" } };
  }

  const assignedTo = input.assigned_to ?? existing.assigned_to;
  if ((nextStatus === "assigned" || nextStatus === "in_progress") && (assignedTo === undefined || assignedTo === null || String(assignedTo).trim() === "")) {
    return { status: 422, body: { error: "assigned_to is required" } };
  }

  const data = buildUpdateData(input);
  applyDerivedStatusFields(data, nextStatus);

  const request = await prisma.guest_requests.update({ where: { id }, data });
  return { status: 200, body: request };
}

export async function updateRequest(
  prisma: GuestRequestPrisma,
  id: string,
  input: Record<string, unknown>
): Promise<ServiceOk | ServiceError> {
  if (input.priority !== undefined && !VALID_PRIORITIES.has(String(input.priority) as GuestRequestPriority)) {
    return { status: 400, body: { error: "Invalid priority" } };
  }

  if (input.status !== undefined) {
    return transitionStatus(prisma, id, input.status, input);
  }

  const existing = await prisma.guest_requests.findUnique({ where: { id } });
  if (!existing) return { status: 404, body: { error: "Guest request not found" } };

  const data = buildUpdateData(input);
  const request = await prisma.guest_requests.update({ where: { id }, data });
  return { status: 200, body: request };
}

export async function deleteRequest(prisma: GuestRequestPrisma, id: string): Promise<ServiceOk | ServiceError> {
  const existing = await prisma.guest_requests.findUnique({ where: { id } });
  if (!existing) return { status: 404, body: { error: "Guest request not found" } };

  const request = await prisma.guest_requests.delete({ where: { id } });
  return { status: 200, body: request };
}
