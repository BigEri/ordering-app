"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { isAdminMenuPreviewOnClient } from "../lib/admin/publicMenuPreviewUrl";
import { setKioskDeviceSecretForPos } from "../lib/pos/kioskDeviceSecretStore";
import { randomUuid } from "../lib/randomUuid";
import { prefetchMenuCacheFromWelcome } from "../lib/kiosk/warmMenuCache";

const STORAGE_DEVICE_ID = "kiosk.deviceId";
const STORAGE_TABLE_ID = "kiosk.tableId";
const STORAGE_TABLE_LABEL = "kiosk.tableLabel";
/** Poslední známý reload nonce ze serveru — při vyšším čísle v /api/devices/config se stránka obnoví. */
const STORAGE_RELOAD_NONCE = "kiosk.reloadNonce";
const STORAGE_DEVICE_SECRET = "kiosk.deviceSecret";
/** Záložní cookie (když localStorage selže nebo se maže). */
const COOKIE_DEVICE_ID = "kiosk_device_id";
const IDB_NAME = "kiosk_device";
const IDB_STORE = "kv";
const IDB_KEY_DEVICE = "deviceId";
/** ~10 let — kiosk tablet má ID držet dlouho */
const COOKIE_MAX_AGE_SEC = 10 * 365 * 24 * 60 * 60;

const HEARTBEAT_MS = 45_000;
/** Admin „Vynutit obnovení“ — tablet polluje config a při vyšším reloadNonce obnoví stránku. */
const CONFIG_POLL_MS = 12_000;

/** Kiosk tablet / host menu — ne admin ani setup. */
function needsKioskMenuRestaurantSync(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === "/" || pathname === "/menu" || pathname.startsWith("/menu/");
}

function needsKioskDeviceContext(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/admin")) return false;
  if (pathname === "/setup" || pathname === "/virtual-pos") return false;
  if (pathname === "/pair" || pathname.startsWith("/pair/")) return false;
  if ((pathname === "/menu" || pathname.startsWith("/menu/")) && isAdminMenuPreviewOnClient()) return false;
  return true;
}

type DeviceConfigJson = {
  ok?: boolean;
  binding?: {
    tableId: string;
    tableLabel: string;
    restaurantId?: string | null;
    deviceSecret?: string | null;
  } | null;
  reloadNonce?: number;
};

const configInflight = new Map<string, Promise<DeviceConfigJson>>();

function fetchDeviceConfig(deviceId: string) {
  const u = new URL("/api/devices/config", typeof window !== "undefined" ? window.location.origin : "http://localhost");
  u.searchParams.set("deviceId", deviceId);
  u.searchParams.set("_t", String(Date.now()));
  return fetch(u.toString(), { cache: "no-store" });
}

/** Sdílený in-flight request — init, poll a cookie sync nevolají config 3× najednou. */
function fetchDeviceConfigJson(deviceId: string): Promise<DeviceConfigJson> {
  const hit = configInflight.get(deviceId);
  if (hit) return hit;
  const run = fetchDeviceConfig(deviceId)
    .then(async (r) => (await r.json()) as DeviceConfigJson)
    .finally(() => {
      configInflight.delete(deviceId);
    });
  configInflight.set(deviceId, run);
  return run;
}

function defaultTableLabel(tableId: string): string {
  return `Stůl ${tableId}`;
}

function readStoredReloadNonce(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_RELOAD_NONCE);
    if (raw == null || raw === "") return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Pokud server zvýšil nonce (admin „Vynutit obnovení“), uložíme ho a obnovíme stránku. */
function applyServerReloadNonce(serverNonce: unknown): void {
  if (typeof window === "undefined") return;
  if (typeof serverNonce !== "number" || !Number.isFinite(serverNonce)) return;
  const prev = readStoredReloadNonce();
  if (serverNonce <= prev) return;
  try {
    window.localStorage.setItem(STORAGE_RELOAD_NONCE, String(serverNonce));
  } catch {
    /* ignore */
  }
  window.location.reload();
}

function normalizeDeviceId(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s || s.length > 200) return null;
  return s;
}

function readDeviceIdFromLocalStorage(): string | null {
  try {
    return normalizeDeviceId(window.localStorage.getItem(STORAGE_DEVICE_ID));
  } catch {
    return null;
  }
}

function writeDeviceIdToLocalStorage(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_DEVICE_ID, id);
  } catch {
    /* ignore */
  }
}

function readDeviceIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const prefix = `${COOKIE_DEVICE_ID}=`;
    const parts = document.cookie.split("; ");
    for (const p of parts) {
      if (p.startsWith(prefix)) {
        return normalizeDeviceId(decodeURIComponent(p.slice(prefix.length)));
      }
    }
    return null;
  } catch {
    return null;
  }
}

