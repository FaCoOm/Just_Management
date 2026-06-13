/**
 * Listings Source of Truth (SoT) — pure logic.
 *
 * Consumes docs/database_design/listings.csv (+ Ruby.csv + Manuka.csv) and
 * resolves listing internal_name -> canonical { propertySlug, roomNumbers[] }
 * against the rooms SoT.
 *
 * RULES (per user 2026-06-13):
 * - Within-building room drift accepted silently (CC 401 -> CC 301).
 * - Cross-building drift refused unless opts.allowCrossBuilding=true.
 * - Composite listings (Milk 2 & Coffee 2) split into multiple roomNumbers.
 *
 * NO I/O, NO Prisma. Pure functions only.
 */

import {
  ROOMS_SOURCE_OF_TRUTH,
  findPropertyByParserPrefix,
  findPropertyBySlug,
  type SoTProperty,
  type SoTRoom,
} from "./rooms-source-of-truth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DriftType =
  | "exact"
  | "within_building"
  | "cross_building"
  | "composite";

export interface NormalizedListingName {
  /** Canonical property slug (e.g. "mh", "ll", "tc"). Undefined on error. */
  propertySlug?: string;
  /** Canonical room name(s). Empty array on error. */
  roomNumbers: string[];
  /** How the resolution was reached. Undefined on error. */
  driftType?: DriftType;
  /** Error code when resolution fails. */
  errorCode?: string;
  /** Human-readable error message. */
  error?: string;
}

export interface DriftResolution {
  /** DB row id of the listing being repaired. */
  dbRowId: string;
  /** Original internal_name as stored in DB. */
  fromInternalName: string;
  /** Resolved canonical room name (single-room case). */
  resolvedRoomName: string;
  /** Resolved canonical property slug. */
  resolvedPropertySlug: string;
  /** Drift type that produced this fix. */
  driftType: DriftType;
  /** True when the DB owner field disagrees with the merged CSV owner. */
  ownerDrift: boolean;
}

export interface ListingsCsvRow {
  /** Provider listing ID, preserved as string. */
  providerListingId: string;
  /** Listing internal name (e.g. "MH - 01", "LL - Milk 2 & Coffee 2"). */
  internalName: string;
  /** Public-facing listing title. */
  title: string;
  /** Provider status text. */
  status: string;
  /** Public listing URL. */
  url: string;
  /** Which CSV this row was sourced from. */
  owner: "ruby" | "manuka" | "listings";
  /** Per-CSV raw observations without overriding canonical fields. */
  sourceMetadata: Record<string, unknown>;
}

export interface ClassifyDbRow {
  id: string;
  provider_listing_id: string;
  internal_name: string;
  /** Current owner value from DB. Optional — legacy callers omit it. */
  owner?: string;
}

export interface ClassifyOptions {
  /** Normalizer function (typically `normalizeListingInternalName`). */
  normalize: (name: string) => NormalizedListingName;
}

export interface ClassifyResult {
  /** DB row ids whose provider_listing_id matches a CSV row. */
  keepIds: string[];
  /** DB row ids with no matching CSV provider_listing_id (delete candidates). */
  surplusIds: string[];
  /** CSV providerListingIds with no matching DB row (insert candidates). */
  missingProviderIds: string[];
  /** DB rows whose internal_name disagrees with the canonical resolution. */
  driftFixes: DriftResolution[];
}

// ---------------------------------------------------------------------------
// Drift catalog (mirrors backend/scripts/merge-surplus-rooms.ts:89-145)
// ---------------------------------------------------------------------------

interface DriftEntry {
  /** Property slug the drift applies to. */
  propertySlug: string;
  /** Surplus / drifted room name as written in listing internal_name. */
  surplus: string;
  /** Canonical room name in rooms SoT. */
  canonical: string;
}

const DRIFT_CATALOG: DriftEntry[] = [
  { propertySlug: "tc", surplus: "8.05", canonical: "C 8.05" },
  { propertySlug: "tc", surplus: "C12.02", canonical: "C 12.02" },
  { propertySlug: "ll", surplus: "coffee 3", canonical: "Coffee 3" },
  { propertySlug: "ll", surplus: "Latte 1", canonical: "Latte" },
  { propertySlug: "theo", surplus: "B20.12A Main", canonical: "B20.12A" },
  { propertySlug: "ta", surplus: "The Alley 1", canonical: "Alley 1" },
  { propertySlug: "cc", surplus: "303 (301 cu)", canonical: "303" },
  { propertySlug: "cc", surplus: "303 (301 cÅ©)", canonical: "303" },
  { propertySlug: "cc", surplus: "303 (301 cũ)", canonical: "303" },
];

