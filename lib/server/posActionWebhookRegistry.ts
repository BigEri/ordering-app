import { nowIso } from "./db";
import { prisma } from "./prisma";

type MemoryEntry = {
  resolve: (body: string | null) => void;
  timer: ReturnType<typeof setTimeout>;
};

const pendingMemory = new Map<string, MemoryEntry>();

const POLL_MS = 200;

async function createWebhookCallbackRow(callbackId: string, ms: number): Promise<void> {
  const createdAtIso = nowIso();
  const expiresAtIso = new Date(Date.now() + ms).toISOString();
  await prisma.posActionWebhookCallback.upsert({
    where: { callbackId },
    create: { callbackId, body: null, createdAtIso, expiresAtIso, resolvedAtIso: null },
    update: { expiresAtIso, resolvedAtIso: null, body: null },
  });
}

/** undefined = ještě nevyřešeno; null = expirováno bez těla */
async function readResolvedBody(callbackId: string): Promise<string | null | undefined> {
  const row = await prisma.posActionWebhookCallback.findUnique({
    where: { callbackId },
    select: { body: true, resolvedAtIso: true, expiresAtIso: true },
  });
  if (!row) return undefined;
  if (row.resolvedAtIso) return row.body ?? "";
  if (new Date(row.expiresAtIso).getTime() <= Date.now()) return null;
  return undefined;
}

async function persistWebhookBody(callbackId: string, body: string): Promise<void> {
  await prisma.posActionWebhookCallback.updateMany({
    where: { callbackId },
    data: { body, resolvedAtIso: nowIso() },
  });
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/**
 * Čeká na callback z Dotyky — in-memory (stejná instance) + polling DB (multi-instance / serverless).
 */
export function waitForPosActionWebhook(callbackId: string, ms: number): Promise<string | null> {
  void createWebhookCallbackRow(callbackId, ms).catch(() => {});

  return new Promise((resolve) => {
    let settled = false;
    const finish = (body: string | null) => {
      if (settled) return;
      settled = true;
      const e = pendingMemory.get(callbackId);
      if (e) {
        clearTimeout(e.timer);
        pendingMemory.delete(callbackId);
      }
      resolve(body);
    };

    const timer = setTimeout(() => {
      void readResolvedBody(callbackId).then((b) => finish(b ?? null));
    }, ms);

    pendingMemory.set(callbackId, {
      resolve: finish,
      timer,
    });

    void (async () => {
      const deadline = Date.now() + ms;
      while (Date.now() < deadline && !settled) {
        const body = await readResolvedBody(callbackId);
        if (body !== undefined) {
          finish(body);
          return;
        }
        await sleep(POLL_MS);
      }
    })();
  });
}

export function resolvePosActionWebhook(callbackId: string, body: string): boolean {
  void persistWebhookBody(callbackId, body).catch(() => {});

  const e = pendingMemory.get(callbackId);
  if (!e) return false;
  e.resolve(body);
  return true;
}

export function cancelPosActionWebhook(callbackId: string | null | undefined): void {
  if (!callbackId) return;
  const e = pendingMemory.get(callbackId);
  if (e) e.resolve(null);
}

export async function pruneExpiredPosWebhookCallbacksAsync(): Promise<number> {
  const now = nowIso();
  const r = await prisma.posActionWebhookCallback.deleteMany({
    where: { expiresAtIso: { lt: now } },
  });
  return r.count;
}
