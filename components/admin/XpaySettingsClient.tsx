"use client";

import * as React from "react";

import { useAdminLanguage } from "./AdminLanguageProvider";

type XpayGet =
  | {
      ok: true;
      hasRow: boolean;
      hasEnvFallback: boolean;
      hasApiKey: boolean;
      environment: "sandbox" | "production";
      disabled: boolean;
      lastOkAtIso: string | null;
      lastError: string | null;
    }
  | { ok: false; error: string };

export function XpaySettingsClient({ restaurantId }: { restaurantId: string }) {
  const { t } = useAdminLanguage();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);
  const [data, setData] = React.useState<XpayGet | null>(null);
  const [apiKey, setApiKey] = React.useState("");
  const [environment, setEnvironment] = React.useState<"sandbox" | "production">("sandbox");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(restaurantId)}/xpay`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const j = (await r.json()) as XpayGet;
      setData(j);
      if (!j.ok) {
        setErr(j.error);
        return;
      }
      setEnvironment(j.environment);
    } catch {
      setErr(t("admin.xpay.loadErr"));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(restaurantId)}/xpay`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() || undefined, environment }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setErr(typeof j.error === "string" ? j.error : t("admin.xpay.saveFailed"));
        return;
      }
      setApiKey("");
      setMsg(t("admin.xpay.saved"));
      await load();
    } catch {
      setErr(t("admin.xpay.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (disabled: boolean) => {
    setToggling(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(restaurantId)}/xpay`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setErr(typeof j.error === "string" ? j.error : t("admin.xpay.toggleFailed"));
        return;
      }
      await load();
    } catch {
      setErr(t("admin.xpay.toggleFailed"));
    } finally {
      setToggling(false);
    }
  };

  const ok = data && data.ok ? data : null;

  return (
    <section
      style={{
        marginTop: 16,
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 16,
        background: "var(--panel)",
      }}
    >
      <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>{t("admin.xpay.title")}</h2>
      <p className="textMuted2" style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.55 }}>
        {t("admin.xpay.intro")}
      </p>
      {loading ? <p className="textMuted">{t("admin.xpay.loading")}</p> : null}
      {err ? (
        <p role="alert" style={{ color: "#fecaca" }}>
          {err}
        </p>
      ) : null}
      {msg ? <p style={{ color: "var(--success)" }}>{msg}</p> : null}
      {ok ? (
        <>
          <p className="textMuted2" style={{ margin: "0 0 10px", fontSize: 13 }}>
            {t("admin.xpay.status")}{" "}
            {ok.disabled ? (
              <strong style={{ color: "#fca5a5" }}>{t("admin.xpay.statusDisabled")}</strong>
            ) : ok.hasApiKey || ok.hasEnvFallback ? (
              <strong style={{ color: "var(--success)" }}>{t("admin.xpay.statusActive")}</strong>
            ) : (
              <strong>{t("admin.xpay.statusNone")}</strong>
            )}
            {ok.hasApiKey ? ` · ${t("admin.xpay.keyOk")}` : ok.hasEnvFallback ? ` · ${t("admin.xpay.keyEnv")}` : ` · ${t("admin.xpay.keyMissing")}`}
            {` · ${ok.environment === "production" ? t("admin.xpay.envProduction") : t("admin.xpay.envSandbox")}`}
          </p>
          {ok.lastOkAtIso ? (
            <p className="textMuted2" style={{ margin: "0 0 8px", fontSize: 12 }}>
              {t("admin.xpay.lastOk")} {ok.lastOkAtIso}
            </p>
          ) : null}
          {ok.lastError ? (
            <p role="alert" style={{ margin: "0 0 12px", fontSize: 12, color: "#fecaca" }}>
              {t("admin.xpay.lastError")} {ok.lastError}
            </p>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {ok.hasRow ? (
              <button
                type="button"
                className="chip"
                disabled={toggling}
                onClick={() => void onToggle(!ok.disabled)}
                style={{ cursor: "pointer" }}
              >
                {ok.disabled ? t("admin.xpay.enable") : t("admin.xpay.disable")}
              </button>
            ) : null}
            <button type="button" className="chip" onClick={() => void load()} style={{ cursor: "pointer" }}>
              {t("admin.xpay.refreshStatus")}
            </button>
          </div>
          <form onSubmit={(e) => void onSave(e)} style={{ display: "grid", gap: 10, maxWidth: 520 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              {t("admin.xpay.apiKey")}
              <input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={ok.hasApiKey ? t("admin.xpay.apiKeyKeep") : t("admin.xpay.apiKeyPlaceholder")}
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)" }}
              />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              {t("admin.xpay.environment")}
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value === "production" ? "production" : "sandbox")}
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)" }}
              >
                <option value="sandbox">{t("admin.xpay.envSandbox")}</option>
                <option value="production">{t("admin.xpay.envProduction")}</option>
              </select>
            </label>
            <button type="submit" className="btnPrimary" disabled={saving} style={{ justifySelf: "start" }}>
              {saving ? t("admin.xpay.saving") : t("admin.xpay.save")}
            </button>
          </form>
        </>
      ) : null}
    </section>
  );
}
