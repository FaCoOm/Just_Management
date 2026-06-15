import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const TLS_FILE_PARAMS = ["sslcert", "sslrootcert", "sslkey"] as const;

function hasUsableTlsFile(filePath: string): boolean {
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  return fs.existsSync(resolvedPath);
}

export function sanitizeDatabaseUrl(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);

    for (const param of TLS_FILE_PARAMS) {
      const value = parsed.searchParams.get(param);
      if (value && !hasUsableTlsFile(value)) {
        parsed.searchParams.delete(param);
      }
    }

    return parsed.toString();
  } catch {
    return databaseUrl;
  }
}

const databaseUrl = process.env.DATABASE_URL
  ? sanitizeDatabaseUrl(process.env.DATABASE_URL)
  : undefined;

export const prisma = new PrismaClient({
  datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
});
