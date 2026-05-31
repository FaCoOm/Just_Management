import { OneApiError, OneConfigError } from "./one/client.js";
import { listMessages } from "./one/google/gmail.js";

export type ConnectionStatus = { connected: boolean; provider: string; error?: string };

export type EmailQuery = { from?: string; subject?: string; after?: string; maxResults?: number };

export type EmailMessage = { id: string; subject: string; from: string; date: string; snippet: string };

export type SheetRow = Record<string, string | number | null>;

export interface ProviderConnector {
  getConnectionStatus(): Promise<ConnectionStatus>;
  listEmails(query: EmailQuery): Promise<EmailMessage[]>;
  appendSheetRows(sheetId: string, rows: SheetRow[]): Promise<void>;
}

function toGmailQuery(query: EmailQuery): string {
  const parts: string[] = [];
  if (query.from) parts.push(`from:${query.from}`);
  if (query.subject) parts.push(`subject:${query.subject}`);
  if (query.after) parts.push(`after:${query.after}`);
  return parts.join(" ");
}

export class WithOneProviderConnector implements ProviderConnector {
  constructor(private readonly connectionKey: string) {}

  async getConnectionStatus(): Promise<ConnectionStatus> {
    try {
      await listMessages(this.connectionKey, "", { maxResults: 1 });
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
    const data = await listMessages(this.connectionKey, toGmailQuery(query), { maxResults: query.maxResults });
    return data.messages.map((message) => ({
      id: message.id,
      subject: "",
      from: "",
      date: "",
      snippet: "",
    }));
  }

  async appendSheetRows(_sheetId: string, _rows: SheetRow[]): Promise<void> {
    throw new Error("Not yet implemented — deferred to Task 31");
  }
}
