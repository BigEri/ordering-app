"use client";

import Link from "next/link";
import * as React from "react";

type Resp = { ok: true } | { ok: false; error: string };

function errCs(msg: string | undefined): string {
  if (!msg) return "Operace selhala.";
  const m: Record<string, string> = {
    Unauthorized: "Nejste přihlášeni.",
    "Invalid credentials": "Staré heslo není správně.",
    "Passwords do not match": "Nové heslo se neshoduje.",
    "Password too short": "Nové heslo je moc krátké (min. 6 znaků).",
    "Missing password": "Vyplňte všechna pole.",
  };
  return m[msg] ?? msg;
}

export default function AdminAccountPage() {
  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [newPassword2, setNewPassword2] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaved(false);
    setSaving(true);
    try {
      const r = await fetch("/api/admin/account/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword, newPassword2 }),
      });
      const j = (await r.json()) as Resp;
      if (!r.ok || !j.ok) {
        setErr(errCs("error" in j ? j.error : "Error"));
        return;
      }
      setOldPassword("");
      setNewPassword("");
      setNewPassword2("");
      setSaved(true);
    } catch {
      setErr("Operace selhala (síť).");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="adminPage">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: "1.5rem" }}>Můj účet</h1>
          <p className="textMuted2" style={{ margin: 0, fontSize: 13 }}>
            Změna hesla pro přihlášeného uživatele.
          </p>
        </div>
        <Link className="chip" href="/admin" style={{ textDecoration: "none" }}>
          ← Admin
        </Link>
      </div>

      {err ? (
        <p role="alert" style={{ color: "#fecaca", marginTop: 12 }}>
          {err}
        </p>
      ) : null}

      <section
        style={{
          marginTop: 18,
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 16,
          background: "var(--panel)",
          maxWidth: 560,
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>Změnit heslo</h2>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Staré heslo</span>
            <input
              type="password"
              className="chip"
              style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", color: "var(--text)" }}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Nové heslo</span>
            <input
              type="password"
              className="chip"
              style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", color: "var(--text)" }}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Nové heslo znovu</span>
            <input
              type="password"
              className="chip"
              style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", color: "var(--text)" }}
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              autoComplete="new-password"
            />
          </label>

          <button type="submit" className="btnPrimary" disabled={saving} style={{ cursor: "pointer", justifySelf: "start" }}>
            {saving ? "…" : "Uložit nové heslo"}
          </button>
          {saved ? <p style={{ margin: 0, color: "var(--success)" }}>Heslo změněno.</p> : null}
        </form>
      </section>
    </main>
  );
}

