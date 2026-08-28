"use client";

import { AdminChipLink } from "../../../components/admin/AdminNavLink";
import { useAdminLanguage } from "../../../components/admin/AdminLanguageProvider";
import * as React from "react";

type Resp = { ok: true } | { ok: false; error: string };

export default function AdminAccountPage() {
  const { t } = useAdminLanguage();
  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [newPassword2, setNewPassword2] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const errMsg = (msg: string | undefined): string => {
    if (!msg) return t("admin.account.err.generic");
    const m: Record<string, string> = {
      Error: t("admin.account.err.unknown"),
      Unauthorized: t("admin.account.err.unauthorized"),
      "Invalid credentials": t("admin.account.err.invalidCredentials"),
      "Passwords do not match": t("admin.account.err.passwordsMismatch"),
      "Password too short": t("admin.account.err.passwordTooShort"),
      "Missing password": t("admin.account.err.missingPassword"),
    };
    return m[msg] ?? msg;
  };

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
        setErr(errMsg("error" in j ? j.error : "Error"));
        return;
      }
      setOldPassword("");
      setNewPassword("");
      setNewPassword2("");
      setSaved(true);
    } catch {
      setErr(t("admin.account.networkErr"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="adminPage">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: "1.5rem" }}>{t("admin.account.title")}</h1>
          <p className="textMuted2" style={{ margin: 0, fontSize: 13 }}>
            {t("admin.account.subtitle")}
          </p>
        </div>
        <AdminChipLink href="/admin">{t("admin.account.backAdmin")}</AdminChipLink>
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
        <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>{t("admin.account.changeTitle")}</h2>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>{t("admin.account.oldPassword")}</span>
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
            <span>{t("admin.account.newPassword")}</span>
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
            <span>{t("admin.account.newPassword2")}</span>
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
            {saving ? "…" : t("admin.account.save")}
          </button>
          {saved ? <p style={{ margin: 0, color: "var(--success)" }}>{t("admin.account.saved")}</p> : null}
        </form>
      </section>
    </main>
  );
}
