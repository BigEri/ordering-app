"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function PairKioskRedirectInner() {
  const searchParams = useSearchParams();

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const qs = searchParams?.toString() ?? "";
      try {
        const r = await fetch("/api/admin/me", { cache: "no-store", credentials: "same-origin" });
        const j = (await r.json()) as { ok?: boolean; activeRestaurantId?: string | null };
        if (cancelled) return;
        const rid = r.ok && j.ok ? (j.activeRestaurantId ?? "").trim() : "";
        if (!rid) {
          window.location.replace("/admin");
          return;
        }
        const base = `/admin/restaurants/${encodeURIComponent(rid)}/devices/pair`;
        window.location.replace(qs ? `${base}?${qs}` : base);
      } catch {
        if (!cancelled) window.location.replace("/admin");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <main className="adminPage">
      <p className="textMuted">Přesměrování na párování kiosku…</p>
    </main>
  );
}

export default function AdminPairKioskRedirectPage() {
  return (
    <Suspense
      fallback={
        <main className="adminPage">
          <p className="textMuted">Přesměrování…</p>
        </main>
      }
    >
      <PairKioskRedirectInner />
    </Suspense>
  );
}
