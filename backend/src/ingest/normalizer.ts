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

  const dayFirstMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    const dateOnly = `${year}-${month}-${day}`;
    return includeTime ? `${dateOnly}T00:00:00.000Z` : dateOnly;
  }

  return normalized;
}

export function parseSourceFile(buffer: Buffer, mimeType: string): Record<string, unknown>[] {
  const isExcel = mimeType.includes("excel") || mimeType.includes("spreadsheetml");
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // csv parsing is supported by xlsx if it's text/csv
  const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: false }); // raw:false preserves 19-digit IDs as strings
  return rows;
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
