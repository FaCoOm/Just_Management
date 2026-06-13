import { describe, it } from "node:test";
import assert from "node:assert";

import {
  normalizeListingTitle,
  resolveReservationListing,
  type ChannelListingRecord,
  type ListingResolutionTx,
} from "../src/ingest/lib/listing-resolution.js";

function createListing(id: string, title: string, propertyId = "prop-1", roomId = "room-1"): ChannelListingRecord {
  return {
    id,
    title,
    listing_room_mappings: [
      {
        room_id: roomId,
        room: { property_id: propertyId },
      },
    ],
  };
}

function createMockTx(args: {
  aliases?: Array<{
    channel_listing_id: string;
    channel_listing: ChannelListingRecord;
  }>;
  exactListings?: ChannelListingRecord[];
  allListings?: ChannelListingRecord[];
}) {
  const upserts: Array<{
    where: {
      channel_listing_id_alias_value: {
        channel_listing_id: string;
        alias_value: string;
      };
    };
    create: {
      channel_listing_id: string;
      external_account_id: string;
      alias_value: string;
      alias_type: string;
    };
  }> = [];

  const tx: ListingResolutionTx = {
    channel_listing_aliases: {
      findMany: async ({ where }) => {
        assert.strictEqual(where.external_account_id, "acct-1");
        return args.aliases ?? [];
      },
      upsert: async (payload) => {
        upserts.push({ where: payload.where, create: payload.create });
        return {};
      },
    },
    channel_listings: {
      findMany: async ({ where }) => {
        assert.strictEqual(where.external_account_id, "acct-1");
        if (typeof where.title === "string") {
          return args.exactListings ?? [];
        }

        return args.allListings ?? [];
      },
    },
  };

  return { tx, upserts };
}

describe("normalizeListingTitle", () => {
  it("removes MUJO prefix", () => {
    assert.strictEqual(normalizeListingTitle("MUJO- Foo Bar"), normalizeListingTitle("Foo Bar"));
  });

  it("removes Latte Lounge prefix", () => {
    assert.strictEqual(normalizeListingTitle("Latte Lounge - X"), normalizeListingTitle("X"));
  });

  it("handles empty and null inputs", () => {
    assert.strictEqual(normalizeListingTitle(""), "");
    assert.strictEqual(normalizeListingTitle(null), "");
    assert.strictEqual(normalizeListingTitle(undefined), "");
  });
});

describe("resolveReservationListing fuzzy fallback", () => {
  it("returns unresolved when fuzzy stage finds no matches", async () => {
    const { tx, upserts } = createMockTx({
      aliases: [],
      exactListings: [],
      allListings: [createListing("listing-1", "Different Listing")],
    });

    const result = await resolveReservationListing(tx, "acct-1", "MUJO - Comfortable bed room central city #Netflix");

    assert.strictEqual(result.resolution, null);
    assert.strictEqual(result.error, null);
    assert.strictEqual(upserts.length, 0);
  });

  it("resolves one fuzzy match and creates an alias", async () => {
    const matchedListing = createListing(
      "listing-1",
      "Comfortable bed room central city #Netflix",
      "prop-9",
      "room-7",
    );
    const { tx, upserts } = createMockTx({
      aliases: [],
      exactListings: [],
      allListings: [matchedListing],
    });

    const result = await resolveReservationListing(tx, "acct-1", "MUJO - Comfortable bed room central city #Netflix");

    assert.deepStrictEqual(result, {
      resolution: {
        listingId: "listing-1",
        propertyId: "prop-9",
        roomId: "room-7",
        method: "fuzzy",
      },
      error: null,
    });
    assert.strictEqual(upserts.length, 1);
    assert.deepStrictEqual(upserts[0], {
      where: {
        channel_listing_id_alias_value: {
          channel_listing_id: "listing-1",
          alias_value: "MUJO - Comfortable bed room central city #Netflix",
        },
      },
      create: {
        channel_listing_id: "listing-1",
        external_account_id: "acct-1",
        alias_value: "MUJO - Comfortable bed room central city #Netflix",
        alias_type: "auto",
      },
    });
  });

  it("dead-letters ambiguous fuzzy matches with candidate titles", async () => {
    const { tx, upserts } = createMockTx({
      aliases: [],
      exactListings: [],
      allListings: [
        createListing("listing-1", "Deluxe condo @District1 #BenThanh", "prop-1", "room-1"),
        createListing("listing-2", "Latte Lounge - Deluxe condo @District1 #BenThanh", "prop-2", "room-2"),
        createListing("listing-3", "MUJO- Deluxe condo @District1 #BenThanh", "prop-3", "room-3"),
        createListing("listing-4", "The Alley - Deluxe condo @District1 #BenThanh", "prop-4", "room-4"),
      ],
    });

    const result = await resolveReservationListing(tx, "acct-1", "MUJO- Deluxe condo @District1 #BenThanh");

    assert.strictEqual(result.resolution, null);
    assert.deepStrictEqual(result.error, {
      code: "AMBIGUOUS_LISTING_MATCH",
      reason:
        "Ambiguous normalized listing match for title: MUJO- Deluxe condo @District1 #BenThanh. Candidates: Deluxe condo @District1 #BenThanh, Latte Lounge - Deluxe condo @District1 #BenThanh, MUJO- Deluxe condo @District1 #BenThanh",
    });
    assert.strictEqual(upserts.length, 0);
  });
});
