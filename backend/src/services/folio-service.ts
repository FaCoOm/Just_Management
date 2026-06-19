import type { FolioLineItemKind, FolioStatus, Prisma, PrismaClient } from "@prisma/client";

export type FolioDb = PrismaClient | Prisma.TransactionClient;
export type LedgerLineItem = { kind: FolioLineItemKind | string; line_total: number };
export type LedgerPayment = { amount: number };

export type ServiceError = { status: 400 | 404; body: { error: string; errors?: Array<{ field: string; message: string }> } };
export type ServiceOk = { status: 200; body: unknown };

const LINE_ITEM_KINDS = new Set<FolioLineItemKind>(["charge", "credit"]);
const FOLIO_INCLUDE = { line_items: { orderBy: { created_at: "asc" } }, payments: { orderBy: { received_at: "asc" } } } as const;

export function computeBalance(lineItems: readonly LedgerLineItem[], payments: readonly LedgerPayment[]): { subtotal: number; paid: number; balance: number } {
  const subtotal = lineItems.reduce((sum, item) => sum + (item.kind === "credit" ? -item.line_total : item.line_total), 0);
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return { subtotal, paid, balance: subtotal - paid };
}

function positiveInt(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function refreshFolio(prisma: FolioDb, folioId: string): Promise<unknown> {
  const folio = await prisma.folios.findUnique({ where: { id: folioId }, include: FOLIO_INCLUDE });
  if (!folio) return null;
  const totals = computeBalance(folio.line_items, folio.payments);
  const status: FolioStatus = folio.status === "finalized" && totals.balance === 0 ? "settled" : folio.status;
  return prisma.folios.update({
    where: { id: folioId },
    data: {
      subtotal_amount: totals.subtotal,
      paid_amount: totals.paid,
      balance_amount: totals.balance,
      status,
      settled_at: status === "settled" ? new Date() : folio.settled_at,
    },
    include: FOLIO_INCLUDE,
  });
}

export async function getFolioById(prisma: FolioDb, id: string): Promise<ServiceOk | ServiceError> {
  const folio = await prisma.folios.findUnique({ where: { id }, include: FOLIO_INCLUDE });
  return folio ? { status: 200, body: folio } : { status: 404, body: { error: "Folio not found" } };
}

export async function listFolios(prisma: FolioDb, filters: { reservation_id?: string; property_id?: string }): Promise<ServiceOk> {
  const where: Record<string, string> = {};
  if (filters.reservation_id) where.reservation_id = filters.reservation_id;
  if (filters.property_id) where.property_id = filters.property_id;
  const body = await prisma.folios.findMany({ where, orderBy: { opened_at: "desc" }, include: FOLIO_INCLUDE });
  return { status: 200, body };
}

export async function postLineItem(prisma: PrismaClient, folioId: string, input: Record<string, unknown>): Promise<ServiceOk | ServiceError> {
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const quantity = positiveInt(input.quantity);
  const unitAmount = positiveInt(input.unit_amount);
  const kind = typeof input.kind === "string" && LINE_ITEM_KINDS.has(input.kind as FolioLineItemKind) ? input.kind as FolioLineItemKind : null;
  if (!description || !quantity || !unitAmount || !kind) return { status: 400, body: { error: "Invalid folio line item" } };
  const folio = await prisma.folios.findUnique({ where: { id: folioId }, select: { id: true } });
  if (!folio) return { status: 404, body: { error: "Folio not found" } };
  const body = await prisma.$transaction(async (tx) => {
    await tx.folio_line_items.create({
      data: {
        folio_id: folioId,
        description,
        kind,
        quantity,
        unit_amount: unitAmount,
        line_total: quantity * unitAmount,
        tax_rate: positiveInt(input.tax_rate) ?? 8,
        source: typeof input.source === "string" && input.source.trim() ? input.source.trim() : "manual",
      },
    });
    return refreshFolio(tx, folioId);
  });
  return { status: 200, body };
}

export async function recordPayment(prisma: PrismaClient, folioId: string, input: Record<string, unknown>): Promise<ServiceOk | ServiceError> {
  const amount = positiveInt(input.amount);
  const method = typeof input.method === "string" && input.method.trim() ? input.method.trim() : "Chuyển khoản";
  if (!amount) return { status: 400, body: { error: "Invalid folio payment" } };
  const folio = await prisma.folios.findUnique({ where: { id: folioId }, select: { id: true } });
  if (!folio) return { status: 404, body: { error: "Folio not found" } };
  const body = await prisma.$transaction(async (tx) => {
    await tx.folio_payments.create({
      data: {
        folio_id: folioId,
        method,
        amount,
        reference: typeof input.reference === "string" && input.reference.trim() ? input.reference.trim() : null,
      },
    });
    return refreshFolio(tx, folioId);
  });
  return { status: 200, body };
}
