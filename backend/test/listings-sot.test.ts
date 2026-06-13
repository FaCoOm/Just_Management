import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Module under test: backend/src/lib/listings-source-of-truth.ts (T7 — does NOT exist yet)
import {
  normalizeListingInternalName,
  type NormalizedListingName,
  type DriftResolution,
  parseListingsCsv,
  type ListingsCsvRow,
  classifyDbRowsAgainstCsv,
  type ClassifyResult,
  mergeCsvWithOwnership,
} from "../src/lib/listings-source-of-truth.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Construct the canonical internal name the way the provider writes it. */
function internalName(prefix: string, room: string): string {
  return `${prefix} - ${room}`;
}

/** Assert that a result is a successful resolution with the expected shape. */
function assertResolved(
  result: NormalizedListingName,
  expected: {
    propertySlug: string;
    roomNumbers: string[];
    driftType: string;
  },
): void {
  assert.equal(result.propertySlug, expected.propertySlug);
  assert.deepEqual(result.roomNumbers, expected.roomNumbers);
  assert.equal(result.driftType, expected.driftType);
}

/** Assert that a result is an error with the expected code. */
function assertError(
  result: NormalizedListingName,
  expectedCode: string,
): void {
  assert.equal(result.errorCode, expectedCode);
  assert.ok(result.error, "Expected an error message when errorCode is present");
}

// ---------------------------------------------------------------------------
// normalizeListingInternalName
// ---------------------------------------------------------------------------

describe("normalizeListingInternalName", () => {
  // ---- S1: exact matches ------------------------------------------------

  it("MH - 01 -> exact resolution", () => {
    const result = normalizeListingInternalName(internalName("MH", "01"));
    assertResolved(result, {
      propertySlug: "mh",
      roomNumbers: ["01"],
      driftType: "exact",
    });
  });

  // ---- S3: within-building drift (surplus -> canonical) -----------------

  it("TC - 8.05 -> within_building drift (S3 surplus)", () => {
    // SURPLUS_ROOM_SPECS maps tc/8.05 -> tc/C 8.05 (within same property)
    const result = normalizeListingInternalName(internalName("TC", "8.05"));
    assertResolved(result, {
      propertySlug: "tc",
      roomNumbers: ["C 8.05"],
      driftType: "within_building",
    });
  });

  it("TC - C12.02 -> within_building drift (S3 surplus)", () => {
    // SURPLUS_ROOM_SPECS maps tc/C12.02 -> tc/C 12.02
    const result = normalizeListingInternalName(internalName("TC", "C12.02"));
    assertResolved(result, {
      propertySlug: "tc",
      roomNumbers: ["C 12.02"],
      driftType: "within_building",
    });
  });

  it("TheO - B 20.12A Main -> within_building drift (S3 surplus)", () => {
    // SURPLUS_ROOM_SPECS maps theo/B20.12A Main -> theo/B20.12A
    const result = normalizeListingInternalName("TheO - B 20.12A Main");
    assertResolved(result, {
      propertySlug: "theo",
      roomNumbers: ["B20.12A"],
      driftType: "within_building",
    });
  });

  it("TA - The Alley 1 -> within_building drift (S3 surplus)", () => {
    // SURPLUS_ROOM_SPECS maps ta/The Alley 1 -> ta/Alley 1
    const result = normalizeListingInternalName("TA - The Alley 1");
    assertResolved(result, {
      propertySlug: "ta",
      roomNumbers: ["Alley 1"],
      driftType: "within_building",
    });
  });

  it("LL - Latte 1 -> within_building drift (S3 surplus)", () => {
    // SURPLUS_ROOM_SPECS maps ll/Latte 1 -> ll/Latte
    const result = normalizeListingInternalName("LL - Latte 1");
    assertResolved(result, {
      propertySlug: "ll",
      roomNumbers: ["Latte"],
      driftType: "within_building",
    });
  });

  it("LL - coffee 3 -> within_building drift (S3 case-insensitive surplus)", () => {
    // SURPLUS_ROOM_SPECS maps ll/coffee 3 -> ll/Coffee 3 (case-insensitive)
    const result = normalizeListingInternalName("LL - coffee 3");
    assertResolved(result, {
      propertySlug: "ll",
      roomNumbers: ["Coffee 3"],
      driftType: "within_building",
    });
  });

  // ---- S5: composite splits ---------------------------------------------

  it("LL - Milk 2 & Coffee 2 -> composite split (S5)", () => {
    const result = normalizeListingInternalName("LL - Milk 2 & Coffee 2");
    assertResolved(result, {
      propertySlug: "ll",
      roomNumbers: ["Milk 2", "Coffee 2"],
      driftType: "composite",
    });
  });

  it("LL - Milk 2 and Coffee 2 -> composite split (and variant)", () => {
    const result = normalizeListingInternalName("LL - Milk 2 and Coffee 2");
    assertResolved(result, {
      propertySlug: "ll",
      roomNumbers: ["Milk 2", "Coffee 2"],
      driftType: "composite",
    });
  });

  // ---- unknown rooms ----------------------------------------------------

  it("MH - 99 -> ROOM_NOT_IN_SOT error", () => {
    const result = normalizeListingInternalName(internalName("MH", "99"));
    assertError(result, "ROOM_NOT_IN_SOT");
  });

  // ---- S4: cross-building refusal ---------------------------------------

  it("TC - Coffee 1 -> CROSS_BUILDING_DRIFT error (S4)", () => {
    // "Coffee 1" exists in LL (parserPrefix "LL"), not TC.
    // The prefix is TC but the room resolves to ll. Cross-building refused.
    const result = normalizeListingInternalName(internalName("TC", "Coffee 1"));
    assertError(result, "CROSS_BUILDING_DRIFT");
  });

  it("TC - Coffee 1 with allowCrossBuilding=true -> resolves to ll/Coffee 1", () => {
    const result = normalizeListingInternalName(
      internalName("TC", "Coffee 1"),
      { allowCrossBuilding: true },
    );
    assertResolved(result, {
      propertySlug: "ll",
      roomNumbers: ["Coffee 1"],
      driftType: "cross_building",
    });
  });
});

