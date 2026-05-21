"use client";

import * as React from "react";

export function LoginClient({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !data.ok) {
        setErr(data.error ?? "Přihlášení se nezdařilo.");
        return;
      }
      window.location.href = nextPath;
    } catch {
      setErr("Přihlášení se nezdařilo (síť).");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "40px 16px 64px" }}>
      <h1 style={{ margin: "0 0 8px", fontSize: "1.6rem" }}>Admin</h1>
      <p className="textMuted" style={{ margin: "0 0 20px" }}>
        Přihlášení pro vedoucího / personál restaurace.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Email</span>
          <input
            className="chip"
            style={{
              padding: "10px 12px",
              border: "1px solid var(--border)",
              borderRadius: 10,
              background: "var(--bg-elevated)",
              color: "var(--text)",
            }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Heslo</span>
          <input
            type="password"
            className="chip"
            style={{
              padding: "10px 12px",
              border: "1px solid var(--border)",
              borderRadius: 10,
              background: "var(--bg-elevated)",
              color: "var(--text)",
            }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        <button type="submit" className="btnPrimary" disabled={loading} style={{ cursor: "pointer", justifySelf: "start" }}>
          {loading ? "…" : "Přihlásit"}
        </button>
      </form>

      {err ? (
        <p role="alert" style={{ marginTop: 12, color: "#fecaca" }}>
          {err}
        </p>
      ) : null}
    </main>
  );
}

