"use client";

import Link from "next/link";
import * as React from "react";

type StatusPayload = { ok?: boolean; needsSetup?: boolean; bootstrapConfigured?: boolean };

export function SetupClient({ initialToken }: { initialToken: string }) {
  const [status, setStatus] = React.useState<StatusPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [restaurantName, setRestaurantName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [token, setToken] = React.useState(initialToken);
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/setup/status", { cache: "no-store" });
        const j = (await r.json()) as StatusPayload;
        if (!cancelled) setStatus(r.ok && j.ok ? j : null);
      } catch {
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const r = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token.trim()}`,
        },
        body: JSON.stringify({
          restaurantName: restaurantName.trim(),
          email: email.trim(),
          password,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setErr(typeof j.error === "string" ? j.error : "Chyba");
        return;
      }
      setDone(true);
    } catch {
      setErr("Síťová chyba");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main style={{ maxWidth: 480, margin: "48px auto", padding: "0 20px" }}>
        <p style={{ opacity: 0.85 }}>Načítání…</p>
      </main>
    );
  }

  if (status == null) {
    return (
      <main style={{ maxWidth: 480, margin: "48px auto", padding: "0 20px" }}>
        <h1 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Stav se nepodařilo načíst</h1>
        <p style={{ lineHeight: 1.55 }}>Zkuste obnovit stránku.</p>
      </main>
    );
  }

  if (!status.needsSetup) {
    return (
      <main style={{ maxWidth: 480, margin: "48px auto", padding: "0 20px" }}>
        <h1 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Aplikace je již nastavená</h1>
        <p style={{ lineHeight: 1.55, opacity: 0.9 }}>
          V databázi už existuje uživatel. Prvotní nastavení není potřeba.
        </p>
        <p style={{ marginTop: 20 }}>
          <Link href="/admin/login" style={{ textDecoration: "underline" }}>
            Přihlásit se do administrace →
          </Link>
        </p>
      </main>
    );
  }

  if (!status.bootstrapConfigured) {
    return (
      <main style={{ maxWidth: 520, margin: "48px auto", padding: "0 20px" }}>
        <h1 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Chybí BOOTSTRAP_TOKEN</h1>
        <p style={{ lineHeight: 1.55, opacity: 0.9 }}>
          Na serveru není nastavena proměnná prostředí <code>BOOTSTRAP_TOKEN</code>. Bez ní nelze vytvořit prvního správce přes tento formulář.
        </p>
        <p style={{ marginTop: 16, lineHeight: 1.55, opacity: 0.85 }}>
          Doplňte token v <code>.env.local</code> nebo v nastavení hostingu, restartujte aplikaci a obnovte stránku.
        </p>
      </main>
    );
  }

  if (done) {
    return (
      <main style={{ maxWidth: 480, margin: "48px auto", padding: "0 20px" }}>
        <h1 style={{ fontSize: "1.35rem", marginBottom: 12 }}>Hotovo</h1>
        <p style={{ lineHeight: 1.55 }}>Účet správce a první provozovna byly vytvořeny.</p>
        <p style={{ marginTop: 20 }}>
          <Link href="/admin/login" style={{ textDecoration: "underline", fontWeight: 600 }}>
            Přihlásit se →
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "48px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: "1.35rem", marginBottom: 8 }}>Prvotní nastavení</h1>
      <p style={{ lineHeight: 1.55, opacity: 0.9, marginBottom: 20 }}>
        Vytvoříte prvního správce (SUPER_ADMIN) a jednu provozovnu. Potřebujete hodnotu <code>BOOTSTRAP_TOKEN</code> z prostředí serveru.
      </p>

      <form onSubmit={(e) => void onSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>Token (Bearer)</span>
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>Název provozovny</span>
          <input
            type="text"
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            required
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>E-mail správce</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>Heslo</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}
          />
        </label>
        {err ? (
          <p role="alert" style={{ color: "#fecaca", margin: 0 }}>
            {err}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            cursor: submitting ? "not-allowed" : "pointer",
            fontWeight: 600,
            background: "var(--accent, #6366f1)",
            color: "#fff",
          }}
        >
          {submitting ? "Odesílám…" : "Vytvořit účet"}
        </button>
      </form>
    </main>
  );
}
