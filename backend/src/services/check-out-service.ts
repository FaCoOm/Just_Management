import type { PrismaClient } from "@prisma/client";
import { operationsEvents } from "../events/operations-events.js";
import { computeBalance } from "./folio-service.js";

type CheckOutResult = { status: 200; body: unknown } | { status: 404 | 409; body: { error: string } };

const CHECK_OUT_STATUSES = new Set(["checked_in", "check_out_pending"]);

export async function checkOut(prisma: PrismaClient, reservationId: string): Promise<CheckOutResult> {
  const existing = await prisma.reservations.findUnique({
    where: { id: reservationId },
    include: { reservation_room_allocations: true, folio: { include: { line_items: true, payments: true } } },
  });
  if (!existing) return { status: 404, body: { error: "Reservation not found" } };
  if (!CHECK_OUT_STATUSES.has(existing.status)) return { status: 409, body: { error: "Reservation cannot be checked out" } };
  const existingFolio = existing.folio;
  if (!existingFolio) return { status: 409, body: { error: "Folio not found" } };

  const totals = computeBalance(existingFolio.line_items, existingFolio.payments);
  const body = await prisma.$transaction(async (tx) => {
    const folio = await tx.folios.update({
      where: { id: existingFolio.id },
      data: { status: "finalized", subtotal_amount: totals.subtotal, paid_amount: totals.paid, balance_amount: totals.balance, finalized_at: new Date() },
      include: { line_items: { orderBy: { created_at: "asc" } }, payments: { orderBy: { received_at: "asc" } } },
    });
    const reservation = await tx.reservations.update({ where: { id: reservationId }, data: { status: "checked_out" } });
    return { reservation, folio };
  });

  const roomIds = new Set<string>();
  if (existing.primary_room_id) roomIds.add(existing.primary_room_id);
  for (const allocation of existing.reservation_room_allocations) roomIds.add(allocation.room_id);
  operationsEvents.emitCheckoutCompleted({ reservationId, propertyId: existing.property_id, roomIds: [...roomIds], occurredAt: new Date().toISOString() });
  return { status: 200, body };
}
