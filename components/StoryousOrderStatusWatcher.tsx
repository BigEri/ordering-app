"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

import { isAdminMenuPreviewOnClient } from "../lib/admin/publicMenuPreviewUrl";
import {
  dropStoryousPendingOrderId,
  listStoryousPendingOrderIds,
} from "../lib/client/storyousKioskSession";
import { usePosTableFields } from "./DeviceTableProvider";
import { useLanguage } from "./LanguageProvider";

function isWatcherPath(pathname: string): boolean {
  if (pathname === "/" || pathname.startsWith("/admin") || pathname.startsWith("/pay")) return false;
  if (isAdminMenuPreviewOnClient()) return false;
  return true;
}

export function StoryousOrderStatusWatcher() {
  const pathname = usePathname() ?? "";
  const { t } = useLanguage();
  const { posTableFields, ready } = usePosTableFields();
  const [declined, setDeclined] = React.useState(false);

  React.useEffect(() => {
    if (!isWatcherPath(pathname) || !ready || declined) return;
    let cancelled = false;

    const tick = async () => {
      const ids = listStoryousPendingOrderIds();
      if (ids.length === 0) return;
      const fields = posTableFields();
      if (!fields.deviceId?.trim()) return;
      for (const orderId of ids) {
        if (cancelled) return;
        try {
          const r = await fetch("/api/pos/storyous-order-status", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...fields, orderId }),
            cache: "no-store",
          });
          const j = (await r.json()) as { ok?: boolean; state?: string | null };
          if (!r.ok || !j.ok) continue;
          const state = (j.state ?? "").toUpperCase();
          if (state === "DECLINED") {
            dropStoryousPendingOrderId(orderId);
            setDeclined(true);
            return;
          }
          if (state === "CONFIRMED" || state === "DISPATCHED") {
            dropStoryousPendingOrderId(orderId);
          }
        } catch {
          /* další tick */
        }
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [declined, pathname, posTableFields, ready]);

  if (!declined) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("pos.storyous.declinedTitle")}
      className="modalOverlay modalOverlay--60"
      onClick={() => setDeclined(false)}
    >
      <div className="modalCard" onClick={(e) => e.stopPropagation()}>
        <strong className="modalTitle">{t("pos.storyous.declinedTitle")}</strong>
        <p className="textMuted" style={{ margin: 0 }}>
          {t("pos.storyous.declined")}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="chip" onClick={() => setDeclined(false)} style={{ cursor: "pointer" }}>
            {t("menu.confirmed.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