function writeDeviceIdToCookie(id: string): void {
  if (typeof document === "undefined") return;
  try {
    const enc = encodeURIComponent(id);
    let tail = `path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
    if (typeof location !== "undefined" && location.protocol === "https:") {
      tail += "; Secure";
    }
    document.cookie = `${COOKIE_DEVICE_ID}=${enc}; ${tail}`;
  } catch {
    /* ignore */
  }
}

function idbOpen(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onerror = () => resolve(null);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
  });
}

async function readDeviceIdFromIdb(): Promise<string | null> {
  const db = await idbOpen();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.close();
        resolve(null);
        return;
      }
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const g = store.get(IDB_KEY_DEVICE);
      g.onsuccess = () => {
        const v = g.result;
        db.close();
        resolve(typeof v === "string" ? normalizeDeviceId(v) : null);
      };
      g.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      try {
        db.close();
      } catch {
        /* ignore */
      }
      resolve(null);
    }
  });
}

async function writeDeviceIdToIdb(id: string): Promise<void> {
  const db = await idbOpen();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      store.put(id, IDB_KEY_DEVICE);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        resolve();
      };
    } catch {
      try {
        db.close();
      } catch {
        /* ignore */
      }
      resolve();
    }
  });
}

/** Zapíše ID do všech dostupných úložišť (localStorage, cookie, IndexedDB). */
async function persistDeviceIdEverywhere(id: string): Promise<void> {
  writeDeviceIdToLocalStorage(id);
  writeDeviceIdToCookie(id);
  await writeDeviceIdToIdb(id);
}

/**
 * Trvalé ID zařízení: localStorage → cookie → IndexedDB → nové UUID.
 * Zálohy zajišťují stejné ID i když jedno z úložišť selže nebo ho systém smaže.
 */
async function getOrCreateDeviceIdAsync(): Promise<string> {
  if (typeof window === "undefined") return "";

  const fromLs = readDeviceIdFromLocalStorage();
  const fromCookie = readDeviceIdFromCookie();
  const fromIdb = await readDeviceIdFromIdb();

  const chosen = fromLs ?? fromCookie ?? fromIdb ?? null;
  const id = chosen ?? randomUuid();

  await persistDeviceIdEverywhere(id);
  return id;
}

function readLocalTable(): { tableId: string; tableLabel: string } {
  if (typeof window === "undefined") return { tableId: "1", tableLabel: defaultTableLabel("1") };
  try {
    const tid = window.localStorage.getItem(STORAGE_TABLE_ID)?.trim();
    const lbl = window.localStorage.getItem(STORAGE_TABLE_LABEL)?.trim();
    if (tid) {
      return { tableId: tid, tableLabel: lbl || defaultTableLabel(tid) };
    }
  } catch {
    /* ignore */
  }
  return { tableId: "1", tableLabel: defaultTableLabel("1") };
}

function writeLocalTable(tableId: string, tableLabel: string) {
  try {
    window.localStorage.setItem(STORAGE_TABLE_ID, tableId);
    window.localStorage.setItem(STORAGE_TABLE_LABEL, tableLabel);
  } catch {
    /* ignore */
  }
}

type DeviceTableContextValue = {
  deviceId: string;
  tableId: string;
  tableLabel: string;
  /** True až po synchronizaci s localStorage / URL / API (pro první render může být default). */
  ready: boolean;
  /** Kód pro párování v administraci, dokud zařízení nemá záznam v kiosk_device_bindings. */
  pairingCode: string | null;
  pairingExpiresAtIso: string | null;
  needsPairing: boolean;
  /** Pole pro POS včetně deviceId — aby server mohl spárovat objednávku se zařízením v /admin/devices. */
  posTableFields: () => { tableId: string; tableLabel: string; deviceId: string; restaurantId?: string | null };
};

const DeviceTableContext = React.createContext<DeviceTableContextValue | null>(null);

export function DeviceTableProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); // jen pro vyloučení /admin u heartbeat
  const router = useRouter();
  const [deviceId, setDeviceId] = React.useState("");
  const [tableId, setTableId] = React.useState("1");
  const [tableLabel, setTableLabel] = React.useState("Stůl 1");
  const [ready, setReady] = React.useState(false);
  /** Veřejné menu: ID provozovny pro POS API (per-tenant Dotykačka). */
  const [menuRestaurantId, setMenuRestaurantId] = React.useState<string | null>(null);
  const [pairingCode, setPairingCode] = React.useState<string | null>(null);
  const [pairingExpiresAtIso, setPairingExpiresAtIso] = React.useState<string | null>(null);
  const [needsPairing, setNeedsPairing] = React.useState(false);
  /** Kdy vyprší aktuální kód (ms) — aby poll nevolal upsert při každém intervalu. */
  const pairingExpiryMsRef = React.useRef(0);

  type ConfigBinding = {
    tableId: string;
    tableLabel: string;
    restaurantId?: string | null;
    deviceSecret?: string | null;
  } | null;

  const applyDeviceSecret = React.useCallback((secret: string | null | undefined) => {
    const s = secret?.trim() ?? "";
    if (!s) return;
    try {
      window.localStorage.setItem(STORAGE_DEVICE_SECRET, s);
    } catch {
      /* ignore */
    }
    setKioskDeviceSecretForPos(s);
  }, []);

  const syncPairingWithConfig = React.useCallback(
    async (did: string, binding: ConfigBinding, cancelled: () => boolean) => {
      if (!did) return;
      if (pathname?.startsWith("/admin") || pathname === "/setup" || pathname === "/pair") return;

      if (binding) {
        if (cancelled()) return;
        setNeedsPairing(false);
        setPairingCode(null);
        setPairingExpiresAtIso(null);
        pairingExpiryMsRef.current = 0;
        applyDeviceSecret(binding.deviceSecret);
        return;
      }

      if (cancelled()) return;
      setNeedsPairing(true);
      const now = Date.now();
      const renewIfWithinMs = 3 * 60 * 1000;
      const exp = pairingExpiryMsRef.current;
      if (exp > 0 && now < exp - renewIfWithinMs) return;

      try {
        const pr = await fetch("/api/public/device-pairing-code", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deviceId: did }),
        });
        const j = (await pr.json()) as { ok?: boolean; code?: string; expiresAtIso?: string };
        if (cancelled() || !pr.ok || !j.ok || !j.code) return;
        setPairingCode(j.code);
        const iso = typeof j.expiresAtIso === "string" ? j.expiresAtIso : null;
        setPairingExpiresAtIso(iso);
        pairingExpiryMsRef.current = iso ? new Date(iso).getTime() : 0;
      } catch {
        /* ignore */
      }
    },
    [pathname, applyDeviceSecret],
  );

  React.useEffect(() => {
    if (!needsKioskDeviceContext(pathname)) {
      setReady(true);
      return;
    }

    let cancelled = false;

    (async () => {
      let id = "";
      if (typeof window !== "undefined") {
        const fromUrl = normalizeDeviceId(new URLSearchParams(window.location.search).get("deviceId"));
        if (fromUrl) {
          id = fromUrl;
          await persistDeviceIdEverywhere(fromUrl);
        }
      }
      if (!id) {
        id = await getOrCreateDeviceIdAsync();
      }
      if (cancelled) return;
      setDeviceId(id);

      try {
        const storedSecret = window.localStorage.getItem(STORAGE_DEVICE_SECRET);
        if (storedSecret) setKioskDeviceSecretForPos(storedSecret);
      } catch {
        /* ignore */
      }

      let { tableId: tid, tableLabel: lbl } = readLocalTable();

      if (typeof window !== "undefined") {
        const sp = new URLSearchParams(window.location.search);
        const urlTable = sp.get("table")?.trim();
        const urlTableLabel = sp.get("tl")?.trim();
        if (urlTable) {
          tid = urlTable;
          lbl = urlTableLabel || defaultTableLabel(urlTable);
          writeLocalTable(tid, lbl);
        }
      }

      setTableId(tid);
      setTableLabel(lbl);

      const applyBinding = (b: { tableId: string; tableLabel: string } | null) => {
        if (b) {
          setTableId(b.tableId);
          setTableLabel(b.tableLabel);
          writeLocalTable(b.tableId, b.tableLabel);
        }
      };

      try {
        const data = await fetchDeviceConfigJson(id);
        if (cancelled) return;
        lastConfigRef.current = { deviceId: id, binding: data.binding ?? null };
        if (data.ok && data.binding) {
          applyBinding(data.binding);
          applyDeviceSecret(data.binding.deviceSecret);
        }
        if (!cancelled) applyServerReloadNonce(data.reloadNonce);
        await syncPairingWithConfig(id, data.ok ? data.binding ?? null : null, () => cancelled);
      } catch {
        /* offline — lokální stůl */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [syncPairingWithConfig, pathname, applyDeviceSecret]);

  React.useEffect(() => {
    if (!needsKioskDeviceContext(pathname)) return;
    if (!deviceId || !ready) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const data = await fetchDeviceConfigJson(deviceId);
        if (cancelled) return;
        lastConfigRef.current = { deviceId, binding: data.binding ?? null };
        if (data.ok && data.binding) {
          setTableId(data.binding.tableId);
          setTableLabel(data.binding.tableLabel);
          writeLocalTable(data.binding.tableId, data.binding.tableLabel);
          applyDeviceSecret(data.binding.deviceSecret);
        }
        applyServerReloadNonce(data.reloadNonce);
        await syncPairingWithConfig(deviceId, data.ok ? data.binding ?? null : null, () => cancelled);
      } catch {
        /* ignore */
      }
    };

    const t = window.setInterval(() => void poll(), CONFIG_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [deviceId, ready, pathname, syncPairingWithConfig, applyDeviceSecret]);

  React.useEffect(() => {
    if (!needsKioskDeviceContext(pathname)) return;
    if (!deviceId || !ready) return;

    const send = () => {
      void fetch("/api/devices/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceId,
          tableId,
          tableLabel,
        }),
      }).catch(() => {});
    };

    send();
    const t = window.setInterval(send, HEARTBEAT_MS);
    return () => window.clearInterval(t);
  }, [deviceId, tableId, tableLabel, ready, pathname]);

  const kioskMenuCookieSynced = React.useRef(false);
  const lastConfigRef = React.useRef<{ deviceId: string; binding: DeviceConfigJson["binding"] } | null>(null);

  React.useEffect(() => {
    kioskMenuCookieSynced.current = false;
    lastConfigRef.current = null;
  }, [deviceId]);

  /** Párování tabletu v adminu → cookie veřejné provozovny a obnoví SSR (fotky, ingredience). */
  React.useEffect(() => {
    if (!needsKioskDeviceContext(pathname)) return;
    if (!deviceId || !ready) return;
    if (!needsKioskMenuRestaurantSync(pathname)) return;
    if (kioskMenuCookieSynced.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const cached =
          lastConfigRef.current?.deviceId === deviceId ? lastConfigRef.current.binding : null;
        const data =
          cached != null
            ? { ok: true as const, binding: cached }
            : await fetchDeviceConfigJson(deviceId);
        if (cancelled || !data.ok || !data.binding?.restaurantId) return;
        const sync = await fetch("/api/public/kiosk-menu-cookie", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deviceId }),
          credentials: "same-origin",
        });
        if (cancelled || !sync.ok) return;
        setMenuRestaurantId(data.binding.restaurantId ?? null);
        kioskMenuCookieSynced.current = true;
        router.refresh();
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceId, ready, pathname, router]);

  React.useEffect(() => {
    if (!needsKioskDeviceContext(pathname)) return;
    if (!needsKioskMenuRestaurantSync(pathname)) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/public/menu-context", { cache: "no-store" });
        const j = (await r.json()) as { ok?: boolean; restaurantId?: string | null };
        if (!cancelled && r.ok && j.ok) setMenuRestaurantId(j.restaurantId ?? null);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  /** Úvodní stránka: přednahřát Dotykačka menu + overrides, aby přechod na /menu byl rychlý. */
  React.useEffect(() => {
    if (pathname !== "/") return;
    if (!ready || !deviceId || needsPairing) return;
    prefetchMenuCacheFromWelcome(deviceId);
  }, [pathname, ready, deviceId, needsPairing]);

  const posTableFields = React.useCallback(
    () => ({
      tableId,
      tableLabel,
      deviceId,
      ...(menuRestaurantId ? { restaurantId: menuRestaurantId } : {}),
    }),
    [tableId, tableLabel, deviceId, menuRestaurantId],
  );

  const value = React.useMemo<DeviceTableContextValue>(
    () => ({
      deviceId,
      tableId,
      tableLabel,
      ready,
      pairingCode,
      pairingExpiresAtIso,
      needsPairing,
      posTableFields,
    }),
    [deviceId, tableId, tableLabel, ready, pairingCode, pairingExpiresAtIso, needsPairing, posTableFields],
  );

  return <DeviceTableContext.Provider value={value}>{children}</DeviceTableContext.Provider>;
}

/** Hodnoty odpovídají počátečnímu stavu v `DeviceTableProvider` (když chybí provider kvůli duplicitnímu modulu v bundleru). */
const POS_TABLE_FIELDS_FALLBACK: DeviceTableContextValue = {
  deviceId: "",
  tableId: "1",
  tableLabel: "Stůl 1",
  ready: false,
  pairingCode: null,
  pairingExpiresAtIso: null,
  needsPairing: false,
  posTableFields: () => ({ tableId: "1", tableLabel: "Stůl 1", deviceId: "", restaurantId: null }),
};

export function usePosTableFields(): DeviceTableContextValue {
  const ctx = React.useContext(DeviceTableContext);
  if (ctx) return ctx;
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[ordering] usePosTableFields: žádný DeviceTableProvider v kontextu — použit fallback (zkontrolujte obalení routy).",
    );
  }
  return POS_TABLE_FIELDS_FALLBACK;
}
