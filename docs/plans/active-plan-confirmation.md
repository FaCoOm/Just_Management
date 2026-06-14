# Active Plan Confirmation: Listings Source of Truth (SoT) & Ingestion Hardening

**Date**: 2026-06-13  
**Active Terminal Output Source**: `ProcessId: 81136` (pwsh)

---

## 📋 Confirmed Active Plan

Based on the latest terminal output from `ProcessId: 81136`, the opencode agent is executing the **Listings Source of Truth (SoT) and Ingestion Hardening Plan**. 

This plan addresses a critical JS number precision loss bug (which was causing duplicate listings on 19-digit IDs) and enforces schema-level constraints on listing-to-room mappings.

---

## 🛠️ Task Execution Breakdown

The agent has completed the initial validation/TDD red tests (**T1–T6**) and is currently working on or about to execute the following steps:

| Task ID | Stage | Objective | Target Files |
| :--- | :--- | :--- | :--- |
| **T7** | **In Progress** | Write the core Listings Source of Truth library | [listings-source-of-truth.ts](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/backend/src/lib/listings-source-of-truth.ts) |
| **T8** | **Next** | Add composite unique constraint `@@unique([channel_listing_id, room_id, mapping_role])` and generate an additive migration | [schema.prisma](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/backend/prisma/schema.prisma) |
| **T9** | **Next** | Build the idempotent listings SoT seed script (`--check` / `--apply` modes) | `backend/scripts/seed-listings-sot.ts` |
| **T10** | **Next** | Wire package scripts for listings SoT check and apply | [package.json](file:///C:/Users/Fate_Conqueror/GitHub/Just_Management/backend/package.json) |
| **T11** | **Next** | Conduct Oracle architecture review before database mutation | N/A |
| **T13** | **Next** | Run `--check` against Azure database and clean up the 52 duplicate listings | Azure PostgreSQL Database |

---

## 💡 Key Plan Decisions & Architecture Gates

1. **JS Precision Loss Fix**: The underlying bug causing listings duplication is JS Number precision loss on 19-digit listing IDs. The fix is setting `raw: false` in `xlsx.utils.sheet_to_json` to preserve them as strings (completed in `normalizer.ts`).
2. **Schema Hardening**: Adding a composite unique constraint to `listing_room_mappings` prevents duplicate mapping records for the same listing, room, and role.
3. **Dry-Run Check**: Rerunning the seed script in check mode will identify and report listing status/drift before any database write occurs.
