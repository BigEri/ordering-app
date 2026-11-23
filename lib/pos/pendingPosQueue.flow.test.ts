import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Minimální IndexedDB v paměti — jen to, co používá fronta (open, put, getAll, delete). */
function fakeIndexedDb() {
  const rows = new Map<string, unknown>();
  const later = (fn: () => void) => setTimeout(fn, 0);
  const db = {
    objectStoreNames: { contains: () => true },
    close() {},
    transaction() {
      const tx: Record<string, unknown> & { oncomplete?: () => void } = {};
      const done = () => later(() => tx.oncomplete?.());
      tx.objectStore = () => ({
        put(row: { id: string }) {
          rows.set(row.id, structuredClone(row));
          done();
        },
        delete(id: string) {
          rows.delete(id);
          done();
        },
        getAll() {
          const req: { result?: unknown; onsuccess?: () => void } = {};
          later(() => {
            req.result = [...rows.values()].map((r) => structuredClone(r));
            req.onsuccess?.();
            tx.oncomplete?.();
          });
          return req;
        },
      });
      return tx;
    },
  };
  return {
    rows,
    api: {
      open() {
        const req: { result?: unknown; onsuccess?: () => void } = {};
        later(() => {
          req.result = db;
          req.onsuccess?.();
        });
        return req;
      },
    },
  };
}

const events: string[] = [];
let idb: ReturnType<typeof fakeIndexedDb>;
let online = true;
let serverUp = true;
const delivered: Array<{ url: string; clientRequestId: unknown }> = [];

beforeEach(() => {
  vi.resetModules();
  events.length = 0;
  delivered.length = 0;
  online = true;
  serverUp = true;
  idb = fakeIndexedDb();
  vi.stubGlobal("indexedDB", idb.api);
  vi.stubGlobal("navigator", {
    get onLine() {
      return online;
    },
  });
  vi.stubGlobal("window", {
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: (ev: Event) => {
      events.push(ev.type);
      return true;
    },
  });
  vi.stubGlobal("CustomEvent", class extends Event {
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      super(type);
      this.detail = init?.detail;
    }
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { body: string }) => {
      if (!online || !serverUp) throw new TypeError("Failed to fetch");
      const body = JSON.parse(init.body) as { clientRequestId?: unknown };
      delivered.push({ url, clientRequestId: body.clientRequestId });
      return new Response(JSON.stringify({ ok: true, storyous: { ok: true, orderId: "ord-1" } }), { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function load() {
  const queue = await import("./pendingPosQueue");
  const resilient = await import("./postPosJsonResilient");
  return { ...queue, ...resilient };
}

const ORDER = { tableId: "132", lines: [{ menuItemId: "p:soup", qty: 1, unitPriceCzk: 56 }], totalCzk: 56 };
const SNAPSHOT = { lines: [{ name: "Rajčatová", qty: 1, unitPriceCzk: 56 }], totalCzk: 56 };

describe("offline order on the tablet", () => {
  it("is kept and delivered exactly once after the connection returns", async () => {
    const q = await load();
    online = false;

    const r = await q.postPosJsonResilient("/api/pos/order-confirmed", ORDER, { clientOrderSnapshot: SNAPSHOT });
    expect(r).toMatchObject({ ok: false, kind: "queued" });
    expect(await q.hasPendingOrderConfirmed()).toBe(true);

    // host mezitím klepne znovu — stále offline, nic se neodešle ani nepřibude
    await q.flushPendingPosQueue();
    expect(idb.rows.size).toBe(1);
    expect(delivered).toHaveLength(0);

    online = true;
    await Promise.all([q.flushPendingPosQueue(), q.flushPendingPosQueue()]);

    expect(delivered).toHaveLength(1);
    expect(delivered[0]?.url).toBe("/api/pos/order-confirmed");
    expect(await q.hasPendingOrderConfirmed()).toBe(false);
    expect(events).toContain(q.POS_QUEUE_ORDER_SENT);
  });

  it("keeps the same request id when it is queued after failed retries (Wi-Fi up, internet down)", async () => {
    const q = await load();
    serverUp = false;
    const r = await q.postPosJsonResilient("/api/pos/order-confirmed", ORDER, { clientOrderSnapshot: SNAPSHOT });
    expect(r).toMatchObject({ ok: false, kind: "queued" });
    const queuedId = (JSON.parse((idb.rows.values().next().value as { bodyJson: string }).bodyJson) as {
      clientRequestId: string;
    }).clientRequestId;

    serverUp = true;
    await q.flushPendingPosQueue();
    expect(delivered.map((d) => d.clientRequestId)).toEqual([queuedId]);
  });

  it("drops an order that waited longer than 30 minutes instead of sending it to the kitchen", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const q = await load();
    online = false;
    await q.postPosJsonResilient("/api/pos/order-confirmed", ORDER, { clientOrderSnapshot: SNAPSHOT });

    vi.setSystemTime(Date.now() + q.PENDING_MAX_AGE_MS + 1000);
    online = true;
    await q.flushPendingPosQueue();

    expect(delivered).toHaveLength(0);
    expect(idb.rows.size).toBe(0);
    expect(events).toContain(q.POS_PENDING_ORDER_RESET);
  });
});

describe("isPermanentPendingFailure", () => {
  it("drops rejected requests but retries outages", async () => {
    const { isPermanentPendingFailure } = await load();
    expect(isPermanentPendingFailure({ kind: "network" })).toBe(false);
    expect(isPermanentPendingFailure({ kind: "http", status: 502 })).toBe(false);
    expect(isPermanentPendingFailure({ kind: "http", status: 429 })).toBe(false);
    expect(isPermanentPendingFailure({ kind: "http", status: 400 })).toBe(true);
    expect(isPermanentPendingFailure({ kind: "http", status: 409, body: { till: { code: "BILL_EMPTY" } } })).toBe(true);
  });
});
