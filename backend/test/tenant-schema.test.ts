import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

function modelBlock(name: string) {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `missing model ${name}`);
  return match[0];
}

function enumBlock(name: string) {
  const match = schema.match(new RegExp(`enum ${name} \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `missing enum ${name}`);
  return match[0];
}

function enumValues(name: string) {
  return enumBlock(name)
    .split("\n")
    .slice(1, -1)
    .map((line) => line.trim())
    .filter(Boolean);
}

function assertField(block: string, pattern: RegExp) {
  assert.match(block, pattern);
}

describe("tenant stay registration Prisma schema", () => {
  it("defines exact planned enum values", () => {
    assert.deepEqual(enumValues("StayType"), ["short_term", "long_term"]);
    assert.deepEqual(enumValues("TenantStatus"), ["active", "inactive", "archived"]);
    assert.deepEqual(enumValues("DriveFolderStatus"), ["pending", "created", "failed"]);
    assert.deepEqual(enumValues("IdDocumentType"), ["passport", "national_id", "drivers_license", "other"]);
    assert.deepEqual(enumValues("GuestRequestStatus"), ["open", "assigned", "in_progress", "fulfilled", "closed", "reopened"]);
    assert.deepEqual(enumValues("GuestRequestPriority"), ["low", "medium", "high", "urgent"]);
  });

  it("defines tenants with the exact planned fields", () => {
    const block = modelBlock("tenants");

    assertField(block, /id\s+String\s+@id @default\(uuid\(\)\) @db\.Uuid/);
    assertField(block, /property_id\s+String\s+@db\.Uuid/);
    assertField(block, /name\s+String/);
    assertField(block, /email\s+String\?/);
    assertField(block, /phone\s+String\?/);
    assertField(block, /id_document_type\s+IdDocumentType/);
    assertField(block, /id_document_number\s+String/);
    assertField(block, /nationality\s+String\?/);
    assertField(block, /lease_start\s+DateTime\s+@db\.Date/);
    assertField(block, /lease_end\s+DateTime\s+@db\.Date/);
    assertField(block, /monthly_rent\s+Int/);
    assertField(block, /deposit_amount\s+Int\?/);
    assertField(block, /emergency_contact_name\s+String\?/);
    assertField(block, /emergency_contact_phone\s+String\?/);
    assertField(block, /notes\s+String\?/);
    assertField(block, /status\s+TenantStatus\s+@default\(active\)/);
    assertField(block, /is_vip\s+Boolean\s+@default\(false\)/);
    assertField(block, /created_at\s+DateTime\s+@default\(now\(\)\) @db\.Timestamptz\(6\)/);
    assertField(block, /updated_at\s+DateTime\s+@default\(now\(\)\) @updatedAt @db\.Timestamptz\(6\)/);
  });

  it("defines stay_registrations with the exact planned fields", () => {
    const block = modelBlock("stay_registrations");

    assertField(block, /id\s+String\s+@id @default\(uuid\(\)\) @db\.Uuid/);
    assertField(block, /property_id\s+String\s+@db\.Uuid/);
    assertField(block, /tenant_id\s+String\?\s+@db\.Uuid/);
    assertField(block, /room_id\s+String\?\s+@db\.Uuid/);
    assertField(block, /guest_name\s+String/);
    assertField(block, /guest_count\s+Int\s+@default\(1\)/);
    assertField(block, /registration_date\s+DateTime\s+@db\.Date/);
    assertField(block, /registration_number\s+String\?/);
    assertField(block, /drive_folder_id\s+String\?/);
    assertField(block, /drive_folder_status\s+DriveFolderStatus\s+@default\(pending\)/);
    assertField(block, /notes\s+String\?/);
    assertField(block, /created_at\s+DateTime\s+@default\(now\(\)\) @db\.Timestamptz\(6\)/);
    assertField(block, /updated_at\s+DateTime\s+@default\(now\(\)\) @updatedAt @db\.Timestamptz\(6\)/);
  });

  it("defines required relations and indexes", () => {
    const tenants = modelBlock("tenants");
    const registrations = modelBlock("stay_registrations");
    const guestRequests = modelBlock("guest_requests");

    assertField(tenants, /property\s+properties\s+@relation\(fields: \[property_id\], references: \[id\], onDelete: Restrict\)/);
    assertField(tenants, /stay_registrations\s+stay_registrations\[\]/);
    assertField(tenants, /@@index\(\[property_id\]\)/);
    assertField(tenants, /@@index\(\[status\]\)/);

    assertField(registrations, /property\s+properties\s+@relation\(fields: \[property_id\], references: \[id\], onDelete: Restrict\)/);
    assertField(registrations, /tenant\s+tenants\?\s+@relation\(fields: \[tenant_id\], references: \[id\], onDelete: SetNull\)/);
    assertField(registrations, /room\s+rooms\?\s+@relation\(fields: \[room_id\], references: \[id\], onDelete: SetNull\)/);
    assertField(registrations, /@@index\(\[property_id\]\)/);
    assertField(registrations, /@@index\(\[tenant_id\]\)/);
    assertField(registrations, /@@index\(\[room_id\]\)/);
    assertField(registrations, /@@index\(\[registration_date\]\)/);

    assertField(modelBlock("properties"), /tenants\s+tenants\[\]/);
    assertField(modelBlock("properties"), /stay_registrations\s+stay_registrations\[\]/);
    assertField(modelBlock("rooms"), /stay_registrations\s+stay_registrations\[\]/);

    assertField(guestRequests, /description\s+String\?/);
    assertField(guestRequests, /status\s+GuestRequestStatus\s+@default\(open\)/);
    assertField(guestRequests, /priority\s+GuestRequestPriority\s+@default\(medium\)/);
    assertField(guestRequests, /assigned_to\s+String\?/);
    assertField(guestRequests, /is_completed\s+Boolean\s+@default\(false\)/);
    assertField(guestRequests, /created_at\s+DateTime\s+@default\(now\(\)\) @db\.Timestamptz\(6\)/);
    assertField(guestRequests, /updated_at\s+DateTime\s+@default\(now\(\)\) @updatedAt @db\.Timestamptz\(6\)/);
    assertField(guestRequests, /completed_at\s+DateTime\? @db\.Timestamptz\(6\)/);
    assertField(guestRequests, /reservation_id\s+String\?\s+@db\.Uuid/);
    assertField(guestRequests, /property_id\s+String\?\s+@db\.Uuid/);
    assertField(guestRequests, /guest\s+guests\s+@relation\(fields: \[guest_id\], references: \[id\], onDelete: Restrict\)/);
    assertField(guestRequests, /property\s+properties\?\s+@relation\(fields: \[property_id\], references: \[id\], onDelete: SetNull\)/);
    assertField(guestRequests, /reservation\s+reservations\?\s+@relation\(fields: \[reservation_id\], references: \[id\], onDelete: SetNull\)/);
    assertField(guestRequests, /room\s+rooms\s+@relation\(fields: \[room_id\], references: \[id\], onDelete: Restrict\)/);
    assertField(guestRequests, /@@index\(\[guest_id\]\)/);
    assertField(guestRequests, /@@index\(\[property_id\]\)/);
    assertField(guestRequests, /@@index\(\[status\]\)/);
    assertField(guestRequests, /@@index\(\[priority\]\)/);
    assertField(guestRequests, /@@index\(\[assigned_to\]\)/);
    assertField(guestRequests, /@@index\(\[property_id, status\]\)/);
    assertField(guestRequests, /@@index\(\[property_id, priority\]\)/);
    assertField(guestRequests, /@@index\(\[reservation_id\]\)/);
  });
});
