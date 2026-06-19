import type { PrismaClient } from "@prisma/client";

type StaffResult = { status: 201; body: unknown } | { status: 400; body: { error: string; errors: Array<{ field: string; message: string }> } };
const REQUIRED_FIELDS = ["name", "email", "role", "property_ids"] as const;
const STAFF_ROLES = new Set(["admin", "manager", "accountant", "staff"]);

export type StaffPrisma = PrismaClient;

export async function createStaff(prisma: StaffPrisma, input: Record<string, unknown>): Promise<StaffResult> {
  const errors = REQUIRED_FIELDS.filter((field) => input[field] === undefined || input[field] === null || input[field] === "")
    .map((field) => ({ field, message: `${field} is required` }));
  if (typeof input.role === "string" && !STAFF_ROLES.has(input.role)) errors.push({ field: "role", message: "Invalid role" });
  if (!Array.isArray(input.property_ids) || input.property_ids.length === 0) errors.push({ field: "property_ids", message: "property_ids is required" });
  if (errors.length > 0) return { status: 400, body: { error: "Invalid staff member", errors } };
  const body = await prisma.staff_members.create({
    data: {
      name: String(input.name),
      email: String(input.email),
      role: String(input.role),
      property_ids: (input.property_ids as unknown[]).map(String),
      status: input.status === undefined ? "active" : String(input.status),
    },
  });
  return { status: 201, body };
}
