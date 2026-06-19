import type { PrismaClient } from "@prisma/client";

type DiningEventResult = { status: 201; body: unknown } | { status: 400 | 404; body: { error: string; errors?: Array<{ field: string; message: string }> } };
const REQUIRED_FIELDS = ["title", "type", "venue", "date", "start_time", "end_time", "guest_count", "guest_name", "property_id"] as const;

export type DiningEventPrisma = PrismaClient;

export async function createDiningEvent(prisma: DiningEventPrisma, input: Record<string, unknown>): Promise<DiningEventResult> {
  const errors = REQUIRED_FIELDS.filter((field) => input[field] === undefined || input[field] === null || input[field] === "")
    .map((field) => ({ field, message: `${field} is required` }));
  if (errors.length > 0) return { status: 400, body: { error: "Invalid dining event", errors } };
  const property = await prisma.properties.findUnique({ where: { id: String(input.property_id) }, select: { id: true } });
  if (!property) return { status: 404, body: { error: "Property not found", errors: [{ field: "property_id", message: "Property not found" }] } };
  const body = await prisma.dining_event_bookings.create({
    data: {
      title: String(input.title),
      type: String(input.type),
      venue: String(input.venue),
      date: new Date(`${String(input.date)}T00:00:00.000Z`),
      start_time: String(input.start_time),
      end_time: String(input.end_time),
      guest_count: Number.parseInt(String(input.guest_count), 10),
      guest_name: String(input.guest_name),
      property_id: String(input.property_id),
      status: input.status === undefined ? "pending" : String(input.status),
      notes: input.notes === undefined || input.notes === null ? "" : String(input.notes),
    },
  });
  return { status: 201, body: { ...body, date: body.date.toISOString().slice(0, 10) } };
}
