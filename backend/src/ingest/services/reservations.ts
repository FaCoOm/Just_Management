import { PrismaClient, Prisma } from "@prisma/client";
import { extractReservations, parseSourceFile } from "../normalizer";
import { createEmptyIngestSummary, type IngestSummaryResponse } from "../contracts";

const prisma = new PrismaClient();

function toValidDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildOperationalNotes(sourceAccount: string, rawStatus: string): string {
  return `booking_source=Airbnb; external_account=${sourceAccount}; raw_status=${rawStatus}`;
}

export async function processReservationSync(
  buffer: Buffer,
  mimeType: string,
  sourceAccount: string,
  isDryRun: boolean
): Promise<IngestSummaryResponse> {
  let summary = createEmptyIngestSummary("reservations", isDryRun);
  let rows: Record<string, unknown>[];

  try {
    rows = parseSourceFile(buffer, mimeType);
  } catch (error) {
    summary.errors.push({
      code: "MALFORMED_FILE",
      message: error instanceof Error ? error.message : "Failed to parse file",
    });
    return summary;
  }

  const reservations = extractReservations(rows);
  summary.processed = reservations.length;

  let syncRunId = summary.syncRunId;
  if (!isDryRun) {
    const syncRun = await prisma.sync_runs.create({
      data: {
        source_type: "multipart",
        source_account: sourceAccount,
        endpoint: "/api/ingest/reservations",
        is_dry_run: false,
      },
    });
    syncRunId = syncRun.id;
    summary.syncRunId = syncRunId;
  }

  let channelId = "dummy-channel-id";
  let externalAccountId = "dummy-external-account-id";

  if (!isDryRun) {
    const channel = await prisma.channels.upsert({
      where: { slug: "airbnb" },
      update: {},
      create: { slug: "airbnb", display_name: "Airbnb" },
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

  for (const reservation of reservations) {
    if (!isDryRun) {
      try {
        await prisma.$transaction(async (tx) => {
          let resolvedListingId: string | null = null;
          let resolvedPropertyId: string | null = null;
          let resolvedRoomId: string | null = null;
          let listingResolutionError: { code: string; reason: string } | null = null;

          if (reservation.listingTitle) {
            const aliases = await tx.channel_listing_aliases.findMany({
              where: {
                external_account_id: externalAccountId,
                alias_value: reservation.listingTitle,
              },
              include: {
                channel_listing: {
                  include: { listing_room_mappings: { include: { room: true } } },
                },
              },
            });

            if (aliases.length > 1) {
              listingResolutionError = {
                code: "AMBIGUOUS_LISTING_MATCH",
                reason: `Multiple alias matches found for listing title: ${reservation.listingTitle}`,
              };
            } else if (aliases.length === 1 && aliases[0].channel_listing.listing_room_mappings.length > 0) {
              const alias = aliases[0];
              resolvedListingId = alias.channel_listing_id;
              const mapping = alias.channel_listing.listing_room_mappings[0];
              resolvedRoomId = mapping.room_id;
              resolvedPropertyId = mapping.room.property_id;
            } else {
              const exactListings = await tx.channel_listings.findMany({
                where: {
                  external_account_id: externalAccountId,
                  title: reservation.listingTitle,
                },
                include: { listing_room_mappings: { include: { room: true } } },
              });

              if (exactListings.length > 1) {
                listingResolutionError = {
                  code: "AMBIGUOUS_LISTING_MATCH",
                  reason: `Multiple listing matches found for title: ${reservation.listingTitle}`,
                };
              } else if (exactListings.length === 1 && exactListings[0].listing_room_mappings.length > 0) {
                const exactListing = exactListings[0];
                resolvedListingId = exactListing.id;
                const mapping = exactListing.listing_room_mappings[0];
                resolvedRoomId = mapping.room_id;
                resolvedPropertyId = mapping.room.property_id;
              }
            }
          }

          if (!resolvedListingId || !resolvedPropertyId || !resolvedRoomId) {
            deadLetters.push({
              sync_run_id: syncRunId,
              source_row_number: reservation.sourceRowNumber,
              failure_code: listingResolutionError?.code ?? "UNRESOLVED_LISTING",
              failure_reason: listingResolutionError?.reason ?? `Could not resolve listing title: ${reservation.listingTitle}`,
              normalized_payload: reservation.rawPayload as Prisma.InputJsonValue,
            });
            summary.deadLetters++;
            return;
          }

          if (!reservation.confirmationCode) {
            deadLetters.push({
              sync_run_id: syncRunId,
              source_row_number: reservation.sourceRowNumber,
              failure_code: "MISSING_CONFIRMATION_CODE",
              failure_reason: "Reservation missing confirmation code.",
              normalized_payload: reservation.rawPayload as Prisma.InputJsonValue,
            });
            summary.deadLetters++;
            return;
          }

          const checkIn = toValidDate(reservation.checkInDate);
          const checkOut = toValidDate(reservation.checkOutDate);
          if (!checkIn || !checkOut) {
            deadLetters.push({
              sync_run_id: syncRunId,
              source_row_number: reservation.sourceRowNumber,
              failure_code: "MALFORMED_FILE",
              failure_reason: "Reservation has invalid or missing check-in/check-out dates.",
              normalized_payload: reservation.rawPayload as Prisma.InputJsonValue,
            });
            summary.deadLetters++;
            return;
          }

          const bookedAt = toValidDate(reservation.bookedAt);

          const existingRef = await tx.reservation_external_refs.findFirst({
            where: {
              channel_id: channelId,
              external_account_id: externalAccountId,
              confirmation_code: reservation.confirmationCode,
            },
            include: { reservation: true },
          });

          // Normalized Status
          let normalizedStatus = "pending";
          const rawL = reservation.rawStatus.toLowerCase();
          if (rawL === "currently hosting" || rawL === "arriving today" || rawL === "ongoing") normalizedStatus = "checked_in";
          else if (rawL === "confirmed" || rawL === "upcoming") normalizedStatus = "pending";
          else if (rawL === "review guest" || rawL === "past guest" || rawL === "checkout today") normalizedStatus = "checked_out";
          else if (rawL === "canceled" || rawL === "cancelled") normalizedStatus = "cancelled";

          let resId = "";

          if (existingRef) {
            resId = existingRef.reservation_id;
            await tx.reservations.update({
              where: { id: resId },
              data: {
                property_id: resolvedPropertyId,
                primary_room_id: resolvedRoomId,
                status: normalizedStatus,
                check_in_date: checkIn,
                check_out_date: checkOut,
                guest_name: reservation.guestName,
                guest_phone: reservation.guestPhone,
                adult_count: reservation.adultCount,
                child_count: reservation.childCount,
                infant_count: reservation.infantCount,
                guest_count: reservation.adultCount + reservation.childCount + reservation.infantCount,
                operational_notes: buildOperationalNotes(sourceAccount, reservation.rawStatus),
              },
            });

            await tx.reservation_external_refs.update({
              where: { id: existingRef.id },
              data: {
                channel_listing_id: resolvedListingId,
                provider_reservation_id: reservation.providerReservationId,
                raw_status: reservation.rawStatus,
                source_status: normalizedStatus,
                booked_at: bookedAt,
                last_synced_at: new Date(),
              },
            });

            const existingAllocation = await tx.reservation_room_allocations.findFirst({
              where: { reservation_id: resId },
            });

            if (existingAllocation) {
              await tx.reservation_room_allocations.update({
                where: { id: existingAllocation.id },
                data: {
                  room_id: resolvedRoomId,
                  allocation_role: "stay",
                },
              });
            } else {
              await tx.reservation_room_allocations.create({
                data: {
                  reservation_id: resId,
                  room_id: resolvedRoomId,
                  allocation_role: "stay",
                },
              });
            }

            summary.updated++;
          } else {
              const resRecord = await tx.reservations.create({
                data: {
                  property_id: resolvedPropertyId,
                 primary_room_id: resolvedRoomId,
                 status: normalizedStatus,
                 check_in_date: checkIn,
                 check_out_date: checkOut,
                 guest_name: reservation.guestName,
                 guest_phone: reservation.guestPhone,
                 adult_count: reservation.adultCount,
                child_count: reservation.childCount,
                infant_count: reservation.infantCount,
                guest_count: reservation.adultCount + reservation.childCount + reservation.infantCount,
                operational_notes: buildOperationalNotes(sourceAccount, reservation.rawStatus),
                }
              });
             resId = resRecord.id;

             await tx.reservation_external_refs.create({
               data: {
                 reservation_id: resId,
                 channel_id: channelId,
                 external_account_id: externalAccountId,
                 channel_listing_id: resolvedListingId,
                 confirmation_code: reservation.confirmationCode,
                 provider_reservation_id: reservation.providerReservationId,
                  raw_status: reservation.rawStatus,
                  source_status: normalizedStatus,
                  booked_at: bookedAt,
                  last_synced_at: new Date(),
                }
              });

             await tx.reservation_room_allocations.create({
               data: {
                 reservation_id: resId,
                 room_id: resolvedRoomId,
                 allocation_role: "stay",
               }
             });

             summary.created++;
          }
        });
      } catch (err) {
        summary.errors.push({
          code: "CONFIG_AUTH_FAILURE",
          message: err instanceof Error ? err.message : "DB Transaction Error",
        });
      }
    } else {
      if (reservation.confirmationCode) summary.created++;
      else summary.skipped++;
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
