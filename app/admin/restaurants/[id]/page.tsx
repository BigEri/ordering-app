"use client";

import { useParams, usePathname, useSearchParams } from "next/navigation";

import { AdminChipLink } from "../../../../components/admin/AdminNavLink";
import { Suspense } from "react";
import * as React from "react";

type RestaurantDetailResponse =
  | { ok: true; restaurant: { id: string; name: string; createdAtIso: string } }
  | { ok: false; error: string };

type RestaurantUsersResponse =
  | { ok: true; restaurant: { id: string; name: string }; users: { id: string; email: string; globalRole: string; role: string }[] }
  | { ok: false; error: string };

type DotykackaSettingsResponse =
  | {
      ok: true;
      hasRow: boolean;
      cloudId: number | null;
      branchId: number;
      productMapJson: string;
      apiBase: string;
      hasRefreshToken: boolean;
      disabled: boolean;
      revokedAtIso: string | null;
      lastOkAtIso: string | null;
      lastError: string | null;
    }
  | { ok: false; error: string };

type RestaurantLocalesResponse =
  | { ok: true; hasConfig: boolean; locales: { code: string; label: string; enabled: boolean }[] }
  | { ok: false; error: string };

const TABS = ["overview", "users", "menu", "dotykacka"] as const;
type TabId = (typeof TABS)[number];

function tabFromSearch(raw: string | null): TabId {
  if (raw && (TABS as readonly string[]).includes(raw)) return raw as TabId;
  return "overview";
}

