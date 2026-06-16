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

const POLL_MS = 7000;

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

export function TableBillSyncWatcher() {
  const pathname = usePathname() ?? "";
  const { t } = useLanguage();
  const { posTableFields } = usePosTableFields();
  const { syncTableBillFromDotykacka, clearOrders } = useOrders();

  const [issuedOpen, setIssuedOpen] = React.useState(false);
  const [issuedTotal, setIssuedTotal] = React.useState<number | null>(null);
  const handledIssuedRef = React.useRef(false);
  const hadOpenBillRef = React.useRef(false);
  const lastTotalRef = React.useRef<number | null>(null);
  const posTableFieldsRef = React.useRef(posTableFields);
  posTableFieldsRef.current = posTableFields;

  const applyBillSnapshot = React.useCallback(
    (j: TableOpenBillResponse) => {
      const lines = Array.isArray(j.lines) ? j.lines : [];
      const totalCzk = typeof j.totalCzk === "number" && Number.isFinite(j.totalCzk) ? j.totalCzk : 0;
      const open = j.open === true && lines.length > 0;

      if (open) {
        hadOpenBillRef.current = true;
        lastTotalRef.current = totalCzk;
        syncTableBillFromDotykacka({ lines, totalCzk });
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
    if (pathname === "/" || pathname.startsWith("/admin") || pathname === "/virtual-pos") return;
    if (isAdminMenuPreviewOnClient()) return;
    if (handledIssuedRef.current) return;

    try {
      const r = await fetch("/api/pos/table-open-bill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(posTableFieldsRef.current()),
        cache: "no-store",
      });
      const j = (await r.json()) as TableOpenBillResponse;
      if (!r.ok || !j.ok) return;
      if (j.configured === false) return;
      applyBillSnapshot(j);
    } catch {
      /* ignore */
    }
  }, [applyBillSnapshot, pathname]);

  React.useEffect(() => {
    if (pathname === "/" || pathname.startsWith("/admin") || pathname === "/virtual-pos") return;
    if (isAdminMenuPreviewOnClient()) return;
    if (handledIssuedRef.current) return;

    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (cancelled || inFlight || handledIssuedRef.current) return;
      inFlight = true;
      try {
        await syncNow();
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const id = window.setInterval(tick, POLL_MS);
    const onSyncRequest = () => void tick();
    window.addEventListener(TABLE_BILL_SYNC_REQUEST, onSyncRequest);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener(TABLE_BILL_SYNC_REQUEST, onSyncRequest);
    };
  }, [pathname, syncNow]);

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
