import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function findTool(name) {
  const binary = process.platform === "win32" ? `${name}.cmd` : name;
  const paths = [
    path.join("node_modules", ".bin", binary),
    path.join("frontend", "node_modules", ".bin", binary),
    path.join("backend", "node_modules", ".bin", binary),
  ];
  return paths.some((p) => fs.existsSync(p));
}

const hasBuildTools = findTool("tsc") && findTool("vite") && findTool("prisma");

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
