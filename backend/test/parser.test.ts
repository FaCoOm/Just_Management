import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseInternalName } from "../src/ingest/parser.js";

// RED test suite for T6. Assertions describe DESIRED post-T6 behavior.
// Today (pre-T6) these MUST fail; after T6 implements opts.allowComposite
// + roomNumbers array, they MUST go GREEN.
describe("parseInternalName composite room support (T6 RED)", () => {
  it("splits ampersand composite into roomNumbers array when allowComposite=true [RED until T6]", () => {
    // After T6: parsed.roomNumbers = ["Milk 2", "Coffee 2"], no error.
    // Cast to any because opts param + roomNumbers field do not exist yet on the type.
    const result = (parseInternalName as any)("LL - Milk 2 & Coffee 2", { allowComposite: true });
    assert.equal(result.errorCode, undefined, "composite must not error when allowComposite=true");
    assert.equal(result.error, undefined);
    assert.ok(result.parsed, "parsed must be present for composite happy path");
    assert.equal(result.parsed.propertySlug, "ll");
    assert.deepEqual(result.parsed.roomNumbers, ["Milk 2", "Coffee 2"]);
  });

  it("splits 'and' composite case-insensitively when allowComposite=true [RED until T6]", () => {
    const result = (parseInternalName as any)("LL - Milk 2 and Coffee 2", { allowComposite: true });
    assert.equal(result.errorCode, undefined);
    assert.ok(result.parsed);
    assert.equal(result.parsed.propertySlug, "ll");
    assert.deepEqual(result.parsed.roomNumbers, ["Milk 2", "Coffee 2"]);
  });

  it("keeps single roomNumber string for non-composite (back-compat) [GREEN today and after T6]", () => {
    const result = parseInternalName("MH - 01");
    assert.equal(result.error, undefined);
    assert.equal(result.errorCode, undefined);
    assert.ok(result.parsed);
    assert.equal(result.parsed!.roomNumber, "01");
    assert.equal(result.parsed!.propertySlug, "mh");
  });

  it("rejects composite without allowComposite opt (legacy default) [GREEN today and after T6]", () => {
    const result = parseInternalName("LL - Milk 2 & Coffee 2");
    assert.equal(result.errorCode, "COMPOSITE_ROOM");
  });
});