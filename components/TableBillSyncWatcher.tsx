"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

import { isAdminMenuPreviewOnClient } from "../lib/admin/publicMenuPreviewUrl";
import { TABLE_BILL_SYNC_REQUEST } from "../lib/client/tableBillSync";
import { buildKioskWelcomeUrl } from "../lib/kiosk/nav";
import { resetPendingOrderConfirmedState } from "../lib/pos/pendingPosQueue";
import { useOrders } from "./OrdersProvider";
import { usePosTableFields } from "./DeviceTableProvider";
import { useLanguage } from "./LanguageProvider";

/** Běžný interval — na tabletu se může škrtit, proto máme i sync po interakci. */
const POLL_MS = 7000;
/** Když už běží účet u stolu, sync častěji (položky z Dotypos od obsluhy). */
const POLL_OPEN_BILL_MS = 4000;
/** Minimální odstup syncu po dotyku obrazovky. */
const INTERACTION_SYNC_MIN_MS = 1500;

type TableOpenBillResponse = {
  ok?: boolean;
  configured?: boolean;
  open?: boolean;
  lines?: Array<{ name: string; qty: number; unitPriceCzk: number }>;
  totalCzk?: number;
};

function formatCzk(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "";
  return `${Math.round(n)} Kč`;
}

function isWatcherPath(pathname: string): boolean {
  if (pathname === "/" || pathname.startsWith("/admin") || pathname === "/virtual-pos") return false;
  if (isAdminMenuPreviewOnClient()) return false;
  return true;
}

export function TableBillSyncWatcher() {
  const pathname = usePathname() ?? "";
  const { t } = useLanguage();
  const { posTableFields, ready } = usePosTableFields();
  const { syncTableBillFromDotykacka, clearOrders, hasOpenTableBill } = useOrders();

  const [issuedOpen, setIssuedOpen] = React.useState(false);
  const [issuedTotal, setIssuedTotal] = React.useState<number | null>(null);
  const handledIssuedRef = React.useRef(false);
  const hadOpenBillRef = React.useRef(false);
  const lastTotalRef = React.useRef<number | null>(null);
  const posTableFieldsRef = React.useRef(posTableFields);
  const readyRef = React.useRef(ready);
  const lastInteractionSyncAtRef = React.useRef(0);
  posTableFieldsRef.current = posTableFields;
  readyRef.current = ready;

  const applyBillSnapshot = React.useCallback(
    (j: TableOpenBillResponse) => {
      const lines = Array.isArray(j.lines) ? j.lines : [];
      const totalCzk = typeof j.totalCzk === "number" && Number.isFinite(j.totalCzk) ? j.totalCzk : 0;
      const billOpen = j.open === true;

      if (billOpen && lines.length > 0) {
        hadOpenBillRef.current = true;
        lastTotalRef.current = totalCzk;
        syncTableBillFromDotykacka({ lines, totalCzk });
        return;
      }

      if (billOpen && lines.length === 0) {
        // Otevřený účet bez naparsovaných řádků — nemazat lokální stav.
        return;
      }

      syncTableBillFromDotykacka({ lines: [], totalCzk: 0 });

      if (!handledIssuedRef.current && hadOpenBillRef.current) {
        handledIssuedRef.current = true;
        setIssuedTotal(lastTotalRef.current);
        setIssuedOpen(true);
        hadOpenBillRef.current = false;
        lastTotalRef.current = null;
        void resetPendingOrderConfirmedState();
        clearOrders();
        window.setTimeout(() => {
          window.location.href = buildKioskWelcomeUrl();
        }, 4500);
      }
    },
    [clearOrders, syncTableBillFromDotykacka],
  );

  const syncNow = React.useCallback(async () => {
    if (!isWatcherPath(pathname)) return;
    if (handledIssuedRef.current) return;
    if (!readyRef.current) return;

    const fields = posTableFieldsRef.current();
    if (!fields.deviceId?.trim() || !/^\d+$/.test(String(fields.tableId ?? "").trim())) return;

    try {
      const r = await fetch("/api/pos/table-open-bill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fields),
        cache: "no-store",
      });
      const j = (await r.json()) as TableOpenBillResponse;
      if (!r.ok || !j.ok) return;
      if (j.configured === false) return;
      applyBillSnapshot(j);
    } catch {
      /* síť — další pokus z intervalu nebo po interakci */
    }
  }, [applyBillSnapshot, pathname]);

  const syncNowRef = React.useRef(syncNow);
  syncNowRef.current = syncNow;

  const bumpInteractionSync = React.useCallback(() => {
    if (!isWatcherPath(pathname)) return;
    if (handledIssuedRef.current) return;
    const now = Date.now();
    if (now - lastInteractionSyncAtRef.current < INTERACTION_SYNC_MIN_MS) return;
    lastInteractionSyncAtRef.current = now;
    void syncNowRef.current();
  }, [pathname]);

  React.useEffect(() => {
    if (!isWatcherPath(pathname)) return;
    if (handledIssuedRef.current) return;

    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (cancelled || inFlight || handledIssuedRef.current) return;
      inFlight = true;
      try {
        await syncNowRef.current();
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const pollMs = hasOpenTableBill ? POLL_OPEN_BILL_MS : POLL_MS;
    const id = window.setInterval(tick, pollMs);
    const onSyncRequest = () => void tick();

    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };

    const capture: AddEventListenerOptions = { capture: true, passive: true };
    const onPointer = () => bumpInteractionSync();

    window.addEventListener(TABLE_BILL_SYNC_REQUEST, onSyncRequest);
    window.addEventListener("focus", onSyncRequest);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", onPointer, capture);
    window.addEventListener("touchstart", onPointer, capture);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener(TABLE_BILL_SYNC_REQUEST, onSyncRequest);
      window.removeEventListener("focus", onSyncRequest);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onPointer, capture);
      window.removeEventListener("touchstart", onPointer, capture);
    };
  }, [pathname, hasOpenTableBill, bumpInteractionSync]);

  if (!issuedOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("issued.modal.aria")}
      onClick={() => setIssuedOpen(false)}
      className="modalOverlay modalOverlay--60"
    >
      <div onClick={(e) => e.stopPropagation()} className="modalCard">
        <strong className="modalTitle">{t("issued.modal.title")}</strong>
        <p className="textMuted" style={{ margin: 0 }}>
          {issuedTotal != null
            ? t("issued.modal.bodyWithTotal").replace("{{total}}", formatCzk(issuedTotal))
            : t("issued.modal.body")}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="chip" onClick={() => setIssuedOpen(false)} style={{ cursor: "pointer" }}>
            {t("issued.modal.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
