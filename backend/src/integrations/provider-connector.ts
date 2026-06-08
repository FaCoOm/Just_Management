import { OneApiError, OneConfigError } from "./one/client.js";
import { getMessage, getHeader, listMessages as listGmailMessages } from "./one/google/gmail.js";
import { passthrough } from "./one/client.js";

export type ConnectionStatus = { connected: boolean; provider: string; error?: string };

export type EmailQuery = { from?: string; subject?: string; after?: string; maxResults?: number };

export type EmailMessage = { id: string; subject: string; from: string; date: string; snippet: string };

export type SheetRow = Record<string, string | number | null>;

export interface ProviderConnector {
  getConnectionStatus(): Promise<ConnectionStatus>;
  listEmails(query: EmailQuery): Promise<EmailMessage[]>;
  getEmailBody(messageId: string): Promise<string>;
  appendSheetRows(sheetId: string, rows: SheetRow[], options?: SheetUpsertOptions): Promise<SheetUpsertResult>;
}

export interface SheetUpsertOptions {
  sheetName?: string;
  idempotencyKeyColumn?: string;
}

export interface SheetUpsertResult {
  rowsAppended: number;
  rowsUpdated: number;
  rowsSkipped: number;
}

function toGmailQuery(query: EmailQuery): string {
  const parts: string[] = [];
  if (query.from) parts.push(`from:${query.from}`);
  if (query.subject) parts.push(`subject:${query.subject}`);
  if (query.after) parts.push(`after:${query.after}`);
  return parts.join(" ");
}

// OTA Parser Registry Types
export type OtaProvider = "airbnb" | "booking.com" | "agoda" | "generic";

export interface OtaEmailParser {
  provider: OtaProvider;
  canParse(from: string, subject: string): boolean;
  parseEmail(payload: { subject: string; from: string; body: string }): ParsedOtaData | null;
}

export interface ParsedOtaData {
  provider: OtaProvider;
  confirmationCode: string | null;
  guestName: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  listingTitle: string | null;
  amount: number | null;
  currency: string | null;
  rawFields: Record<string, string>;
}

// Gmail passthrough action IDs
const SHEETS_APPEND_ACTION_ID = "conn_mod_def::GJ30kqWG-z8::VMMRhQGBT_ei-wq4JK7Sow";
const SHEETS_GET_ACTION_ID = "conn_mod_def::GJ30jpJCuBA::-7kldtebSUeO7_FYtT48JQ";

// OTA Parser Registry
const otaParsers: OtaEmailParser[] = [];

export function registerOtaParser(parser: OtaEmailParser): void {
  otaParsers.push(parser);
}

export function getOtaParsers(): OtaEmailParser[] {
  return [...otaParsers];
}

export function findParserForEmail(from: string, subject: string): OtaEmailParser | undefined {
  return otaParsers.find(p => p.canParse(from, subject));
}

// Built-in OTA Parsers

export const airbnbParser: OtaEmailParser = {
  provider: "airbnb",
  canParse(from: string, subject: string): boolean {
    const fromLower = from.toLowerCase();
    const subjectLower = subject.toLowerCase();
    return fromLower.includes("airbnb") || subjectLower.includes("airbnb") || subjectLower.includes("reservation confirmed");
  },
  parseEmail(payload: { subject: string; from: string; body: string }): ParsedOtaData | null {
    const { subject, from, body } = payload;
    const rawFields: Record<string, string> = {};

    // Extract confirmation code
    const confirmMatch = subject.match(/([A-Z]{2,3}-[A-Z0-9]{6,})/i) || body.match(/confirmation[^:]*:\s*([A-Z]{2,3}-[A-Z0-9]{6,})/i);
    const confirmationCode = confirmMatch?.[1]?.toUpperCase() ?? null;

    // Extract guest name
    const guestMatch = body.match(/guest\s*(?:name)?[^:]*:\s*([^\n]+)/i) || body.match(/dear\s+([^,\n]+)/i);
    const guestName = guestMatch?.[1]?.trim() ?? null;

    // Extract dates (look for date patterns)
    const checkInMatch = body.match(/check[\s-]?in[^:]*:\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    const checkOutMatch = body.match(/check[\s-]?out[^:]*:\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);

    // Extract amount
    const amountMatch = body.match(/total[^:]*:\s*[\$€]?([\d,]+\.?\d*)/i) || body.match(/([\$€]\s*[\d,]+\.?\d*)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]?.replace(/,/g, "") ?? "0") : null;

    rawFields.provider = "airbnb";
    rawFields.from = from;
    rawFields.subject = subject;

    return {
      provider: "airbnb",
      confirmationCode,
      guestName,
      checkInDate: checkInMatch?.[1] ?? null,
      checkOutDate: checkOutMatch?.[1] ?? null,
      listingTitle: null,
      amount,
      currency: amountMatch?.[0]?.includes("$") ? "USD" : null,
      rawFields,
    };
  },
};

