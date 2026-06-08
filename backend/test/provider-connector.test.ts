import { describe, it } from "node:test";
import assert from "node:assert";
import {
  airbnbParser,
  bookingComParser,
  agodaParser,
  genericParser,
  findParserForEmail,
  WithOneProviderConnector,
} from "../src/integrations/provider-connector.js";

describe("OTA Email Parsers", () => {
  describe("Airbnb Parser", () => {
    it("should match Airbnb emails", () => {
      assert.strictEqual(airbnbParser.canParse("noreply@airbnb.com", "Reservation confirmed"), true);
      assert.strictEqual(airbnbParser.canParse("guest@example.com", "Airbnb reservation"), true);
      assert.strictEqual(airbnbParser.canParse("other@other.com", "Regular email"), false);
    });

    it("should parse Airbnb email payload", () => {
      const email = {
        subject: "Reservation Confirmed - HM-XYZ123ABC",
        from: "noreply@airbnb.com",
        body: "Dear Host,\nGuest Name: John Doe\nCheck-in: 08/06/2026\nCheck-out: 09/06/2026\nTotal Payout: $120.50\nConfirmation Code: HM-XYZ123ABC",
      };
      const result = airbnbParser.parseEmail(email);
      assert.ok(result);
      assert.strictEqual(result.provider, "airbnb");
      assert.strictEqual(result.confirmationCode, "HM-XYZ123ABC");
      assert.strictEqual(result.guestName, "John Doe");
      assert.strictEqual(result.checkInDate, "08/06/2026");
      assert.strictEqual(result.checkOutDate, "09/06/2026");
      assert.strictEqual(result.amount, 120.5);
      assert.strictEqual(result.currency, "USD");
    });
  });

  describe("Booking.com Parser", () => {
    it("should match Booking.com emails", () => {
      assert.strictEqual(bookingComParser.canParse("customer.service@booking.com", "New Booking"), true);
      assert.strictEqual(bookingComParser.canParse("other@other.com", "Booking confirmation"), true);
      assert.strictEqual(bookingComParser.canParse("other@other.com", "Regular email"), false);
    });

    it("should parse Booking.com email payload", () => {
      const email = {
        subject: "New Booking confirmation 987654321",
        from: "customer.service@booking.com",
        body: "Hotel: Mujo Saigon\nGuest: Jane Smith\nConfirmation Number: 987654321\nTotal: $240.00",
      };
      const result = bookingComParser.parseEmail(email);
      assert.ok(result);
      assert.strictEqual(result.provider, "booking.com");
      assert.strictEqual(result.confirmationCode, "987654321");
      assert.strictEqual(result.guestName, "Jane Smith");
      assert.strictEqual(result.listingTitle, "Mujo Saigon");
    });
  });

  describe("Agoda Parser", () => {
    it("should match Agoda emails", () => {
      assert.strictEqual(agodaParser.canParse("noreply@agoda.com", "Booking alert"), true);
      assert.strictEqual(agodaParser.canParse("other@other.com", "Agoda Confirmation"), true);
    });

    it("should parse Agoda email payload", () => {
      const email = {
        subject: "Agoda Booking Confirmation 88776655",
        from: "noreply@agoda.com",
        body: "Booking ID: 88776655\nGuest: Alice Brown\nTotal: 1500000 VND",
      };
      const result = agodaParser.parseEmail(email);
      assert.ok(result);
      assert.strictEqual(result.provider, "agoda");
      assert.strictEqual(result.confirmationCode, "88776655");
    });
  });

  describe("Generic Parser", () => {
    it("should fallback to parse generic email payload", () => {
      const email = {
        subject: "Direct Reservation CONF-998877",
        from: "direct@guest.com",
        body: "Confirmation: CONF-998877\nStay details...",
      };
      const result = genericParser.parseEmail(email);
      assert.ok(result);
      assert.strictEqual(result.provider, "generic");
      assert.strictEqual(result.confirmationCode, "CONF-998877");
    });
  });

  describe("Parser Selection", () => {
    it("should find correct parser for email", () => {
      const airbnb = findParserForEmail("noreply@airbnb.com", "Reservation");
      assert.strictEqual(airbnb?.provider, "airbnb");

      const booking = findParserForEmail("customer.service@booking.com", "New");
      assert.strictEqual(booking?.provider, "booking.com");
    });
  });
});

describe("WithOneProviderConnector Mocking", () => {
  it("should handle connection status when key is active", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (url) => {
        assert.ok(url.toString().includes("/gmail/v1/users/me/messages"));
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: async () => ({ messages: [] }),
        } as unknown as Response;
      };

      const connector = new WithOneProviderConnector("test-connection-key");
      const status = await connector.getConnectionStatus();
      assert.strictEqual(status.connected, true);
      assert.strictEqual(status.provider, "withone");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should handle sheet upsert appends correctly", async () => {
    const originalFetch = globalThis.fetch;
    try {
      let fetchCount = 0;
      globalThis.fetch = async (url, init) => {
        fetchCount++;
        if (init?.method === "GET") {
          // Read existing sheet values to check for duplicates
          return {
            ok: true,
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: async () => ({
              values: [
                ["id", "guest_name"],
                ["101", "Existing Guest"],
              ],
            }),
          } as unknown as Response;
        } else if (init?.method === "POST" || init?.method === "PUT") {
          // Append or Update values
          return {
            ok: true,
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: async () => ({}),
          } as unknown as Response;
        } else {
          throw new Error(`Unexpected method: ${init?.method}`);
        }
      };

      const connector = new WithOneProviderConnector("test-connection-key");
      const result = await connector.appendSheetRows("sheet-id-123", [
        { id: "101", guest_name: "Existing Guest" }, // should be updated (PUT)
        { id: "102", guest_name: "New Guest" },      // should be appended (POST)
      ], {
        sheetName: "Sheet1",
        idempotencyKeyColumn: "id",
      });

      assert.strictEqual(result.rowsAppended, 1);
      assert.strictEqual(result.rowsUpdated, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
