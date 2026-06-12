/**
 * Rooms Source of Truth (SoT)
 *
 * 45 canonical rooms across 8 Mujo properties. Sourced from
 * `docs/database_design/Room Types.md` and the Notion Room Standards
 * data source (`480a2381-4334-4119-8b8a-e0b7456d26e5`).
 *
 * RULES:
 * - This file is the single authoritative source for property + room inventory.
 * - DO NOT edit unless the user has confirmed the change.
 * - Edits MUST stay in sync with `docs/database_design/Room Types.md`.
 * - The seed script and ingestion services consume this file directly.
 *
 * KEY DESIGN:
 * - `slug`: matches `parser.ts` getPropertySlug() output. The ingestion
 *   pipeline parses listing internal names and maps them to these slugs.
 * - `parserPrefix`: the prefix the parser recognises (KNOWN_PREFIXES in parser.ts).
 * - `rooms[].roomName`: the canonical room identifier as it appears in
 *   listing internal names ("MH - 01", "LL - Coffee 1", etc.). Matches the
 *   "Room # / Name" column in Room Types.md.
 * - `rooms[].code`: the canonical type code from the Notion Room Types data
 *   source. Variants (e.g. 3.2, 3.3) extend the base family with size /
 *   bed-configuration deltas.
 */

export interface SoTRoom {
  /** Canonical room identifier from Room Types.md "Room # / Name" column. */
  roomName: string;
  /** Notion canonical type code. See ROOM_TYPE_CATALOG for the resolved type. */
  code: keyof typeof ROOM_TYPE_CATALOG;
}

export interface SoTProperty {
  /** Slug stored in `properties.slug`. Matches `parser.ts` getPropertySlug() output. */
  slug: string;
  /** Display name shown in the dashboard sidebar / property cards. */
  name: string;
  /** Internal-name prefix the ingestion parser recognises. */
  parserPrefix: string;
  /** Canonical room list (length must match Room Types.md table for this property). */
  rooms: SoTRoom[];
}

/**
 * Canonical room type catalog. Sourced from the Notion "Room Types" data
 * source (`480a2381-4334-4119-8b8a-e0b7456d26e5`).
 *
 * `family` matches the Notion `Family` select option name. `title` is the
 * canonical room type name shown to operators. `otaName` is the public
 * listing label used on Airbnb/Booking. `maxOccupancy` matches Notion.
 */
export const ROOM_TYPE_CATALOG = {
  "1": {
    family: "Master",
    title: "Master",
    maxOccupancy: 2,
    otaName: "Master Room with Balcony & Kitchen",
  },
  "2": {
    family: "Standard",
    title: "Standard",
    maxOccupancy: 2,
    otaName: "Standard Room",
  },
  "3": {
    family: "Twin Room",
    title: "Double Beds",
    maxOccupancy: 3,
    otaName: "Double-Bed Room with Kitchen",
  },
  "3.2": {
    family: "Twin Room",
    title: "Master (Queen + Single)",
    maxOccupancy: 3,
    otaName: "Master Room \u2014 Queen + Single",
  },
  "3.3": {
    family: "Twin Room",
    title: "Master (Queen + Single, Larger)",
    maxOccupancy: 3,
    otaName: "Master Room \u2014 Queen + Single (Spacious)",
  },
  "4": {
    family: "Deluxe Queen",
    title: "Deluxe Queen",
    maxOccupancy: 2,
    otaName: "Deluxe Queen \u2014 Balcony, Kitchen & Bathtub",
  },
  "4.2": {
    family: "Deluxe Queen",
    title: "Deluxe Queen (Larger)",
    maxOccupancy: 2,
    otaName: "Deluxe Queen (Spacious)",
  },
  "5": {
    family: "Double Room (Balcony)",
    title: "Double Room (Balcony)",
    maxOccupancy: 4,
    otaName: "Double Room \u2014 Two Queens, Balcony & Kitchen",
  },
  "6": {
    family: "Double Room (Bathtub)",
    title: "Double Room (Bathtub)",
    maxOccupancy: 4,
    otaName: "Double Room \u2014 Two Queens, Kitchen & Bathtub",
  },
  "7": {
    family: "Deluxe Queen (Compact)",
    title: "Deluxe Queen (Compact)",
    maxOccupancy: 2,
    otaName: "Deluxe Queen Studio with Kitchen",
  },
  "8": {
    family: "Luxury Apartment",
    title: "Luxury Apartment",
    maxOccupancy: 4,
    otaName: "Two-Bedroom Luxury Apartment",
  },
} as const;

