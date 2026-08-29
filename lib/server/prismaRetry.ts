import { isPrismaTransientConnectionError } from "./prismaKnownError";
import { prisma } from "./prisma";

/** Po idle HTTP (Storyous/Dotykačka) Neon často zavře spojení — jednou odpojit a zopakovat. */
export async function withPrismaTransientRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (first) {
    if (!isPrismaTransientConnectionError(first)) throw first;
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
    try {
      await prisma.$connect();
    } catch {
      /* další pokus query stejně selže srozumitelněji */
    }
    return await run();
  }
}