export const bookingComParser: OtaEmailParser = {
  provider: "booking.com",
  canParse(from: string, subject: string): boolean {
    const fromLower = from.toLowerCase();
    const subjectLower = subject.toLowerCase();
    return fromLower.includes("booking.com") || fromLower.includes("booking.") || subjectLower.includes("booking confirmation");
  },
  parseEmail(payload: { subject: string; from: string; body: string }): ParsedOtaData | null {
    const { subject, from, body } = payload;
    const rawFields: Record<string, string> = {};

    // Booking.com confirmation codes are typically numeric
    const confirmMatch = body.match(/confirmation[^:]*:\s*(\d{8,})/i) || subject.match(/(\d{8,})/);
    const confirmationCode = confirmMatch?.[1] ?? null;

    // Extract guest name
    const guestMatch = body.match(/guest[^:]*:\s*([^\n]+)/i) || body.match(/dear\s+([^,\n]+)/i);
    const guestName = guestMatch?.[1]?.trim() ?? null;

    // Extract property/listing
    const propertyMatch = body.match(/property[^:]*:\s*([^\n]+)/i) || body.match(/hotel[^:]*:\s*([^\n]+)/i);
    const listingTitle = propertyMatch?.[1]?.trim() ?? null;

    // Extract amount
    const amountMatch = body.match(/total[^:]*:\s*[\$€]?([\d,]+\.?\d*)/i);
    const amount = amountMatch ? parseFloat(amountMatch[1]?.replace(/,/g, "") ?? "0") : null;

    rawFields.provider = "booking.com";
    rawFields.from = from;
    rawFields.subject = subject;

    return {
      provider: "booking.com",
      confirmationCode,
      guestName,
      checkInDate: null,
      checkOutDate: null,
      listingTitle,
      amount,
      currency: null,
      rawFields,
    };
  },
};

export const agodaParser: OtaEmailParser = {
  provider: "agoda",
  canParse(from: string, subject: string): boolean {
    const fromLower = from.toLowerCase();
    const subjectLower = subject.toLowerCase();
    return fromLower.includes("agoda") || subjectLower.includes("agoda");
  },
  parseEmail(payload: { subject: string; from: string; body: string }): ParsedOtaData | null {
    const { subject, from, body } = payload;
    const rawFields: Record<string, string> = {};

    // Agoda booking IDs
    const confirmMatch = body.match(/booking[^:]*:\s*(\d+)/i) || subject.match(/(\d{8,})/);
    const confirmationCode = confirmMatch?.[1] ?? null;

    const guestMatch = body.match(/guest[^:]*:\s*([^\n]+)/i);
    const guestName = guestMatch?.[1]?.trim() ?? null;

    const amountMatch = body.match(/total[^:]*:\s*[\$€]?([\d,]+\.?\d*)/i);
    const amount = amountMatch ? parseFloat(amountMatch[1]?.replace(/,/g, "") ?? "0") : null;

    rawFields.provider = "agoda";
    rawFields.from = from;
    rawFields.subject = subject;

    return {
      provider: "agoda",
      confirmationCode,
      guestName,
      checkInDate: null,
      checkOutDate: null,
      listingTitle: null,
      amount,
      currency: null,
      rawFields,
    };
  },
};

export const genericParser: OtaEmailParser = {
  provider: "generic",
  canParse(_from: string, _subject: string): boolean {
    // Generic parser is always available as fallback
    return true;
  },
  parseEmail(payload: { subject: string; from: string; body: string }): ParsedOtaData | null {
    const { subject, from, body } = payload;
    const rawFields: Record<string, string> = {};

    // Try to extract any confirmation-like code
    const confirmMatch = body.match(/(?:confirmation|booking|reservation)[^:]*:\s*([A-Z0-9\-]{6,})/i) || subject.match(/([A-Z0-9\-]{6,})/i);
    const confirmationCode = confirmMatch?.[1]?.trim() ?? null;

    rawFields.provider = "generic";
    rawFields.from = from;
    rawFields.subject = subject;
    rawFields.bodyPreview = body.substring(0, 500);

    return {
      provider: "generic",
      confirmationCode,
      guestName: null,
      checkInDate: null,
      checkOutDate: null,
      listingTitle: null,
      amount: null,
      currency: null,
      rawFields,
    };
  },
};

// Register built-in parsers
registerOtaParser(airbnbParser);
registerOtaParser(bookingComParser);
registerOtaParser(agodaParser);
registerOtaParser(genericParser);

export class WithOneProviderConnector implements ProviderConnector {
  constructor(private readonly connectionKey: string) {}

