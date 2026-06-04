"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { publicMenuUrlFromAdmin } from "../../lib/admin/publicMenuPreviewUrl";
import { AdminNavLink } from "./AdminNavLink";
import { TableflowBrand } from "./TableflowBrand";
import type { AdminShellBootstrap } from "../../lib/server/adminShellBootstrap";
import { AdminShellProvider } from "./AdminShellContext";
import { useAdminRestaurantBootstrap } from "./useAdminRestaurantBootstrap";

type MeOk = AdminShellBootstrap["me"];

function labelFromMe(me: MeOk, map: Record<string, string>): string | null {
  const rid = me.activeRestaurantId;
  if (rid && map[rid]) return map[rid];
  if (me.activeRestaurantName) return me.activeRestaurantName;
  return rid ? null : null;
}

export function AdminShell({
  children,
  bootstrap,
}: {
  children: React.ReactNode;
  bootstrap: AdminShellBootstrap | null;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [me, setMe] = React.useState<MeOk | null>(bootstrap?.me ?? null);
  const [restaurantNameById, setRestaurantNameById] = React.useState<Record<string, string>>(
    () => bootstrap?.restaurantMap ?? {},
  );
  const [activeRestaurantLabel, setActiveRestaurantLabel] = React.useState<string | null>(
    () => bootstrap?.activeLabel ?? null,
  );
  const [clientReady, setClientReady] = React.useState(false);

  const isLogin = pathname === "/admin/login";

  useAdminRestaurantBootstrap(!isLogin);

  React.useEffect(() => {
    setClientReady(true);
  }, []);

  const refreshShell = React.useCallback(async () => {
    try {
      const [meR, rR] = await Promise.all([
        fetch("/api/admin/me", { cache: "no-store", credentials: "same-origin" }),
        fetch("/api/admin/restaurants", { cache: "no-store", credentials: "same-origin" }),
      ]);
      const meJ = (await meR.json()) as MeOk | { ok: false };
      const rJ = (await rR.json()) as { ok?: boolean; restaurants?: { id: string; name: string }[] };
      if (!meR.ok || !meJ.ok) return;
      setMe(meJ);
      setRestaurantNameById((prev) => {
        const next = { ...prev };
        if (rR.ok && rJ.ok && rJ.restaurants) {
          for (const x of rJ.restaurants) next[x.id] = x.name;
        }
        setActiveRestaurantLabel(labelFromMe(meJ, next));
        return next;
      });
    } catch {
      /* keep SSR / last good state */
    }
  }, []);

  React.useEffect(() => {
    if (isLogin || bootstrap) return;
    void refreshShell();
  }, [isLogin, bootstrap, refreshShell]);

  React.useEffect(() => {
    if (isLogin) return;
    const onRestaurantUpdated = () => void refreshShell();
    window.addEventListener("oa-restaurant-updated", onRestaurantUpdated);
    return () => window.removeEventListener("oa-restaurant-updated", onRestaurantUpdated);
  }, [isLogin, refreshShell]);

  const isSuper = me?.ok && me.session.globalRole === "SUPER_ADMIN";

  const breadcrumbItems = React.useMemo(() => {
    const items: { label: string; href?: string }[] = [{ label: "Admin", href: "/admin" }];
    if (pathname === "/admin" || pathname === "/admin/login") return items;

    if (pathname.startsWith("/admin/restaurants")) {
      items.push({ label: "Provozovny", href: "/admin/restaurants" });
      const m = /^\/admin\/restaurants\/([^/]+)/.exec(pathname);
      if (m?.[1]) {
        const id = m[1];
        const name = restaurantNameById[id];
        items.push({ label: name ?? "Detail", href: undefined });
      }
    } else if (pathname.startsWith("/admin/menu")) {
      items.push({ label: "Menu (úpravy)", href: "/admin/menu" });
      if (pathname.startsWith("/admin/menu/translations")) {
        items.push({ label: "Překlady", href: undefined });
      }
    } else if (pathname.startsWith("/admin/welcome")) {
      items.push({ label: "Úvodní stránka", href: undefined });
    } else if (pathname.startsWith("/admin/users")) {
      items.push({ label: "Uživatelé", href: undefined });
    } else if (pathname.startsWith("/admin/devices")) {
      items.push({ label: "Zařízení", href: undefined });
    }
    return items;
  }, [pathname, restaurantNameById]);

  React.useEffect(() => {
    if (!isSuper || isLogin) return;
    const m = /^\/admin\/restaurants\/([^/]+)\/?$/.exec(pathname);
    const id = m?.[1];
    if (!id) return;
    if (restaurantNameById[id]) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/admin/restaurants/${id}`, { cache: "no-store", credentials: "same-origin" });
        const j = (await r.json()) as { ok?: boolean; restaurant?: { name?: string } };
        if (cancelled || !j.ok || !j.restaurant?.name) return;
        setRestaurantNameById((prev) => ({ ...prev, [id]: j.restaurant!.name! }));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, isSuper, isLogin, restaurantNameById]);

  const onBack = () => {
    if (pathname === "/admin" || pathname === "/admin/login") {
      window.location.href = "/menu";
      return;
    }
    if (pathname.startsWith("/admin/restaurants/") && pathname !== "/admin/restaurants") {
      window.location.href = "/admin/restaurants";
      return;
    }
    if (window.history.length > 1) {
      router.back();
      return;
    }
    window.location.href = "/admin";
  };

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    window.location.href = "/kiosk/reset-mode";
  };

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <AdminShellProvider value={bootstrap}>
    <div className={`adminShell${clientReady ? " adminShell--ready" : ""}`}>
      <aside className="adminShell__aside" aria-label="Admin menu">
        <div className="adminShell__brand">
          <span className="adminShell__brandTitle">Admin</span>
          <span className="adminShell__brandSub">Správa vaší restaurace</span>
        </div>
        <nav className="adminShell__nav">
          <AdminNavLink href="/admin" label="Přehled" active={pathname === "/admin"} />
          {isSuper ? (
            <AdminNavLink href="/admin/restaurants" label="Provozovny" active={pathname.startsWith("/admin/restaurants")} />
          ) : null}
          <AdminNavLink
            href="/admin/menu"
            label="Menu (úpravy)"
            active={pathname.startsWith("/admin/menu") && !pathname.startsWith("/admin/menu/translations")}
          />
          <AdminNavLink href="/admin/menu/translations" label="Překlady menu" active={pathname.startsWith("/admin/menu/translations")} />
          <AdminNavLink href="/admin/welcome" label="Úvodní stránka" active={pathname.startsWith("/admin/welcome")} />
          <AdminNavLink href="/admin/users" label="Uživatelé" active={pathname.startsWith("/admin/users")} />
          <AdminNavLink href="/admin/devices" label="Zařízení" active={pathname.startsWith("/admin/devices")} />
          <a className="adminNavLink" href={publicMenuUrlFromAdmin()} style={{ textDecoration: "none" }}>
            Veřejné menu ↗
          </a>
        </nav>
        <div className="adminShell__asideFoot">
          {me?.ok ? (
            <p className="adminShell__user" title={me.session.email}>
              {me.session.email}
              <span className="adminShell__role">{me.session.globalRole === "SUPER_ADMIN" ? "SUPER" : ""}</span>
            </p>
          ) : (
            <p className="textMuted2" style={{ margin: 0, fontSize: 12 }}>
              Načítání…
            </p>
          )}
          <button type="button" className="chip adminShell__logout" onClick={() => void onLogout()}>
            Odhlásit
          </button>
        </div>
        <TableflowBrand className="adminShell__tableflow" />
      </aside>

      <div className="adminShell__main">
        <header className="adminShell__top">
          <div className="adminShell__topRow">
            <button type="button" className="chip adminShell__back" onClick={onBack} aria-label="Zpět">
              ← Zpět
            </button>
            <div className="adminShell__activePill" title="Vaše restaurace (kontext pro uživatele a zařízení)">
              {activeRestaurantLabel ? (
                <>
                  <span className="textMuted2">Vaše restaurace:</span> <strong>{activeRestaurantLabel}</strong>
                </>
              ) : (
                <span className="textMuted2">Dokončete nastavení v Přehledu</span>
              )}
            </div>
          </div>
          <nav className="adminBreadcrumb" aria-label="Drobečková navigace">
            {breadcrumbItems.map((b, i) => (
              <React.Fragment key={`${b.label}-${i}`}>
                {i > 0 ? <span className="adminBreadcrumb__sep">/</span> : null}
                {b.href ? (
                  <a href={b.href} className="adminBreadcrumb__link">
                    {b.label}
                  </a>
                ) : (
                  <span className="adminBreadcrumb__current">{b.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        </header>
        <div className="adminShell__content">{children}</div>
      </div>
    </div>
    </AdminShellProvider>
  );
}
