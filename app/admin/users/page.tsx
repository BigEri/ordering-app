"use client";

import * as React from "react";

type UsersResponse =
  | {
      ok: true;
      users: { id: string; email: string; globalRole: string; role: "RESTAURANT_ADMIN" | "STAFF" }[];
      restaurantId: string;
      sessionUserId: string;
      sessionGlobalRole: "SUPER_ADMIN" | "USER";
    }
  | { ok: false; error: string };

function errCs(msg: string | undefined): string {
  if (!msg) return "Operace selhala.";
  const m: Record<string, string> = {
    "Cannot remove yourself": "Sebe z této restaurace nemůžete odebrat.",
    "User not in restaurant": "Uživatel v této restauraci není.",
    "Only superadmin can remove restaurant admins": "Odebrat vedoucího může jen superadmin.",
    Forbidden: "Nemáte oprávnění.",
    Unauthorized: "Nejste přihlášeni.",
    "No restaurant selected": "Není vybraná aktivní restaurace.",
    "User not found": "Uživatel neexistuje.",
    "Password too short": "Heslo je moc krátké (min. 8 znaků).",
  };
  return m[msg] ?? msg;
}

export default function AdminUsersPage() {
  const [data, setData] = React.useState<UsersResponse | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<"RESTAURANT_ADMIN" | "STAFF">("STAFF");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [resettingId, setResettingId] = React.useState<string | null>(null);
  const [resetOpenId, setResetOpenId] = React.useState<string | null>(null);
  const [resetNewPassword, setResetNewPassword] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/users", { cache: "no-store" });
      const j = (await r.json()) as UsersResponse;
      setData(j);
      if (!r.ok || !j.ok) {
        setErr(!r.ok ? "Nelze načíst uživatele." : ("error" in j ? j.error : "Nelze načíst uživatele."));
      }
    } catch {
      setErr("Nelze načíst uživatele (síť).");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaved(false);
    setSaving(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setErr(j.error ?? "Uložení selhalo.");
        return;
      }
      setEmail("");
      setPassword("");
      setRole("STAFF");
      setSaved(true);
      await load();
    } catch {
      setErr("Uložení selhalo (síť).");
    } finally {
      setSaving(false);
    }
  };

  const canRemoveRow = (
    u: { id: string; role: "RESTAURANT_ADMIN" | "STAFF"; globalRole: string },
    sessionUserId: string,
    sessionGlobalRole: "SUPER_ADMIN" | "USER",
  ) => {
    if (u.id === sessionUserId) return false;
    if (u.globalRole === "SUPER_ADMIN") return false;
    if (u.role === "RESTAURANT_ADMIN" && sessionGlobalRole !== "SUPER_ADMIN") return false;
    return true;
  };

  const onRemove = async (userId: string, email: string) => {
    if (!window.confirm(`Odebrat uživatele „${email}“ z této restaurace? Přístup se zruší, účet v systému může zůstat pro jiné restaurace.`)) {
      return;
    }
    setErr(null);
    setRemovingId(userId);
    try {
      const r = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setErr(errCs(j.error));
        return;
      }
      await load();
    } catch {
      setErr("Odebrání selhalo (síť).");
    } finally {
      setRemovingId(null);
    }
  };

  const onResetPasswordOpen = (userId: string) => {
    setErr(null);
    setResetOpenId((cur) => (cur === userId ? null : userId));
    setResetNewPassword("");
  };

  const onResetPasswordSubmit = async (userId: string, email: string) => {
    const newPassword = resetNewPassword;
    if (!newPassword) return;
    if (newPassword.length < 8) {
      setErr("Heslo je moc krátké (min. 8 znaků).");
      return;
    }
    if (!window.confirm(`Opravdu nastavit nové heslo pro „${email}“?`)) return;

    setErr(null);
    setResettingId(userId);
    try {
      const r = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, newPassword }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setErr(errCs(j.error));
        return;
      }
      setResetOpenId(null);
      setResetNewPassword("");
      await load();
      window.alert(`Heslo pro „${email}“ bylo nastaveno.`);
    } catch {
      setErr("Reset hesla selhal (síť).");
    } finally {
      setResettingId(null);
    }
  };

  return (
    <main className="adminPage">
      <h1 style={{ margin: "0 0 8px", fontSize: "1.5rem" }}>Uživatelé</h1>
      <p className="textMuted" style={{ margin: "0 0 18px" }}>
        Správa přístupů pro vedoucího a personál v aktivní restauraci. Odebráním se zruší členství v této restauraci (účet může dál existovat jinde).
      </p>

      {err ? (
        <p role="alert" style={{ color: "#fecaca", marginBottom: 12 }}>
          {err}
        </p>
      ) : null}

      <section
        style={{
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 16,
          background: "var(--panel)",
          marginBottom: 18,
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>Přidat / obnovit účet</h2>
        <form onSubmit={onCreate} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Email</span>
            <input
              className="chip"
              style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", color: "var(--text)" }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Heslo (nastaví / resetuje)</span>
            <input
              type="password"
              className="chip"
              style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", color: "var(--text)" }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Role</span>
            <select
              className="chip"
              value={role}
              onChange={(e) => setRole(e.target.value === "RESTAURANT_ADMIN" ? "RESTAURANT_ADMIN" : "STAFF")}
              style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", color: "var(--text)" }}
            >
              <option value="STAFF">Personál</option>
              <option value="RESTAURANT_ADMIN">Vedoucí (admin)</option>
            </select>
          </label>
          <button type="submit" className="btnPrimary" disabled={saving} style={{ cursor: "pointer", justifySelf: "start" }}>
            {saving ? "…" : "Uložit"}
          </button>
          {saved ? (
            <p style={{ margin: 0, color: "var(--success)" }}>Uloženo.</p>
          ) : null}
        </form>
      </section>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Seznam</h2>
          <button type="button" className="chip" onClick={() => void load()} disabled={loading} style={{ cursor: "pointer" }}>
            {loading ? "…" : "Obnovit"}
          </button>
        </div>

        {data && data.ok ? (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, border: "1px solid var(--border)", borderRadius: 12 }}>
              <thead>
                <tr style={{ background: "var(--panel)" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px" }}>Email</th>
                  <th style={{ textAlign: "left", padding: "10px 12px" }}>Role</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", width: 120 }}>Akce</th>
                </tr>
              </thead>
              <tbody>
                {(data.sessionGlobalRole === "SUPER_ADMIN"
                  ? data.users
                  : data.users.filter((u) => u.globalRole !== "SUPER_ADMIN")
                ).map((u) => (
                  <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <strong>{u.email}</strong>
                      {u.globalRole === "SUPER_ADMIN" ? (
                        <span className="textMuted2" style={{ marginLeft: 8, fontSize: 12 }}>
                          SUPER_ADMIN
                        </span>
                      ) : null}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {u.role === "RESTAURANT_ADMIN" ? "Vedoucí" : "Personál"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                        {data.sessionGlobalRole === "SUPER_ADMIN" ? (
                          <button
                            type="button"
                            className="chip"
                            style={{ cursor: "pointer" }}
                            disabled={resettingId === u.id}
                            onClick={() => onResetPasswordOpen(u.id)}
                            title="Nastaví nové heslo uživateli"
                          >
                            {resettingId === u.id ? "…" : resetOpenId === u.id ? "Zrušit reset" : "Reset hesla"}
                          </button>
                        ) : null}

                        {data.sessionGlobalRole === "SUPER_ADMIN" && resetOpenId === u.id ? (
                          <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
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
                              onClick={() => void onResetPasswordSubmit(u.id, u.email)}
                            >
                              Uložit
                            </button>
                          </span>
                        ) : null}

                        {canRemoveRow(u, data.sessionUserId, data.sessionGlobalRole) ? (
                          <button
                            type="button"
                            className="chip"
                            style={{ cursor: "pointer", color: "#fecaca", borderColor: "rgba(248,113,113,0.35)" }}
                            disabled={removingId === u.id}
                            onClick={() => void onRemove(u.id, u.email)}
                          >
                            {removingId === u.id ? "…" : "Odebrat"}
                          </button>
                        ) : u.id === data.sessionUserId ? (
                          <span className="textMuted2" style={{ fontSize: 12 }}>
                            (já)
                          </span>
                        ) : (
                          <span className="textMuted2" style={{ fontSize: 12 }} title="Odebrat vedoucího může jen superadmin">
                            —
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="textMuted" style={{ marginTop: 12 }}>
            {loading ? "Načítání…" : "—"}
          </p>
        )}
      </section>
    </main>
  );
}

