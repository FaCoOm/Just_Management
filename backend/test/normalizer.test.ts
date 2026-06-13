import { describe, it } from "node:test";
import assert from "node:assert";

import { parseSourceFile, extractListings } from "../src/ingest/normalizer.js";

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