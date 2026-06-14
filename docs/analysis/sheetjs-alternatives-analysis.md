# Analysis: SheetJS Usage and Better Alternatives

This document analyzes why the current implementation incorporates SheetJS (`xlsx`) for parsing, the limitations of this choice, and proposed alternatives.

---

## 1. Why SheetJS was originally chosen

SheetJS (`xlsx`) is widely used because it provides a **unified parser** that supports multiple spreadsheet formats out of the box:
- Excel spreadsheets (`.xlsx`, `.xls`)
- CSV files (`.csv`)
- OpenDocument spreadsheets (`.ods`)

By incorporating SheetJS, the backend ingest pipeline could accept both `.csv` and `.xlsx` uploads via the same code route, parsing them into JSON with `xlsx.utils.sheet_to_json`.

---

## 2. Limitations of SheetJS for CSV Ingestion

While convenient, using SheetJS for CSV files introduces several issues:

1. **Destructive Auto-Coercion**: SheetJS automatically formats strings it detects as dates or numbers. This causes precision loss in 19-digit Airbnb IDs and parses date strings like `01/07/2026` (July 1st) into format-drifted variants like `1/7/26` (which standard JS parses as Jan 7th).
2. **Character Encoding Corruption**: When reading a raw `Buffer` of a CSV, SheetJS defaults to ANSI/Windows-1252 parsing rather than UTF-8, mangling non-English letters.
3. **Library Bloat**: SheetJS is a large package designed for complex ZIP-compressed XML Excel archives, which is unnecessary overhead for simple flat CSV text files.

---

## 3. Alternatives

### Option A: Configure SheetJS for Raw UTF-8 CSV Parsing (Recommended & Practical)
- **Concept**: Keep SheetJS to maintain binary Excel compatibility, but isolate the CSV parsing code path. Convert the buffer to a UTF-8 string first and pass `raw: true`.
- **Pros**: Zero new dependencies; fully backward-compatible; instantly fixes the bugs with minimal code change.
- **Cons**: Still relies on a heavy library for CSV processing.

### Option B: Integrate `papaparse` for CSVs
- **Concept**: Add `papaparse` to dependencies. Use it exclusively for CSVs, and fall back to SheetJS only for Excel binary files.
- **Pros**: Fast, RFC-compliant, native UTF-8 support, highly configurable coercion.
- **Cons**: Adds a new package to `package.json`.

### Option C: Custom CSV Parser (Zero Dependency)
- **Concept**: Use a lightweight, custom CSV parser function (similar to the one in [listings-source-of-truth.ts](file:///c:/Users/Fate_Conqueror/GitHub/Just_Management/backend/src/lib/listings-source-of-truth.ts) line 401).
- **Pros**: Zero extra weight; absolute control over date/precision handling.
- **Cons**: Requires writing and maintaining CSV RFC 4180 parsing edge cases (quotes, escaped commas, newlines).
