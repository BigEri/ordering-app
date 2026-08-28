"use client";

import * as React from "react";

import { isKioskWebView } from "../../../lib/kiosk/isKioskWebView";
import { navigateToKioskMode } from "../../../lib/kiosk/modeSwitch";
import { AdminLanguageMenu } from "../../../components/admin/AdminLanguageMenu";
import { useAdminLanguage } from "../../../components/admin/AdminLanguageProvider";
import { TableflowBrand } from "../../../components/admin/TableflowBrand";

export function LoginClient({ nextPath }: { nextPath: string }) {
  const { t } = useAdminLanguage();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [kiosk, setKiosk] = React.useState(false);
  const [hostSwitching, setHostSwitching] = React.useState(false);

  React.useEffect(() => {
    setKiosk(isKioskWebView());
  }, []);

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
        setErr(data.error ?? t("admin.login.failed"));
        return;
      }
      window.setTimeout(() => {
        window.location.replace(nextPath);
      }, 50);
    } catch {
      setErr(t("admin.login.networkErr"));
    } finally {
      setLoading(false);
    }
  };

  const backToHost = async () => {
    const ok = window.confirm(t("admin.login.backToHostConfirm"));
    if (!ok) return;
    setHostSwitching(true);
    try {
      await navigateToKioskMode("host");
    } catch {
      setHostSwitching(false);
    }
  };

  return (
    <div className="adminLoginPage">
      <main style={{ maxWidth: 520, margin: "0 auto", padding: "40px 16px 64px" }}>
        <div className="adminLoginLang">
          <div>
            <h1 style={{ margin: "0 0 8px", fontSize: "1.6rem" }}>{t("admin.login.title")}</h1>
            <p className="textMuted" style={{ margin: "0 0 20px" }}>
              {t("admin.login.subtitle")}
            </p>
          </div>
          <AdminLanguageMenu />
        </div>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>{t("admin.login.email")}</span>
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
            <span>{t("admin.login.password")}</span>
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
            {loading ? "…" : t("admin.login.submit")}
          </button>
        </form>

        {err ? (
          <p role="alert" style={{ marginTop: 12, color: "#fecaca" }}>
            {err}
          </p>
        ) : null}

        {kiosk ? (
          <p className="textMuted" style={{ marginTop: 28, fontSize: 13, lineHeight: 1.45 }}>
            {t("admin.login.kioskHint")}{" "}
            <button
              type="button"
              onClick={() => void backToHost()}
              disabled={hostSwitching}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "inherit",
                textDecoration: "underline",
                cursor: hostSwitching ? "wait" : "pointer",
                font: "inherit",
              }}
            >
              {hostSwitching ? "…" : t("admin.login.backToHost")}
            </button>
          </p>
        ) : null}
      </main>
      <TableflowBrand className="tableflowBrand--loginCorner" />
    </div>
  );
}
