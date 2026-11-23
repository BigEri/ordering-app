import { isEngineNotConnectedError, isPrismaTransientConnectionError } from "./prismaKnownError";
import { reconnectSharedPrisma } from "./prisma";

/**
 * Po idle HTTP (Storyous/Dotykačka) Neon často zavře spojení — jednou odpojit a zopakovat.
 * „Engine is not yet connected“ už opakuje query extension (`$connect` + nový dotaz);
 * tady se nesmí znovu volat `$disconnect`, jinak engine zůstane shozený.
 */
export async function withPrismaTransientRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (first) {
    if (isEngineNotConnectedError(first)) throw first;
    if (!isPrismaTransientConnectionError(first)) throw first;
    await reconnectSharedPrisma(first);
    return await run();
  }
}
