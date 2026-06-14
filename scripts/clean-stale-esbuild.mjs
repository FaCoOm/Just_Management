import fs from "node:fs";
import path from "node:path";

const staleEsbuildDirs = [
  path.join("node_modules", "tsx", "node_modules", "esbuild"),
  path.join("backend", "node_modules", "tsx", "node_modules", "esbuild"),
];

for (const dir of staleEsbuildDirs) {
  fs.rmSync(dir, { recursive: true, force: true });
}
