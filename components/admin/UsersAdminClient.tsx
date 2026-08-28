"use client";

import * as React from "react";

import { useAdminLanguage } from "./AdminLanguageProvider";

export type UsersAdminClientProps = {
  /** Restaurant whose memberships to manage — preferred over cookie alone. */
  restaurantId: string;
  restaurantName?: string | null;
  /** When true, omit outer adminPage main (embedded in restaurant tabs). */
  embedded?: boolean;
};

type UsersResponse =
  | {
      ok: true;
      users: { id: string; email: string; globalRole: string; role: "RESTAURANT_ADMIN" | "STAFF" }[];
      restaurantId: string;
      sessionUserId: string;
      sessionGlobalRole: "SUPER_ADMIN" | "USER";
    }
  | { ok: false; error: string };

export function UsersAdminClient({
  restaurantId,
  restaurantName = null,
  embedded = false,
}: UsersAdminClientProps) {
  const { t } = useAdminLanguage();
  const rid = restaurantId.trim();

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

  const errMsg = React.useCallback(
    (msg: string | undefined): string => {
      if (!msg) return t("admin.users.err.generic");
      const m: Record<string, string> = {
        Error: t("admin.users.err.unknown"),
        "Cannot remove yourself": t("admin.users.err.cannotRemoveSelf"),
        "User not in restaurant": t("admin.users.err.userNotInRestaurant"),
        "Only superadmin can remove restaurant admins": t("admin.users.err.onlySuperRemoveAdmin"),
        Forbidden: t("admin.users.err.forbidden"),
        Unauthorized: t("admin.users.err.unauthorized"),
        "No restaurant selected": t("admin.users.err.noRestaurant"),
        "User not found": t("admin.users.err.userNotFound"),
        "Password too short": t("admin.users.passwordTooShort"),
      };
      return m[msg] ?? msg;
    },
    [t],
  );

  const usersListUrl = React.useMemo(() => {
    if (!rid) return "/api/admin/users";
    return `/api/admin/users?restaurantId=${encodeURIComponent(rid)}`;
  }, [rid]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    if (!rid) {
      setErr(t("admin.users.missingRestaurantId"));
      setData(null);
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(usersListUrl, { cache: "no-store", credentials: "same-origin" });
      const j = (await r.json()) as UsersResponse;
      setData(j);
      if (!r.ok || !j.ok) {
        setErr(
          !r.ok
            ? t("admin.users.loadErr")
            : "error" in j
              ? errMsg(j.error)
              : t("admin.users.loadErr"),
        );
      }
    } catch {
      setErr(t("admin.users.loadNetworkErr"));
    } finally {
      setLoading(false);
    }
  }, [rid, usersListUrl, t, errMsg]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rid) return;
    setErr(null);
    setSaved(false);
    setSaving(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password, role, restaurantId: rid }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setErr(errMsg(j.error) || t("admin.users.saveFailed"));
        return;
      }
      setEmail("");
      setPassword("");
      setRole("STAFF");
      setSaved(true);
      await load();
    } catch {
      setErr(t("admin.users.saveNetworkErr"));
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

  const onRemove = async (userId: string, userEmail: string) => {
    if (!rid) return;
    if (!window.confirm(t("admin.users.removeConfirm", { email: userEmail }))) {
      return;
    }
    setErr(null);
    setRemovingId(userId);
    try {
      const r = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId, restaurantId: rid }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setErr(errMsg(j.error));
        return;
      }
      await load();
    } catch {
      setErr(t("admin.users.removeNetworkErr"));
    } finally {
      setRemovingId(null);
    }
  };

  const onResetPasswordOpen = (userId: string) => {
    setErr(null);
    setResetOpenId((cur) => (cur === userId ? null : userId));
    setResetNewPassword("");
  };

  const onResetPasswordSubmit = async (userId: string, userEmail: string) => {
    const newPassword = resetNewPassword;
    if (!newPassword) return;
    if (newPassword.length < 8) {
      setErr(t("admin.users.passwordTooShort"));
      return;
    }
    if (!window.confirm(t("admin.users.resetConfirm", { email: userEmail }))) return;

    setErr(null);
    setResettingId(userId);
    try {
      const r = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId, newPassword }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setErr(errMsg(j.error));
        return;
      }
      setResetOpenId(null);
      setResetNewPassword("");
      await load();
      window.alert(t("admin.users.resetOk", { email: userEmail }));
    } catch {
      setErr(t("admin.users.resetNetworkErr"));
    } finally {
      setResettingId(null);
    }
  };

  const body = (
    <>
      {!embedded ? <h1 style={{ margin: "0 0 8px", fontSize: "1.5rem" }}>{t("admin.users.title")}</h1> : null}
      {embedded ? (
        <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>{t("admin.users.titleEmbedded")}</h2>
      ) : null}
      <p className="textMuted" style={{ margin: "0 0 18px" }}>
        {restaurantName
          ? t("admin.users.subtitleNamed", { name: restaurantName })
          : t("admin.users.subtitle")}
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
        <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>{t("admin.users.addTitle")}</h2>
        <form onSubmit={(e) => void onCreate(e)} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>{t("admin.users.email")}</span>
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
            <span>{t("admin.users.password")}</span>
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
              autoComplete="new-password"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>{t("admin.users.role")}</span>
            <select
              className="chip"
              value={role}
              onChange={(e) => setRole(e.target.value === "RESTAURANT_ADMIN" ? "RESTAURANT_ADMIN" : "STAFF")}
              style={{
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--bg-elevated)",
                color: "var(--text)",
              }}
            >
              <option value="STAFF">{t("admin.users.roleStaff")}</option>
              <option value="RESTAURANT_ADMIN">{t("admin.users.roleAdmin")}</option>
            </select>
          </label>
          <button type="submit" className="btnPrimary" disabled={saving || !rid} style={{ cursor: "pointer", justifySelf: "start" }}>
            {saving ? "…" : t("admin.users.save")}
          </button>
          {saved ? <p style={{ margin: 0, color: "var(--success)" }}>{t("admin.users.saved")}</p> : null}
        </form>
      </section>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{t("admin.users.listTitle")}</h2>
          <button type="button" className="chip" onClick={() => void load()} disabled={loading} style={{ cursor: "pointer" }}>
            {loading ? "…" : t("admin.users.refresh")}
          </button>
        </div>

        {data && data.ok ? (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
                border: "1px solid var(--border)",
                borderRadius: 12,
              }}
            >
              <thead>
                <tr style={{ background: "var(--panel)" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px" }}>{t("admin.users.colEmail")}</th>
                  <th style={{ textAlign: "left", padding: "10px 12px" }}>{t("admin.users.colRole")}</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", width: 120 }}>{t("admin.users.colActions")}</th>
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
                      {u.role === "RESTAURANT_ADMIN" ? t("admin.users.roleLabelAdmin") : t("admin.users.roleLabelStaff")}
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
                            title={t("admin.users.resetTitle")}
                          >
                            {resettingId === u.id
                              ? "…"
                              : resetOpenId === u.id
                                ? t("admin.users.resetCancel")
                                : t("admin.users.resetPassword")}
                          </button>
                        ) : null}

                        {data.sessionGlobalRole === "SUPER_ADMIN" && resetOpenId === u.id ? (
                          <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                            <input
                              type="password"
                              value={resetNewPassword}
                              onChange={(e) => setResetNewPassword(e.target.value)}
                              placeholder={t("admin.users.resetPlaceholder")}
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
                              {t("admin.users.save")}
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
                            {removingId === u.id ? "…" : t("admin.users.remove")}
                          </button>
                        ) : u.id === data.sessionUserId ? (
                          <span className="textMuted2" style={{ fontSize: 12 }}>
                            {t("admin.users.me")}
                          </span>
                        ) : (
                          <span className="textMuted2" style={{ fontSize: 12 }} title={t("admin.users.removeAdminHint")}>
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
            {loading ? t("admin.users.loading") : "—"}
          </p>
        )}
      </section>
    </>
  );

  if (embedded) return <div>{body}</div>;
  return <main className="adminPage">{body}</main>;
}
