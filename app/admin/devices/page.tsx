"use client";

import { AdminRedirecting } from "../../../components/admin/AdminRedirecting";
import * as React from "react";

/**
 * Legacy /admin/devices — middleware redirects when cookie is set.
 * Client fallback resolves restaurant from /api/admin/me.
 */
export default function AdminDevicesRedirectPage() {
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/admin/me", { cache: "no-store", credentials: "same-origin" });
        const j = (await r.json()) as { ok?: boolean; activeRestaurantId?: string | null };
        if (cancelled) return;
        const rid = r.ok && j.ok ? (j.activeRestaurantId ?? "").trim() : "";
        window.location.replace(
          rid
            ? `/admin/restaurants/${encodeURIComponent(rid)}?tab=devices`
            : "/admin",
        );
      } catch {
        if (!cancelled) window.location.replace("/admin");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminRedirecting messageKey="admin.redirect.devices" />
  );
}
