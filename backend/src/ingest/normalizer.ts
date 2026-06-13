import * as xlsx from "xlsx";

export interface ListingSourceRow {
  title: string;
  internalName: string | null;
  providerListingId: string | null;
  location: string;
  sourceRowNumber: number;
  rawPayload: Record<string, unknown>;
}

export interface ReservationSourceRow {
  confirmationCode: string | null;
  providerReservationId: string | null;
  guestName: string;
  guestPhone: string | null;
  rawStatus: string;
  checkInDate: string | null; // ISO format YYYY-MM-DD
  checkOutDate: string | null; // ISO format YYYY-MM-DD
  bookedAt: string | null; // ISO format YYYY-MM-DDTHH:mm:ss.SSSZ
  adultCount: number;
  childCount: number;
  infantCount: number;
  listingTitle: string | null;
  sourceRowNumber: number;
  rawPayload: Record<string, unknown>;
}

export function normalizeString(val: unknown): string {
  if (val === null || val === undefined) return "";
  // Remove BOMs, trim whitespace, normalize unicode
  return String(val).replace(/^\uFEFF/, "").trim().normalize("NFC");
}

function getNormalizedValue(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const normalized = normalizeString(row[key]);
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return "";
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function fromExcelSerial(value: number, includeTime: boolean): string {
  const parsed = xlsx.SSF.parse_date_code(value);
  if (!parsed) return "";

  const year = parsed.y;
  const month = pad(parsed.m);
  const day = pad(parsed.d);

  if (!includeTime) {
    return `${year}-${month}-${day}`;
  }

  const hours = pad(parsed.H ?? 0);
  const minutes = pad(parsed.M ?? 0);
  const seconds = pad(Math.floor(parsed.S ?? 0));
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
}

function normalizeDateValue(value: unknown, includeTime = false): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const iso = value.toISOString();
    return includeTime ? iso : iso.slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return fromExcelSerial(value, includeTime);
  }

  const normalized = normalizeString(value);
  if (!normalized) {
    return "";
  }

  if (/^\d+(\.\d+)?$/.test(normalized)) {
    return fromExcelSerial(Number(normalized), includeTime);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return includeTime ? `${normalized}T00:00:00.000Z` : normalized;
  }

  const dayFirstMatch = normalized.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (dayFirstMatch) {
    const [, d, m, y] = dayFirstMatch;
    const day = d.padStart(2, "0");
    const month = m.padStart(2, "0");
    const year = y.length === 2 ? `20${y}` : y;
    const dateOnly = `${year}-${month}-${day}`;
    return includeTime ? `${dateOnly}T00:00:00.000Z` : dateOnly;
  }

  return normalized;
}

export function parseSourceFile(buffer: Buffer, mimeType: string, filename?: string): Record<string, unknown>[] {
  const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isExcel = isZip || mimeType.includes("excel") || mimeType.includes("spreadsheetml") || (filename && /\.(xlsx|xls)$/i.test(filename));
  const isCsv = !isExcel;

  if (isCsv) {
    const csvContent = buffer.toString("utf8").replace(/^\uFEFF/, "");
    const workbook = xlsx.read(csvContent, { type: "string", raw: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: true });
    return rows as Record<string, unknown>[];
  } else {
    const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Pre-process date cells to write consistent, timezone-stable strings back to cell.w and cell.v
    for (const key of Object.keys(sheet)) {
      if (key[0] === "!") continue;
      const cell = sheet[key];
      if (cell && cell.t === "d" && cell.v instanceof Date && !Number.isNaN(cell.v.getTime())) {
        const dateObj = cell.v;
        const hasTime = dateObj.getUTCHours() !== 0 || dateObj.getUTCMinutes() !== 0 || dateObj.getUTCSeconds() !== 0;
        if (!hasTime) {
          const year = dateObj.getUTCFullYear();
          const month = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
          const day = String(dateObj.getUTCDate()).padStart(2, "0");
          const formattedDate = `${year}-${month}-${day}`;
          cell.v = formattedDate;
          cell.t = "s";
          cell.w = formattedDate;
        } else {
          const formattedDate = dateObj.toISOString();
          cell.v = formattedDate;
          cell.t = "s";
          cell.w = formattedDate;
        }
      }
    }

    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: false });
    return rows as Record<string, unknown>[];
  }
}

export function extractListings(rows: Record<string, unknown>[]): ListingSourceRow[] {
  return rows.map((row, index) => {
    // Normalize keys to handle aliasing
    const normalizedRow: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(row)) {
      normalizedRow[normalizeString(key).toLowerCase()] = val;
    }

    return {
      title: getNormalizedValue(normalizedRow, ["name", "title"]),
      internalName: getNormalizedValue(normalizedRow, ["internal name", "internal_name"]) || null,
      providerListingId: getNormalizedValue(normalizedRow, ["listing id", "id"]) || null,
      location: getNormalizedValue(normalizedRow, ["location", "city"]),
      sourceRowNumber: index + 2, // Assuming 1 header row
      rawPayload: row,
    };
  });
}

export function extractReservations(rows: Record<string, unknown>[]): ReservationSourceRow[] {
  return rows.map((row, index) => {
    const normalizedRow: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(row)) {
      normalizedRow[normalizeString(key).toLowerCase()] = val;
    }

    return {
      confirmationCode: getNormalizedValue(normalizedRow, ["confirmation code"]) || null,
      providerReservationId: getNormalizedValue(normalizedRow, ["reservation id"]) || null,
      guestName: getNormalizedValue(normalizedRow, ["guest name", "guest"]),
      guestPhone: getNormalizedValue(normalizedRow, ["phone", "guest phone", "contact"]) || null,
      rawStatus: getNormalizedValue(normalizedRow, ["status"]),
      checkInDate:
        normalizeDateValue(
          normalizedRow["start date"] ?? normalizedRow["check in"] ?? normalizedRow["check-in"],
        ) || null,
      checkOutDate:
        normalizeDateValue(
          normalizedRow["end date"] ?? normalizedRow["check out"] ?? normalizedRow["checkout"] ?? normalizedRow["check-out"],
        ) || null,
      bookedAt: normalizeDateValue(normalizedRow["booked at"] ?? normalizedRow["booked"], true) || null,
      adultCount: parseInt(getNormalizedValue(normalizedRow, ["adults", "# of adults"]) || "1", 10) || 1,
      childCount: parseInt(getNormalizedValue(normalizedRow, ["children", "# of children"]) || "0", 10) || 0,
      infantCount: parseInt(getNormalizedValue(normalizedRow, ["infants", "# of infants"]) || "0", 10) || 0,
      listingTitle: getNormalizedValue(normalizedRow, ["listing", "listing title"]) || null,
      sourceRowNumber: index + 2,
      rawPayload: row,
    };
  });
}