// ---------------------------------------------------------------------------
// parseListingsCsv
// ---------------------------------------------------------------------------

describe("parseListingsCsv", () => {
  it("filters rows where status !== 'Listed'", () => {
    const csv = [
      "ID,Title,Internal Name,Type,Location,Status,Host Editor URL,Public URL,Extracted At",
      "1234567890123456789,Title 1,MH - 01,home,,Listed,https://edit/1,https://example.com/1,2026-05-26T03:33:28.840Z",
      "9876543210987654321,Title 2,MH - 02,home,,In progress,https://edit/2,https://example.com/2,2026-05-26T03:33:28.840Z",
    ].join("\n");

    const rows = parseListingsCsv(csv);
    assert.equal(rows.length, 1, "Only the Listed row should be returned");
    assert.equal(rows[0].status, "Listed");
  });

  it("preserves 19-digit IDs as strings", () => {
    const csv = [
      "ID,Title,Internal Name,Type,Location,Status,Host Editor URL,Public URL,Extracted At",
      "1234567890123456789,Title 1,MH - 01,home,,Listed,https://edit/1,https://example.com/1,2026-05-26T03:33:28.840Z",
    ].join("\n");

    const rows = parseListingsCsv(csv);
    assert.equal(rows.length, 1);
    assert.equal(typeof rows[0].providerListingId, "string");
    assert.equal(rows[0].providerListingId, "1234567890123456789");
  });

  it("returns ListingsCsvRow[] with all required fields", () => {
    const csv = [
      "ID,Title,Internal Name,Type,Location,Status,Host Editor URL,Public URL,Extracted At",
      "1234567890123456789,Title 1,MH - 01,home,,Listed,https://edit/1,https://example.com/1,2026-05-26T03:33:28.840Z",
    ].join("\n");

    const rows = parseListingsCsv(csv);
    assert.equal(rows.length, 1);

    const row: ListingsCsvRow = rows[0];
    assert.ok("providerListingId" in row);
    assert.ok("internalName" in row);
    assert.ok("title" in row);
    assert.ok("status" in row);
    assert.ok("url" in row);
    assert.equal(row.internalName, "MH - 01");
  });
});

// ---------------------------------------------------------------------------
// classifyDbRowsAgainstCsv
// ---------------------------------------------------------------------------

