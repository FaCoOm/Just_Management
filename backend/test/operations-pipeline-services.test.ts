import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { describe, it } from "vitest";
import { computeBalance } from "../src/services/folio-service.js";
import { createDiningEvent } from "../src/services/dining-event-service.js";
import { createStaff } from "../src/services/staff-service.js";
import { createStayExperience } from "../src/services/stay-experience-service.js";

describe("operations pipeline services", () => {
  it("computes folio balances from charges, credits, and payments", () => {
    const result = computeBalance(
      [
        { kind: "charge", line_total: 300 },
        { kind: "credit", line_total: 50 },
      ],
      [{ amount: 125 }],
    );

    assert.deepEqual(result, { subtotal: 250, paid: 125, balance: 125 });
  });

  it("creates stay experience only for an existing reservation", async () => {
    const created: Record<string, unknown>[] = [];
    const prisma: Partial<PrismaClient> = {
      reservations: {
        findUnique: async () => ({ id: "reservation-1", property_id: "property-1" }),
      },
      stay_experiences: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          const stayType: "short_term" | "long_term" | null = data.stay_type === "short_term" || data.stay_type === "long_term" ? data.stay_type : null;
          return {
            id: "stay-experience-1",
            reservation_id: String(data.reservation_id),
            channel_id: data.channel_id === undefined ? null : String(data.channel_id),
            external_ref_id: data.external_ref_id === undefined ? null : String(data.external_ref_id),
            platform_reference: data.platform_reference === undefined ? null : String(data.platform_reference),
            stay_type: stayType,
            experience_notes: String(data.experience_notes ?? ""),
            guest_request_content: String(data.guest_request_content ?? ""),
            created_at: new Date(),
            updated_at: new Date(),
          };
        },
        findMany: async () => [],
        findUnique: async () => null,
        update: async () => ({ id: "stay-experience-1", reservation_id: "reservation-1", channel_id: null, external_ref_id: null, platform_reference: null, stay_type: null, experience_notes: "", guest_request_content: "", created_at: new Date(), updated_at: new Date() }),
        delete: async () => ({ id: "stay-experience-1", reservation_id: "reservation-1", channel_id: null, external_ref_id: null, platform_reference: null, stay_type: null, experience_notes: "", guest_request_content: "", created_at: new Date(), updated_at: new Date() }),
      },
    };

    const result = await createStayExperience(prisma as PrismaClient, {
      reservation_id: "reservation-1",
      stay_type: "short_term",
      experience_notes: "Quiet stay",
      guest_request_content: "Extra towel",
    });

    assert.equal(result.status, 201);
    assert.deepEqual(created[0], {
      reservation_id: "reservation-1",
      channel_id: undefined,
      external_ref_id: undefined,
      platform_reference: undefined,
      stay_type: "short_term",
      experience_notes: "Quiet stay",
      guest_request_content: "Extra towel",
    });
  });

  it("rejects dining event create when required fields are missing", async () => {
    const prisma: Partial<PrismaClient> = {
      properties: { findUnique: async () => ({ id: "property-1" }) },
      dining_event_bookings: { create: async () => ({ id: "event-1", date: new Date("2026-06-19T00:00:00.000Z") }) },
    };

    const result = await createDiningEvent(prisma as PrismaClient, {
      title: "Dinner",
    });

    assert.equal(result.status, 400);
    assert.ok(result.body.errors?.some((error) => error.field === "property_id"));
  });

  it("creates staff with required role and property assignment", async () => {
    const created: Record<string, unknown>[] = [];
    const prisma: Partial<PrismaClient> = {
      staff_members: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return { id: "staff-1", last_active_at: null, ...data };
        },
      },
    };

    const result = await createStaff(prisma as PrismaClient, {
      name: "Staff A",
      email: "staff@example.com",
      role: "staff",
      property_ids: ["property-1"],
    });

    assert.equal(result.status, 201);
    assert.deepEqual(created[0], {
      name: "Staff A",
      email: "staff@example.com",
      role: "staff",
      property_ids: ["property-1"],
      status: "active",
    });
  });
});
