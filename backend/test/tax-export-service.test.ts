import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { runTaxExport } from "../src/tax-export/service.js";
import { PrismaClient } from "@prisma/client";

// Simple Prisma Mock Builder
function createMockPrisma() {
  const settingsDb: any[] = [];
  const reservationsDb: any[] = [];
  const externalRefsDb: any[] = [];
  const jobsDb: any[] = [];
  const itemsDb: any[] = [];
  const channelsDb: any[] = [
    { id: "chan-1", slug: "airbnb", display_name: "Airbnb" },
    { id: "chan-2", slug: "booking.com", display_name: "Booking.com" },
    { id: "chan-3", slug: "agoda", display_name: "Agoda" },
  ];

  const tx: any = {
    tax_export_settings: {
      findFirst: async () => settingsDb[0] || null,
      create: async ({ data }: any) => {
        const item = { id: "settings-id", ...data };
        settingsDb.push(item);
        return item;
      },
    },
    reservations: {
      findMany: async ({ where }: any) => {
        return reservationsDb.filter(r => {
          if (where.check_out_date && r.check_out_date.getTime() !== where.check_out_date.getTime()) return false;
          if (where.id && r.id !== where.id) return false;
          return true;
        });
      },
      update: async ({ where, data }: any) => {
        const res = reservationsDb.find(r => r.id === where.id);
        if (res) {
          Object.assign(res, data);
        }
        return res;
      },
    },
    reservation_external_refs: {
      findFirst: async ({ where }: any) => {
        return externalRefsDb.find(ref => ref.reservation_id === where.reservation_id) || null;
      },
      create: async ({ data }: any) => {
        const item = { id: `ref-${Math.random()}`, ...data };
        externalRefsDb.push(item);
        return item;
      },
    },
    channels: {
      findFirst: async ({ where }: any) => {
        if (where.slug && where.slug.contains) {
          const needle = where.slug.contains.toLowerCase();
          return channelsDb.find(c => c.slug.includes(needle)) || channelsDb[0];
        }
        return channelsDb[0];
      },
    },
    tax_export_jobs: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        const item = { id: `job-${Math.random()}`, ...data };
        jobsDb.push(item);
        return item;
      },
    },
    tax_export_items: {
      findFirst: async () => null,
      createMany: async ({ data }: any) => {
        for (const d of data) {
          itemsDb.push({ id: `item-${Math.random()}`, ...d });
        }
        return { count: data.length };
      },
    },
  };

  const client = {
    ...tx,
    $transaction: async (cb: any) => {
      return cb(tx);
    },
  };

  return { client, settingsDb, reservationsDb, externalRefsDb, jobsDb, itemsDb };
}

describe("Tax Export Orchestrator & Integration Service", () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    process.env.ONE_CONNECTION_KEY = "conn_test_mock_connection_key";
  });

  it("should run tax-export, fetch emails, match by guest name, enrich database records, and trigger sheets upsert", async () => {
    // Arrange
    mockPrisma.settingsDb.push({
      id: "settings-id",
      default_buyer_label: "Khách lẻ không lấy hóa đơn",
      default_payment_method: "Chuyển khoản",
      default_unit: "Đêm",
      default_vat_rate: 8,
      service_name_template: "Dịch vụ thuê phòng ({check_in} - {check_out})",
      schedule_enabled: false,
      schedule_time: "18:00",
      schedule_timezone: "Asia/Ho_Chi_Minh",
      sheet_id: "sheet-id-456",
      sheet_tab: "Sheet1",
      template_columns: {},
    });

    mockPrisma.reservationsDb.push({
      id: "res-uuid-1",
      property_id: "prop-1",
      guest_name: "Jane Smith",
      check_in_date: new Date("2026-06-08T00:00:00.000Z"),
      check_out_date: new Date("2026-06-09T00:00:00.000Z"),
      status: "checked_out",
      operational_notes: "booking_source=Airbnb",
      reservation_external_refs: [],
    });

    // Mock fetch for Gmail listing, Gmail body, Sheets read, and Sheets append
    let listCallCount = 0;
    let getCallCount = 0;
    let appendCallCount = 0;

    globalThis.fetch = async (url, init) => {
      const urlStr = url.toString();
      if (urlStr.includes("/gmail/v1/users/me/messages/msg-123")) {
        getCallCount++;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: async () => ({
            id: "msg-123",
            payload: {
              headers: [
                { name: "subject", value: "Reservation Confirmed - HM-XYZ123ABC" },
                { name: "from", value: "noreply@airbnb.com" },
                { name: "date", value: "Mon, 08 Jun 2026 10:00:00 +0700" },
              ],
              body: {
                data: Buffer.from("Guest Name: Jane Smith\nCheck-in: 08/06/2026\nCheck-out: 09/06/2026\nTotal Payout: $150.00\nConfirmation Code: HM-XYZ123ABC").toString("base64url"),
              },
            },
          }),
        } as unknown as Response;
      }

      if (urlStr.includes("/gmail/v1/users/me/messages")) {
        listCallCount++;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: async () => ({
            messages: [{ id: "msg-123", threadId: "thread-123" }],
          }),
        } as unknown as Response;
      }

      if (urlStr.includes("/v4/spreadsheets/sheet-id-456/values/Sheet1")) {
        if (init?.method === "GET") {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: async () => ({
              values: [["id", "invoice_number", "guest_name"]],
            }),
          } as unknown as Response;
        }

        if (init?.method === "POST" || init?.method === "PUT") {
          appendCallCount++;
          return {
            ok: true,
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: async () => ({}),
          } as unknown as Response;
        }
      }

      throw new Error(`Unexpected fetch call: ${urlStr} (${init?.method})`);
    };

    try {
      // Act
      const result = await runTaxExport(mockPrisma.client as unknown as PrismaClient, "2026-06-09");

      // Assert
      assert.strictEqual(result.runStatus, "created");
      assert.strictEqual(result.createdNewJob, true);
      assert.strictEqual(result.items.length, 1);

      const enrichedReservation = mockPrisma.reservationsDb[0];
      assert.ok(enrichedReservation.operational_notes.includes("nightly_rate=150"));

      assert.strictEqual(mockPrisma.externalRefsDb.length, 1);
      assert.strictEqual(mockPrisma.externalRefsDb[0].confirmation_code, "HM-XYZ123ABC");

      assert.strictEqual(listCallCount, 1);
      assert.strictEqual(getCallCount, 2);
      assert.strictEqual(appendCallCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
