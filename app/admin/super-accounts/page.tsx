"use client";

import * as React from "react";

type SuperUsersResponse =
  | {
      ok: true;
      sessionUserId: string;
      users: { id: string; email: string; createdAtIso: string; isMe: boolean }[];
    }
  | { ok: false; error: string };

export default function SuperAccountsPage() {
  const [data, setData] = React.useState<SuperUsersResponse | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [resetOpenId, setResetOpenId] = React.useState<string | null>(null);
  const [resetNewPassword, setResetNewPassword] = React.useState("");
  const [resettingId, setResettingId] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/super-users", { cache: "no-store", credentials: "same-origin" });
      const j = (await r.json()) as SuperUsersResponse;
      setData(j);
      if (!r.ok || !j.ok) {
        setErr(!r.ok ? "Nepodařilo se načíst SUPER účty." : "error" in j ? j.error : "Chyba");
      }
    } catch {
      setErr("Nepodařilo se načíst SUPER účty (připojení).");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onReset = async (userId: string, email: string) => {
    setMsg(null);
    setErr(null);
    if (resetNewPassword.length < 8) {
      setErr("Heslo musí mít aspoň 8 znaků.");
      return;
    }
    setResettingId(userId);
    try {
      const r = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId, newPassword: resetNewPassword }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setErr(j.error ?? "Reset hesla selhal.");
        return;
      }
      setMsg(`Heslo pro ${email} bylo změněno.`);
      setResetOpenId(null);
      setResetNewPassword("");
    } catch {
      setErr("Reset hesla selhal (připojení).");
    } finally {
      setResettingId(null);
    }
  };

  return (
    <main className="adminPage">
      <h1 style={{ margin: "0 0 8px", fontSize: "1.5rem" }}>SUPER účty</h1>
      <p className="textMuted2" style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.5 }}>
        Globální administrátoři Tableflow. Tady můžeš resetovat heslo jinému SUPER účtu (záloha, když se
        zamkneš).
      </p>

      {loading ? <p className="textMuted">Načítám…</p> : null}
      {err ? (
        <p role="alert" style={{ color: "#fecaca", marginBottom: 12 }}>
          {err}
        </p>
      ) : null}
      {msg ? (
        <p role="status" style={{ color: "var(--success, #86efac)", marginBottom: 12 }}>
          {msg}
        </p>
      ) : null}

      {data && data.ok ? (
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--panel)" }}>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>Email</th>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>Vytvořeno</th>
                <th style={{ textAlign: "right", padding: "10px 12px", width: 280 }}>Akce</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <strong>{u.email}</strong>
                    {u.isMe ? (
                      <span className="textMuted2" style={{ marginLeft: 8, fontSize: 12 }}>
                        (já)
                      </span>
                    ) : null}
                  </td>
                  <td style={{ padding: "10px 12px" }} className="textMuted2">
                    {u.createdAtIso}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="chip"
                        style={{ cursor: "pointer" }}
                        disabled={resettingId === u.id}
                        onClick={() => {
                          setMsg(null);
                          setErr(null);
                          setResetOpenId((cur) => (cur === u.id ? null : u.id));
                          setResetNewPassword("");
                        }}
                      >
                        {resetOpenId === u.id ? "Zrušit" : "Reset hesla"}
                      </button>
                      {resetOpenId === u.id ? (
                        <>
                          <input
                            type="password"
                            value={resetNewPassword}
                            onChange={(e) => setResetNewPassword(e.target.value)}
                            placeholder="Nové heslo (min. 8)"
                            autoComplete="new-password"
                            className="chip"
                            style={{
                              width: 180,
                              padding: "8px 10px",
                              border: "1px solid var(--border)",
                              borderRadius: 10,
                              background: "var(--bg-elevated)",
                              color: "var(--text)",
                            }}
                          />
                          <button
                            type="button"
                            className="btnPrimary"
                            disabled={resettingId === u.id || resetNewPassword.length < 8}
                            style={{ cursor: "pointer" }}
                            onClick={() => void onReset(u.id, u.email)}
                          >
                            {resettingId === u.id ? "…" : "Uložit"}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p style={{ marginTop: 16 }}>
        <a href="/admin/restaurants" className="adminBreadcrumb__link">
          ← Zpět na provozovny
        </a>
      </p>
    </main>
  );
}
