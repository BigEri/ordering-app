"use client";

import * as React from "react";

import { useAdminLanguage } from "../../components/admin/AdminLanguageProvider";
import { useAdminShellBootstrap } from "../../components/admin/AdminShellContext";

type MeResponse =
  | {
      ok: true;
      session: { globalRole: "SUPER_ADMIN" | "USER" };
      activeRestaurantId: string | null;
      memberships: { restaurantId: string; role: string }[];
    }
  | { ok: false; error: string };

/**
 * `/admin` is no longer a second dashboard — redirect into the right home:
 * - SUPER → seznam provozoven
 * - vedoucí → workspace své provozovny
 */
export default function AdminHomeRedirectPage() {
  const bootstrap = useAdminShellBootstrap();
  const { t } = useAdminLanguage();
  const [msg, setMsg] = React.useState(() => t("admin.shell.loading"));

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let me: MeResponse | null = bootstrap?.me
          ? (bootstrap.me as MeResponse)
          : null;
        if (!me) {
          const r = await fetch("/api/admin/me", { cache: "no-store", credentials: "same-origin" });
          me = (await r.json()) as MeResponse;
        }
        if (cancelled) return;
        if (!me.ok) {
          window.location.replace("/admin/login");
          return;
        }
        if (me.session.globalRole === "SUPER_ADMIN") {
          window.location.replace("/admin/restaurants");
          return;
        }
        const rid =
          me.activeRestaurantId?.trim() ||
          me.memberships[0]?.restaurantId?.trim() ||
          "";
        if (rid) {
          window.location.replace(`/admin/restaurants/${encodeURIComponent(rid)}/menu`);
          return;
        }
        setMsg(t("admin.shell.noRestaurant"));
      } catch {
        if (!cancelled) setMsg(t("admin.shell.loadAccountFailed"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrap, t]);

  return (
    <main className="adminPage">
      <p className="textMuted">{msg}</p>
    </main>
  );
}
