const BRAND_PREFIX_PATTERN = /^(mujo|latte lounge|the alley|the crest|the opera)\s*[-:]?\s*/i;

export interface ListingRoomMappingRecord {
  room_id: string;
  room: {
    property_id: string;
  };
}

export interface ChannelListingRecord {
  id: string;
  title: string;
  listing_room_mappings: ListingRoomMappingRecord[];
}

export interface ChannelListingAliasRecord {
  channel_listing_id: string;
  channel_listing: ChannelListingRecord;
}

export interface ListingResolutionResult {
  listingId: string;
  propertyId: string;
  roomId: string;
  method: "alias" | "exact" | "fuzzy";
}

export interface ListingResolutionError {
  code: "AMBIGUOUS_LISTING_MATCH" | "UNRESOLVED_LISTING";
  reason: string;
}

export interface ListingResolutionTx {
  channel_listing_aliases: {
    findMany(args: {
      where: {
        external_account_id: string;
        alias_value: string;
      };
      include: {
        channel_listing: {
          include: {
            listing_room_mappings: {
              include: {
                room: true;
              };
            };
          };
        };
      };
    }): Promise<ChannelListingAliasRecord[]>;
    upsert(args: {
      where: {
        channel_listing_id_alias_value: {
          channel_listing_id: string;
          alias_value: string;
        };
      };
      update: Record<string, never>;
      create: {
        channel_listing_id: string;
        external_account_id: string;
        alias_value: string;
        alias_type: string;
      };
    }): Promise<unknown>;
  };
  channel_listings: {
    findMany(args: {
      where: {
        external_account_id: string;
        title?: string;
      };
      include: {
        listing_room_mappings: {
          include: {
            room: true;
          };
        };
      };
    }): Promise<ChannelListingRecord[]>;
  };
}

export function normalizeListingTitle(title: string | null | undefined): string {
  if (!title) {
    return "";
  }

  return title
    .toLowerCase()
    .replace(BRAND_PREFIX_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toResolutionResult(listing: ChannelListingRecord, method: ListingResolutionResult["method"]): ListingResolutionResult | null {
  const mapping = listing.listing_room_mappings[0];
  if (!mapping) {
    return null;
  }

  return {
    listingId: listing.id,
    propertyId: mapping.room.property_id,
    roomId: mapping.room_id,
    method,
  };
}

function formatCandidateTitles(candidates: ChannelListingRecord[]): string {
  const titles = Array.from(new Set(candidates.map((candidate) => candidate.title))).slice(0, 3);
  return titles.join(", ");
}

export async function resolveReservationListing(
  tx: ListingResolutionTx,
  externalAccountId: string,
  listingTitle: string,
): Promise<{ resolution: ListingResolutionResult | null; error: ListingResolutionError | null }> {
  const aliases = await tx.channel_listing_aliases.findMany({
    where: {
      external_account_id: externalAccountId,
      alias_value: listingTitle,
    },
    include: {
      channel_listing: {
        include: { listing_room_mappings: { include: { room: true } } },
      },
    },
  });

  if (aliases.length > 1) {
    return {
      resolution: null,
      error: {
        code: "AMBIGUOUS_LISTING_MATCH",
        reason: `Multiple alias matches found for listing title: ${listingTitle}`,
      },
    };
  }

  if (aliases.length === 1) {
    const aliasResolution = toResolutionResult(aliases[0].channel_listing, "alias");
    if (aliasResolution) {
      return { resolution: aliasResolution, error: null };
    }
  }

  const exactListings = await tx.channel_listings.findMany({
    where: {
      external_account_id: externalAccountId,
      title: listingTitle,
    },
    include: { listing_room_mappings: { include: { room: true } } },
  });

  if (exactListings.length > 1) {
    return {
      resolution: null,
      error: {
        code: "AMBIGUOUS_LISTING_MATCH",
        reason: `Multiple listing matches found for title: ${listingTitle}`,
      },
    };
  }

  if (exactListings.length === 1) {
    const exactResolution = toResolutionResult(exactListings[0], "exact");
    if (exactResolution) {
      return { resolution: exactResolution, error: null };
    }
  }

  const normalizedTitle = normalizeListingTitle(listingTitle);
  const accountListings = await tx.channel_listings.findMany({
    where: { external_account_id: externalAccountId },
    include: { listing_room_mappings: { include: { room: true } } },
  });
  const listingsByNormalizedTitle = new Map<string, ChannelListingRecord[]>();

  for (const listing of accountListings) {
    const normalizedListingTitle = normalizeListingTitle(listing.title);
    const existing = listingsByNormalizedTitle.get(normalizedListingTitle) ?? [];
    existing.push(listing);
    listingsByNormalizedTitle.set(normalizedListingTitle, existing);
  }

  const fuzzyMatches = listingsByNormalizedTitle.get(normalizedTitle) ?? [];

  if (fuzzyMatches.length === 0) {
    return { resolution: null, error: null };
  }

  if (fuzzyMatches.length > 1) {
    return {
      resolution: null,
      error: {
        code: "AMBIGUOUS_LISTING_MATCH",
        reason: `Ambiguous normalized listing match for title: ${listingTitle}. Candidates: ${formatCandidateTitles(fuzzyMatches)}`,
      },
    };
  }

  const fuzzyResolution = toResolutionResult(fuzzyMatches[0], "fuzzy");
  if (!fuzzyResolution) {
    return { resolution: null, error: null };
  }

  await tx.channel_listing_aliases.upsert({
    where: {
      channel_listing_id_alias_value: {
        channel_listing_id: fuzzyResolution.listingId,
        alias_value: listingTitle,
      },
    },
    update: {},
    create: {
      channel_listing_id: fuzzyResolution.listingId,
      external_account_id: externalAccountId,
      alias_value: listingTitle,
      alias_type: "auto",
    },
  });

  return { resolution: fuzzyResolution, error: null };
}
