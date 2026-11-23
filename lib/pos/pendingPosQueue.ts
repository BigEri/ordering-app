/**
 * Fronta neodeslaných POS požadavků (IndexedDB) — přežije obnovení stránky.
 * Pouze na klientu.
 */

import { postPosJson } from "./postPosJson";
import { BILL_EMPTY_CODE, tillErrorCodeFromBody } from "./tillErrorCodes";

const DB_NAME = "pos_pending_queue";
const STORE = "pending";
const DB_VERSION = 1;

export type PendingPosRow = {
  id: string;
  url: string;
  bodyJson: string;
  /** Jen u order-confirmed — doplnění objednávky do historie po úspěšném flushi. */
  clientOrderSnapshotJson?: string;
  createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("no idb"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

export async function enqueuePending(row: Omit<PendingPosRow, "createdAt">): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.objectStore(STORE).put({
      ...row,
      createdAt: Date.now(),
    } satisfies PendingPosRow);
  });
}

export async function listPending(): Promise<PendingPosRow[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const g = tx.objectStore(STORE).getAll();
      g.onsuccess = () => {
        db.close();
        resolve((g.result as PendingPosRow[]) ?? []);
      };
      g.onerror = () => {
        db.close();
        reject(g.error);
      };
    });
  } catch {
    return [];
  }
}

export async function hasPendingOrderConfirmed(): Promise<boolean> {
  const items = await listPending();
  return items.some((i) => i.url.includes("/order-confirmed"));
}

/** Smaže neodeslané objednávky z fronty (např. po potvrzení změny košíku). */
export async function clearPendingOrderConfirmed(): Promise<void> {
  const items = await listPending();
  for (const item of items) {
    if (item.url.includes("/order-confirmed")) {
      await removePending(item.id);
    }
  }
}

export const POS_QUEUE_ORDER_SENT = "pos-queue-order-sent";
export const POS_QUEUE_FLUSH_DETAIL = "pos-queue-flush-detail";
/** Fronta order-confirmed byla vyčištěna — UI může zrušit guard „Neodeslaná objednávka“. */
export const POS_PENDING_ORDER_RESET = "pos-pending-order-reset";

function orderIdFromOkBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const rec = body as Record<string, unknown>;
  if (typeof rec.orderId === "string" && rec.orderId.trim()) return rec.orderId.trim();
  for (const key of ["storyous", "till"] as const) {
    const nested = rec[key];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;
    const id = (nested as Record<string, unknown>).orderId;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return undefined;
}

/**
 * Vymaže frontu order-confirmed a synchronně upozorní UI.
 * Volat po úspěšném odeslání, zaplacení účtu v Dotyce, nebo ručním zrušení fronty.
 */
export async function resetPendingOrderConfirmedState(): Promise<void> {
  await clearPendingOrderConfirmed();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(POS_PENDING_ORDER_RESET));
  }
}

export async function removePending(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
      tx.objectStore(STORE).delete(id);
    });
  } catch {
    /* ignore */
  }
}

/** Starší požadavek už neposílat — objednávka po půl hodině do kuchyně jen nadělá zmatek. */
export const PENDING_MAX_AGE_MS = 30 * 60_000;

/** Zahodit po HTTP chybě? 4xx = server požadavek odmítl a opakování nepomůže (kromě 408/429). */
export function isPermanentPendingFailure(r: { kind: "network" | "http"; status?: number; body?: unknown }): boolean {
  if (r.kind !== "http") return false;
  if (tillErrorCodeFromBody(r.body) === BILL_EMPTY_CODE) return true;
  const s = r.status ?? 0;
  return s >= 400 && s < 500 && s !== 408 && s !== 429;
}

let flushInFlight: Promise<void> | null = null;

/** Odešle všechny položky ve frontě; při úspěchu maže a dispatchuje události pro UI. Souběžná volání sdílí jeden běh. */
export function flushPendingPosQueue(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!flushInFlight) {
    flushInFlight = flushOnce().finally(() => {
      flushInFlight = null;
    });
  }
  return flushInFlight;
}

async function flushOnce(): Promise<void> {
  const items = await listPending();
  let droppedOrder = false;
  for (const item of items) {
    try {
      if (Date.now() - item.createdAt > PENDING_MAX_AGE_MS) {
        await removePending(item.id);
        if (item.url.includes("/order-confirmed")) droppedOrder = true;
        continue;
      }
      const body = JSON.parse(item.bodyJson) as unknown;
      const r = await postPosJson(item.url, body);
      if (!r.ok) {
        if (isPermanentPendingFailure(r)) {
          await removePending(item.id);
          if (item.url.includes("/order-confirmed")) droppedOrder = true;
        }
        continue;
      }

      await removePending(item.id);

      if (item.url.includes("/order-confirmed") && item.clientOrderSnapshotJson) {
        try {
          const snap = JSON.parse(item.clientOrderSnapshotJson) as {
            lines: unknown;
            totalCzk: number;
          };
          const storyousOrderId = orderIdFromOkBody(r.body);
          window.dispatchEvent(
            new CustomEvent(POS_QUEUE_ORDER_SENT, {
              detail: { ...snap, ...(storyousOrderId ? { storyousOrderId } : {}) },
            }),
          );
        } catch {
          /* ignore */
        }
      } else {
        window.dispatchEvent(
          new CustomEvent(POS_QUEUE_FLUSH_DETAIL, {
            detail: { url: item.url, body },
          }),
        );
      }
    } catch {
      /* další pokus později */
    }
  }
  // Zahozená objednávka — košík už nehlídá „neodeslanou objednávku“, host ji může poslat znovu.
  if (droppedOrder && !(await hasPendingOrderConfirmed())) {
    window.dispatchEvent(new Event(POS_PENDING_ORDER_RESET));
  }
}
