"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

import { isAdminMenuPreviewOnClient } from "../lib/admin/publicMenuPreviewUrl";
import { useMenuCart } from "./MenuCartProvider";
import { useOrders } from "./OrdersProvider";
import { usePosTableFields } from "./DeviceTableProvider";
import { useLanguage } from "./LanguageProvider";

const POLL_MS = 7000;

function formatCzk(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "";
  return `${Math.round(n)} Kč`;
}

export function PaidResetWatcher() {
  const pathname = usePathname() ?? "";
  const { t } = useLanguage();
  const { posTableFields } = usePosTableFields();
  const { orders, clearOrders } = useOrders();
  const { setCart } = useMenuCart();

  const [open, setOpen] = React.useState(false);
  const [paidTotal, setPaidTotal] = React.useState<number | null>(null);
  const handledRef = React.useRef(false);

  React.useEffect(() => {
    // Na welcome page / adminu nic nedělat.
    if (pathname === "/" || pathname.startsWith("/admin") || pathname === "/virtual-pos") return;
    if (isAdminMenuPreviewOnClient()) return;
    if (orders.length === 0) return;
    if (handledRef.current) return;

    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (cancelled || inFlight || handledRef.current) return;
      inFlight = true;
      try {
        const r = await fetch("/api/pos/payment-status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(posTableFields()),
          cache: "no-store",
        });
        const j = (await r.json()) as { ok?: boolean; configured?: boolean; paid?: boolean; totalCzk?: number | null };
        if (cancelled || !r.ok || !j.ok || j.configured === false) return;
        if (j.paid) {
          handledRef.current = true;
          setPaidTotal(typeof j.totalCzk === "number" ? j.totalCzk : null);
          setOpen(true);

          // Reset pro dalšího hosta.
          setCart(() => ({}));
          clearOrders();

          window.setTimeout(() => {
            window.location.href = "/";
          }, 4500);
        }
      } catch {
        /* ignore */
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pathname, orders.length, posTableFields, clearOrders, setCart]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("paid.modal.aria")}
      onClick={() => setOpen(false)}
      className="modalOverlay modalOverlay--60"
    >
      <div onClick={(e) => e.stopPropagation()} className="modalCard">
        <strong className="modalTitle">{t("paid.modal.title")}</strong>
        <p className="textMuted" style={{ margin: 0 }}>
          {paidTotal != null ? t("paid.modal.bodyWithTotal").replace("{{total}}", formatCzk(paidTotal)) : t("paid.modal.body")}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="chip" onClick={() => setOpen(false)} style={{ cursor: "pointer" }}>
            {t("paid.modal.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

