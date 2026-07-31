"use client";

import { useParams, usePathname, useSearchParams } from "next/navigation";

import { DevicesAdminClient } from "../../../../components/admin/DevicesAdminClient";
import { UsersAdminClient } from "../../../../components/admin/UsersAdminClient";
import { WelcomeSettingsClient } from "../../welcome/WelcomeSettingsClient";
import { Suspense } from "react";
import * as React from "react";

type RestaurantDetailResponse =
  | { ok: true; restaurant: { id: string; name: string; createdAtIso: string } }
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

const TABS = ["overview", "menu", "users", "devices", "welcome", "dotykacka"] as const;
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

  /** Legacy ?tab=menu → dedicated menu route (SSR editor). */
  React.useEffect(() => {
    if (tab !== "menu" || !id) return;
    window.location.replace(`/admin/restaurants/${encodeURIComponent(id)}/menu`);
  }, [tab, id]);

  const [detail, setDetail] = React.useState<RestaurantDetailResponse | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [isSuper, setIsSuper] = React.useState(false);
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
  const [deleting, setDeleting] = React.useState(false);

  const [pinConfigured, setPinConfigured] = React.useState<boolean | null>(null);
  const [pinDraft, setPinDraft] = React.useState("");
  const [pinConfirm, setPinConfirm] = React.useState("");
  const [pinLoading, setPinLoading] = React.useState(false);
  const [pinSaving, setPinSaving] = React.useState(false);
  const [pinMsg, setPinMsg] = React.useState<string | null>(null);
  const [pinErr, setPinErr] = React.useState<string | null>(null);

  const [rebootHour, setRebootHour] = React.useState(4);
  const [rebootMinute, setRebootMinute] = React.useState(0);
  const [rebootIsDefault, setRebootIsDefault] = React.useState(true);
  const [rebootLoading, setRebootLoading] = React.useState(false);
  const [rebootSaving, setRebootSaving] = React.useState(false);
  const [rebootMsg, setRebootMsg] = React.useState<string | null>(null);
  const [rebootErr, setRebootErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!id) return;
    setErr(null);
    try {
      const dR = await fetch(`/api/admin/restaurants/${id}`, { cache: "no-store" });
      const dJ = (await dR.json()) as RestaurantDetailResponse;
      setDetail(dJ);
      if (!dR.ok || !dJ.ok) setErr(!dR.ok ? "Nelze načíst detail restaurace." : ("error" in dJ ? dJ.error : "Chyba"));
    } catch {
      setErr("Nepodařilo se načíst data (zřejmě výpadek připojení). Zkuste to prosím znovu.");
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
      setLocalesErr("Nepodařilo se načíst jazykové nastavení (zřejmě výpadek připojení). Zkuste to prosím znovu.");
      setLocales(null);
    } finally {
      setLocalesLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    if (tab !== "overview") return;
    void loadLocales();
  }, [tab, loadLocales]);

  const loadKioskPin = React.useCallback(async () => {
    if (!id) return;
    setPinLoading(true);
    setPinErr(null);
    try {
      const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(id)}/kiosk-service-pin`, {
        cache: "no-store",
      });
      const j = (await r.json()) as { ok?: boolean; configured?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setPinErr(j.error ?? "Nelze načíst stav servisního PIN.");
        setPinConfigured(null);
        return;
      }
      setPinConfigured(Boolean(j.configured));
    } catch {
      setPinErr("Nepodařilo se načíst stav PIN (připojení).");
      setPinConfigured(null);
    } finally {
      setPinLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    if (tab !== "overview" || !isSuper) return;
    void loadKioskPin();
  }, [tab, loadKioskPin, isSuper]);

  const loadKioskReboot = React.useCallback(async () => {
    if (!id) return;
    setRebootLoading(true);
    setRebootErr(null);
    try {
      const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(id)}/kiosk-maintenance-reboot`, {
        cache: "no-store",
      });
      const j = (await r.json()) as {
        ok?: boolean;
        hour?: number;
        minute?: number;
        isDefault?: boolean;
        error?: string;
      };
      if (!r.ok || !j.ok) {
        setRebootErr(j.error ?? "Nelze načíst čas údržbového restartu.");
        return;
      }
      setRebootHour(typeof j.hour === "number" ? j.hour : 4);
      setRebootMinute(typeof j.minute === "number" ? j.minute : 0);
      setRebootIsDefault(Boolean(j.isDefault));
    } catch {
      setRebootErr("Nepodařilo se načíst čas restartu (připojení).");
    } finally {
      setRebootLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    if (tab !== "overview" || !isSuper) return;
    void loadKioskReboot();
  }, [tab, loadKioskReboot, isSuper]);

  const onSaveKioskReboot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setRebootMsg(null);
    setRebootErr(null);
    if (!Number.isInteger(rebootHour) || rebootHour < 0 || rebootHour > 23) {
      setRebootErr("Hodina musí být 0–23.");
      return;
    }
    if (!Number.isInteger(rebootMinute) || rebootMinute < 0 || rebootMinute > 59) {
      setRebootErr("Minuta musí být 0–59.");
      return;
    }
    setRebootSaving(true);
    try {
      const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(id)}/kiosk-maintenance-reboot`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hour: rebootHour, minute: rebootMinute }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        hour?: number;
        minute?: number;
        isDefault?: boolean;
        error?: string;
      };
      if (!r.ok || !j.ok) {
        setRebootErr(j.error ?? "Uložení času restartu selhalo.");
        return;
      }
      setRebootHour(typeof j.hour === "number" ? j.hour : rebootHour);
      setRebootMinute(typeof j.minute === "number" ? j.minute : rebootMinute);
      setRebootIsDefault(false);
      setRebootMsg(
        "Čas údržbového restartu uložen. Spárované tablety ho stáhnou při dalším pollu (~15 s) a naplánují AlarmManager.",
      );
    } catch {
      setRebootErr("Nepodařilo se uložit čas restartu (připojení).");
    } finally {
      setRebootSaving(false);
    }
  };

  const onSaveKioskPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setPinMsg(null);
    setPinErr(null);
    const pin = pinDraft.trim();
    const confirm = pinConfirm.trim();
    if (!/^\d{4,12}$/.test(pin)) {
      setPinErr("PIN musí mít 4–12 číslic.");
      return;
    }
    if (pin !== confirm) {
      setPinErr("PIN a potvrzení se neshodují.");
      return;
    }
    setPinSaving(true);
    try {
      const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(id)}/kiosk-service-pin`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const j = (await r.json()) as { ok?: boolean; configured?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setPinErr(j.error ?? "Uložení PIN selhalo.");
        return;
      }
      setPinConfigured(true);
      setPinDraft("");
      setPinConfirm("");
      setPinMsg("Servisní PIN uložen. Spárované tablety ho stáhnou při dalším pollu (~15 s).");
    } catch {
      setPinErr("Nepodařilo se uložit PIN (připojení).");
    } finally {
      setPinSaving(false);
    }
  };

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
      setDotyk({ ok: false, error: "Nepodařilo se načíst nastavení Dotykačky (zřejmě výpadek připojení)." });
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
        setBranchesErr(j.error ?? "Nepodařilo se načíst pobočky z Dotykačky.");
        setBranchesFromApi(null);
        return;
      }
      setBranchesFromApi(Array.isArray(j.branches) ? j.branches : []);
    } catch {
      setBranchesErr("Nepodařilo se načíst pobočky (zřejmě výpadek připojení). Zkuste to prosím znovu.");
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
        const meJ = (await meR.json()) as {
          ok?: boolean;
          activeRestaurantId?: string | null;
          session?: { globalRole?: string };
        };
        if (!meR.ok || !meJ.ok) {
          if (!cancelled) setContextSync("err");
          return;
        }
        if (!cancelled) setIsSuper(meJ.session?.globalRole === "SUPER_ADMIN");
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
      setDotykMsg("Uložení se nezdařilo (zřejmě výpadek připojení). Zkuste to prosím znovu.");
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
      setDotykMsg("Změna se nezdařila (zřejmě výpadek připojení). Zkuste to prosím znovu.");
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
      setErr("Název se nepodařilo uložit (zřejmě výpadek připojení). Zkuste to prosím znovu.");
    } finally {
      setSavingName(false);
    }
  };

  const onDeleteRestaurant = async () => {
    if (!id || !detail?.ok) return;
    const label = detail.restaurant.name.trim() || id;
    const ok = window.confirm(
      `Opravdu trvale smazat provozovnu „${label}“?\n\nSmaže se Dotykačka, tablety, menu, fotky a uživatelské vazby v této restauraci. Uživatelské účty v systému zůstanou.\n\nTuto akci nelze vrátit.`,
    );
    if (!ok) return;
    setDeleting(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setErr(j.error ?? "Smazání provozovny selhalo.");
        return;
      }
      window.location.href = "/admin/restaurants";
    } catch {
      setErr("Smazání se nezdařilo (zřejmě výpadek připojení). Zkuste to prosím znovu.");
    } finally {
      setDeleting(false);
    }
  };

  const name = detail && detail.ok ? detail.restaurant.name : id;

  const tabHref = (t: TabId) => {
    if (t === "overview") return pathname;
    if (t === "menu") return `${pathname}/menu`;
    return `${pathname}?tab=${t}`;
  };

  if (tab === "menu") {
    return (
      <main className="adminPage">
        <p className="textMuted">Přesměrování na menu provozovny…</p>
      </main>
    );
  }

  return (
    <main className="adminPage">
      {contextSync === "syncing" ? (
        <div className="adminRestaurantContextBar" role="status">
          <span className="textMuted2">Načítám nastavení vaší restaurace…</span>
        </div>
      ) : null}
      {contextSync === "err" ? (
        <div className="adminRestaurantContextBar adminRestaurantContextBar--warn" role="alert">
          Nepodařilo se načíst nastavení vaší restaurace. Zkuste obnovit stránku.
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <p className="textMuted2" style={{ margin: "0 0 4px", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Nastavení restaurace
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
              Stejný text se ukazuje hostům na úvodní stránce, v menu a v záhlaví.
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

          {isSuper ? (
          <section
            style={{
              marginTop: 16,
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 16,
              background: "var(--panel)",
            }}
          >
            <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>Servisní PIN tabletu</h2>
            <p className="textMuted2" style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5 }}>
              PIN pro dlouhý stisk na kiosk tabletu (Host → Admin). Z tabletu se měnit nedá — jen tady jako
              superadmin. Dokud nenastavíš vlastní, tablety používají výchozí <code>2580</code>.
            </p>
            {pinLoading ? (
              <p className="textMuted2" style={{ margin: 0, fontSize: 13 }}>
                …
              </p>
            ) : (
              <p style={{ margin: "0 0 12px", fontSize: 13 }}>
                Stav:{" "}
                {pinConfigured === true ? (
                  <strong>vlastní PIN nastaven</strong>
                ) : pinConfigured === false ? (
                  <span className="textMuted2">výchozí 2580</span>
                ) : (
                  <span className="textMuted2">neznámý</span>
                )}
              </p>
            )}
            <form onSubmit={(e) => void onSaveKioskPin(e)} style={{ display: "grid", gap: 12, maxWidth: 360 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Nový PIN (4–12 číslic)</span>
                <input
                  className="chip"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                  }}
                  value={pinDraft}
                  onChange={(e) => setPinDraft(e.target.value)}
                  maxLength={12}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Potvrzení PIN</span>
                <input
                  className="chip"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                  }}
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value)}
                  maxLength={12}
                />
              </label>
              <button type="submit" className="btnPrimary" disabled={pinSaving} style={{ cursor: "pointer", justifySelf: "start" }}>
                {pinSaving ? "…" : "Uložit PIN"}
              </button>
            </form>
            {pinMsg ? (
              <p role="status" style={{ margin: "12px 0 0", fontSize: 13, color: "var(--success, #86efac)" }}>
                {pinMsg}
              </p>
            ) : null}
            {pinErr ? (
              <p role="alert" style={{ margin: "12px 0 0", fontSize: 13, color: "#fecaca" }}>
                {pinErr}
              </p>
            ) : null}
          </section>
          ) : null}

          {isSuper ? (
          <section
            style={{
              marginTop: 16,
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 16,
              background: "var(--panel)",
            }}
          >
            <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>Údržbový restart tabletu</h2>
            <p className="textMuted2" style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5 }}>
              1× týdně v nastaveném <strong>místním čase tabletu</strong> Device Owner tiše restartuje
              kiosk. Po restartu se vždy vrátí do Host zámku. Pokud byl tablet vypnutý, restart se
              odloží na další výskyt tohoto času (nikdy dopoledne / přes den). Výchozí:{" "}
              <code>04:00</code>.
            </p>
            {rebootLoading ? (
              <p className="textMuted2" style={{ margin: 0, fontSize: 13 }}>
                …
              </p>
            ) : (
              <p style={{ margin: "0 0 12px", fontSize: 13 }}>
                Stav:{" "}
                {rebootIsDefault ? (
                  <span className="textMuted2">výchozí 04:00</span>
                ) : (
                  <strong>
                    {String(rebootHour).padStart(2, "0")}:{String(rebootMinute).padStart(2, "0")}
                  </strong>
                )}
              </p>
            )}
            <form
              onSubmit={(e) => void onSaveKioskReboot(e)}
              style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <span>Hodina (0–23)</span>
                <input
                  className="chip"
                  type="number"
                  min={0}
                  max={23}
                  step={1}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                    width: 96,
                  }}
                  value={rebootHour}
                  onChange={(e) => setRebootHour(Number.parseInt(e.target.value, 10) || 0)}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Minuta (0–59)</span>
                <input
                  className="chip"
                  type="number"
                  min={0}
                  max={59}
                  step={1}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                    width: 96,
                  }}
                  value={rebootMinute}
                  onChange={(e) => setRebootMinute(Number.parseInt(e.target.value, 10) || 0)}
                />
              </label>
              <button type="submit" className="btnPrimary" disabled={rebootSaving} style={{ cursor: "pointer" }}>
                {rebootSaving ? "…" : "Uložit čas"}
              </button>
            </form>
            {rebootMsg ? (
              <p role="status" style={{ margin: "12px 0 0", fontSize: 13, color: "var(--success, #86efac)" }}>
                {rebootMsg}
              </p>
            ) : null}
            {rebootErr ? (
              <p role="alert" style={{ margin: "12px 0 0", fontSize: 13, color: "#fecaca" }}>
                {rebootErr}
              </p>
            ) : null}
          </section>
          ) : null}

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
              Nastavení platí pro vaši restauraci. Ovlivňuje přepínač jazyka v menu. Překlady menu upravíte v záložce{" "}
              <a href={tabHref("menu")} className="adminBreadcrumb__link">
                Menu
              </a>{" "}
              → Překlady.
              {id ? (
                <>
                  {" "}
                  (
                  <a
                    href={`/admin/restaurants/${encodeURIComponent(id)}/menu/translations`}
                    className="adminBreadcrumb__link"
                  >
                    otevřít překlady
                  </a>
                  ).
                </>
              ) : null}
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
                      setLocalesErr("Uložení se nezdařilo (zřejmě výpadek připojení). Zkuste to prosím znovu.");
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
                    ? "Vaše restaurace má vlastní sadu jazyků (liší se od výchozí)."
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

          {detail && detail.ok && isSuper ? (
            <section
              style={{
                marginTop: 24,
                border: "1px solid rgba(248, 113, 113, 0.35)",
                borderRadius: 16,
                padding: 16,
                background: "rgba(248, 113, 113, 0.06)",
              }}
            >
              <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", color: "#fecaca" }}>Smazat provozovnu</h2>
              <p className="textMuted2" style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.55 }}>
                Trvale odstraní provozovnu <strong>{detail.restaurant.name}</strong> včetně Dotykačky, tabletů, úprav menu a
                fotek. Uživatelské účty (e-mail) v systému zůstanou — zmizí jen jejich vazba na tuto restauraci.
                Provozovnu nastavenou jako <code style={{ fontSize: 12 }}>PUBLIC_RESTAURANT_ID</code> na serveru nelze smazat.
              </p>
              <button
                type="button"
                className="chip"
                disabled={deleting}
                onClick={() => void onDeleteRestaurant()}
                style={{
                  cursor: deleting ? "wait" : "pointer",
                  borderColor: "rgba(248, 113, 113, 0.5)",
                  color: "#fecaca",
                }}
              >
                {deleting ? "Mažu…" : "Smazat provozovnu"}
              </button>
            </section>
          ) : null}
        </>
      ) : null}

      {tab === "users" && id ? (
        <section style={{ marginTop: 16 }}>
          <UsersAdminClient
            restaurantId={id}
            restaurantName={detail && detail.ok ? detail.restaurant.name : null}
            embedded
          />
        </section>
      ) : null}

      {tab === "devices" && id ? (
        <section style={{ marginTop: 16 }}>
          <DevicesAdminClient
            restaurantId={id}
            restaurantName={detail && detail.ok ? detail.restaurant.name : null}
            embedded
            pairHref={`/admin/restaurants/${encodeURIComponent(id)}/devices/pair`}
          />
        </section>
      ) : null}

      {tab === "welcome" && id ? (
        <section style={{ marginTop: 16 }}>
          <WelcomeSettingsClient
            restaurantId={id}
            restaurantName={detail && detail.ok ? detail.restaurant.name : name}
            embedded
          />
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
          <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>Dotykačka</h2>
          <p className="textMuted2" style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.55 }}>
            <strong>Cloud ID</strong> identifikuje váš účet v Dotypos (číslo z OAuth). <strong>ID pobočky (branch)</strong> je
            jiné číslo — konkrétní pobočka v tom cloudu, kde běží vaše pokladna. Nejprve OAuth, pak vyberte pobočku ze seznamu
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
                  Připojit Dotykačku (OAuth)
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
                  <span>ID pobočky (branch) — výběr z Dotykačky nebo ručně</span>
                  {branchesFromApi && branchesFromApi.length > 0 ? (
                    <select
                      className="chip"
                      aria-label="Vyberte pobočku z Dotykačky"
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

export default function RestaurantDetailPage() {
  return (
    <Suspense fallback={<RestaurantDetailFallback />}>
      <RestaurantDetailInner />
    </Suspense>
  );
}
