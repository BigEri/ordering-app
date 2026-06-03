"use client";

import * as React from "react";

import { AdminChipLink } from "../../../components/admin/AdminNavLink";
import { postSelectActiveRestaurant } from "../../../lib/admin/clientRestaurantSelect";
import type { RestaurantOverviewItem } from "../../../lib/server/restaurantOverview";

type MeResponse =
  | {
      ok: true;
      session: { userId: string; email: string; globalRole: "SUPER_ADMIN" | "USER" };
      activeRestaurantId: string | null;
    }
  | { ok: false; error: string };

type OverviewResponse =
  | {
      ok: true;
      ts: string;
      summary: {
        total: number;
        operationalReady: number;
        incomplete: number;
        fullyOnboarded: number;
      };
      restaurants: RestaurantOverviewItem[];
    }
  | { ok: false; error: string };

type ListFilter = "all" | "incomplete" | "ready";

function OnboardingChecklist({ item }: { item: RestaurantOverviewItem }) {
  const steps: { key: keyof RestaurantOverviewItem["onboarding"]; label: string }[] = [
    { key: "dotykacka", label: "Dotykačka + mapa" },
    { key: "device", label: "Tablet spárovaný" },
    { key: "welcome", label: "Úvodní stránka" },
    { key: "menuPhoto", label: "Fotka v menu" },
  ];
  return (
    <ul className="adminOnboardingChecklist" aria-label="Kroky nastavení provozovny">
      {steps.map((s) => {
        const done = item.onboarding[s.key];
        return (
          <li key={s.key} className={done ? "adminOnboardingChecklist__item--done" : undefined}>
            <span className="adminOnboardingChecklist__mark" aria-hidden="true">
              {done ? "✓" : "○"}
            </span>
            <span>{s.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

function StatusBadge({ item }: { item: RestaurantOverviewItem }) {
  if (item.fullyOnboarded) {
    return <span className="adminRestaurantStatus adminRestaurantStatus--ok">Kompletní</span>;
  }
  if (item.operationalReady) {
    return <span className="adminRestaurantStatus adminRestaurantStatus--ready">Provozuschopná</span>;
  }
  return <span className="adminRestaurantStatus adminRestaurantStatus--warn">Doplňte nastavení</span>;
}

export function RestaurantsDashboard() {
  const [me, setMe] = React.useState<MeResponse | null>(null);
  const [overview, setOverview] = React.useState<OverviewResponse | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [selecting, setSelecting] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [filterQ, setFilterQ] = React.useState("");
  const [listFilter, setListFilter] = React.useState<ListFilter>("all");

  const [restaurantName, setRestaurantName] = React.useState("");
  const [managerEmail, setManagerEmail] = React.useState("");
  const [managerPassword, setManagerPassword] = React.useState("");

  const load = React.useCallback(async () => {
    setErr(null);
    try {
      const [meR, oR] = await Promise.all([
        fetch("/api/admin/me", { cache: "no-store", credentials: "same-origin" }),
        fetch("/api/admin/restaurants/overview", { cache: "no-store", credentials: "same-origin" }),
      ]);
      const meJ = (await meR.json()) as MeResponse;
      const oJ = (await oR.json()) as OverviewResponse;
      setMe(meJ);
      setOverview(oJ);
      if (!meR.ok || !meJ.ok) setErr("Nepodařilo se načíst váš profil.");
      if (!oR.ok || !oJ.ok) {
        const errMsg = "error" in oJ && oJ.error ? oJ.error : "Nepodařilo se načíst přehled provozoven.";
        setErr(errMsg);
      }
    } catch {
      setErr("Nepodařilo se načíst data (zřejmě výpadek připojení). Zkuste to prosím znovu.");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onOpen = async (restaurantId: string, next = "/admin") => {
    setSelecting(restaurantId);
    setErr(null);
    try {
      const sel = await postSelectActiveRestaurant(restaurantId);
      if (!sel.ok) {
        setErr(sel.error ?? "Restauraci se nepodařilo vybrat. Zkuste to prosím znovu.");
        return;
      }
      window.dispatchEvent(new Event("oa-restaurant-updated"));
      window.location.href = next;
    } catch {
      setErr("Restauraci se nepodařilo vybrat (zřejmě výpadek připojení). Zkuste to prosím znovu.");
    } finally {
      setSelecting(null);
    }
  };

  const forbidden = me && me.ok && me.session.globalRole !== "SUPER_ADMIN";

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setCreating(true);
    try {
      const r = await fetch("/api/admin/restaurants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          restaurantName,
          managerEmail,
          managerPassword,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string; restaurantId?: string };
      if (!r.ok || !j.ok || !j.restaurantId) {
        setErr(j.error ?? "Restauraci se nepodařilo vytvořit. Zkuste to prosím znovu.");
        return;
      }
      setRestaurantName("");
      setManagerEmail("");
      setManagerPassword("");
      await load();
      window.location.href = `/admin/restaurants/${j.restaurantId}`;
    } catch {
      setErr("Restauraci se nepodařilo vytvořit (zřejmě výpadek připojení). Zkuste to prosím znovu.");
    } finally {
      setCreating(false);
    }
  };

  const activeId = me && me.ok ? me.activeRestaurantId : null;
  const allRows = overview && overview.ok ? overview.restaurants : [];
  const summary = overview && overview.ok ? overview.summary : null;
  const q = filterQ.trim().toLowerCase();

  const filtered = allRows.filter((r) => {
    if (listFilter === "incomplete" && r.operationalReady) return false;
    if (listFilter === "ready" && !r.operationalReady) return false;
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
  });

  return (
    <main className="adminPage">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: "1.5rem" }}>Dashboard provozoven</h1>
          <p className="textMuted2" style={{ margin: 0, fontSize: 13, maxWidth: 720, lineHeight: 1.5 }}>
            Přehled všech restaurací: stav Dotykačky, tablety a checklist nastavení. Rychlé akce nastaví aktivní provozovnu a
            otevřou příslušnou sekci administrace.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="chip" onClick={() => void load()} style={{ cursor: "pointer" }}>
            Obnovit
          </button>
        </div>
      </div>

      {forbidden ? (
        <p role="alert" style={{ marginTop: 12, color: "#fecaca" }}>
          Tato stránka je jen pro SUPER_ADMIN.
        </p>
      ) : null}

      {err ? (
        <p role="alert" style={{ marginTop: 12, color: "#fecaca" }}>
          {err}
        </p>
      ) : null}

      {summary ? (
        <div className="adminRestaurantsStats" role="group" aria-label="Souhrn provozoven">
          <div className="adminRestaurantsStat">
            <span className="adminRestaurantsStat__value">{summary.total}</span>
            <span className="adminRestaurantsStat__label">Celkem</span>
          </div>
          <div className="adminRestaurantsStat adminRestaurantsStat--ok">
            <span className="adminRestaurantsStat__value">{summary.operationalReady}</span>
            <span className="adminRestaurantsStat__label">Provozuschopné</span>
          </div>
          <div className="adminRestaurantsStat adminRestaurantsStat--warn">
            <span className="adminRestaurantsStat__value">{summary.incomplete}</span>
            <span className="adminRestaurantsStat__label">K doplnění</span>
          </div>
          <div className="adminRestaurantsStat">
            <span className="adminRestaurantsStat__value">{summary.fullyOnboarded}</span>
            <span className="adminRestaurantsStat__label">Kompletní setup</span>
          </div>
        </div>
      ) : null}

      {overview && overview.ok ? (
        <section style={{ marginTop: 20 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>Provozovny ({allRows.length})</h2>
          <div className="adminRestaurantsToolbar">
            <label
              className="textMuted2"
              style={{
                fontSize: 13,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                flex: "1 1 240px",
                minWidth: 0,
                alignSelf: "flex-start",
              }}
            >
              <span>Hledat podle názvu nebo ID</span>
              <input
                className="adminRestaurantsSearch"
                value={filterQ}
                onChange={(e) => setFilterQ(e.target.value)}
                placeholder="např. Pizza nebo začátek UUID…"
                autoComplete="off"
                aria-label="Filtrovat restaurace"
              />
            </label>
            <fieldset className="adminRestaurantsFilterGroup">
              <legend className="sr-only">Filtr stavu</legend>
              {(
                [
                  ["all", "Vše"],
                  ["incomplete", "K doplnění"],
                  ["ready", "Provozuschopné"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`chip adminRestaurantsFilterBtn${listFilter === id ? " adminRestaurantsFilterBtn--active" : ""}`}
                  onClick={() => setListFilter(id)}
                  aria-pressed={listFilter === id}
                >
                  {label}
                </button>
              ))}
            </fieldset>
            <span className="textMuted2" style={{ fontSize: 13, alignSelf: "center" }}>
              Zobrazeno: <strong style={{ color: "var(--text)" }}>{filtered.length}</strong>
              {q || listFilter !== "all" ? ` z ${allRows.length}` : null}
            </span>
          </div>

          {filtered.length === 0 ? (
            <p className="textMuted" style={{ marginTop: 8 }}>
              Žádná provozovna neodpovídá filtru.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filtered.map((r) => {
                const isActive = activeId === r.id;
                const busy = selecting === r.id;
                return (
                  <div
                    key={r.id}
                    className={`adminRestaurantCard${isActive ? " adminRestaurantCard--active" : ""}${!r.operationalReady ? " adminRestaurantCard--incomplete" : ""}`}
                  >
                    <div className="adminRestaurantCard__meta">
                      <div className="adminRestaurantCard__titleRow">
                        <strong style={{ fontSize: "1.05rem" }}>{r.name}</strong>
                        <StatusBadge item={r} />
                      </div>
                      <span className="adminRestaurantCard__id" title="Interní ID v databázi">
                        {r.id}
                      </span>
                      <p className="adminRestaurantCard__metrics textMuted2">
                        Tablety: <strong>{r.deviceCount}</strong>
                        {" · "}
                        Fotky menu: <strong>{r.menuImageCount}</strong>
                        {" · "}
                        Vedoucí: <strong>{r.managerCount}</strong>
                      </p>
                      {!r.dotykacka.syncConfigured && r.dotykacka.hint ? (
                        <p className="adminRestaurantCard__hint" role="status">
                          {r.dotykacka.hint}
                        </p>
                      ) : null}
                      <OnboardingChecklist item={r} />
                      {isActive ? (
                        <span className="textMuted2" style={{ fontSize: 12, marginTop: 6, display: "inline-block" }}>
                          Právě aktivní kontext (cookie)
                        </span>
                      ) : null}
                    </div>
                    <div className="adminRestaurantCard__actions">
                      <AdminChipLink href={`/admin/restaurants/${r.id}`}>
                        <strong>Detail →</strong>
                      </AdminChipLink>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => void onOpen(r.id, `/admin/restaurants/${r.id}`)}
                        disabled={busy}
                        style={{ cursor: "pointer" }}
                        title="Nastavit aktivní a otevřít Dotykačku / nastavení"
                      >
                        {busy ? "…" : "Dotykačka"}
                      </button>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => void onOpen(r.id, "/admin/devices/pair-kiosk")}
                        disabled={busy}
                        style={{ cursor: "pointer" }}
                        title="Nastavit aktivní a párovat kiosk"
                      >
                        {busy ? "…" : "Párovat kiosk"}
                      </button>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => void onOpen(r.id, "/admin/menu")}
                        disabled={busy}
                        style={{ cursor: "pointer" }}
                        title="Nastavit aktivní a otevřít úpravy menu"
                      >
                        {busy ? "…" : "Menu"}
                      </button>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => void onOpen(r.id, "/admin/devices")}
                        disabled={busy}
                        style={{ cursor: "pointer" }}
                      >
                        {busy ? "…" : "Zařízení"}
                      </button>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => void onOpen(r.id, "/admin/users")}
                        disabled={busy}
                        style={{ cursor: "pointer" }}
                      >
                        {busy ? "…" : "Uživatelé"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : !err ? (
        <p className="textMuted" style={{ marginTop: 16 }}>
          Načítání…
        </p>
      ) : null}

      {!forbidden ? (
        <section className="adminRestaurantsCreate">
          <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>Přidat provozovnu</h2>
          <form onSubmit={onCreate} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Název restaurace</span>
              <input
                className="chip adminRestaurantsCreateInput"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Email vedoucího (admin restaurace)</span>
              <input
                className="chip adminRestaurantsCreateInput"
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Heslo vedoucího</span>
              <input
                type="password"
                className="chip adminRestaurantsCreateInput"
                value={managerPassword}
                onChange={(e) => setManagerPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <button type="submit" className="btnPrimary" disabled={creating} style={{ cursor: "pointer", justifySelf: "start" }}>
              {creating ? "…" : "Vytvořit"}
            </button>
            <p className="textMuted2" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
              Po vytvoření přejdete do detailu; aktivní restaurace se nastaví automaticky.
            </p>
          </form>
        </section>
      ) : null}
    </main>
  );
}