describe("classifyDbRowsAgainstCsv", () => {
  const sampleCsvRows: ListingsCsvRow[] = [
    {
      providerListingId: "1111111111111111111",
      internalName: "MH - 01",
      title: "Title 1",
      status: "Listed",
      url: "https://example.com/1",
    },
    {
      providerListingId: "2222222222222222222",
      internalName: "LL - Coffee 1",
      title: "Title 2",
      status: "Listed",
      url: "https://example.com/2",
    },
  ];

  it("returns keepIds for matching providerListingId", () => {
    const dbRows = [
      {
        id: "db-1",
        provider_listing_id: "1111111111111111111",
        internal_name: "MH - 01",
      },
    ] as any[];

    const result: ClassifyResult = classifyDbRowsAgainstCsv(dbRows, sampleCsvRows, {
      normalize: (name: string) =>
        normalizeListingInternalName(name),
    });

    assert.deepEqual(result.keepIds, ["db-1"]);
    assert.deepEqual(result.surplusIds, []);
    assert.deepEqual(result.missingProviderIds, ["2222222222222222222"]);
  });

  it("returns surplusIds for DB rows whose provider_listing_id is not in CSV", () => {
    const dbRows = [
      {
        id: "db-orphan",
        provider_listing_id: "9999999999999999999",
        internal_name: "MH - 99",
      },
    ] as any[];

    const result: ClassifyResult = classifyDbRowsAgainstCsv(dbRows, sampleCsvRows, {
      normalize: (name: string) =>
        normalizeListingInternalName(name),
    });

    assert.deepEqual(result.keepIds, []);
    assert.deepEqual(result.surplusIds, ["db-orphan"]);
    assert.deepEqual(
      result.missingProviderIds.sort(),
      ["1111111111111111111", "2222222222222222222"].sort(),
    );
  });

  it("returns missingProviderIds for CSV rows whose providerListingId is not in DB", () => {
    const dbRows = [
      {
        id: "db-1",
        provider_listing_id: "1111111111111111111",
        internal_name: "MH - 01",
      },
    ] as any[];

    const result: ClassifyResult = classifyDbRowsAgainstCsv(dbRows, sampleCsvRows, {
      normalize: (name: string) =>
        normalizeListingInternalName(name),
    });

    assert.deepEqual(result.keepIds, ["db-1"]);
    assert.deepEqual(result.surplusIds, []);
    assert.deepEqual(result.missingProviderIds, ["2222222222222222222"]);
  });

  it("returns driftFixes when DB internal_name disagrees with CSV but rooms resolve under same property", () => {
    const dbRows = [
      {
        id: "db-drift",
        provider_listing_id: "1111111111111111111",
        // DB still has the old surplus name, CSV has already updated to canonical
        internal_name: "MH - 1",
      },
    ] as any[];

    const csvWithUpdated: ListingsCsvRow[] = [
      {
        providerListingId: "1111111111111111111",
        internalName: "MH - 01",
        title: "Title 1",
        status: "Listed",
        url: "https://example.com/1",
      },
    ];

    const result: ClassifyResult = classifyDbRowsAgainstCsv(
      dbRows,
      csvWithUpdated,
      {
        normalize: (name: string) =>
          normalizeListingInternalName(name),
      },
    );

    assert.deepEqual(result.keepIds, ["db-drift"]);
    assert.deepEqual(result.surplusIds, []);
    assert.deepEqual(result.missingProviderIds, []);

    // A drift fix should be emitted when the DB internal_name resolves
    // to a different canonical name than what's stored.
    assert.ok(
      result.driftFixes && result.driftFixes.length > 0,
      "Expected driftFixes when DB internal_name != CSV-provided canonical name",
    );

    const fix: DriftResolution = result.driftFixes[0];
    assert.equal(fix.dbRowId, "db-drift");
    assert.equal(fix.resolvedRoomName, "01");
  });
});

// ---------------------------------------------------------------------------
// mergeCsvWithOwnership
// ---------------------------------------------------------------------------

