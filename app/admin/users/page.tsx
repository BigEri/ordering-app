"use client";

import * as React from "react";

/**
 * Legacy /admin/users — middleware redirects when cookie is set.
 * Client fallback resolves restaurant from /api/admin/me.
 */
export default function AdminUsersRedirectPage() {
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
            ? `/admin/restaurants/${encodeURIComponent(rid)}?tab=users`
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
    <main className="adminPage">
      <p className="textMuted">Přesměrování na uživatele provozovny…</p>
    </main>
  );
}