  async getConnectionStatus(): Promise<ConnectionStatus> {
    try {
      await listGmailMessages(this.connectionKey, "", { maxResults: 1 });
      return { connected: true, provider: "withone" };
    } catch (error) {
      if (error instanceof OneApiError || error instanceof OneConfigError) {
        return {
          connected: false,
          provider: "withone",
          error: error.message,
        };
      }
      throw error;
    }
  }

  async listEmails(query: EmailQuery): Promise<EmailMessage[]> {
    const data = await listGmailMessages(this.connectionKey, toGmailQuery(query), { maxResults: query.maxResults ?? 50 });
    const messages: EmailMessage[] = [];

    for (const item of data.messages) {
      try {
        const message = await getMessage(this.connectionKey, item.id);
        const subject = getHeader(message.payload, "subject") ?? "";
        const from = getHeader(message.payload, "from") ?? "";
        const date = getHeader(message.payload, "date") ?? message.internalDate ?? "";

        messages.push({
          id: item.id,
          subject,
          from,
          date: typeof date === "string" ? date : String(date),
          snippet: "",
        });
      } catch {
        // Skip messages that fail to fetch
        continue;
      }
    }

    return messages;
  }

  async getEmailBody(messageId: string): Promise<string> {
    const message = await getMessage(this.connectionKey, messageId);
    if (!message.payload) return "";

    const extractBody = (part: any): string => {
      let body = "";
      if (part.body?.data) {
        const base64 = part.body.data.replace(/-/g, "+").replace(/_/g, "/");
        body += Buffer.from(base64, "base64").toString("utf-8");
      }
      if (part.parts) {
        for (const subPart of part.parts) {
          body += extractBody(subPart);
        }
      }
      return body;
    };

    return extractBody(message.payload);
  }

  async appendSheetRows(sheetId: string, rows: SheetRow[], options?: SheetUpsertOptions): Promise<SheetUpsertResult> {
    const result: SheetUpsertResult = { rowsAppended: 0, rowsUpdated: 0, rowsSkipped: 0 };

    if (rows.length === 0) {
      return result;
    }

    const sheetName = options?.sheetName ?? "Sheet1";
    const idempotencyKey = options?.idempotencyKeyColumn;

    // If idempotency key is specified, fetch existing rows to check for duplicates
    let existingRows: Map<string, number> = new Map();
    if (idempotencyKey) {
      try {
        const existingData = await passthrough<{ values?: unknown[][] }>({
          connectionKey: this.connectionKey,
          actionId: SHEETS_GET_ACTION_ID,
          method: "GET",
          path: `/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(sheetName)}`,
          query: { valueRenderOption: "UNFORMATTED_VALUE" },
        });

        const values = existingData.values ?? [];
        // Build a map of idempotency key -> row index (1-based, skipping header)
        const headers = (values[0] ?? []) as string[];
        const keyIndex = headers.findIndex(h => h.toLowerCase() === idempotencyKey.toLowerCase());

        if (keyIndex >= 0) {
          for (let i = 1; i < values.length; i++) {
            const row = values[i];
            const keyValue = row[keyIndex];
            if (typeof keyValue === "string" || typeof keyValue === "number") {
              existingRows.set(String(keyValue), i + 1); // 1-based row number
            }
          }
        }
      } catch {
        // If we cannot fetch existing data, proceed with append-only
      }
    }

    // Separate rows into updates and appends
    const rowsToAppend: SheetRow[] = [];
    const rowsToUpdate: Array<{ rowIndex: number; row: SheetRow }> = [];

    for (const row of rows) {
      if (idempotencyKey && row[idempotencyKey] != null) {
        const keyValue = String(row[idempotencyKey]);
        const existingRow = existingRows.get(keyValue);

        if (existingRow) {
          rowsToUpdate.push({ rowIndex: existingRow, row });
          continue;
        }
      }
      rowsToAppend.push(row);
    }

    // Append new rows
    if (rowsToAppend.length > 0) {
      const values = rowsToAppend.map(row => Object.values(row));
      await passthrough({
        connectionKey: this.connectionKey,
        actionId: SHEETS_APPEND_ACTION_ID,
        method: "POST",
        path: `/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(sheetName)}:append`,
        query: {
          valueInputOption: "USER_ENTERED",
          insertDataOption: "INSERT_ROWS",
        },
        body: { values },
      });
      result.rowsAppended = rowsToAppend.length;
    }

    // Update existing rows
    for (const { rowIndex, row } of rowsToUpdate) {
      const values = Object.values(row);
      await passthrough({
        connectionKey: this.connectionKey,
        actionId: SHEETS_APPEND_ACTION_ID,
        method: "PUT",
        path: `/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(sheetName)}!A${rowIndex}`,
        query: { valueInputOption: "USER_ENTERED" },
        body: { values: [values] },
      });
      result.rowsUpdated++;
    }

    return result;
  }
}
