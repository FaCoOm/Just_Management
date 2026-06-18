// Shim for tests that import from "node:test".
// vitest does not register `describe`/`it` from `node:test`, so we re-export
// vitest equivalents with the same names so those test files just work.
export { describe, it, before, beforeEach, after, afterEach } from "vitest";
