"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

type MeResponse =
  | {
      ok: true;
      session: { userId: string; email: string; globalRole: "SUPER_ADMIN" | "USER" };
      activeRestaurantId: string | null;
    }
  | { ok: false; error: string };

type RestaurantsResponse = { ok: true; restaurants: { id: string; name: string }[] } | { ok: false; error: string };

export default function SuperAdminRestaurantsPage() {
  const router = useRouter();
  const [me, setMe] = React.useState<MeResponse | null>(null);
  const [restaurants, setRestaurants] = React.useState<RestaurantsResponse | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [selecting, setSelecting] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [filterQ, setFilterQ] = React.useState("");

  const [restaurantName, setRestaurantName] = React.useState("");
  const [managerEmail, setManagerEmail] = React.useState("");
  const [managerPassword, setManagerPassword] = React.useState("");

  const load = React.useCallback(async () => {
    setErr(null);
    try {
      const [meR, rR] = await Promise.all([fetch("/api/admin/me", { cache: "no-store" }), fetch("/api/admin/restaurants", { cache: "no-store" })]);
      const meJ = (await meR.json()) as MeResponse;
      const rJ = (await rR.json()) as RestaurantsResponse;
      setMe(meJ);
      setRestaurants(rJ);
      if (!meR.ok || !meJ.ok) setErr("Nelze načíst profil.");
      if (!rR.ok || !rJ.ok) setErr("Nelze načíst restaurace.");
    } catch {
      setErr("Načtení se nezdařilo (síť).");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onOpen = async (restaurantId: string, next = "/admin") => {
    setSelecting(restaurantId);
    setErr(null);
    try {
      const r = await fetch("/api/admin/restaurant/select", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setErr(j.error ?? "Výběr restaurace selhal.");
        return;
      }
      window.dispatchEvent(new Event("oa-restaurant-updated"));
      window.location.href = next;
    } catch {
      setErr("Výběr restaurace selhal (síť).");
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
        setErr(j.error ?? "Vytvoření restaurace selhalo.");
        return;
      }
      setRestaurantName("");
      setManagerEmail("");
      setManagerPassword("");
      await load();
      router.push(`/admin/restaurants/${j.restaurantId}`);
    } catch {
      setErr("Vytvoření restaurace selhalo (síť).");
    } finally {
      setCreating(false);
    }
  };

  const activeId = me && me.ok ? me.activeRestaurantId : null;
  const allRows = restaurants && restaurants.ok ? restaurants.restaurants : [];
  const q = filterQ.trim().toLowerCase();
  const filtered = q
    ? allRows.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
    : allRows;

  return (
    <main className="adminPage">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: "1.5rem" }}>Restaurace</h1>
          <p className="textMuted2" style={{ margin: 0, fontSize: 13, maxWidth: 640, lineHeight: 1.5 }}>
            Seznam všech provozoven. Po kliknutí na <strong>Detail</strong> se otevře správa konkrétní restaurace a zároveň se nastaví jako{" "}
            <strong>aktivní</strong> (stejný kontext jako Uživatelé / Zařízení v postranním menu). U více záznamů použijte vyhledávání.
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

      {restaurants && restaurants.ok ? (
        <section style={{ marginTop: 20 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>Všechny restaurace ({allRows.length})</h2>
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
            <span className="textMuted2" style={{ fontSize: 13 }}>
              Zobrazeno: <strong style={{ color: "var(--text)" }}>{filtered.length}</strong>
              {q ? ` z ${allRows.length}` : null}
            </span>
          </div>

          {filtered.length === 0 ? (
            <p className="textMuted" style={{ marginTop: 8 }}>
              Žádná restaurace neodpovídá filtru.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filtered.map((r) => {
                const isActive = activeId === r.id;
                return (
                  <div
                    key={r.id}
                    className={`adminRestaurantCard${isActive ? " adminRestaurantCard--active" : ""}`}
                  >
                    <div className="adminRestaurantCard__meta">
                      <strong style={{ display: "block", fontSize: "1.05rem" }}>{r.name}</strong>
                      <span className="adminRestaurantCard__id" title="Interní ID v databázi">
                        {r.id}
                      </span>
                      {isActive ? (
                        <span className="textMuted2" style={{ fontSize: 12, marginTop: 6, display: "inline-block" }}>
                          Právě aktivní kontext (cookie)
                        </span>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link className="chip" href={`/admin/restaurants/${r.id}`} style={{ textDecoration: "none", fontWeight: 600 }}>
                        Detail →
                      </Link>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => void onOpen(r.id, "/admin/users")}
                        disabled={selecting === r.id}
                        style={{ cursor: "pointer" }}
                        title="Nastavit aktivní a otevřít uživatele"
                      >
                        {selecting === r.id ? "…" : "Uživatelé"}
                      </button>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => void onOpen(r.id, "/admin/devices")}
                        disabled={selecting === r.id}
                        style={{ cursor: "pointer" }}
                        title="Nastavit aktivní a otevřít zařízení"
                      >
                        {selecting === r.id ? "…" : "Zařízení"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <p className="textMuted" style={{ marginTop: 16 }}>
          Načítání…
        </p>
      )}

      {!forbidden ? (
        <section
          style={{
            marginTop: 28,
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 16,
            background: "var(--panel)",
          }}
        >
          <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>Přidat restauraci</h2>
          <form onSubmit={onCreate} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Název restaurace</span>
              <input
                className="chip"
                style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", color: "var(--text)" }}
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Email vedoucího (admin restaurace)</span>
              <input
                className="chip"
                style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", color: "var(--text)" }}
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Heslo vedoucího</span>
              <input
                type="password"
                className="chip"
                style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", color: "var(--text)" }}
                value={managerPassword}
                onChange={(e) => setManagerPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <button type="submit" className="btnPrimary" disabled={creating} style={{ cursor: "pointer", justifySelf: "start" }}>
              {creating ? "…" : "Vytvořit"}
            </button>
            <p className="textMuted2" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
              Po vytvoření přejdete do detailu; aktivní restaurace se nastaví automaticky. Personál přidáte v detailu nebo v Uživatelích.
            </p>
          </form>
        </section>
      ) : null}
    </main>
  );
}
