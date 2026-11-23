import { AsyncLocalStorage } from "node:async_hooks";

import { PrismaClient } from "@prisma/client";

import { requireDatabaseUrl } from "./dbConfig";
import { isEngineNotConnectedError } from "./prismaKnownError";
import { retryOnTransientConnection } from "./prismaTransient";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __prismaReconnect: ((error?: unknown) => Promise<void>) | undefined;
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

/**
 * Jedno připojení pro paralelní dotazy.
 * Mrtvý socket Neonu se nejdřív odpojí. „Engine is not yet connected“ se jen připojí —
 * `$disconnect` v tu chvíli engine, který ještě startuje, shodí a další requesty zůstanou odpojené.
 */
function reconnectPrisma(client: PrismaClient, error?: unknown): Promise<void> {
  if (!reconnecting) {
    const engineNotConnected = isEngineNotConnectedError(error);
    reconnecting = (async () => {
      if (!engineNotConnected) {
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
        return;
      }
      await client.$connect();
    })().finally(() => {
      reconnecting = null;
    });
  }
  return reconnecting;
}

/** Sdílené připojení i pro volání mimo query extension (audit, pokladna). */
export function reconnectSharedPrisma(error?: unknown): Promise<void> {
  const reconnect = globalThis.__prismaReconnect;
  if (!reconnect) return Promise.resolve();
  return reconnect(error);
}

function createPrismaClient(): PrismaClient {
  const url = serverlessDatabaseUrl(requireDatabaseUrl());
  const base = new PrismaClient({
    datasources: { db: { url } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  const reconnect = (error?: unknown) => reconnectPrisma(base, error);
  globalThis.__prismaReconnect = reconnect;

  // Modelové dotazy (findUnique, …) se při krátkém výpadku Neonu zopakují.
  // Bez toho SSR admin menu spadne na ořezanou hlášku Server Components.
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          if ((retryDepth.getStore() ?? 0) > 0) return query(args);
          return retryDepth.run(1, () =>
            retryOnTransientConnection(async () => {
              if (reconnecting) {
                try {
                  await reconnecting;
                } catch {
                  /* dotaz níž zkusí připojení znovu */
                }
              }
              return query(args);
            }, reconnect),
          );
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

globalThis.__prisma = prisma;

