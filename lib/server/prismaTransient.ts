import { isPrismaTransientConnectionError } from "./prismaKnownError";

const RETRY_DELAY_MS = 250;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Jedno opakování, když Neon pooler nestihne spojení (P1001 / „Can't reach database server“)
 * nebo pool drží mrtvý socket. `reconnect` má odpojit klienta a otevřít nové spojení.
 */
export async function retryOnTransientConnection<T>(
  run: () => Promise<T>,
  reconnect: () => Promise<void>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isPrismaTransientConnectionError(error)) throw error;
    await wait(RETRY_DELAY_MS);
    await reconnect();
    return await run();
  }
}
