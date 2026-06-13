import { describe, it } from "node:test";
import assert from "node:assert";

import { parseSourceFile, extractListings, extractReservations } from "../src/ingest/normalizer.js";

describe("extractListings 19-digit Airbnb listing IDs", () => {
  it("preserves 19-digit providerListingId as exact string via CSV (ID column)", () => {
    const csv = `ID,Internal Name
"1009132800895283205","Apt 1"
"874784830445566937","Apt 2"
`;

    const rows = parseSourceFile(Buffer.from(csv), "text/csv");
    assert.strictEqual(rows.length, 2, "should parse 2 data rows");

    const listings = extractListings(rows);

    assert.strictEqual(listings.length, 2);
    assert.strictEqual(typeof listings[0].providerListingId, "string");
    assert.strictEqual(
      listings[0].providerListingId,
      "1009132800895283205",
      `expected exact 19-digit string but got ${typeof listings[0].providerListingId}: ${listings[0].providerListingId}`,
    );
    assert.strictEqual(
      listings[1].providerListingId,
      "874784830445566937",
      `expected exact 19-digit string but got ${typeof listings[1].providerListingId}: ${listings[1].providerListingId}`,
    );
  });

  it("preserves 19-digit providerListingId as exact string via CSV (Listing ID column)", () => {
    const csv = `Listing ID,Internal Name
"1009132800895283205","Apt 1"
"874784830445566937","Apt 2"
`;

    const rows = parseSourceFile(Buffer.from(csv), "text/csv");
    assert.strictEqual(rows.length, 2, "should parse 2 data rows");

    const listings = extractListings(rows);

    assert.strictEqual(listings.length, 2);
    assert.strictEqual(typeof listings[0].providerListingId, "string");
    assert.strictEqual(
      listings[0].providerListingId,
      "1009132800895283205",
      `expected exact 19-digit string but got ${typeof listings[0].providerListingId}: ${listings[0].providerListingId}`,
    );
    assert.strictEqual(
      listings[1].providerListingId,
      "874784830445566937",
      `expected exact 19-digit string but got ${typeof listings[1].providerListingId}: ${listings[1].providerListingId}`,
    );
  });
});

describe("extractReservations date normalization and encoding", () => {
  it("normalizes flexible dates like D/M/YY or DD/MM/YYYY correctly and preserves UTF-8 non-ASCII characters", () => {
    const csv = `"Confirmation code","Status","Guest name","Contact","# of adults","# of children","# of infants","Start date","End date","# of nights","Booked","Listing","Earnings"
"HMKRPEZY98","Currently hosting","정찬 김 Trần Vân","+1 303-885-4087","2","0","0","21/05/2026","1/7/26","41","2026-05-17","MUJO- Deluxe condo @District1 #BenThanh","₫49,508,768"
`;

    const rows = parseSourceFile(Buffer.from(csv), "text/csv");
    const reservations = extractReservations(rows);

    assert.strictEqual(reservations.length, 1);
    assert.strictEqual(reservations[0].guestName, "정찬 김 Trần Vân");
    assert.strictEqual(reservations[0].checkInDate, "2026-05-21");
    assert.strictEqual(reservations[0].checkOutDate, "2026-07-01");
    assert.strictEqual(reservations[0].bookedAt, "2026-05-17T00:00:00.000Z");
  });
});