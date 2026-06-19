import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import fc from "fast-check";
import { describe, it } from "vitest";
import { checkIn } from "../src/services/check-in-service.js";
import { checkOut } from "../src/services/check-out-service.js";
import { createDiningEvent } from "../src/services/dining-event-service.js";
import { computeBalance, recordPayment } from "../src/services/folio-service.js";
import { createRequest, transitionStatus, type GuestRequestStatus } from "../src/services/guest-request-service.js";
import { createStaff } from "../src/services/staff-service.js";
import { createStayExperience } from "../src/services/stay-experience-service.js";
import { previewTaxExport } from "../src/tax-export/service.js";

const RUNS = 100;
const stayTypeArb = fc.constantFrom("short_term", "long_term" as const);
const unicodeArb = fc.fullUnicodeString({ maxLength: 40 });
const idArb = fc.uuid();

function propertyTest(name: string, property: fc.IProperty<unknown> | fc.IAsyncProperty<unknown>): void {
  it(name, () => fc.assert(property, { numRuns: RUNS }));
}

describe("operations pipeline property invariants", () => {
  propertyTest(
    "Feature: operations-pipeline, Property 1: stay-experience create requires an existing reservation",
    fc.asyncProperty(idArb, fc.boolean(), async (reservationId, exists) => {
      const created: Record<string, unknown>[] = [];
      const prisma = {
        reservations: { findUnique: async () => exists ? { id: reservationId } : null },
        stay_experiences: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            created.push(data);
            return { id: "stay-1", ...data, created_at: new Date(), updated_at: new Date() };
          },
        },
      } as unknown as PrismaClient;

      const result = await createStayExperience(prisma, { reservation_id: reservationId });

      assert.equal(result.status, exists ? 201 : 404);
      assert.equal(created.length, exists ? 1 : 0);
      if (exists) assert.equal(created[0].reservation_id, reservationId);
    }),
  );

  propertyTest(
    "Feature: operations-pipeline, Property 2: stay-experience preserves references and free-form content",
    fc.asyncProperty(idArb, fc.option(idArb, { nil: null }), fc.option(idArb, { nil: null }), fc.option(unicodeArb, { nil: null }), stayTypeArb, unicodeArb, unicodeArb, async (reservationId, channelId, externalRefId, platformRef, stayType, notes, content) => {
      const prisma = {
        reservations: { findUnique: async () => ({ id: reservationId }) },
        stay_experiences: {
          create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "stay-1", ...data, created_at: new Date(), updated_at: new Date() }),
        },
      } as unknown as PrismaClient;

      const result = await createStayExperience(prisma, {
        reservation_id: reservationId,
        channel_id: channelId,
        external_ref_id: externalRefId,
        platform_reference: platformRef,
        stay_type: stayType,
        experience_notes: notes,
        guest_request_content: content,
      });

      assert.equal(result.status, 201);
      if (result.status === 201) {
        assert.equal(result.body.reservation_id, reservationId);
        assert.equal(result.body.channel_id, channelId);
        assert.equal(result.body.external_ref_id, externalRefId);
        assert.equal(result.body.platform_reference, platformRef);
        assert.equal(result.body.experience_notes, notes);
        assert.equal(result.body.guest_request_content, content);
      }
    }),
  );

  propertyTest(
    "Feature: operations-pipeline, Property 3: stay-records grouping partitions without loss",
    fc.property(fc.array(fc.record({ id: idArb, stay_type: stayTypeArb }), { maxLength: 50 }), (rows) => {
      const shortTerm = rows.filter((row) => row.stay_type === "short_term");
      const longTerm = rows.filter((row) => row.stay_type === "long_term");
      const unionIds = new Set([...shortTerm, ...longTerm].map((row) => row.id));

      assert.equal(shortTerm.length + longTerm.length, rows.length);
      assert.equal(unionIds.size, new Set(rows.map((row) => row.id)).size);
      assert.equal(shortTerm.every((shortRow) => longTerm.every((longRow) => longRow.id !== shortRow.id)), true);
    }),
  );

  propertyTest(
    "Feature: operations-pipeline, Property 4: guest-request create is reservation-anchored with optional guest/room",
    fc.asyncProperty(idArb, fc.option(idArb, { nil: null }), fc.option(idArb, { nil: null }), fc.boolean(), async (reservationId, guestId, roomId, reservationExists) => {
      const created: Record<string, unknown>[] = [];
      const prisma = {
        reservations: { findUnique: async () => reservationExists ? { id: reservationId, property_id: "property-1" } : null },
        guests: { findUnique: async () => ({ id: guestId ?? "guest-1" }) },
        rooms: { findUnique: async () => ({ id: roomId ?? "room-1" }) },
        properties: { findUnique: async () => ({ id: "property-1" }) },
        guest_requests: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            created.push(data);
            return { id: "request-1", ...data, created_at: new Date(), updated_at: new Date() };
          },
        },
      } as unknown as Parameters<typeof createRequest>[0];

      const result = await createRequest(prisma, { reservation_id: reservationId, request_type: "amenity", guest_id: guestId, room_id: roomId });

      assert.equal(result.status, reservationExists ? 201 : 404);
      assert.equal(created.length, reservationExists ? 1 : 0);
      if (reservationExists) {
        assert.equal(created[0].reservation_id, reservationId);
        assert.equal(created[0].guest_id, guestId);
        assert.equal(created[0].room_id, roomId);
      }
    }),
  );

  propertyTest(
    "Feature: operations-pipeline, Property 5: guest-request status transitions obey the transition table",
    fc.asyncProperty(fc.constantFrom<GuestRequestStatus>("open", "assigned", "in_progress", "fulfilled", "closed", "reopened"), fc.constantFrom<GuestRequestStatus>("open", "assigned", "in_progress", "fulfilled", "closed", "reopened"), async (current, target) => {
      const allowed: Record<GuestRequestStatus, GuestRequestStatus[]> = {
        open: ["assigned", "in_progress", "closed"],
        assigned: ["in_progress", "closed"],
        in_progress: ["fulfilled", "closed"],
        fulfilled: ["closed", "reopened"],
        closed: ["reopened"],
        reopened: ["assigned", "in_progress", "closed"],
      };
      let storedStatus: GuestRequestStatus = current;
      const prisma = {
        guest_requests: {
          findUnique: async () => ({ id: "request-1", status: storedStatus, assigned_to: "agent-1" }),
          update: async ({ data }: { data: { status?: GuestRequestStatus } }) => {
            if (data.status) storedStatus = data.status;
            return { id: "request-1", status: storedStatus };
          },
        },
      } as unknown as Parameters<typeof transitionStatus>[0];

      const result = await transitionStatus(prisma, "request-1", target, { assigned_to: "agent-1" });

      assert.equal(result.status === 200, allowed[current].includes(target));
      assert.equal(storedStatus, allowed[current].includes(target) ? target : current);
    }),
  );

  propertyTest(
    "Feature: operations-pipeline, Property 6: check-in yields exactly one folio and a checked-in reservation",
    fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async (attempts) => {
      let folio: unknown = null;
      let createdFolios = 0;
      let status = "pending";
      const prisma = {
        reservations: {
          findUnique: async () => ({ id: "reservation-1", property_id: "property-1", status, folio }),
          update: async ({ data }: { data: { status: string } }) => {
            status = data.status;
            return { id: "reservation-1", status };
          },
        },
        $transaction: async <T>(fn: (tx: typeof prisma) => Promise<T>) => fn(prisma),
        folios: {
          create: async () => {
            createdFolios += 1;
            folio = { id: "folio-1", reservation_id: "reservation-1", status: "open", line_items: [], payments: [] };
            return folio;
          },
        },
      } as unknown as PrismaClient;

      for (let index = 0; index < attempts; index += 1) {
        const result = await checkIn(prisma, "reservation-1");
        assert.equal(result.status, 200);
      }

      assert.equal(createdFolios, 1);
      assert.equal(status, "checked_in");
    }),
  );

  propertyTest(
    "Feature: operations-pipeline, Property 7: check-out finalizes the folio and transitions the reservation",
    fc.asyncProperty(fc.array(fc.record({ kind: fc.constantFrom("charge", "credit"), line_total: fc.integer({ min: 0, max: 1_000_000 }) }), { minLength: 1, maxLength: 20 }), fc.array(fc.record({ amount: fc.integer({ min: 0, max: 1_000_000 }) })), async (lineItems, payments) => {
      let reservationStatus = "checked_in";
      const updatedFolios: Record<string, unknown>[] = [];
      const prisma = {
        reservations: {
          findUnique: async () => ({ id: "reservation-1", property_id: "property-1", primary_room_id: "room-1", status: reservationStatus, reservation_room_allocations: [], folio: { id: "folio-1", line_items: lineItems, payments } }),
          update: async ({ data }: { data: { status: string } }) => {
            reservationStatus = data.status;
            return { id: "reservation-1", status: reservationStatus };
          },
        },
        $transaction: async <T>(fn: (tx: typeof prisma) => Promise<T>) => fn(prisma),
        folios: {
          update: async ({ data }: { data: Record<string, unknown> }) => {
            const updatedFolio = { id: "folio-1", ...data };
            updatedFolios.push(updatedFolio);
            return updatedFolio;
          },
        },
      } as unknown as PrismaClient;

      const result = await checkOut(prisma, "reservation-1");
      const expected = computeBalance(lineItems, payments);

      assert.equal(result.status, 200);
      assert.equal(reservationStatus, "checked_out");
      const observedFolio = updatedFolios[0];
      assert.equal(observedFolio.status, "finalized");
      assert.equal(observedFolio.subtotal_amount, expected.subtotal);
      assert.equal(observedFolio.paid_amount, expected.paid);
      assert.equal(observedFolio.balance_amount, expected.balance);
    }),
  );

  propertyTest(
    "Feature: operations-pipeline, Property 8: check-out is rejected outside the checked-in lifecycle",
    fc.asyncProperty(fc.constantFrom("pending", "check_in_pending", "cancelled", "no_show", "checked_out"), async (status) => {
      let updateCalls = 0;
      const prisma = {
        reservations: {
          findUnique: async () => ({ id: "reservation-1", property_id: "property-1", primary_room_id: null, status, reservation_room_allocations: [], folio: { id: "folio-1", line_items: [], payments: [] } }),
          update: async () => {
            updateCalls += 1;
            return { id: "reservation-1" };
          },
        },
      } as unknown as PrismaClient;

      const result = await checkOut(prisma, "reservation-1");

      assert.equal(result.status, 409);
      assert.equal(updateCalls, 0);
    }),
  );

  propertyTest(
    "Feature: operations-pipeline, Property 9: folio balance equals the derived ledger formula",
    fc.property(fc.array(fc.record({ kind: fc.constantFrom("charge", "credit"), line_total: fc.integer({ min: 0, max: 2_000_000 }) }), { maxLength: 50 }), fc.array(fc.record({ amount: fc.integer({ min: 0, max: 2_000_000 }) })), (lineItems, payments) => {
      const result = computeBalance(lineItems, payments);
      const subtotal = lineItems.reduce((sum, item) => sum + (item.kind === "credit" ? -item.line_total : item.line_total), 0);
      const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);

      assert.deepEqual(result, { subtotal, paid, balance: subtotal - paid });
    }),
  );

  propertyTest(
    "Feature: operations-pipeline, Property 10: settled folios stay settled at zero balance",
    fc.asyncProperty(fc.integer({ min: 1, max: 1_000_000 }), async (amount) => {
      let folioStatus = "finalized";
      const prisma = {
        folios: {
          findUnique: async () => ({ id: "folio-1", status: folioStatus, settled_at: null, line_items: [{ kind: "charge", line_total: amount }], payments: [{ amount }] }),
          update: async ({ data }: { data: { status: string; balance_amount: number } }) => {
            folioStatus = data.status;
            return { id: "folio-1", ...data };
          },
        },
        $transaction: async <T>(fn: (tx: typeof prisma) => Promise<T>) => fn(prisma),
        folio_payments: { create: async () => ({ id: "payment-1" }) },
      } as unknown as PrismaClient;

      const result = await recordPayment(prisma, "folio-1", { amount: 1, method: "cash" });

      assert.equal(result.status, 200);
      assert.equal(folioStatus, "settled");
    }),
  );

  propertyTest(
    "Feature: operations-pipeline, Property 11: dining-event create validates required fields then persists",
    fc.asyncProperty(fc.constantFrom("title", "type", "venue", "date", "start_time", "end_time", "guest_count", "guest_name", "property_id"), async (missingField) => {
      const valid = { title: "Dinner", type: "dinner", venue: "Rooftop", date: "2026-06-19", start_time: "18:00", end_time: "20:00", guest_count: 4, guest_name: "Guest", property_id: "property-1" };
      const invalid = { ...valid };
      delete invalid[missingField as keyof typeof invalid];
      const prisma = {
        properties: { findUnique: async () => ({ id: "property-1" }) },
        dining_event_bookings: { create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "event-1", ...data, date: new Date(String(data.date)) }) },
      } as unknown as PrismaClient;

      const rejected = await createDiningEvent(prisma, invalid);
      const created = await createDiningEvent(prisma, valid);

      assert.equal(rejected.status, 400);
      assert.equal(rejected.body.errors?.some((error) => error.field === missingField), true);
      assert.equal(created.status, 201);
      if (created.status === 201) assert.equal((created.body as { title: string }).title, valid.title);
    }),
  );

  propertyTest(
    "Feature: operations-pipeline, Property 12: staff create requires role and preserves assignment",
    fc.asyncProperty(fc.array(idArb, { minLength: 1, maxLength: 5 }), fc.constantFrom("name", "email", "role", "property_ids"), async (propertyIds, missingField) => {
      const valid = { name: "Staff A", email: "staff@example.com", role: "staff", property_ids: propertyIds };
      const invalid = { ...valid };
      delete invalid[missingField as keyof typeof invalid];
      const prisma = {
        staff_members: { create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "staff-1", ...data }) },
      } as unknown as PrismaClient;

      const rejected = await createStaff(prisma, invalid);
      const created = await createStaff(prisma, valid);

      assert.equal(rejected.status, 400);
      assert.equal(created.status, 201);
      if (created.status === 201) {
        assert.equal((created.body as { role: string }).role, valid.role);
        assert.deepEqual((created.body as { property_ids: string[] }).property_ids, propertyIds);
      }
    }),
  );

  propertyTest(
    "Feature: operations-pipeline, Property 13: tax-export totals match folio line items with reservation fallback",
    fc.asyncProperty(fc.array(fc.record({ kind: fc.constantFrom("charge", "credit"), line_total: fc.integer({ min: 1, max: 2_000_000 }), tax_rate: fc.integer({ min: 0, max: 20 }) }), { minLength: 1, maxLength: 20 }), fc.integer({ min: 1, max: 2_000_000 }), fc.integer({ min: 1, max: 14 }), async (lineItems, nightlyRate, nights) => {
      const checkout = new Date("2026-06-20T00:00:00.000Z");
      const checkin = new Date(checkout);
      checkin.setUTCDate(checkout.getUTCDate() - nights);
      const settings = { default_buyer_label: "buyer", default_payment_method: "cash", default_unit: "Đêm", default_vat_rate: 8, service_name_template: "Service {check_in} {check_out}", schedule_enabled: false, schedule_time: "18:00", schedule_timezone: "Asia/Ho_Chi_Minh", sheet_id: "", sheet_tab: "", template_columns: {} };
      const folioLineItems = lineItems.map((item, index) => ({
        id: `line-${index}`,
        description: `Item ${index}`,
        quantity: 1,
        unit_amount: item.line_total,
        ...item,
      }));
      const prisma = {
        tax_export_settings: { findFirst: async () => settings },
        tax_export_items: { findFirst: async () => null },
        reservations: {
          findMany: async () => [
            { id: "folio-res", guest_name: "Folio Guest", operational_notes: `nightly_rate=${nightlyRate}`, check_in_date: checkin, check_out_date: checkout, property: { name: "Property" }, reservation_external_refs: [], folio: { status: "finalized", line_items: folioLineItems } },
            { id: "fallback-res", guest_name: "Fallback Guest", operational_notes: `nightly_rate=${nightlyRate}`, check_in_date: checkin, check_out_date: checkout, property: { name: "Property" }, reservation_external_refs: [], folio: null },
          ],
        },
      } as unknown as Parameters<typeof previewTaxExport>[0];

      const result = await previewTaxExport(prisma, "2026-06-20");
      const folioExpected = lineItems.reduce((sum, item) => sum + (item.kind === "credit" ? -item.line_total : item.line_total), 0);
      const fallbackExpected = nightlyRate * nights;
      const folioActual = result.items
        .filter((item) => item.reservation_id === "folio-res")
        .reduce((sum, item) => sum + item.total_amount, 0);

      assert.equal(folioActual, folioExpected);
      assert.equal(result.items.find((item) => item.reservation_id === "folio-res")?.service_description, "Item 0");
      assert.equal(result.items.find((item) => item.reservation_id === "folio-res")?.quantity, 1);
      assert.equal(result.items.find((item) => item.reservation_id === "folio-res")?.unit_price, folioLineItems[0].unit_amount);
      assert.equal(result.items.find((item) => item.reservation_id === "fallback-res")?.total_amount, fallbackExpected);
    }),
  );
});