function RestaurantDetailInner() {
  const params = useParams<{ id: string }>();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const id = params?.id ?? "";
  const tab = tabFromSearch(searchParams.get("tab"));

  const [detail, setDetail] = React.useState<RestaurantDetailResponse | null>(null);
  const [users, setUsers] = React.useState<RestaurantUsersResponse | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [nameDraft, setNameDraft] = React.useState("");
  const [savingName, setSavingName] = React.useState(false);
  const [contextSync, setContextSync] = React.useState<"idle" | "syncing" | "done" | "err">("idle");

  const [dotyk, setDotyk] = React.useState<DotykackaSettingsResponse | null>(null);
  const [dotykLoading, setDotykLoading] = React.useState(false);
  const [branchDraft, setBranchDraft] = React.useState("");
  const [mapDraft, setMapDraft] = React.useState("{}");
  const [apiBaseDraft, setApiBaseDraft] = React.useState("");
  const [dotykSaving, setDotykSaving] = React.useState(false);
  const [dotykMsg, setDotykMsg] = React.useState<string | null>(null);
  const [dotykToggleSaving, setDotykToggleSaving] = React.useState(false);
  const [branchesFromApi, setBranchesFromApi] = React.useState<{ id: number; name: string }[] | null>(null);
  const [branchesLoading, setBranchesLoading] = React.useState(false);
  const [branchesErr, setBranchesErr] = React.useState<string | null>(null);

  const [locales, setLocales] = React.useState<{ code: string; label: string; enabled: boolean }[] | null>(null);
  const [localesHasConfig, setLocalesHasConfig] = React.useState(false);
  const [localesLoading, setLocalesLoading] = React.useState(false);
  const [localesErr, setLocalesErr] = React.useState<string | null>(null);
  const [localesSaving, setLocalesSaving] = React.useState(false);
  const [localesSavedMsg, setLocalesSavedMsg] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!id) return;
    setErr(null);
    try {
      const [dR, uR] = await Promise.all([
        fetch(`/api/admin/restaurants/${id}`, { cache: "no-store" }),
        fetch(`/api/admin/restaurants/${id}/users`, { cache: "no-store" }),
      ]);
      const dJ = (await dR.json()) as RestaurantDetailResponse;
      const uJ = (await uR.json()) as RestaurantUsersResponse;
      setDetail(dJ);
      setUsers(uJ);
      if (!dR.ok || !dJ.ok) setErr(!dR.ok ? "Nelze načíst detail restaurace." : ("error" in dJ ? dJ.error : "Chyba"));
      if (!uR.ok || !uJ.ok) setErr(!uR.ok ? "Nelze načíst uživatele restaurace." : ("error" in uJ ? uJ.error : "Chyba"));
    } catch {
      setErr("Načtení se nezdařilo (síť).");
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const loadLocales = React.useCallback(async () => {
    if (!id) return;
    setLocalesErr(null);
    setLocalesLoading(true);
    try {
      const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(id)}/locales`, { cache: "no-store" });
      const j = (await r.json()) as RestaurantLocalesResponse;
      if (!r.ok || !j.ok) {
        setLocalesErr("Nelze načíst jazykové nastavení restaurace.");
        setLocales(null);
        return;
      }
      setLocales(Array.isArray(j.locales) ? j.locales : []);
      setLocalesHasConfig(Boolean(j.hasConfig));
    } catch {
      setLocalesErr("Nelze načíst jazykové nastavení (síť).");
      setLocales(null);
    } finally {
      setLocalesLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    if (tab !== "overview") return;
    void loadLocales();
  }, [tab, loadLocales]);

  const loadDotykacka = React.useCallback(async () => {
    if (!id) return;
    setDotykLoading(true);
    setDotykMsg(null);
    try {
      const r = await fetch(`/api/admin/restaurants/${id}/dotykacka`, { cache: "no-store" });
      const j = (await r.json()) as DotykackaSettingsResponse;
      setDotyk(j);
      if (r.ok && j.ok) {
        setBranchDraft(String(j.branchId || ""));
        try {
          const pretty = JSON.stringify(JSON.parse(j.productMapJson || "{}") as object, null, 2);
          setMapDraft(pretty);
        } catch {
          setMapDraft(j.productMapJson || "{}");
        }
        setApiBaseDraft(j.apiBase || "");
      }
    } catch {
      setDotyk({ ok: false, error: "Načtení Dotyky selhalo (síť)." });
    } finally {
      setDotykLoading(false);
    }
  }, [id]);

  const loadBranchesFromDotykacka = React.useCallback(async () => {
    if (!id) return;
    setBranchesLoading(true);
    setBranchesErr(null);
    try {
      const r = await fetch(`/api/admin/dotykacka/branches?restaurantId=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const j = (await r.json()) as { ok?: boolean; branches?: { id: number; name: string }[]; error?: string };
      if (!r.ok || !j.ok) {
        setBranchesErr(j.error ?? "Nepodařilo se načíst pobočky z Dotyky.");
        setBranchesFromApi(null);
        return;
      }
      setBranchesFromApi(Array.isArray(j.branches) ? j.branches : []);
    } catch {
      setBranchesErr("Načtení poboček selhalo (síť).");
      setBranchesFromApi(null);
    } finally {
      setBranchesLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    if (tab !== "dotykacka" || !id) return;
    void loadDotykacka();
  }, [tab, id, loadDotykacka]);

  /** Po OAuth stačí cloud + token — načteme seznam poboček z API (nevyžaduje už uložené branchId). */
  React.useEffect(() => {
    if (tab !== "dotykacka" || !id) return;
    if (!dotyk || dotyk.ok !== true || !dotyk.hasRow || !dotyk.hasRefreshToken) return;
    void loadBranchesFromDotykacka();
  }, [tab, id, dotyk, loadBranchesFromDotykacka]);

  /** Při vstupu do detailu nastavit cookie aktivní restaurace = tento řádek (přehled pro více provozoven). */
  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      setContextSync("syncing");
      try {
        const meR = await fetch("/api/admin/me", { cache: "no-store" });
        const meJ = (await meR.json()) as { ok?: boolean; activeRestaurantId?: string | null };
        if (!meR.ok || !meJ.ok) {
          if (!cancelled) setContextSync("err");
          return;
        }
        if (meJ.activeRestaurantId === id) {
          if (!cancelled) setContextSync("done");
          return;
        }
        const r = await fetch("/api/admin/restaurant/select", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ restaurantId: id }),
        });
        const j = (await r.json()) as { ok?: boolean };
        if (!r.ok || !j.ok) {
          if (!cancelled) setContextSync("err");
          return;
        }
        window.dispatchEvent(new Event("oa-restaurant-updated"));
        if (!cancelled) setContextSync("done");
      } catch {
        if (!cancelled) setContextSync("err");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  React.useEffect(() => {
    if (detail && detail.ok) setNameDraft(detail.restaurant.name);
  }, [detail]);

  const onSaveDotykacka = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setDotykSaving(true);
    setDotykMsg(null);
    try {
      const branchId = Number.parseInt(branchDraft.trim(), 10);
      let productMapJson = mapDraft.trim();
      try {
        productMapJson = JSON.stringify(JSON.parse(productMapJson || "{}") as object);
      } catch {
        setDotykMsg("Mapa produktů musí být platný JSON objekt.");
        setDotykSaving(false);
        return;
      }
      const r = await fetch(`/api/admin/restaurants/${id}/dotykacka`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          branchId,
          productMapJson,
          apiBase: apiBaseDraft.trim() || null,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setDotykMsg(j.error ?? "Uložení selhalo.");
        return;
      }
      setDotykMsg("Uloženo.");
      await loadDotykacka();
    } catch {
      setDotykMsg("Uložení selhalo (síť).");
    } finally {
      setDotykSaving(false);
    }
  };

  const onToggleDotykackaDisabled = async () => {
    if (!id || !dotyk || !dotyk.ok || !dotyk.hasRow) return;
    const nextDisabled = !dotyk.disabled;
    if (nextDisabled) {
      const ok = window.confirm(
        "Opravdu chcete odpojit Dotykačku?\n\nNebudou se odesílat objednávky do POS (Dotykačky), dokud ji znovu nezapnete.",
      );
      if (!ok) return;
    }
    setDotykToggleSaving(true);
    setDotykMsg(null);
    try {
      const r = await fetch(`/api/admin/restaurants/${id}/dotykacka`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ disabled: nextDisabled }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setDotykMsg(j.error ?? "Změna stavu selhala.");
        return;
      }
      setDotykMsg(nextDisabled ? "Dotykačka odpojena (disabled)." : "Dotykačka znovu zapnuta.");
      await loadDotykacka();
    } catch {
      setDotykMsg("Změna stavu selhala (síť).");
    } finally {
      setDotykToggleSaving(false);
    }
  };

  const onSaveRestaurantName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const name = nameDraft.trim();
    if (!name || name.length > 200) {
      setErr("Zadejte platný název (1–200 znaků).");
      return;
    }
    setSavingName(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/restaurants/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setErr(j.error ?? "Uložení názvu selhalo.");
        return;
      }
      await load();
      window.dispatchEvent(new Event("oa-restaurant-updated"));
    } catch {
      setErr("Uložení názvu selhalo (síť).");
    } finally {
      setSavingName(false);
    }
  };

  const name = detail && detail.ok ? detail.restaurant.name : id;

  const tabHref = (t: TabId) => (t === "overview" ? pathname : `${pathname}?tab=${t}`);

  return (
    <main className="adminPage">
      {contextSync === "syncing" ? (
        <div className="adminRestaurantContextBar" role="status">
          <span className="textMuted2">Nastavuji aktivní restauraci pro tuto stránku…</span>
        </div>
      ) : null}
      {contextSync === "done" ? (
        <div className="adminRestaurantContextBar">
          <strong>Kontext úprav:</strong> pracujete s provozovnou <strong>{name}</strong>. Sekce Uživatelé a Zařízení v levém menu se vztahují k této restauraci (shodné s pill „Aktivní“ nahoře).
        </div>
      ) : null}
      {contextSync === "err" ? (
        <div className="adminRestaurantContextBar adminRestaurantContextBar--warn" role="alert">
          Nepodařilo se nastavit aktivní restauraci v prohlížeči. Zkuste obnovit stránku nebo vybrat restauraci v Přehledu.
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <p className="textMuted2" style={{ margin: "0 0 4px", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Detail restaurace
          </p>
          <h1 style={{ margin: "0 0 6px", fontSize: "1.5rem" }}>{name}</h1>
          <p className="textMuted2" style={{ margin: 0, fontSize: 12, fontFamily: "ui-monospace, monospace", wordBreak: "break-all" }}>
            ID: {id}
          </p>
        </div>
        <button type="button" className="chip" onClick={() => void load()} style={{ cursor: "pointer" }}>
          Obnovit
        </button>
      </div>

      <ul className="adminTabs" role="tablist" aria-label="Sekce detailu restaurace">
        <li style={{ display: "contents" }}>
          <a
            href={tabHref("overview")}
            className={`adminTab${tab === "overview" ? " adminTab--active" : ""}`}
            role="tab"
            aria-selected={tab === "overview"}
          >
            Přehled
          </a>
        </li>
        <li style={{ display: "contents" }}>
          <a
            href={tabHref("users")}
            className={`adminTab${tab === "users" ? " adminTab--active" : ""}`}
            role="tab"
            aria-selected={tab === "users"}
          >
            Uživatelé
          </a>
        </li>
        <li style={{ display: "contents" }}>
          <a
            href={tabHref("menu")}
            className={`adminTab${tab === "menu" ? " adminTab--active" : ""}`}
            role="tab"
            aria-selected={tab === "menu"}
          >
            Menu
          </a>
        </li>
        <li style={{ display: "contents" }}>
          <a
            href={tabHref("dotykacka")}
            className={`adminTab${tab === "dotykacka" ? " adminTab--active" : ""}`}
            role="tab"
            aria-selected={tab === "dotykacka"}
          >
            Dotykačka
          </a>
        </li>
      </ul>

      {err ? (
        <p role="alert" style={{ marginTop: 12, color: "#fecaca" }}>
          {err}
        </p>
      ) : null}

      {tab === "overview" ? (
        <>
          <section
            style={{
              marginTop: 16,
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 16,
              background: "var(--panel)",
            }}
          >
            <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>Název restaurace</h2>
            <p className="textMuted2" style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5 }}>
              Stejný text se ukazuje hostům na úvodní stránce, v menu a v záhlaví (viz také Přehled admin).
            </p>
            <form onSubmit={(e) => void onSaveRestaurantName(e)} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
              <label style={{ display: "grid", gap: 6, flex: "1 1 220px" }}>
                <span>Název</span>
                <input
                  className="chip"
                  style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", color: "var(--text)" }}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  autoComplete="organization"
                  maxLength={200}
                />
              </label>
              <button type="submit" className="btnPrimary" disabled={savingName} style={{ cursor: "pointer" }}>
                {savingName ? "…" : "Uložit"}
              </button>
            </form>
          </section>

          <section
            style={{
              marginTop: 16,
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 16,
              background: "var(--panel)",
            }}
          >
            <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>Rychlé odkazy</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="chip"
                disabled={contextSync !== "done"}
                onClick={() => {
                  window.location.href = "/admin";
                }}
                style={{ cursor: contextSync === "done" ? "pointer" : "not-allowed" }}
              >
                Přehled admin
              </button>
              <button
                type="button"
                className="chip"
                disabled={contextSync !== "done"}
                onClick={() => {
                  window.location.href = "/admin/users";
                }}
                style={{ cursor: contextSync === "done" ? "pointer" : "not-allowed" }}
              >
                Uživatelé této restaurace
              </button>
              <button
                type="button"
                className="chip"
                disabled={contextSync !== "done"}
                onClick={() => {
                  window.location.href = "/admin/devices";
                }}
                style={{ cursor: contextSync === "done" ? "pointer" : "not-allowed" }}
              >
                Zařízení této restaurace
              </button>
              <AdminChipLink href="/admin/restaurants">← Seznam restaurací</AdminChipLink>
            </div>
            <p className="textMuted2" style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.5 }}>
              Aktivní restaurace se při otevření tohoto detailu nastaví automaticky, aby bylo jasné, co upravujete.
            </p>
          </section>

          {detail && detail.ok ? (
            <section style={{ marginTop: 16 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: "1.05rem" }}>Údaje</h2>
              <p className="textMuted2" style={{ margin: 0, fontSize: 13 }}>
                Vytvořeno: {detail.restaurant.createdAtIso}
              </p>
            </section>
          ) : null}

          <section
            style={{
              marginTop: 16,
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 16,
              background: "var(--panel)",
            }}
          >
            <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>Jazyky pro hosty</h2>
            <p className="textMuted2" style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.55 }}>
              Nastavení je pro tuto provozovnu zvlášť. Ovlivňuje přepínač jazyka v menu. Překlady menu upravíte v{" "}
              <a href="/admin/menu/translations" className="adminBreadcrumb__link">
                Admin → Menu → Překlady
              </a>
              .
            </p>

            {localesLoading ? <p className="textMuted">Načítání…</p> : null}
            {localesErr ? (
              <p role="alert" style={{ color: "#fecaca", margin: "0 0 12px" }}>
                {localesErr}
              </p>
            ) : null}

            {locales && locales.length > 0 ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!id) return;
                  setLocalesSaving(true);
                  setLocalesSavedMsg(null);
                  setLocalesErr(null);
                  const enabledLocales = locales.filter((l) => l.enabled).map((l) => l.code);
                  void (async () => {
                    try {
                      const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(id)}/locales`, {
                        method: "PUT",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ enabledLocales }),
                      });
                      const j = (await r.json()) as { ok?: boolean; error?: string };
                      if (!r.ok || !j.ok) {
                        setLocalesErr(j.error ?? "Uložení selhalo.");
                        return;
                      }
                      setLocalesSavedMsg("Uloženo.");
                      await loadLocales();
                    } catch {
                      setLocalesErr("Uložení selhalo (síť).");
                    } finally {
                      setLocalesSaving(false);
                    }
                  })();
                }}
                style={{ display: "grid", gap: 12 }}
              >
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                  {locales.map((l) => (
                    <label
                      key={l.code}
                      className="chip"
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <strong>{l.label}</strong>
                        <span className="textMuted2" style={{ fontSize: 12, fontFamily: "ui-monospace, monospace" }}>
                          {l.code}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={l.enabled}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setLocales((prev) => (prev ? prev.map((x) => (x.code === l.code ? { ...x, enabled: next } : x)) : prev));
                        }}
                      />
                    </label>
                  ))}
                </div>

                <p className="textMuted2" style={{ margin: 0, fontSize: 12 }}>
                  {localesHasConfig
                    ? "Tato restaurace má vlastní sadu jazyků (lišší se od výchozí)."
                    : "Zatím není uložené vlastní nastavení — aktuálně platí výchozí globální jazyky."}
                </p>

                {localesSavedMsg ? (
                  <p role="status" style={{ margin: 0, fontSize: 13, color: "var(--success)" }}>
                    {localesSavedMsg}
                  </p>
                ) : null}

                <button type="submit" className="btnPrimary" disabled={localesSaving} style={{ cursor: localesSaving ? "wait" : "pointer", justifySelf: "start" }}>
                  {localesSaving ? "…" : "Uložit jazyky"}
                </button>
              </form>
            ) : null}
          </section>
        </>
      ) : null}

      {tab === "users" ? (
        <section style={{ marginTop: 16 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>Uživatelé restaurace</h2>
          {users && users.ok ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, border: "1px solid var(--border)", borderRadius: 12 }}>
                <thead>
                  <tr style={{ background: "var(--panel)" }}>
                    <th style={{ textAlign: "left", padding: "10px 12px" }}>Email</th>
                    <th style={{ textAlign: "left", padding: "10px 12px" }}>Role v restauraci</th>
                    <th style={{ textAlign: "left", padding: "10px 12px" }}>Globální</th>
                  </tr>
                </thead>
                <tbody>
                  {users.users.map((u) => (
                    <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 12px" }}>
                        <strong>{u.email}</strong>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {u.role === "RESTAURANT_ADMIN" ? "Vedoucí" : u.role === "STAFF" ? "Personál" : u.role}
                      </td>
                      <td style={{ padding: "10px 12px" }}>{u.globalRole}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="textMuted">Načítání…</p>
          )}
          <p className="textMuted2" style={{ marginTop: 12, fontSize: 13 }}>
            Přidání účtů probíhá v sekci{" "}
            <a href="/admin/users" className="adminBreadcrumb__link">
              Uživatelé
            </a>{" "}
            (v kontextu aktivní restaurace).
          </p>
        </section>
      ) : null}

      {tab === "menu" ? (
        <section
          style={{
            marginTop: 16,
            border: "1px dashed var(--border)",
            borderRadius: 16,
            padding: 20,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>Menu</h2>
          <p className="textMuted" style={{ margin: 0, lineHeight: 1.55 }}>
            Úpravy jídelníčku z adminu budou doplněny později. Veřejné menu zákazníků najdete na stránce{" "}
            <a href="/menu" className="adminBreadcrumb__link">
              Veřejné menu
            </a>
            .
          </p>
        </section>
      ) : null}

      {tab === "dotykacka" ? (
        <section
          style={{
            marginTop: 16,
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 16,
            background: "var(--panel)",
          }}
        >
          <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>Dotykačka pro tuto provozovnu</h2>
          <p className="textMuted2" style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.55 }}>
            <strong>Cloud ID</strong> identifikuje váš účet v Dotypos (číslo z OAuth). <strong>ID pobočky (branch)</strong> je
            jiné číslo — konkrétní provozovna v tom cloudu, kde běží pokladna. Nejprve OAuth, pak vyberte pobočku ze seznamu
            nebo zadejte číslo ručně, a mapu produktů (jako dříve v <code style={{ fontSize: 12 }}>.env</code>).
          </p>
          {dotykLoading ? <p className="textMuted">Načítání…</p> : null}
          {!dotykLoading && dotyk && !dotyk.ok ? (
            <p role="alert" style={{ color: "#fecaca" }}>
              {dotyk.error}
            </p>
          ) : null}
          {!dotykLoading && dotyk && dotyk.ok ? (
            <>
              <p className="textMuted2" style={{ margin: "0 0 10px", fontSize: 13 }}>
                Cloud ID: <strong>{dotyk.cloudId ?? "—"}</strong>
                {dotyk.hasRefreshToken ? " · refresh token v databázi" : " · refresh token chybí — spusťte OAuth níže"}
              </p>
              <div style={{ display: "grid", gap: 6, margin: "0 0 12px" }}>
                <p className="textMuted2" style={{ margin: 0, fontSize: 13 }}>
                  Stav:{" "}
                  {dotyk.disabled ? (
                    <strong style={{ color: "#fca5a5" }}>odpojeno (disabled)</strong>
                  ) : dotyk.hasRefreshToken ? (
                    <strong style={{ color: "var(--success)" }}>aktivní</strong>
                  ) : (
                    <strong>nepřipojeno</strong>
                  )}
                  {dotyk.revokedAtIso ? (
                    <span className="textMuted2" style={{ marginLeft: 8 }}>
                      (revoked: {dotyk.revokedAtIso})
                    </span>
                  ) : null}
                </p>
                {dotyk.lastOkAtIso ? (
                  <p className="textMuted2" style={{ margin: 0, fontSize: 12 }}>
                    Poslední OK: <span style={{ fontFamily: "ui-monospace, monospace" }}>{dotyk.lastOkAtIso}</span>
                  </p>
                ) : null}
                {dotyk.lastError ? (
                  <p role="alert" style={{ margin: 0, fontSize: 12, color: "#fecaca" }}>
                    Poslední chyba: <span style={{ fontFamily: "ui-monospace, monospace" }}>{dotyk.lastError}</span>
                  </p>
                ) : null}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                <a
                  className="btnPrimary"
                  style={{ textDecoration: "none", display: "inline-block", padding: "8px 14px", borderRadius: 10 }}
                  href={`/api/integrations/dotykacka/connect?restaurantId=${encodeURIComponent(id)}`}
                >
                  Připojit Dotyku (OAuth)
                </a>
                {dotyk.hasRow ? (
                  <button
                    type="button"
                    className="chip"
                    onClick={() => void onToggleDotykackaDisabled()}
                    disabled={dotykToggleSaving}
                    style={{ cursor: dotykToggleSaving ? "wait" : "pointer" }}
                  >
                    {dotykToggleSaving
                      ? "…"
                      : dotyk.disabled
                        ? "Zapnout Dotykačku"
                        : "Odpojit Dotykačku"}
                  </button>
                ) : null}
                <button type="button" className="chip" onClick={() => void loadDotykacka()} style={{ cursor: "pointer" }}>
                  Obnovit stav
                </button>
                {dotyk.hasRefreshToken ? (
                  <button
                    type="button"
                    className="chip"
                    onClick={() => void loadBranchesFromDotykacka()}
                    disabled={branchesLoading}
                    style={{ cursor: branchesLoading ? "wait" : "pointer" }}
                  >
                    {branchesLoading ? "Načítám pobočky…" : "Znovu načíst seznam poboček"}
                  </button>
                ) : null}
              </div>
              {branchesErr ? (
                <p role="alert" style={{ color: "#fecaca", fontSize: 13, margin: "0 0 10px" }}>
                  {branchesErr}
                </p>
              ) : null}
              <form onSubmit={(e) => void onSaveDotykacka(e)} style={{ display: "grid", gap: 12 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>ID pobočky (branch) — výběr z Dotyky nebo ručně</span>
                  {branchesFromApi && branchesFromApi.length > 0 ? (
                    <select
                      className="chip"
                      aria-label="Vyberte pobočku z Dotyky"
                      value={
                        branchesFromApi.some((b) => String(b.id) === branchDraft.trim()) ? branchDraft.trim() : ""
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) setBranchDraft(v);
                      }}
                      style={{
                        padding: "10px 12px",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        background: "var(--bg-elevated)",
                        color: "var(--text)",
                        maxWidth: "100%",
                      }}
                    >
                      <option value="">— vyberte pobočku nebo zadejte ID níže —</option>
                      {branchesFromApi.map((b) => (
                        <option key={b.id} value={String(b.id)}>
                          {b.name} (ID {b.id})
                        </option>
                      ))}
                    </select>
                  ) : branchesLoading ? (
                    <span className="textMuted" style={{ fontSize: 13 }}>
                      Načítám seznam poboček…
                    </span>
                  ) : branchesFromApi !== null && branchesFromApi.length === 0 && dotyk.hasRefreshToken ? (
                    <span className="textMuted" style={{ fontSize: 13 }}>
                      API nevrátilo žádné pobočky — zadejte ID pobočky ručně (nebo zkuste znovu načíst).
                    </span>
                  ) : branchesFromApi === null && dotyk.hasRefreshToken && !branchesErr ? (
                    <span className="textMuted" style={{ fontSize: 13 }}>
                      Seznam se načítá… pokud se neobjeví, použijte ruční pole nebo „Znovu načíst seznam poboček“.
                    </span>
                  ) : null}
                  <input
                    className="chip"
                    style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", color: "var(--text)" }}
                    value={branchDraft}
                    onChange={(e) => setBranchDraft(e.target.value)}
                    inputMode="numeric"
                    placeholder="číslo pobočky (branch), ne cloud ID"
                  />
                  <span className="textMuted2" style={{ fontSize: 12 }}>
                    Cloud ID je výše u OAuth; sem patří jen číslo pobočky, kam má chodit objednávka (pos-actions).
                  </span>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Mapa produktů (JSON: naše menu ID → číslo produktu v Dotyce)</span>
                  <textarea
                    className="chip"
                    style={{
                      minHeight: 140,
                      padding: "10px 12px",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      background: "var(--bg-elevated)",
                      color: "var(--text)",
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 13,
                    }}
                    value={mapDraft}
                    onChange={(e) => setMapDraft(e.target.value)}
                    spellCheck={false}
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span>Volitelně vlastní API base (prázdné = výchozí z .env nebo api.dotykacka.cz)</span>
                  <input
                    className="chip"
                    style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", color: "var(--text)" }}
                    value={apiBaseDraft}
                    onChange={(e) => setApiBaseDraft(e.target.value)}
                    placeholder="https://api.dotykacka.cz"
                  />
                </label>
                {dotykMsg ? (
                  <p role="status" style={{ margin: 0, fontSize: 13 }}>
                    {dotykMsg}
                  </p>
                ) : null}
                <div>
                  <button type="submit" className="btnPrimary" disabled={dotykSaving || !dotyk.hasRow} style={{ cursor: dotykSaving || !dotyk.hasRow ? "not-allowed" : "pointer" }}>
                    {dotykSaving ? "…" : "Uložit pobočku a mapu"}
                  </button>
                  {!dotyk.hasRow ? (
                    <span className="textMuted2" style={{ marginLeft: 10, fontSize: 13 }}>
                      Nejprve dokončete OAuth.
                    </span>
                  ) : null}
                </div>
              </form>
            </>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function RestaurantDetailFallback() {
  return (
    <main className="adminPage">
      <p className="textMuted">Načítání…</p>
    </main>
  );
}

export default function SuperAdminRestaurantDetailPage() {
  return (
    <Suspense fallback={<RestaurantDetailFallback />}>
      <RestaurantDetailInner />
    </Suspense>
  );
}
