"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { postSelectActiveRestaurant } from "../../lib/admin/clientRestaurantSelect";
import { publicMenuUrlFromAdmin } from "../../lib/admin/publicMenuPreviewUrl";
import type { AdminShellBootstrap } from "../../lib/server/adminShellBootstrap";
import { AdminNavLink } from "./AdminNavLink";
import { AdminShellProvider } from "./AdminShellContext";
import {
  RESTAURANT_WORKSPACE_NAV,
  resolveRestaurantWorkspaceSection,
  restaurantWorkspaceHref,
  swapRestaurantIdInPath,
  workspaceNavForRole,
} from "./restaurantWorkspaceNav";
import { AdminLanguageMenu } from "./AdminLanguageMenu";
import { useAdminLanguage } from "./AdminLanguageProvider";
import { TableflowBrand } from "./TableflowBrand";
import { useAdminRestaurantBootstrap } from "./useAdminRestaurantBootstrap";

type MeOk = AdminShellBootstrap["me"];

function labelFromMe(me: MeOk, map: Record<string, string>): string | null {
  const rid = me.activeRestaurantId;
  if (rid && map[rid]) return map[rid];
  if (me.activeRestaurantName) return me.activeRestaurantName;
  return null;
}

function workspaceIdFromPath(pathname: string): string | null {
  const m = /^\/admin\/restaurants\/([^/]+)/.exec(pathname);
  return m?.[1] ?? null;
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
  const searchParams = useSearchParams();
  const { t } = useAdminLanguage();
  const [me, setMe] = React.useState<MeOk | null>(bootstrap?.me ?? null);
  const [restaurants, setRestaurants] = React.useState<{ id: string; name: string }[]>(
    () => bootstrap?.restaurants ?? [],
  );
  const [restaurantNameById, setRestaurantNameById] = React.useState<Record<string, string>>(
    () => bootstrap?.restaurantMap ?? {},
  );
  const [activeRestaurantLabel, setActiveRestaurantLabel] = React.useState<string | null>(
    () => bootstrap?.activeLabel ?? null,
  );
  const [clientReady, setClientReady] = React.useState(false);
  const [logoutLoading, setLogoutLoading] = React.useState(false);
  const [switching, setSwitching] = React.useState(false);

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
      const list = rR.ok && rJ.ok && rJ.restaurants ? rJ.restaurants : [];
      setRestaurants(list);
      setRestaurantNameById((prev) => {
        const next = { ...prev };
        for (const x of list) next[x.id] = x.name;
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

  const isSuper = Boolean(me?.ok && me.session.globalRole === "SUPER_ADMIN");
  const workspaceRid = workspaceIdFromPath(pathname);
  const inWorkspace = Boolean(workspaceRid);
  const onRestaurantList = pathname === "/admin/restaurants" || pathname === "/admin/restaurants/";
  const onSuperAccounts = pathname.startsWith("/admin/super-accounts");
  /** Superadmin platform: restaurant list or SUPER accounts (not inside a venue workspace). */
  const showPlatformNav = isSuper && !inWorkspace;
  const navRestaurantId =
    workspaceRid ?? (me?.ok && !isSuper ? me.activeRestaurantId : null);

  React.useEffect(() => {
    if (isLogin) return;
    const id = workspaceRid;
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
  }, [pathname, isLogin, restaurantNameById, workspaceRid]);

  const workspaceName = workspaceRid
    ? restaurantNameById[workspaceRid] ?? activeRestaurantLabel
    : activeRestaurantLabel;

  const section = React.useMemo(
    () => resolveRestaurantWorkspaceSection(pathname, searchParams.get("tab")),
    [pathname, searchParams],
  );

  const breadcrumbItems = React.useMemo(() => {
    const items: { label: string; href?: string }[] = [];
    if (showPlatformNav || onRestaurantList) {
      items.push({ label: t("admin.nav.restaurants"), href: "/admin/restaurants" });
      return items;
    }
    if (inWorkspace && workspaceRid) {
      if (isSuper) {
        items.push({ label: t("admin.nav.restaurants"), href: "/admin/restaurants" });
      }
      items.push({
        label: workspaceName ?? t("admin.nav.breadcrumbVenueFallback"),
        href: restaurantWorkspaceHref(workspaceRid, "overview"),
      });
      if (section !== "overview") {
        const navItem = RESTAURANT_WORKSPACE_NAV.find((x) => x.id === section);
        const label = navItem ? t(navItem.labelKey) : section;
        items.push({ label, href: undefined });
        if (pathname.includes("/menu/translations")) {
          items.push({ label: t("admin.nav.breadcrumbTranslations"), href: undefined });
        }
      }
      return items;
    }
    items.push({ label: t("admin.nav.breadcrumbAdmin"), href: "/admin" });
    return items;
  }, [
    showPlatformNav,
    onRestaurantList,
    inWorkspace,
    workspaceRid,
    isSuper,
    workspaceName,
    section,
    pathname,
    t,
  ]);

  const onBack = () => {
    if (pathname === "/admin/login") {
      window.location.href = "/";
      return;
    }
    if (inWorkspace && isSuper) {
      window.location.href = "/admin/restaurants";
      return;
    }
    if (pathname.includes("/menu/translations") && workspaceRid) {
      window.location.href = `/admin/restaurants/${encodeURIComponent(workspaceRid)}/menu`;
      return;
    }
    if (pathname.includes("/menu") && workspaceRid) {
      if (isSuper) {
        window.location.href = restaurantWorkspaceHref(workspaceRid, "overview");
      } else if (window.history.length > 1) {
        router.back();
      }
      return;
    }
    if (window.history.length > 1) {
      router.back();
      return;
    }
    window.location.href = isSuper ? "/admin/restaurants" : "/admin";
  };

  const onLogout = async () => {
    setLogoutLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* ignore */
    }
    window.location.href = "/admin/login";
  };

  const onSwitchRestaurant = async (nextId: string) => {
    if (!workspaceRid || nextId === workspaceRid || switching) return;
    setSwitching(true);
    try {
      const sel = await postSelectActiveRestaurant(nextId);
      if (!sel.ok) return;
      const q = typeof window !== "undefined" ? window.location.search : "";
      window.location.href = swapRestaurantIdInPath(pathname, q, workspaceRid, nextId);
    } finally {
      setSwitching(false);
    }
  };

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <AdminShellProvider value={bootstrap}>
      <div className={`adminShell${clientReady ? " adminShell--ready" : ""}`}>
        <aside className="adminShell__aside" aria-label={t("admin.nav.asideAria")}>
          <div className="adminShell__brand">
            <div className="adminShell__brandRow">
              <span className="adminShell__brandTitle">{t("admin.nav.brandTitle")}</span>
              <AdminLanguageMenu />
            </div>
            <span className="adminShell__brandSub">
              {inWorkspace && workspaceName
                ? workspaceName
                : onSuperAccounts
                  ? t("admin.nav.brandSubSuper")
                  : showPlatformNav
                    ? t("admin.nav.brandSubAll")
                    : t("admin.nav.brandSubManage")}
            </span>
          </div>
          <nav className="adminShell__nav">
            {showPlatformNav ? (
              <>
                <AdminNavLink
                  href="/admin/restaurants"
                  label={t("admin.nav.restaurants")}
                  active={onRestaurantList || pathname === "/admin"}
                />
                <AdminNavLink
                  href="/admin/super-accounts"
                  label={t("admin.nav.superAccounts")}
                  active={pathname.startsWith("/admin/super-accounts")}
                />
              </>
            ) : null}

            {isSuper && inWorkspace ? (
              <AdminNavLink
                href="/admin/super-accounts"
                label={t("admin.nav.superAccounts")}
                active={pathname.startsWith("/admin/super-accounts")}
              />
            ) : null}

            {navRestaurantId ? (
              <>
                {workspaceNavForRole(isSuper).map((item) => {
                  const href = restaurantWorkspaceHref(navRestaurantId, item.id);
                  const active =
                    inWorkspace &&
                    workspaceRid === navRestaurantId &&
                    section === item.id;
                  return (
                    <AdminNavLink key={item.id} href={href} label={t(item.labelKey)} active={active} />
                  );
                })}
                <a
                  className="adminNavLink"
                  href={publicMenuUrlFromAdmin({ rid: navRestaurantId })}
                  style={{ textDecoration: "none" }}
                >
                  {t("admin.nav.publicMenu")}
                </a>
              </>
            ) : null}

            {!showPlatformNav && !navRestaurantId ? (
              <p className="textMuted2" style={{ margin: "8px 12px", fontSize: 12 }}>
                {t("admin.nav.loadingRestaurant")}
              </p>
            ) : null}
          </nav>
          <div className="adminShell__asideFoot">
            {me?.ok ? (
              <p className="adminShell__user" title={me.session.email}>
                {me.session.email}
                <span className="adminShell__role">
                  {me.session.globalRole === "SUPER_ADMIN" ? t("admin.nav.roleSuper") : ""}
                </span>
              </p>
            ) : (
              <p className="textMuted2" style={{ margin: 0, fontSize: 12 }}>
                {t("admin.nav.loading")}
              </p>
            )}
            <a href="/admin/account" className="adminNavLink" style={{ textDecoration: "none", fontSize: 13 }}>
              {t("admin.nav.myAccount")}
            </a>
            <button
              type="button"
              className="chip adminShell__logout"
              disabled={logoutLoading}
              onClick={() => void onLogout()}
              style={{ cursor: logoutLoading ? "wait" : "pointer" }}
            >
              {logoutLoading ? "…" : t("admin.nav.logout")}
            </button>
          </div>
          <TableflowBrand className="adminShell__tableflow" />
        </aside>

        <div className="adminShell__main">
          <header className="adminShell__top">
            <div className="adminShell__topRow">
              <button type="button" className="chip adminShell__back" onClick={onBack} aria-label={t("admin.nav.backAria")}>
                {inWorkspace && isSuper ? t("admin.nav.backRestaurants") : t("admin.nav.back")}
              </button>
              <div className="adminShell__activePill" title={t("admin.nav.activePillTitle")}>
                {inWorkspace && isSuper && restaurants.length > 0 ? (
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span className="textMuted2">{t("admin.nav.restaurantLabel")}</span>
                    <select
                      className="chip"
                      value={workspaceRid ?? ""}
                      disabled={switching}
                      onChange={(e) => void onSwitchRestaurant(e.target.value)}
                      style={{ cursor: switching ? "wait" : "pointer", maxWidth: "min(280px, 70vw)" }}
                    >
                      {restaurants.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : workspaceName ? (
                  <>
                    <span className="textMuted2">{t("admin.nav.restaurantLabel")}</span> <strong>{workspaceName}</strong>
                  </>
                ) : showPlatformNav ? (
                  <span className="textMuted2">{t("admin.nav.pickRestaurant")}</span>
                ) : (
                  <span className="textMuted2">{t("admin.nav.loading")}</span>
                )}
              </div>
            </div>
            <nav className="adminBreadcrumb" aria-label={t("admin.nav.breadcrumbAria")}>
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