describe("mergeCsvWithOwnership", () => {
  it("returns 59 rows when fed the real CSV files", async () => {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const base = path.resolve("..", "docs", "database_design");
    const listings = await readFile(path.join(base, "listings.csv"), "utf-8");
    const ruby = await readFile(path.join(base, "Ruby.csv"), "utf-8");
    const manuka = await readFile(path.join(base, "Manuka.csv"), "utf-8");
    const rows = mergeCsvWithOwnership({ listings, ruby, manuka });
    assert.equal(rows.length, 59);
  });

  it("ID 33932700 owner=ruby, internalName from listings.csv", () => {
    const listingsCsv = [
      "ID,Title,Internal Name,Type,Location,Status,Host Editor URL,Public URL,Extracted At",
      '"33932700","Title","LL - Latte 1","home","","Listed","https://edit/1","https://pub/1","2026-05-26T04:10:09.461Z"',
    ].join("\n");
    const rubyCsv = [
      "ID,Title,Internal Name,Type,Location,Status,Host Editor URL,Public URL,Extracted At",
      '"33932700","Title","LL - Latte 1","home","","Listed","https://edit/1","https://pub/1","2026-05-26T04:10:09.461Z"',
    ].join("\n");
    const manukaCsv = [
      "ID,Title,Internal Name,Type,Location,Status,Host Editor URL,Public URL,Extracted At",
      '"33932700","Title","LL - Latte 2","home","","Đã đăng","https://edit/1","https://pub/1","2026-05-26T04:10:09.461Z"',
    ].join("\n");
    const rows = mergeCsvWithOwnership({ listings: listingsCsv, ruby: rubyCsv, manuka: manukaCsv });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].owner, "ruby");
    assert.equal(rows[0].internalName, "LL - Latte 1");
  });

  it("Ruby beats Manuka for ID 947584081523929277", () => {
    const listingsCsv = [
      "ID,Title,Internal Name,Type,Location,Status,Host Editor URL,Public URL,Extracted At",
      '"947584081523929277","T","MH - 01","home","","Listed","https://edit/1","https://pub/1","2026-05-26Z"',
    ].join("\n");
    const rubyCsv = [
      "ID,Title,Internal Name,Type,Location,Status,Host Editor URL,Public URL,Extracted At",
      '"947584081523929277","T","MH - 01","home","","Listed","https://edit/1","https://pub/1","2026-05-26Z"',
    ].join("\n");
    const manukaCsv = [
      "ID,Title,Internal Name,Type,Location,Status,Host Editor URL,Public URL,Extracted At",
      '"947584081523929277","T","MH - 01","home","","Đã đăng","https://edit/1","https://pub/1","2026-05-26Z"',
    ].join("\n");
    const rows = mergeCsvWithOwnership({ listings: listingsCsv, ruby: rubyCsv, manuka: manukaCsv });
    assert.equal(rows[0].owner, "ruby");
  });

  it("Ruby beats Manuka for ID 1027327396117322855", () => {
    const listingsCsv = [
      "ID,Title,Internal Name,Type,Location,Status,Host Editor URL,Public URL,Extracted At",
      '"1027327396117322855","T","MH - 02","home","","Listed","https://edit/1","https://pub/1","2026-05-26Z"',
    ].join("\n");
    const rubyCsv = [
      "ID,Title,Internal Name,Type,Location,Status,Host Editor URL,Public URL,Extracted At",
      '"1027327396117322855","T","MH - 02","home","","Listed","https://edit/1","https://pub/1","2026-05-26Z"',
    ].join("\n");
    const manukaCsv = [
      "ID,Title,Internal Name,Type,Location,Status,Host Editor URL,Public URL,Extracted At",
      '"1027327396117322855","T","MH - 02","home","","Đã đăng","https://edit/1","https://pub/1","2026-05-26Z"',
    ].join("\n");
    const rows = mergeCsvWithOwnership({ listings: listingsCsv, ruby: rubyCsv, manuka: manukaCsv });
    assert.equal(rows[0].owner, "ruby");
  });

  it("parseListingsCsv accepts Vietnamese 'Đã đăng' status (Manuka)", () => {
    const csv = [
      "ID,Title,Internal Name,Type,Location,Status,Host Editor URL,Public URL,Extracted At",
      '"33932700","Title","LL - Latte 2","home","","Đã đăng","https://edit/1","https://pub/1","2026-05-26T04:10:09.461Z"',
      '"1027230099688745912","Title2","LL - Coffee 1","home","","Đã đăng","https://edit/2","https://pub/2","2026-05-26T04:10:09.461Z"',
      '"999999","Title3","MH - 01","home","","In progress","https://edit/3","https://pub/3","2026-05-26T04:10:09.461Z"',
    ].join("\n");
    const rows = parseListingsCsv(csv, "manuka");
    assert.equal(rows.length, 2, "Should keep Đã đăng rows, drop In progress");
    assert.equal(rows[0].owner, "manuka");
  });

  it("mergeCsvWithOwnership drops Ruby/Manuka rows whose ID is not in listings.csv", () => {
    const listingsCsv = [
      "ID,Title,Internal Name,Type,Location,Status,Host Editor URL,Public URL,Extracted At",
      '"1111111111111111111","T1","MH - 01","home","","Listed","","https://p/1","2026-05-26Z"',
    ].join("\n");
    const rubyCsv = [
      "ID,Title,Internal Name,Type,Location,Status,Host Editor URL,Public URL,Extracted At",
      '"1111111111111111111","T1","MH - 01","home","","Listed","","https://p/1","2026-05-26Z"',
      '"9999999999999999999","EXTRA","MH - 02","home","","Listed","","https://p/2","2026-05-26Z"',
    ].join("\n");
    const manukaCsv = "ID,Title,Internal Name,Type,Location,Status,Host Editor URL,Public URL,Extracted At\n";
    const rows = mergeCsvWithOwnership({ listings: listingsCsv, ruby: rubyCsv, manuka: manukaCsv });
    assert.equal(rows.length, 1, "Only canonical listings.csv IDs should appear");
    assert.equal(rows[0].providerListingId, "1111111111111111111");
  });
});