function findDrift(propertySlug: string, room: string): DriftEntry | undefined {
  const target = room.trim().toLowerCase();
  return DRIFT_CATALOG.find(
    (entry) =>
      entry.propertySlug === propertySlug &&
      entry.surplus.toLowerCase() === target,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KNOWN_PREFIXES = ["LL", "TheO", "MH", "CC", "TC", "23", "TA", "Ruby"];

function findRoomByName(
  property: SoTProperty,
  roomName: string,
  opts: { caseSensitive?: boolean } = {},
): SoTRoom | undefined {
  const target = roomName.trim();
  if (opts.caseSensitive) {
    return property.rooms.find((r) => r.roomName === target);
  }
  const targetLower = target.toLowerCase();
  return property.rooms.find(
    (r) => r.roomName.toLowerCase() === targetLower,
  );
}

function findPropertyContainingRoom(
  roomName: string,
): { property: SoTProperty; room: SoTRoom } | undefined {
  const target = roomName.trim().toLowerCase();
  for (const property of ROOMS_SOURCE_OF_TRUTH) {
    const room = property.rooms.find(
      (r) => r.roomName.toLowerCase() === target,
    );
    if (room) {
      return { property, room };
    }
  }
  return undefined;
}

function collapseLeadingLetterSpace(s: string): string {
  return s.replace(/^([A-Za-z])\s+(\d)/, "$1$2");
}

interface ParsedPrefix {
  prefix: string;
  rest: string;
  errorCode?: string;
  error?: string;
}

function parsePrefix(internalName: string): ParsedPrefix {
  const normalized = internalName.replace(/\s+/g, " ").trim();
  const prefixPattern = new RegExp(
    `^(${KNOWN_PREFIXES.join("|")})\\s*(?:-\\s*)?(.*)$`,
    "i",
  );
  const match = normalized.match(prefixPattern);
  if (!match) {
    return {
      prefix: "",
      rest: "",
      errorCode: "AMBIGUOUS_PREFIX",
      error: `Could not determine property prefix from: ${internalName}`,
    };
  }
  const [, rawPrefix, rawRest] = match;
  const prefix = KNOWN_PREFIXES.find(
    (p) => p.toLowerCase() === rawPrefix.toLowerCase(),
  );
  if (!prefix) {
    return {
      prefix: "",
      rest: "",
      errorCode: "UNKNOWN_PREFIX",
      error: `Prefix ${rawPrefix} not mapped`,
    };
  }
  return { prefix, rest: rawRest.trim() };
}

// ---------------------------------------------------------------------------
// Public API: normalizeListingInternalName
// ---------------------------------------------------------------------------

export interface NormalizeOptions {
  /** When true, allow drift that would map to a different building. */
  allowCrossBuilding?: boolean;
}

export function normalizeListingInternalName(
  internalName: string,
  opts: NormalizeOptions = {},
): NormalizedListingName {
  if (!internalName || internalName.trim().length === 0) {
    return {
      roomNumbers: [],
      errorCode: "EMPTY_INTERNAL_NAME",
      error: "Internal name is empty",
    };
  }

  const parsed = parsePrefix(internalName);
  if (parsed.errorCode) {
    return {
      roomNumbers: [],
      errorCode: parsed.errorCode,
      error: parsed.error,
    };
  }

  const property = findPropertyByParserPrefix(parsed.prefix);
  if (!property) {
    return {
      roomNumbers: [],
      errorCode: "UNKNOWN_PREFIX",
      error: `Property not found for prefix ${parsed.prefix}`,
    };
  }

  let room = parsed.rest;
  if (!room) {
    return {
      roomNumbers: [],
      errorCode: "MISSING_ROOM_PART",
      error: `Missing room part after prefix in: ${internalName}`,
    };
  }

  // Composite handling: split on & or " and " (case-insensitive).
  const isComposite =
    room.includes("&") || /\s+and\s+/i.test(room);
  if (isComposite) {
    const parts = room
      .split(/\s*&\s*|\s+and\s+/i)
      .map((p) => collapseLeadingLetterSpace(p.trim()))
      .filter((p) => p.length > 0);
    const resolvedRooms: string[] = [];
    for (const part of parts) {
      const resolved = resolveSingleRoom(property, part, opts);
      if (resolved.errorCode) {
        return {
          roomNumbers: [],
          errorCode: resolved.errorCode,
          error: resolved.error,
        };
      }
      // Composite parts must all resolve within the same property.
      if (resolved.propertySlug !== property.slug) {
        return {
          roomNumbers: [],
          errorCode: "CROSS_BUILDING_DRIFT",
          error: `Composite part "${part}" resolves to ${resolved.propertySlug}, expected ${property.slug}`,
        };
      }
      resolvedRooms.push(...resolved.roomNumbers);
    }
    return {
      propertySlug: property.slug,
      roomNumbers: resolvedRooms,
      driftType: "composite",
    };
  }

  return resolveSingleRoom(property, collapseLeadingLetterSpace(room), opts);
}

function resolveSingleRoom(
  property: SoTProperty,
  roomName: string,
  opts: NormalizeOptions,
): NormalizedListingName {
  // 1. Exact match against this property's room list (case-sensitive).
  // Case-insensitive matches fall through to the drift catalog so they
  // are reported as within_building drift rather than "exact".
  const exact = findRoomByName(property, roomName, { caseSensitive: true });
  if (exact) {
    return {
      propertySlug: property.slug,
      roomNumbers: [exact.roomName],
      driftType: "exact",
    };
  }

  // 2. Within-building drift via DRIFT_CATALOG.
  const drift = findDrift(property.slug, roomName);
  if (drift) {
    const canonical = findRoomByName(property, drift.canonical);
    if (canonical) {
      return {
        propertySlug: property.slug,
        roomNumbers: [canonical.roomName],
        driftType: "within_building",
      };
    }
  }

  // 3. Cross-building search: does the room name exist in another property?
  const elsewhere = findPropertyContainingRoom(roomName);
  if (elsewhere && elsewhere.property.slug !== property.slug) {
    if (opts.allowCrossBuilding) {
      return {
        propertySlug: elsewhere.property.slug,
        roomNumbers: [elsewhere.room.roomName],
        driftType: "cross_building",
      };
    }
    return {
      roomNumbers: [],
      errorCode: "CROSS_BUILDING_DRIFT",
      error: `Room "${roomName}" found in ${elsewhere.property.slug}, not ${property.slug}. Use --allow-cross-building to override.`,
    };
  }

  return {
    roomNumbers: [],
    errorCode: "ROOM_NOT_IN_SOT",
    error: `Room "${roomName}" not found in property ${property.slug} or any other building`,
  };
}

// ---------------------------------------------------------------------------
// Public API: parseListingsCsv
// ---------------------------------------------------------------------------

/**
 * Parse a listings CSV string into rows.
 * - Drops rows whose status matches /^in[\s\-]?progress$/i (covers English + Vietnamese).
 * - Preserves provider_listing_id as a string (no JS Number precision loss).
 * - csvName tags each row with its source CSV (default: "listings").
 */
export function parseListingsCsv(
  csv: string,
  csvName: "ruby" | "manuka" | "listings" = "listings",
): ListingsCsvRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }

  const headerCells = splitCsvLine(lines[0]);
  const headerMap = buildHeaderMap(headerCells);

  const rows: ListingsCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const status = pickCell(cells, headerMap, ["status"]);
    if (/^in[\s\-]?progress$/i.test(status.trim())) {
      continue;
    }
    rows.push({
      providerListingId: pickCell(cells, headerMap, ["id", "listing id"]),
      internalName: pickCell(cells, headerMap, ["internal name"]),
      title: pickCell(cells, headerMap, ["title"]),
      status,
      url: pickCell(cells, headerMap, ["public url", "url"]),
      owner: csvName,
      sourceMetadata: {
        [csvName]: {
          providerListingId: pickCell(cells, headerMap, ["id", "listing id"]),
          internalName: pickCell(cells, headerMap, ["internal name"]),
          title: pickCell(cells, headerMap, ["title"]),
          status,
          url: pickCell(cells, headerMap, ["public url", "url"]),
        },
      },
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

function buildHeaderMap(headerCells: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headerCells.forEach((cell, idx) => {
    map.set(cell.trim().toLowerCase(), idx);
  });
  return map;
}

function pickCell(
  cells: string[],
  headerMap: Map<string, number>,
  keys: string[],
): string {
  for (const key of keys) {
    const idx = headerMap.get(key.toLowerCase());
    if (idx !== undefined && idx < cells.length) {
      return cells[idx];
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Public API: classifyDbRowsAgainstCsv
// ---------------------------------------------------------------------------

export function classifyDbRowsAgainstCsv(
  dbRows: ClassifyDbRow[],
  csvRows: ListingsCsvRow[],
  opts: ClassifyOptions,
): ClassifyResult {
  const csvByProviderId = new Map<string, ListingsCsvRow>();
  for (const row of csvRows) {
    csvByProviderId.set(row.providerListingId, row);
  }

  const dbByProviderId = new Map<string, ClassifyDbRow>();
  for (const row of dbRows) {
    dbByProviderId.set(row.provider_listing_id, row);
  }

  const keepIds: string[] = [];
  const surplusIds: string[] = [];
  const driftFixes: DriftResolution[] = [];

  for (const dbRow of dbRows) {
    const csvRow = csvByProviderId.get(dbRow.provider_listing_id);
    if (!csvRow) {
      surplusIds.push(dbRow.id);
      continue;
    }
    keepIds.push(dbRow.id);

    // Drift detection: when DB internal_name fails to resolve but the
    // CSV-supplied internal_name does, that's a drift fix opportunity.
    const dbResolved = opts.normalize(dbRow.internal_name);
    const csvResolved = opts.normalize(csvRow.internalName);

    if (csvResolved.errorCode) {
      continue;
    }

    const dbCanonicalKey = dbResolved.errorCode
      ? ""
      : `${dbResolved.propertySlug}|${dbResolved.roomNumbers.join("|")}`;
    const csvCanonicalKey = `${csvResolved.propertySlug}|${csvResolved.roomNumbers.join("|")}`;

    const ownerDrift =
      dbRow.owner !== undefined && dbRow.owner !== csvRow.owner;

    if (dbCanonicalKey !== csvCanonicalKey || ownerDrift) {
      driftFixes.push({
        dbRowId: dbRow.id,
        fromInternalName: dbRow.internal_name,
        resolvedRoomName: csvResolved.roomNumbers[0] ?? "",
        resolvedPropertySlug: csvResolved.propertySlug ?? "",
        driftType: csvResolved.driftType ?? "exact",
        ownerDrift,
      });
    }
  }

  const missingProviderIds: string[] = [];
  for (const csvRow of csvRows) {
    if (!dbByProviderId.has(csvRow.providerListingId)) {
      missingProviderIds.push(csvRow.providerListingId);
    }
  }

  return {
    keepIds,
    surplusIds,
    missingProviderIds,
    driftFixes,
  };
}

// ---------------------------------------------------------------------------
// Public API: mergeCsvWithOwnership
// ---------------------------------------------------------------------------

/**
 * Merge listings.csv + Ruby.csv + Manuka.csv with ownership tagging.
 *
 * Precedence (highest wins for `owner`): Ruby > Manuka > listings.
 * Canonical set = listings.csv IDs only.
 * internalName/title/url/providerListingId always from listings.csv.
 * sourceMetadata = union of per-CSV raw observations.
 */
export function mergeCsvWithOwnership(input: {
  listings: string;
  ruby: string;
  manuka: string;
}): ListingsCsvRow[] {
  const listingRows = parseListingsCsv(input.listings, "listings");
  const rubyRows = parseListingsCsv(input.ruby, "ruby");
  const manukaRows = parseListingsCsv(input.manuka, "manuka");

  const canonicalIds = new Set(listingRows.map((r) => r.providerListingId));

  const rubyById = new Map(
    rubyRows
      .filter((r) => canonicalIds.has(r.providerListingId))
      .map((r) => [r.providerListingId, r]),
  );
  const manukaById = new Map(
    manukaRows
      .filter((r) => canonicalIds.has(r.providerListingId))
      .map((r) => [r.providerListingId, r]),
  );

  return listingRows.map((base) => {
    const ruby = rubyById.get(base.providerListingId);
    const manuka = manukaById.get(base.providerListingId);
    const owner: "ruby" | "manuka" | "listings" = manuka
      ? "manuka"
      : ruby
        ? "ruby"
        : "listings";
    const sourceMetadata: Record<string, unknown> = {
      listings: base.sourceMetadata["listings"],
    };
    if (ruby) sourceMetadata["ruby"] = ruby.sourceMetadata["ruby"];
    if (manuka) sourceMetadata["manuka"] = manuka.sourceMetadata["manuka"];
    return { ...base, owner, sourceMetadata };
  });
}
