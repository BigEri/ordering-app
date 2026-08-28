"use client";

import { AdminRedirecting } from "../../../../components/admin/AdminRedirecting";
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
    <AdminRedirecting messageKey="admin.redirect.pairKiosk" />
  );
}

export default function AdminPairKioskRedirectPage() {
  return (
    <Suspense
      fallback={<AdminRedirecting messageKey="admin.overview.redirecting" />}
    >
      <PairKioskRedirectInner />
    </Suspense>
  );
}
