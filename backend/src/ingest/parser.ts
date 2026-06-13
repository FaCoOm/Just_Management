export interface ParsedPropertyRoom {
  propertySlug: string;
  roomNumber: string;
}

export interface ParsedCompositeRoom {
  propertySlug: string;
  roomNumbers: string[];
}

export interface ParserResult {
  parsed?: ParsedPropertyRoom | ParsedCompositeRoom;
  error?: string;
  errorCode?: string;
}

export const KNOWN_PREFIXES = ["LL", "TheO", "MH", "CC", "TC", "23", "TA", "Ruby"];

export function parseInternalName(internalName: string | null, opts?: { allowComposite?: boolean }): ParserResult {
  if (!internalName || internalName.trim().length === 0) {
    return {
      error: "Internal name is empty",
      errorCode: "EMPTY_INTERNAL_NAME"
    };
  }

  // Normalize whitespace: replace multiple spaces with single space
  const normalized = internalName.replace(/\s+/g, " ").trim();

  // Look for a known prefix at the start, optionally followed by space(s) and/or dash
  const prefixPattern = new RegExp(`^(${KNOWN_PREFIXES.join('|')})\\s*(?:-\\s*)?(.*)$`, 'i');
  const match = normalized.match(prefixPattern);

  if (!match) {
    return {
      error: `Could not confidently determine property prefix from: ${internalName}`,
      errorCode: "AMBIGUOUS_PREFIX"
    };
  }

  const [, rawPrefix, rawRoom] = match;

  // Map to deterministic property slug (capitalization match)
  const prefix = KNOWN_PREFIXES.find(p => p.toLowerCase() === rawPrefix.toLowerCase());
  if (!prefix) {
    return {
      error: `Prefix ${rawPrefix} not mapped`,
      errorCode: "UNKNOWN_PREFIX"
    };
  }

  // Normalize room string
  // Remove duplicate spaces, standardize B 16.09 to B16.09, etc. if needed
  let roomNumber = rawRoom.trim();
  
  // Standardize things like "B 9.08" -> "B9.08", "C 12.02" -> "C12.02"
  const collapseLeadingLetterSpace = (s: string): string =>
    s.replace(/^([A-Za-z])\s+(\d)/, "$1$2");
  roomNumber = collapseLeadingLetterSpace(roomNumber);

  // Composite room handling: when caller opts in via { allowComposite: true },
  // split on ampersand or case-insensitive ' and ' and return roomNumbers as array.
  // Without the opt-in, fall through to the legacy COMPOSITE_ROOM rejection below
  // so existing single-room callers stay backward compatible.
  const isComposite =
    roomNumber.includes("&") || roomNumber.toLowerCase().includes(" and ");
  if (opts?.allowComposite && isComposite) {
    const parts = roomNumber
      .split(/\s*&\s*|\s+and\s+/i)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map(collapseLeadingLetterSpace);
    if (parts.length > 1) {
      return {
        parsed: {
          propertySlug: getPropertySlug(prefix),
          roomNumbers: parts,
        },
      };
    }
  }

  // Handle case where room number looks like a composite string like "Milk 2 & Coffee 2"
  // For now, if we have a room part, we just take it as the room number.
  // The requirement says: "Must NOT create rooms or properties from ambiguous parser output."
  // If there's an '&' or 'and', it's likely a composite.
  if (roomNumber.includes('&') || roomNumber.toLowerCase().includes(' and ')) {
    return {
      error: `Composite room detected, cannot map to a single room: ${internalName}`,
      errorCode: "COMPOSITE_ROOM"
    };
  }

  if (!roomNumber) {
    return {
      error: `Missing room part after prefix: ${internalName}`,
      errorCode: "MISSING_ROOM_PART"
    };
  }

  // For property mapping:
  const propertySlug = getPropertySlug(prefix);

  return {
    parsed: {
      propertySlug,
      roomNumber,
    }
  };
}

function getPropertySlug(prefix: string): string {
  // Simple mapping, can be extended
  const mapping: Record<string, string> = {
    "LL": "ll",
    "TheO": "theo",
    "MH": "mh",
    "CC": "cc",
    "TC": "tc",
    "23": "23",
    "TA": "ta",
    "Ruby": "ruby",
  };
  return mapping[prefix] || prefix.toLowerCase();
}
