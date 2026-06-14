import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const requiredBuildTools = [
  path.join("node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc"),
  path.join("node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite"),
  path.join("node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma"),
];

const hasBuildTools = requiredBuildTools.every((toolPath) => fs.existsSync(toolPath));

if (hasBuildTools) {
  process.exit(0);
}

console.warn("[build-deps] Missing build tools; reinstalling dev dependencies for build.");

fs.rmSync(path.join("node_modules", "tsx", "node_modules", "esbuild"), {
  recursive: true,
  force: true,
});

execSync(
  "npm install --include=dev --workspaces --include-workspace-root --legacy-peer-deps --package-lock=false --no-audit --no-fund",
  { stdio: "inherit" }
);
