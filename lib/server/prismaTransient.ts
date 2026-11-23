import { AsyncLocalStorage } from "node:async_hooks";

import { isEngineNotConnectedError, isPrismaTransientConnectionError } from "./prismaKnownError";

const RETRY_DELAY_MS = 250;
/** Engine po studeném startu často odmítne první dotaz — několik `$connect` s odstupem. */
const ENGINE_CONNECT_DELAYS_MS = [80, 200, 500, 1000];

const engineRetryDepth = new AsyncLocalStorage<number>();

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function retryUntilEngineConnects<T>(
  run: () => Promise<T>,
  reconnect: (error: unknown) => Promise<void>,
  firstError: unknown,
): Promise<T> {
  let last = firstError;
  for (const delayMs of ENGINE_CONNECT_DELAYS_MS) {
    await wait(delayMs);
    try {
      await reconnect(last);
    } catch (connectError) {
      last = connectError;
      continue;
    }
    try {
      return await run();
    } catch (error) {
      if (!isPrismaTransientConnectionError(error)) throw error;
      last = error;
      if (!isEngineNotConnectedError(error)) {
        await wait(RETRY_DELAY_MS);
        try {
          await reconnect(error);
        } catch {
          /* další pokus query ukáže původní chybu spojení */
        }
        return await run();
      }
    }
  }
  throw last;
}

/**
 * Jedno opakování, když Neon pooler nestihne spojení (P1001 / „Can't reach database server“)
 * nebo pool drží mrtvý socket. `reconnect` má odpojit klienta a otevřít nové spojení.
 * U „Engine is not yet connected“ se nepřipojuje odpojením — jen opakované `$connect`.
 */
export async function retryOnTransientConnection<T>(
  run: () => Promise<T>,
  reconnect: (error: unknown) => Promise<void>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isPrismaTransientConnectionError(error)) throw error;
    if (isEngineNotConnectedError(error)) {
      if ((engineRetryDepth.getStore() ?? 0) > 0) throw error;
      return engineRetryDepth.run(1, () => retryUntilEngineConnects(run, reconnect, error));
    }
    await wait(RETRY_DELAY_MS);
    await reconnect(error);
    return await run();
  }
}
