import type { Prisma, PrismaClient } from "@prisma/client";

type CheckInDb = PrismaClient | Prisma.TransactionClient;
type CheckInResult = { status: 200; body: unknown } | { status: 404 | 409; body: { error: string } };

const CHECK_IN_STATUSES = new Set(["pending", "check_in_pending", "checked_in"]);

async function findReservation(prisma: CheckInDb, reservationId: string) {
  return prisma.reservations.findUnique({
    where: { id: reservationId },
    include: { folio: true },
  });
}

export async function checkIn(prisma: PrismaClient, reservationId: string): Promise<CheckInResult> {
  const existing = await findReservation(prisma, reservationId);
  if (!existing) return { status: 404, body: { error: "Reservation not found" } };
  if (!CHECK_IN_STATUSES.has(existing.status)) return { status: 409, body: { error: "Reservation cannot be checked in" } };

  const body = await prisma.$transaction(async (tx) => {
    const folio = existing.folio ?? await tx.folios.create({
      data: { reservation_id: existing.id, property_id: existing.property_id },
      include: { line_items: true, payments: true },
    });
    const reservation = await tx.reservations.update({ where: { id: reservationId }, data: { status: "checked_in" } });
    return { reservation, folio };
  });

  return { status: 200, body };
}
