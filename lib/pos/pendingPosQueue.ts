/**
 * Fronta neodeslaných POS požadavků (IndexedDB) — přežije obnovení stránky.
 * Pouze na klientu.
 */

import { postPosJson } from "./postPosJson";

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

export const POS_QUEUE_ORDER_SENT = "pos-queue-order-sent";
export const POS_QUEUE_FLUSH_DETAIL = "pos-queue-flush-detail";

/** Odešle všechny položky ve frontě; při úspěchu maže a dispatchuje události pro UI. */
export async function flushPendingPosQueue(): Promise<void> {
  if (typeof window === "undefined") return;
  const items = await listPending();
  for (const item of items) {
    try {
      const body = JSON.parse(item.bodyJson) as unknown;
      const r = await postPosJson(item.url, body);
      if (!r.ok) continue;

      await removePending(item.id);

      if (item.url.includes("/order-confirmed") && item.clientOrderSnapshotJson) {
        try {
          const snap = JSON.parse(item.clientOrderSnapshotJson) as { lines: unknown; totalCzk: number };
          window.dispatchEvent(new CustomEvent(POS_QUEUE_ORDER_SENT, { detail: snap }));
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
}
