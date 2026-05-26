import { nowIso } from "./db";
import { prisma } from "./prisma";

const TTL_MS = 24 * 60 * 60 * 1000;

/** Už jsme tento požadavek úspěšně dokončili — opakování jen vrátí deduped. */
export async function isSuccessfulDuplicateAsync(clientRequestId: string | undefined): Promise<boolean> {
  const id = clientRequestId?.trim();
  if (!id) return false;
  const row = await prisma.posRequestDedupe.findUnique({
    where: { clientRequestId: id },
    select: { completedAtIso: true },
  });
  if (!row?.completedAtIso) return false;
  const completedMs = new Date(row.completedAtIso).getTime();
  if (!Number.isFinite(completedMs) || Date.now() - completedMs > TTL_MS) {
    await prisma.posRequestDedupe.deleteMany({ where: { clientRequestId: id } }).catch(() => {});
    return false;
  }
  return true;
}

/** Zavolat až po úspěšné odpovědi (200, uloženo / přeposláno). */
export async function markPosRequestSuccessfulAsync(clientRequestId: string | undefined): Promise<void> {
  const id = clientRequestId?.trim();
  if (!id) return;
  const completedAtIso = nowIso();
  await prisma.posRequestDedupe.upsert({
    where: { clientRequestId: id },
    update: { completedAtIso },
    create: { clientRequestId: id, completedAtIso },
  });
}

/** Občasné čištění starých záznamů (volitelné, např. z health/cron). */
export async function prunePosRequestDedupeAsync(): Promise<number> {
  const cutoff = new Date(Date.now() - TTL_MS).toISOString();
  const r = await prisma.posRequestDedupe.deleteMany({
    where: { completedAtIso: { lt: cutoff } },
  });
  return r.count;
}
