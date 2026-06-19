import type { PrismaClient, StayType } from "@prisma/client";

export type StayExperienceRecord = {
  id: string;
  reservation_id: string;
  channel_id: string | null;
  external_ref_id: string | null;
  platform_reference: string | null;
  stay_type: StayType | null;
  experience_notes: string;
  guest_request_content: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type StayExperiencePrisma = PrismaClient;

type ServiceError = { status: 400 | 404; body: { error: string; errors?: Array<{ field: string; message: string }> } };
type ServiceCreated = { status: 201; body: StayExperienceRecord };
type ServiceOk = { status: 200; body: StayExperienceRecord };
type ServiceList = { status: 200; body: StayExperienceRecord[] };
type ServiceNoContent = { status: 204; body: null };

const STAY_TYPES = new Set<StayType>(["short_term", "long_term"]);
const INCLUDE_RESERVATION = { reservation: true } as const;

function optionalString(input: Record<string, unknown>, key: string): string | null | undefined {
  if (input[key] === undefined) return undefined;
  if (input[key] === null) return null;
  return String(input[key]);
}

function stayType(input: unknown): StayType | null | undefined {
  if (input === undefined) return undefined;
  if (input === null || input === "") return null;
  return typeof input === "string" && STAY_TYPES.has(input as StayType) ? input as StayType : undefined;
}

export async function createStayExperience(prisma: StayExperiencePrisma, input: Record<string, unknown>): Promise<ServiceCreated | ServiceError> {
  if (!input.reservation_id) return { status: 400, body: { error: "Invalid stay experience", errors: [{ field: "reservation_id", message: "reservation_id is required" }] } };
  const parsedStayType = stayType(input.stay_type);
  if (parsedStayType === undefined && input.stay_type !== undefined) return { status: 400, body: { error: "Invalid stay_type", errors: [{ field: "stay_type", message: "Invalid stay_type" }] } };
  const reservation = await prisma.reservations.findUnique({ where: { id: String(input.reservation_id) } });
  if (!reservation) return { status: 404, body: { error: "Reservation not found", errors: [{ field: "reservation_id", message: "Reservation not found" }] } };
  const body = await prisma.stay_experiences.create({
    data: {
      reservation_id: String(input.reservation_id),
      channel_id: optionalString(input, "channel_id"),
      external_ref_id: optionalString(input, "external_ref_id"),
      platform_reference: optionalString(input, "platform_reference"),
      stay_type: parsedStayType ?? null,
      experience_notes: optionalString(input, "experience_notes") ?? "",
      guest_request_content: optionalString(input, "guest_request_content") ?? "",
    },
    include: INCLUDE_RESERVATION,
  });
  return { status: 201, body };
}

export async function listStayExperiences(prisma: StayExperiencePrisma, filters: { property_id?: string; reservation_id?: string; stay_type?: string }): Promise<ServiceList | ServiceError> {
  const where: Record<string, unknown> = {};
  if (filters.reservation_id) where.reservation_id = filters.reservation_id;
  if (filters.property_id) where.reservation = { property_id: filters.property_id };
  if (filters.stay_type) {
    if (!STAY_TYPES.has(filters.stay_type as StayType)) return { status: 400, body: { error: "Invalid stay_type" } };
    where.stay_type = filters.stay_type;
  }
  const body = await prisma.stay_experiences.findMany({ where, orderBy: { created_at: "desc" }, include: INCLUDE_RESERVATION });
  return { status: 200, body };
}

export async function getStayExperienceById(prisma: StayExperiencePrisma, id: string): Promise<ServiceOk | ServiceError> {
  const body = await prisma.stay_experiences.findUnique({ where: { id }, include: INCLUDE_RESERVATION });
  return body ? { status: 200, body } : { status: 404, body: { error: "Stay experience not found" } };
}

export async function updateStayExperience(prisma: StayExperiencePrisma, id: string, input: Record<string, unknown>): Promise<ServiceOk | ServiceError> {
  const existing = await prisma.stay_experiences.findUnique({ where: { id } });
  if (!existing) return { status: 404, body: { error: "Stay experience not found" } };
  const parsedStayType = stayType(input.stay_type);
  if (parsedStayType === undefined && input.stay_type !== undefined) return { status: 400, body: { error: "Invalid stay_type", errors: [{ field: "stay_type", message: "Invalid stay_type" }] } };
  const data: Record<string, unknown> = {};
  for (const key of ["channel_id", "external_ref_id", "platform_reference", "experience_notes", "guest_request_content"] as const) {
    const value = optionalString(input, key);
    if (value !== undefined) data[key] = value;
  }
  if (input.stay_type !== undefined) data.stay_type = parsedStayType ?? null;
  const body = await prisma.stay_experiences.update({ where: { id }, data, include: INCLUDE_RESERVATION });
  return { status: 200, body };
}

export async function deleteStayExperience(prisma: StayExperiencePrisma, id: string): Promise<ServiceNoContent | ServiceError> {
  const existing = await prisma.stay_experiences.findUnique({ where: { id } });
  if (!existing) return { status: 404, body: { error: "Stay experience not found" } };
  await prisma.stay_experiences.delete({ where: { id } });
  return { status: 204, body: null };
}
