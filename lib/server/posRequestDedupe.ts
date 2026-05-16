/**
 * Idempotence POS požadavků podle clientRequestId — značí se až po úspěšném dokončení.
 * In-memory, jeden proces.
 */

const TTL_MS = 24 * 60 * 60 * 1000;
const successIds = new Map<string, number>();

function prune(now: number) {
  for (const [id, ts] of successIds) {
    if (now - ts > TTL_MS) successIds.delete(id);
  }
}

/** Už jsme tento požadavek úspěšně dokončili — opakování jen vrátí deduped. */
export function isSuccessfulDuplicate(clientRequestId: string | undefined): boolean {
  if (!clientRequestId?.trim()) return false;
  const now = Date.now();
  prune(now);
  return successIds.has(clientRequestId.trim());
}

/** Zavolat až po úspěšné odpovědi (200, uloženo / přeposláno). */
export function markPosRequestSuccessful(clientRequestId: string | undefined): void {
  if (!clientRequestId?.trim()) return;
  successIds.set(clientRequestId.trim(), Date.now());
}
