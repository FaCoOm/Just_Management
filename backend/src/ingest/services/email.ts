import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createEmptyIngestSummary, type IngestSummaryResponse } from "../contracts";
import { processListingSync } from "./listings";
import { processReservationSync } from "./reservations";
import { findAttachmentParts, getAttachment, getHeader, getMessage, listMessages } from "../../integrations/one/google/gmail.js";

const prisma = new PrismaClient();

function decodeBase64Url(data: string): Buffer {
  return Buffer.from(data, "base64url");
}

function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function defaultQuery(): string {
  return process.env.M_MANAGEMENT_EMAIL_IMPORT_QUERY ?? "has:attachment filename:csv newer_than:30d";
}

async function dispatchAttachment(
  buffer: Buffer,
  targetKind: "listings" | "reservations",
  sourceAccount: string,
  isDryRun: boolean,
): Promise<IngestSummaryResponse> {
  if (targetKind === "listings") {
    return processListingSync(buffer, "text/csv", sourceAccount, isDryRun, "email-attachment");
  }
  return processReservationSync(buffer, "text/csv", sourceAccount, isDryRun, "email-attachment", { replaceMode: true });
}

function addInto(target: IngestSummaryResponse, source: IngestSummaryResponse): void {
  target.processed += source.processed;
  target.created += source.created;
  target.updated += source.updated;
  target.skipped += source.skipped;
  target.deadLetters += source.deadLetters;
  target.errors.push(...source.errors);
}

export async function processEmailSync(
  connectionKey: string,
  targetKind: "listings" | "reservations",
  sourceAccount: string,
  isDryRun: boolean,
): Promise<IngestSummaryResponse> {
  const summary = createEmptyIngestSummary(targetKind, isDryRun);
  const messages = await listMessages(connectionKey, defaultQuery(), { maxResults: 50 });

  for (const item of messages.messages) {
    const message = await getMessage(connectionKey, item.id);
    const parts = findAttachmentParts(message.payload).filter((p) => (p.filename ?? "").toLowerCase().endsWith(".csv"));
    const subject = getHeader(message.payload, "subject");
    const from = getHeader(message.payload, "from");

    for (const part of parts) {
      const attachmentId = part.body?.attachmentId;
      if (!attachmentId) continue;
      const attachment = await getAttachment(connectionKey, item.id, attachmentId);
      const buffer = decodeBase64Url(attachment.data);
      const digest = sha256(buffer);

      const existing = await prisma.email_import_messages.findUnique({
        where: {
          connection_key_provider_message_id_attachment_sha256: {
            connection_key: connectionKey,
            provider_message_id: item.id,
            attachment_sha256: digest,
          },
        },
      });
      if (existing?.status === "processed") {
        summary.skipped += 1;
        continue;
      }

      if (!isDryRun) {
        await prisma.email_import_messages.upsert({
          where: {
            connection_key_provider_message_id_attachment_sha256: {
              connection_key: connectionKey,
              provider_message_id: item.id,
              attachment_sha256: digest,
            },
          },
          create: {
            connection_key: connectionKey,
            provider_message_id: item.id,
            thread_id: message.threadId,
            internal_date: message.internalDate ? new Date(Number(message.internalDate)) : null,
            subject,
            from_address: from,
            attachment_filename: part.filename,
            attachment_size: BigInt(buffer.length),
            attachment_sha256: digest,
            status: "seen",
          },
          update: { status: "seen", failure_reason: null, updated_at: new Date() },
        });
      }

      const childSummary = await dispatchAttachment(buffer, targetKind, sourceAccount, isDryRun);
      addInto(summary, childSummary);

      if (!isDryRun) {
        await prisma.email_import_messages.updateMany({
          where: { connection_key: connectionKey, provider_message_id: item.id, attachment_sha256: digest },
          data: { status: childSummary.errors.length > 0 ? "quarantined" : "processed", failure_reason: childSummary.errors[0]?.message ?? null },
        });
      }
    }
  }

  return summary;
}