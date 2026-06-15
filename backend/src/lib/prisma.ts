import { PrismaClient } from "@prisma/client";

const TLS_FILE_PARAMS = ["sslcert", "sslrootcert", "sslkey"] as const;

export function sanitizeDatabaseUrl(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);

    for (const param of TLS_FILE_PARAMS) {
      parsed.searchParams.delete(param);
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
