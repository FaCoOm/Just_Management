import { Prisma } from "@prisma/client";
import { extractListings, parseSourceFile } from "../normalizer";
import { parseInternalName } from "../parser";
import { createEmptyIngestSummary, type IngestSummaryResponse, type IngestValidationError } from "../contracts";

import { prisma } from "../../lib/prisma";

export async function processListingSync(
  buffer: Buffer,
  mimeType: string,
  sourceAccount: string,
  isDryRun: boolean,
  sourceFile?: string
): Promise<IngestSummaryResponse> {
  let summary = createEmptyIngestSummary("listings", isDryRun);
  let rows: Record<string, unknown>[];
  const createMissingInventory = process.env.M_MANAGEMENT_LISTINGS_CREATE_INVENTORY === "true";

  try {
    rows = parseSourceFile(buffer, mimeType);
  } catch (error) {
    summary.errors.push({
      code: "MALFORMED_FILE",
      message: error instanceof Error ? error.message : "Failed to parse file",
    });
    return summary;
  }

  const listings = extractListings(rows);
  summary.processed = listings.length;

  // We should create a sync run record
  let syncRunId = summary.syncRunId; // Use the mock one if dry run, otherwise we'll create a real one.
  if (!isDryRun) {
    const syncRun = await prisma.sync_runs.create({
      data: {
        source_type: "multipart",
        source_account: sourceAccount,
        endpoint: "/api/ingest/listings",
        is_dry_run: false,
      },
    });
    syncRunId = syncRun.id;
    summary.syncRunId = syncRunId;
  }

  // Ensure channel exists
  let channelId = "dummy-channel-id";
  let externalAccountId = "dummy-external-account-id";
  
  if (!isDryRun) {
    const channel = await prisma.channels.upsert({
      where: { slug: "airbnb" },
      update: {},
      create: {
        slug: "airbnb",
        display_name: "Airbnb",
      },
    });
    channelId = channel.id;

    const account = await prisma.external_accounts.upsert({
      where: {
        channel_id_account_key: {
          channel_id: channel.id,
          account_key: sourceAccount,
        },
      },
      update: { last_sync_started_at: new Date() },
      create: {
        channel_id: channel.id,
        account_key: sourceAccount,
        display_name: sourceAccount,
      },
    });
    externalAccountId = account.id;
  }

  const deadLetters: Prisma.sync_dead_lettersCreateManyInput[] = [];

  for (const listing of listings) {
    const parserResult = parseInternalName(listing.internalName);

    if (parserResult.error) {
      deadLetters.push({
        sync_run_id: syncRunId,
        source_row_number: listing.sourceRowNumber,
        failure_code: parserResult.errorCode || "PARSING_ERROR",
        failure_reason: parserResult.error,
        normalized_payload: listing.rawPayload as Prisma.InputJsonValue,
      });
      summary.deadLetters++;
      continue;
    }

    if (!isDryRun && parserResult.parsed) {
      try {
        // Run in transaction for idempotency
        await prisma.$transaction(async (tx) => {
          let property = await tx.properties.findUnique({
            where: { slug: parserResult.parsed!.propertySlug },
          });

          if (!property && createMissingInventory) {
            property = await tx.properties.create({
              data: {
                slug: parserResult.parsed!.propertySlug,
                name: parserResult.parsed!.propertySlug.toUpperCase(),
              },
            });
          }

          if (!property) {
            deadLetters.push({
              sync_run_id: syncRunId,
              source_file: sourceFile,
              source_row_number: listing.sourceRowNumber,
              failure_code: "UNRESOLVED_LISTING",
              failure_reason: `Property ${parserResult.parsed!.propertySlug} does not exist; set M_MANAGEMENT_LISTINGS_CREATE_INVENTORY=true to create inventory from listings.`,
              normalized_payload: listing.rawPayload as Prisma.InputJsonValue,
            });
            summary.deadLetters++;
            return;
          }

          const roomNumber = parserResult.parsed!.roomNumber;
          let room = await tx.rooms.findFirst({
            where: { property_id: property.id, room_number: roomNumber },
          });

          if (!room && createMissingInventory) {
            room = await tx.rooms.create({
              data: {
                property_id: property.id,
                room_number: roomNumber,
                room_name: roomNumber,
              },
            });
          }

          if (!room) {
            deadLetters.push({
              sync_run_id: syncRunId,
              source_file: sourceFile,
              source_row_number: listing.sourceRowNumber,
              failure_code: "UNRESOLVED_LISTING",
              failure_reason: `Room ${roomNumber} does not exist for property ${parserResult.parsed!.propertySlug}; set M_MANAGEMENT_LISTINGS_CREATE_INVENTORY=true to create inventory from listings.`,
              normalized_payload: listing.rawPayload as Prisma.InputJsonValue,
            });
            summary.deadLetters++;
            return;
          }

          let listingId = "";

          // Upsert Listing
          if (listing.providerListingId) {
            const existingListing = await tx.channel_listings.findUnique({
              where: {
                external_account_id_provider_listing_id: {
                  external_account_id: externalAccountId,
                  provider_listing_id: listing.providerListingId,
                },
              },
            });

            const upsertedListing = await tx.channel_listings.upsert({
              where: {
                external_account_id_provider_listing_id: {
                  external_account_id: externalAccountId,
                  provider_listing_id: listing.providerListingId,
                },
              },
              update: {
                title: listing.title,
                internal_name: listing.internalName,
                location: listing.location,
                last_seen_at: new Date(),
                last_synced_at: new Date(),
              },
              create: {
                external_account_id: externalAccountId,
                provider_listing_id: listing.providerListingId,
                title: listing.title,
                internal_name: listing.internalName,
                location: listing.location,
                last_seen_at: new Date(),
                last_synced_at: new Date(),
              },
            });
            listingId = upsertedListing.id;

            // Map room
            const existingMapping = await tx.listing_room_mappings.findFirst({
              where: { channel_listing_id: upsertedListing.id }
            });
            
            if (!existingMapping) {
              await tx.listing_room_mappings.create({
                data: {
                  channel_listing_id: upsertedListing.id,
                  room_id: room.id,
                }
              });
            }

            if (existingListing) {
              summary.updated++;
            } else {
              summary.created++;
            }
          } else {
             // Ruby / Manuka title-only matching
             const matches = await tx.channel_listings.findMany({
                where: { title: listing.title }
              });

             if (matches.length > 1) {
                deadLetters.push({
                  sync_run_id: syncRunId,
                  source_row_number: listing.sourceRowNumber,
                  failure_code: "AMBIGUOUS_LISTING_MATCH",
                  failure_reason: "Title-only listing matched multiple existing listings.",
                  normalized_payload: listing.rawPayload as Prisma.InputJsonValue,
                });
                summary.deadLetters++;
             } else if (matches.length === 1) {
                const match = matches[0];
                await tx.channel_listing_aliases.upsert({
                  where: {
                    channel_listing_id_alias_value: {
                     channel_listing_id: match.id,
                     alias_value: listing.title,
                   }
                 },
                 update: {},
                 create: {
                   channel_listing_id: match.id,
                   external_account_id: externalAccountId,
                   alias_value: listing.title,
                   alias_type: "auto",
                 }
               });
               summary.updated++;
             } else {
                deadLetters.push({
                  sync_run_id: syncRunId,
                  source_row_number: listing.sourceRowNumber,
                  failure_code: "UNRESOLVED_LISTING",
                  failure_reason: "Title-only listing without matching main listing.",
                  normalized_payload: listing.rawPayload as Prisma.InputJsonValue,
                });
                summary.deadLetters++;
             }
          }
        });
      } catch (err) {
        summary.errors.push({
          code: "CONFIG_AUTH_FAILURE",
          message: err instanceof Error ? err.message : "DB Transaction Error",
        });
      }
    } else {
      // Dry run counters
      if (listing.providerListingId) {
        summary.created++;
      } else {
        summary.updated++;
      }
    }
  }

  if (!isDryRun && deadLetters.length > 0) {
    await prisma.sync_dead_letters.createMany({
      data: deadLetters,
    });
  }

  if (!isDryRun) {
    await prisma.sync_runs.update({
      where: { id: syncRunId },
      data: {
        status: "completed",
        finished_at: new Date(),
        processed_count: summary.processed,
        created_count: summary.created,
        updated_count: summary.updated,
        skipped_count: summary.skipped,
        dead_letter_count: summary.deadLetters,
      },
    });
  }

  return summary;
}
