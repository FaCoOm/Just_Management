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

describe("guest request Prisma schema", () => {
  it("defines exact planned enum values", () => {
    assert.deepEqual(enumValues("GuestRequestStatus"), ["open", "assigned", "in_progress", "fulfilled", "closed", "reopened"]);
    assert.deepEqual(enumValues("GuestRequestPriority"), ["low", "medium", "high", "urgent"]);
  });

  it("defines guest_requests with the exact planned fields", () => {
    const block = modelBlock("guest_requests");

    assertField(block, /id\s+String\s+@id @default\(uuid\(\)\) @db\.Uuid/);
    assertField(block, /guest_id\s+String\?\s+@db\.Uuid/);
    assertField(block, /room_id\s+String\?\s+@db\.Uuid/);
    assertField(block, /request_type\s+String/);
    assertField(block, /notes\s+String\s+@default\(""\)/);
    assertField(block, /description\s+String\?/);
    assertField(block, /status\s+GuestRequestStatus\s+@default\(open\)/);
    assertField(block, /priority\s+GuestRequestPriority\s+@default\(medium\)/);
    assertField(block, /assigned_to\s+String\?/);
    assertField(block, /is_completed\s+Boolean\s+@default\(false\)/);
    assertField(block, /created_at\s+DateTime\s+@default\(now\(\)\) @db\.Timestamptz\(6\)/);
    assertField(block, /updated_at\s+DateTime\s+@default\(now\(\)\) @updatedAt @db\.Timestamptz\(6\)/);
    assertField(block, /completed_at\s+DateTime\? @db\.Timestamptz\(6\)/);
    assertField(block, /reservation_id\s+String\?\s+@db\.Uuid/);
    assertField(block, /property_id\s+String\?\s+@db\.Uuid/);
  });

  it("keeps the legacy compatibility field and lifecycle indexes", () => {
    const block = modelBlock("guest_requests");

    assertField(block, /is_completed\s+Boolean\s+@default\(false\)/);
    assertField(block, /guest\s+guests\?\s+@relation\(fields: \[guest_id\], references: \[id\], onDelete: SetNull\)/);
    assertField(block, /property\s+properties\?\s+@relation\(fields: \[property_id\], references: \[id\], onDelete: SetNull\)/);
    assertField(block, /reservation\s+reservations\?\s+@relation\(fields: \[reservation_id\], references: \[id\], onDelete: SetNull\)/);
    assertField(block, /room\s+rooms\?\s+@relation\(fields: \[room_id\], references: \[id\], onDelete: SetNull\)/);
    assertField(block, /@@index\(\[guest_id\]\)/);
    assertField(block, /@@index\(\[property_id\]\)/);
    assertField(block, /@@index\(\[status\]\)/);
    assertField(block, /@@index\(\[priority\]\)/);
    assertField(block, /@@index\(\[assigned_to\]\)/);
    assertField(block, /@@index\(\[property_id, status\]\)/);
    assertField(block, /@@index\(\[property_id, priority\]\)/);
    assertField(block, /@@index\(\[reservation_id\]\)/);
  });
});
