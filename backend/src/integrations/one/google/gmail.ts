import { passthrough } from "../client.js";

const ACTION_LIST_MESSAGES = "conn_mod_def::GJ3odOE-fdw::ijLww5s-SCSplLQtLpxkrw";
const ACTION_GET_MESSAGE = "conn_mod_def::GJ3ocvMGOS8::D__3BgQSSzWtDUoOqLuX2A";
const ACTION_GET_ATTACHMENT = "conn_mod_def::GJ3ocG2ED_w::LGrrJyM-QFmKBaHwvMWwzQ";

export interface GmailMessageListItem {
  id: string;
  threadId?: string;
}

export interface GmailListMessagesResponse {
  messages: GmailMessageListItem[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface RawListMessagesResponse {
  messages?: Array<{ id?: unknown; threadId?: unknown }>;
  nextPageToken?: unknown;
  resultSizeEstimate?: unknown;
}

export interface GmailMessagePartBody {
  attachmentId?: string;
  size?: number;
  data?: string;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name?: string; value?: string }>;
  body?: GmailMessagePartBody;
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
}

export interface GmailAttachment {
  size?: number;
  data: string;
}

export async function listMessages(
  connectionKey: string,
  query: string,
  opts: { pageToken?: string; maxResults?: number } = {},
): Promise<GmailListMessagesResponse> {
  const data = await passthrough<RawListMessagesResponse>({
    connectionKey,
    actionId: ACTION_LIST_MESSAGES,
    method: "GET",
    path: "/gmail/v1/users/me/messages",
    query: {
      q: query,
      maxResults: opts.maxResults ?? 50,
      pageToken: opts.pageToken,
    },
  });

  return {
    messages: (data.messages ?? [])
      .filter((m): m is { id: string; threadId?: unknown } => typeof m.id === "string")
      .map((m) => ({ id: m.id, threadId: typeof m.threadId === "string" ? m.threadId : undefined })),
    nextPageToken: typeof data.nextPageToken === "string" ? data.nextPageToken : undefined,
    resultSizeEstimate: typeof data.resultSizeEstimate === "number" ? data.resultSizeEstimate : undefined,
  };
}

export async function getMessage(connectionKey: string, messageId: string): Promise<GmailMessage> {
  return passthrough<GmailMessage>({
    connectionKey,
    actionId: ACTION_GET_MESSAGE,
    method: "GET",
    path: `/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`,
    query: { format: "full" },
  });
}

export async function getAttachment(connectionKey: string, messageId: string, attachmentId: string): Promise<GmailAttachment> {
  return passthrough<GmailAttachment>({
    connectionKey,
    actionId: ACTION_GET_ATTACHMENT,
    method: "GET",
    path: `/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
  });
}

export function getHeader(part: GmailMessagePart | undefined, name: string): string | undefined {
  const target = name.toLowerCase();
  const header = part?.headers?.find((h) => h.name?.toLowerCase() === target);
  return header?.value;
}

export function findAttachmentParts(part: GmailMessagePart | undefined): GmailMessagePart[] {
  if (!part) return [];
  const own = part.filename && part.body?.attachmentId ? [part] : [];
  const nested = (part.parts ?? []).flatMap(findAttachmentParts);
  return [...own, ...nested];
}