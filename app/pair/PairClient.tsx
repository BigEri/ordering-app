"use client";

import * as React from "react";

import { AdminChipLink } from "../../components/admin/AdminNavLink";
import { KioskAnchor } from "../../components/kiosk/KioskAnchor";

type MePayload = {
  ok?: boolean;
  session?: { globalRole?: string };
  activeRestaurantId?: string | null;
  activeRestaurantName?: string | null;
};

type RestaurantRow = { id: string; name: string };

export function PairClient() {
  const [meLoading, setMeLoading] = React.useState(true);
  const [me, setMe] = React.useState<MePayload | null>(null);
  const [restaurants, setRestaurants] = React.useState<RestaurantRow[] | null>(null);
  const [code, setCode] = React.useState("");
  const [tableId, setTableId] = React.useState("");
  const [tableLabel, setTableLabel] = React.useState("");
  const [restaurantId, setRestaurantId] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/admin/me", { cache: "no-store", credentials: "same-origin" });
        const j = (await r.json()) as MePayload;
        if (cancelled) return;
        if (!r.ok || !j.ok) {
          setMe(null);
          return;
        }
        setMe(j);
        const rr = await fetch("/api/admin/restaurants", { cache: "no-store", credentials: "same-origin" });
        const jr = (await rr.json()) as { ok?: boolean; restaurants?: RestaurantRow[] };
        if (!cancelled && rr.ok && jr.ok && jr.restaurants) {
          setRestaurants(jr.restaurants);
          const active = j.activeRestaurantId?.trim();
          if (active && jr.restaurants.some((x) => x.id === active)) {
            setRestaurantId(active);
          } else if (jr.restaurants.length === 1) {
            setRestaurantId(jr.restaurants[0].id);
          }
        }
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setMeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isSuper = me?.session?.globalRole === "SUPER_ADMIN";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        code: code.trim().toUpperCase(),
        tableId: tableId.trim(),
        tableLabel: tableLabel.trim(),
      };
      if (isSuper && restaurantId.trim()) {
        body.restaurantId = restaurantId.trim();
      }
      const r = await fetch("/api/admin/devices/pair-by-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string; deviceId?: string };
      if (!r.ok || !j.ok) {
        setErr(typeof j.error === "string" ? j.error : "Chyba");
        return;
      }
      setMsg("Zařízení bylo spárováno. Tablet si může obnovit menu.");
      setCode("");
    } catch {
      setErr("Síťová chyba");
    } finally {
      setSubmitting(false);
    }
  };

  if (meLoading) {
    return (
      <main style={{ maxWidth: 480, margin: "48px auto", padding: "0 20px" }}>
        <p style={{ opacity: 0.85 }}>Načítání…</p>
      </main>
    );
  }

  if (me === null) {
    return (
      <main style={{ maxWidth: 480, margin: "48px auto", padding: "0 20px" }}>
        <h1 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Párování tabletu</h1>
        <p style={{ lineHeight: 1.55, marginBottom: 20 }}>
          Pro zadání kódu z tabletu se musíte přihlásit do administrace.
        </p>
        <AdminChipLink href="/admin/login?next=/pair">Přihlásit se →</AdminChipLink>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: "1.35rem", marginBottom: 8 }}>Párování tabletu</h1>
      <p style={{ lineHeight: 1.55, opacity: 0.9, marginBottom: 12 }}>
        Doporučujeme{" "}
        <AdminChipLink href="/admin/devices/pair-kiosk">Párování u stolů</AdminChipLink>{" "}
        — výběr stolu přímo z Dotykačky. Tato stránka slouží pro ruční zadání ID stolu.
      </p>
      <p style={{ lineHeight: 1.55, opacity: 0.9, marginBottom: 20 }}>
        Na tabletu otevřete <KioskAnchor href="/menu">/menu</KioskAnchor> — zobrazí se šestimístný kód. Zadejte ho níže spolu se stolem.
      </p>

      <form onSubmit={(e) => void onSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {isSuper && restaurants && restaurants.length > 0 ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, opacity: 0.85 }}>Provozovna (volitelné, jinak aktivní v administraci)</span>
            <select
              value={restaurantId}
              onChange={(e) => setRestaurantId(e.target.value)}
              style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
            >
              <option value="">— aktivní z administrace —</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {!isSuper && !me.activeRestaurantId ? (
          <p role="alert" style={{ color: "#fecaca", margin: 0 }}>
            Nemáte nastavenou vaši restauraci. Dokončete nejdřív nastavení v Přehledu administrace.
          </p>
        ) : null}

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>Kód z tabletu</span>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            placeholder="např. ABC12X"
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", letterSpacing: "0.12em" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>ID stolu (v Dotyce / interní)</span>
          <input
            type="text"
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
            required
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>Název stolu (zobrazení)</span>
          <input
            type="text"
            value={tableLabel}
            onChange={(e) => setTableLabel(e.target.value)}
            required
            placeholder="např. Stůl 5"
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
          />
        </label>
        {err ? (
          <p role="alert" style={{ color: "#fecaca", margin: 0 }}>
            {err}
          </p>
        ) : null}
        {msg ? (
          <p role="status" style={{ color: "var(--success, #86efac)", margin: 0 }}>
            {msg}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting || (!isSuper && !me.activeRestaurantId)}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            cursor: submitting ? "not-allowed" : "pointer",
            fontWeight: 600,
            background: "var(--accent, #6366f1)",
            color: "#fff",
            opacity: !isSuper && !me.activeRestaurantId ? 0.5 : 1,
          }}
        >
          {submitting ? "Páruji…" : "Spárovat"}
        </button>
      </form>

      <p style={{ marginTop: 24, fontSize: 14, opacity: 0.85 }}>
        <AdminChipLink href="/admin/devices">Zpět na zařízení v administraci →</AdminChipLink>
      </p>
    </main>
  );
}
