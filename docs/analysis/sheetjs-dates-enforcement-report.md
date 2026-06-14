# Ingestion Date Parsing & Character Encoding Enforcement Report

This document records the architectural analysis, root causes, and technical solutions implemented to permanently resolve date-swapping bugs and character encoding corruption (mojibake) in the `Just_Management` hospitality ingestion pipeline.

---

## 1. Problem Analysis & Root Causes

### A. Date Swapping / US Format Coercion
- **Symptom**: Check-out dates in European/Vietnamese formats like `01/07/2026` (July 1st, 2026) were parsed as `2026-01-07` (January 7, 2026) on `All Reservations` views.
- **Root Cause**: Excel serial numbers are locale-independent. However, when parsing Excel spreadsheets (`.xlsx`) using SheetJS, specifying `{ raw: false }` format coercion coerces dates into locale-specific formatted strings (such as `7/1/26` or `07/01/2026` depending on the system/browser settings). The backend string date parser then misinterprets the day and month segments (US locale dates use `MM/DD/YYYY`).

### B. International Character Corruption (Mojibake)
- **Symptom**: Guest names with accents or non-Latin scripts (e.g. Romanian `Gabriel Ştiufliuc`, Korean `정찬 김`, Vietnamese `Trần Vân`) were stored as corrupted characters (such as `ì ì°¬ ê¹`).
- **Root Cause**: CSV files read via buffers without clean Unicode/BOM handling or parsed as ASCII/binary string variables led to multi-byte characters getting split or coerced incorrectly. 

---

## 2. Permanent Enforcement Solutions

The following modifications were made to ensure date parsing and UTF-8 encoding are permanently and robustly enforced:

### 1. Stripping UTF-8 BOM from CSV content
In [normalizer.ts](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/backend/src/ingest/normalizer.ts), when handling CSV uploads/syncs:
```typescript
const csvContent = buffer.toString("utf8").replace(/^\uFEFF/, "");
const workbook = xlsx.read(csvContent, { type: "string", raw: true });
```
This strips byte-order marks (`\uFEFF`) from the input string, preventing any corrupted header mappings (e.g., matching `\uFEFFID` instead of `ID`).

### 2. Timezone-Stable Excel Date Pre-Processing
In [normalizer.ts](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/backend/src/ingest/normalizer.ts), when handling Excel files, we read with `cellDates: true` and pre-process any parsed Date objects in the worksheet cells to clean strings:
```typescript
const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

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
```
This ensures Excel serial dates are converted directly from raw Date objects into timezone-stable, ISO standard strings in the worksheet prior to converting to JSON rows. This bypasses locale-based text conversion in the downstream parser while preserving 19-digit provider listing IDs as strings.

### 3. Date Object & Dashed Separator Support in Normalizer
In `normalizeDateValue`:
- Added direct checking for `instanceof Date` to format Date objects to ISO string directly.
- Standardized regex formatting to handle both slash (`/`) and dash (`-`) separators interchangeably (e.g. matching `01-07-2026`).

---

## 3. Verification Details

- **Unit Tests**: Ran `npm run test` on the backend. All 49 unit tests passed successfully.
- **Ingestion Harness**: Ran `npm run verify-ingestion` on the backend. Checked dry-runs, real runs, duplicate resolutions, and Sheets integrations—all returned successfully.
- **Verified DB State**: Checked that `Quoc Le`'s check-out is correctly stored as July 1st, 2026 (`2026-07-01`), guest names display correctly in non-Latin formats, and duplicate room formats (`8.05`, `303 (301 cu)`) are never created.
