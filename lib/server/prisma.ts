import { AsyncLocalStorage } from "node:async_hooks";

import { PrismaClient } from "@prisma/client";

import { requireDatabaseUrl } from "./dbConfig";
import { retryOnTransientConnection } from "./prismaTransient";

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

let reconnecting: Promise<void> | null = null;
const retryDepth = new AsyncLocalStorage<number>();

/** Jedno odpojení pro paralelní dotazy, které spadly na stejném mrtvém spojení. */
function reconnectPrisma(client: PrismaClient): Promise<void> {
  if (!reconnecting) {
    reconnecting = (async () => {
      try {
        await client.$disconnect();
      } catch {
        /* ignore */
      }
      try {
        await client.$connect();
      } catch {
        /* další pokus query stejně selže srozumitelněji */
      }
    })().finally(() => {
      reconnecting = null;
    });
  }
  return reconnecting;
}

function createPrismaClient(): PrismaClient {
  const url = serverlessDatabaseUrl(requireDatabaseUrl());
  const base = new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  // Modelové dotazy (findUnique, …) se při krátkém výpadku Neonu zopakují.
  // Bez toho SSR admin menu spadne na ořezanou hlášku Server Components.
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          if ((retryDepth.getStore() ?? 0) > 0) return query(args);
          return retryDepth.run(1, () =>
            retryOnTransientConnection(() => query(args), () => reconnectPrisma(base)),
          );
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

globalThis.__prisma = prisma;