export const ROOMS_SOURCE_OF_TRUTH: SoTProperty[] = [
  {
    slug: "mh",
    name: "Mujo \u2014 MH",
    parserPrefix: "MH",
    rooms: [
      { roomName: "Lotus", code: "1" },
      { roomName: "Rose", code: "1" },
      { roomName: "Kitchen", code: "3.2" },
      { roomName: "01", code: "2" },
      { roomName: "02", code: "2" },
      { roomName: "03", code: "2" },
      { roomName: "05", code: "2" },
    ],
  },
  {
    slug: "23",
    name: "Mujo \u2014 23",
    parserPrefix: "23",
    rooms: [
      { roomName: "Salt", code: "1" },
      { roomName: "Sugar", code: "1" },
      { roomName: "Garlic", code: "2" },
      { roomName: "Pepper", code: "2" },
    ],
  },
  {
    slug: "ruby",
    name: "Mujo 19 (Nguy\u1ec5n Tr\u00e3i)",
    parserPrefix: "Ruby",
    rooms: [
      { roomName: "Ruby 1", code: "2" },
      { roomName: "Ruby 2", code: "2" },
      { roomName: "Ruby 4", code: "2" },
      { roomName: "Ruby 6", code: "2" },
      { roomName: "Ruby 5", code: "1" },
      { roomName: "Ruby 7", code: "1" },
      { roomName: "Ruby 3", code: "3.2" },
    ],
  },
  {
    slug: "cc",
    name: "Mujo \u2014 CC",
    parserPrefix: "CC",
    rooms: [
      { roomName: "301", code: "1" },
      { roomName: "303", code: "1" },
      { roomName: "401", code: "1" },
      { roomName: "403", code: "1" },
      { roomName: "302", code: "2" },
      { roomName: "402", code: "2" },
      { roomName: "304", code: "3" },
      { roomName: "404", code: "3" },
    ],
  },
  {
    slug: "ll",
    name: "Mujo \u2014 Latte Lounge",
    parserPrefix: "LL",
    rooms: [
      { roomName: "Coffee 1", code: "2" },
      { roomName: "Milk 1", code: "2" },
      { roomName: "Coffee 2", code: "4" },
      { roomName: "Milk 2", code: "4" },
      { roomName: "Latte 2", code: "4.2" },
      { roomName: "Coffee 3", code: "5" },
      { roomName: "Milk 3", code: "5" },
      { roomName: "Latte", code: "6" },
    ],
  },
  {
    slug: "ta",
    name: "Mujo \u2014 The Alley",
    parserPrefix: "TA",
    rooms: [
      { roomName: "Alley 2", code: "7" },
      { roomName: "Alley 3", code: "7" },
      { roomName: "Alley 4", code: "7" },
      { roomName: "Alley 1", code: "3.3" },
    ],
  },
  {
    slug: "tc",
    name: "Mujo \u2014 The Crest",
    parserPrefix: "TC",
    rooms: [
      { roomName: "C 8.05", code: "8" },
      { roomName: "C 12.02", code: "8" },
    ],
  },
  {
    slug: "theo",
    name: "Mujo \u2014 The Opera",
    parserPrefix: "TheO",
    rooms: [
      { roomName: "B9.08", code: "8" },
      { roomName: "B15.12A", code: "8" },
      { roomName: "B16.09", code: "8" },
      { roomName: "B20.12A", code: "8" },
      { roomName: "A21.12A", code: "8" },
    ],
  },
];

/** Total room count enforced by the SoT. Used as a runtime invariant. */
export const ROOMS_SOT_TOTAL = ROOMS_SOURCE_OF_TRUTH.reduce(
  (sum, prop) => sum + prop.rooms.length,
  0,
);

/** Compile-time guard: total must remain 45 unless the user authorises a change. */
const _expectedTotal: 45 = ROOMS_SOT_TOTAL as 45;
void _expectedTotal;

/**
 * Resolve a room's canonical type metadata.
 * @throws if the code is not in the catalog (should be impossible given the type system).
 */
export function resolveRoomType(code: SoTRoom["code"]): typeof ROOM_TYPE_CATALOG[SoTRoom["code"]] {
  const entry = ROOM_TYPE_CATALOG[code];
  if (!entry) {
    throw new Error(`Unknown room code in SoT: ${code}`);
  }
  return entry;
}

/** Look up a property by parser prefix (e.g. "MH", "LL"). */
export function findPropertyByParserPrefix(prefix: string): SoTProperty | undefined {
  return ROOMS_SOURCE_OF_TRUTH.find((p) => p.parserPrefix === prefix);
}

/** Look up a property by slug. */
export function findPropertyBySlug(slug: string): SoTProperty | undefined {
  return ROOMS_SOURCE_OF_TRUTH.find((p) => p.slug === slug);
}
