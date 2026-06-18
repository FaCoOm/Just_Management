import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const nodeTestShim = fileURLToPath(new URL("./test/node-test-shim.ts", import.meta.url));

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: [
      "test/**/*.test.ts",
      "test/**/*.spec.ts",
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
    ],
    exclude: ["node_modules", "dist"],
    setupFiles: ["./test/setup.ts"],
    pool: "forks",
    testTimeout: 20000,
  },
  resolve: {
    alias: [
      { find: /^node:test$/, replacement: nodeTestShim },
    ],
  },
});
