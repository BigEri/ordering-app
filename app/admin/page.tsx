"use client";

import * as React from "react";

import { AdminChipLink } from "../../components/admin/AdminNavLink";
import { useAdminShellBootstrap } from "../../components/admin/AdminShellContext";
import { postSelectActiveRestaurant } from "../../lib/admin/clientRestaurantSelect";
import { tStaff } from "../../lib/i18n/tStaff";

type MeResponse =
  | {
      ok: true;
      session: { userId: string; email: string; globalRole: "SUPER_ADMIN" | "USER" };
      activeRestaurantId: string | null;
      activeRestaurantName: string | null;
      memberships: { restaurantId: string; role: string }[];
    }
  | { ok: false; error: string };

type RestaurantsResponse =
  | { ok: true; restaurants: { id: string; name: string }[] }
  | { ok: false; error: string };

type DotykackaIntegrationStatus = {
  syncConfigured: boolean;
  hint: string | null;
};

export default function AdminHomePage() {
  const shellBootstrap = useAdminShellBootstrap();
  const [me, setMe] = React.useState<MeResponse | null>(() =>
    shellBootstrap?.me ? (shellBootstrap.me as MeResponse) : null,
  );
  const [restaurants, setRestaurants] = React.useState<RestaurantsResponse | null>(() =>
    shellBootstrap ? { ok: true, restaurants: shellBootstrap.restaurants } : null,
  );
  const [selecting, setSelecting] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [savingName, setSavingName] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [dotykackaStatus, setDotykackaStatus] = React.useState<DotykackaIntegrationStatus | null>(null);
  const [dotykackaLoading, setDotykackaLoading] = React.useState(false);

  const loadDotykackaStatus = React.useCallback(async (restaurantId: string | null | undefined) => {
    const rid = restaurantId?.trim() ?? "";
    if (!rid) {
      setDotykackaStatus(null);
      return;
    }
    setDotykackaLoading(true);
    try {
      const r = await fetch(`/api/admin/integrations-status?restaurantId=${encodeURIComponent(rid)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const j = (await r.json()) as { ok?: boolean; dotykacka?: DotykackaIntegrationStatus };
      if (r.ok && j.ok !== false && j.dotykacka) {
        setDotykackaStatus(j.dotykacka);
      } else {
        setDotykackaStatus(null);
      }
    } catch {
      setDotykackaStatus(null);
    } finally {
      setDotykackaLoading(false);
    }
  }, []);

  const load = React.useCallback(async (opts?: { background?: boolean }) => {
    if (!opts?.background) {
      setErr(null);
      setRefreshing(true);
    }
    try {
      const [meR, rR] = await Promise.all([
        fetch("/api/admin/me", { cache: "no-store", credentials: "same-origin" }),
        fetch("/api/admin/restaurants", { cache: "no-store", credentials: "same-origin" }),
      ]);
      const meJ = (await meR.json()) as MeResponse;
      const rJ = (await rR.json()) as RestaurantsResponse;
      setMe(meJ);
      setRestaurants(rJ);
      if (!meR.ok || (meJ as { ok?: boolean }).ok !== true) {
        setErr("Nepodařilo se načíst váš profil (možná vypršelo přihlášení).");
      }
      if (!rR.ok || (rJ as { ok?: boolean }).ok !== true) {
        setErr("Nepodařilo se načíst údaje o vaší restauraci.");
      }
    } catch {
      setErr("Nepodařilo se načíst data (zřejmě výpadek připojení). Zkuste to prosím znovu.");
    } finally {
      if (!opts?.background) setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    if (shellBootstrap) return;
    void load();
  }, [load, shellBootstrap]);

  const activeId = me && me.ok ? me.activeRestaurantId : null;
  const activeName =
    restaurants && restaurants.ok && activeId ? restaurants.restaurants.find((r) => r.id === activeId)?.name ?? null : null;

  const canManageDotykacka =
    me &&
    me.ok &&
    activeId &&
    (me.session.globalRole === "SUPER_ADMIN" ||
      me.memberships.some((m) => m.restaurantId === activeId && m.role === "RESTAURANT_ADMIN"));

  React.useEffect(() => {
    if (!canManageDotykacka || !activeId) {
      setDotykackaStatus(null);
      return;
    }
    void loadDotykackaStatus(activeId);
  }, [activeId, canManageDotykacka, loadDotykackaStatus]);

  React.useEffect(() => {
    if (activeName) setEditName(activeName);
    else if (me && me.ok && me.activeRestaurantName) setEditName(me.activeRestaurantName);
  }, [activeName, me]);

  const canRenameRestaurant =
    me &&
    me.ok &&
    me.activeRestaurantId &&
    (me.session.globalRole === "SUPER_ADMIN" ||
      me.memberships.some((m) => m.restaurantId === me.activeRestaurantId && m.role === "RESTAURANT_ADMIN"));

  const onSaveRestaurantName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me?.ok || !me.activeRestaurantId) return;
    const name = editName.trim();
    if (!name || name.length > 200) {
      setErr("Zadejte platný název (1–200 znaků).");
      return;
    }
    setSavingName(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/restaurants/${me.activeRestaurantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setErr(j.error ?? "Název se nepodařilo uložit. Zkuste to prosím znovu.");
        return;
      }
      await load();
      window.dispatchEvent(new Event("oa-restaurant-updated"));
    } catch {
      setErr("Název se nepodařilo uložit (zřejmě výpadek připojení). Zkuste to prosím znovu.");
    } finally {
      setSavingName(false);
    }
  };

  const onSelect = async (restaurantId: string) => {
    setSelecting(restaurantId);
    setErr(null);
    try {
      const sel = await postSelectActiveRestaurant(restaurantId);
      if (!sel.ok) {
        setErr(sel.error ?? "Restauraci se nepodařilo vybrat. Zkuste to prosím znovu.");
        return;
      }
      await load();
      window.dispatchEvent(new Event("oa-restaurant-updated"));
    } catch {
      setErr("Restauraci se nepodařilo vybrat (zřejmě výpadek připojení). Zkuste to prosím znovu.");
    } finally {
      setSelecting(null);
    }
  };

  return (
    <main className="adminPage">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: "1.5rem" }}>Admin</h1>
          {me && me.ok ? (
            <p className="textMuted2" style={{ margin: 0, fontSize: 13 }}>
              Přihlášen: <strong>{me.session.email}</strong> · {me.session.globalRole === "SUPER_ADMIN" ? "SUPER ADMIN" : "uživatel"}
            </p>
          ) : (
            <p className="textMuted2" style={{ margin: 0, fontSize: 13 }}>
              Načítání…
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="chip"
            disabled={refreshing}
            onClick={() => void load()}
            style={{ cursor: refreshing ? "wait" : "pointer" }}
          >
            {refreshing ? "…" : "Obnovit"}
          </button>
        </div>
      </div>

      {err ? (
        <p role="alert" style={{ marginTop: 12, color: "#fecaca" }}>
          {err}
        </p>
      ) : null}

      {canRenameRestaurant ? (
        <section
          style={{
            marginTop: 18,
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 16,
            background: "var(--panel)",
          }}
        >
          <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>Název pro zákazníky</h2>
          <p className="textMuted2" style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5 }}>
            Zobrazuje se na úvodní stránce, v menu a v záhlaví aplikace.
          </p>
          <form onSubmit={(e) => void onSaveRestaurantName(e)} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
            <label style={{ display: "grid", gap: 6, flex: "1 1 220px" }}>
              <span>Název restaurace</span>
              <input
                className="chip"
                style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", color: "var(--text)" }}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoComplete="organization"
                maxLength={200}
              />
            </label>
            <button type="submit" className="btnPrimary" disabled={savingName} style={{ cursor: "pointer" }}>
              {savingName ? "…" : "Uložit název"}
            </button>
          </form>
        </section>
      ) : null}

      <section
        style={{
          marginTop: 18,
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 16,
          background: "var(--panel)",
        }}
      >
        <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>Vaše restaurace</h2>
        <p className="textMuted" style={{ margin: "0 0 12px" }}>
          {activeName ? (
            <>
              Právě upravujete: <strong>{activeName}</strong>
            </>
          ) : (
            <>Zatím není nastavená vaše restaurace. Obnovte stránku nebo se přihlaste znovu.</>
          )}
        </p>

        {restaurants && restaurants.ok ? (
          <div style={{ display: "grid", gap: 8 }}>
            {restaurants.restaurants.map((r) => {
              const active = r.id === activeId;
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`chip${active ? " chipActive" : ""}`}
                  onClick={() => void onSelect(r.id)}
                  disabled={selecting === r.id}
                  style={{ cursor: "pointer", justifyContent: "space-between", display: "flex", padding: "10px 12px" }}
                >
                  <span>{r.name}</span>
                  <span className="textMuted2" style={{ fontSize: 12 }}>
                    {active ? "aktivní" : selecting === r.id ? "…" : "vybrat"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : !shellBootstrap ? (
          <p className="textMuted">Načítání…</p>
        ) : null}
      </section>

      <section style={{ marginTop: 18, display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Správa</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {me && me.ok && me.session.globalRole === "SUPER_ADMIN" ? (
            <AdminChipLink href="/admin/restaurants">Restaurace (superadmin)</AdminChipLink>
          ) : null}
          <AdminChipLink href="/admin/menu">Menu (úpravy)</AdminChipLink>
          <AdminChipLink href="/admin/welcome">Úvodní stránka</AdminChipLink>
          <AdminChipLink href="/admin/devices">Zařízení</AdminChipLink>
          <AdminChipLink href="/admin/users">Uživatelé</AdminChipLink>
          <AdminChipLink href="/admin/account">Můj účet</AdminChipLink>
        </div>
        {me && me.ok && me.session.globalRole === "SUPER_ADMIN" ? (
          <p className="textMuted2" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            Tip: jako SUPER_ADMIN můžete přepínat mezi restauracemi v seznamu výše.
          </p>
        ) : null}
      </section>

      {canManageDotykacka && activeId ? (
        <section
          style={{
            marginTop: 18,
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 16,
            background: "var(--panel)",
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>Dotykačka (cloud)</h2>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 14,
              lineHeight: 1.5,
              color: dotykackaLoading
                ? "var(--muted2)"
                : dotykackaStatus?.syncConfigured
                  ? "var(--success)"
                  : "#fcd34d",
            }}
          >
            {dotykackaLoading
              ? "Načítám stav Dotykačky…"
              : dotykackaStatus?.syncConfigured
                ? tStaff("admin.devices.healthDotykackaYes")
                : tStaff("admin.devices.healthDotykackaNo")}
          </p>
          {dotykackaStatus?.syncConfigured === false && dotykackaStatus.hint ? (
            <p className="textMuted2" style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.55 }}>
              {dotykackaStatus.hint}
            </p>
          ) : null}
          <p className="textMuted2" style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.55 }}>
            {dotykackaStatus?.syncConfigured
              ? "Propojení funguje. OAuth znovu spusťte jen když vypadne přihlášení do Dotypos cloudu."
              : "Dokončete propojení přes OAuth a v nastavení vyberte pobočku a mapu produktů."}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <a
              className={dotykackaStatus?.syncConfigured ? "chip" : "btnPrimary"}
              style={{
                textDecoration: "none",
                display: "inline-block",
                padding: dotykackaStatus?.syncConfigured ? undefined : "8px 14px",
                borderRadius: dotykackaStatus?.syncConfigured ? undefined : 10,
              }}
              href={`/api/integrations/dotykacka/connect?restaurantId=${encodeURIComponent(activeId)}`}
            >
              {dotykackaStatus?.syncConfigured ? "Znovu propojit Dotykačku (OAuth)" : "Připojit Dotykačku (OAuth)"}
            </a>
            <AdminChipLink href={`/admin/restaurants/${encodeURIComponent(activeId)}?tab=dotykacka`}>
              Nastavení Dotykačky (pobočka + mapa) →
            </AdminChipLink>
          </div>
        </section>
      ) : me && me.ok && !activeId ? (
        <section style={{ marginTop: 18 }}>
          <p className="textMuted2" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>
            Pro připojení Dotykačky nejdřív dokončete nastavení v Přehledu výše.
          </p>
        </section>
      ) : null}
    </main>
  );
}

