const TRANSIENT_FETCH_RE = /fetch failed|network|econnreset|etimedout|enotfound|socket hang up|abort/i;

export function isTransientFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  if (TRANSIENT_FETCH_RE.test(msg)) return true;
  const cause = (err as Error & { cause?: unknown }).cause;
  if (cause instanceof Error && TRANSIENT_FETCH_RE.test(cause.message)) return true;
  return false;
}

export function userFacingDotykackaMenuError(message: string): string {
  const raw = message.trim();
  if (!raw) return "Nepodařilo se načíst produkty z Dotykačky.";
  if (TRANSIENT_FETCH_RE.test(raw)) {
    return "Dočasně se nepodařilo spojit s Dotykačkou. Obnovte stránku nebo zkuste znovu za chvíli.";
  }
  return raw;
}

function retryDelayMs(attempt: number): number {
  return 400 * (attempt + 1);
}

/** Krátké opakování při výpadku sítě (Vercel → Dotykačka). */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts?: { retries?: number },
): Promise<Response> {
  const retries = opts?.retries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastErr = err;
      if (attempt < retries && isTransientFetchError(err)) {
        await new Promise((r) => setTimeout(r, retryDelayMs(attempt)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
