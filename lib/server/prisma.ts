import { PrismaClient } from "@prisma/client";

import { requireDatabaseUrl } from "./dbConfig";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/** Na Vercelu omezíme pool na instanci — jinak Neon rychle dojde connection limit. */
function serverlessDatabaseUrl(raw: string): string {
  if (process.env.VERCEL !== "1") return raw;
  if (/[?&]connection_limit=/.test(raw)) return raw;
  const sep = raw.includes("?") ? "&" : "?";
  return `${raw}${sep}connection_limit=1&pool_timeout=20`;
}

function createPrismaClient(): PrismaClient {
  const url = serverlessDatabaseUrl(requireDatabaseUrl());
  return new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

globalThis.__prisma = prisma;

