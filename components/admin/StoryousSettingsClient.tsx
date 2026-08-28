"use client";

import * as React from "react";

import { useAdminLanguage } from "./AdminLanguageProvider";

type Desk = { deskId: string; name: string; code: string };
type Place = { placeId: string; name: string; state: string | null };

type Preview = {
  deskCount: number;
  desks: Desk[];
  menuItemCount: number;
  placeState: string | null;
};

type StoryousGet =
  | {
      ok: true;
      hasAppCredentials: boolean;
      hasRow: boolean;
      merchantId: string;
      placeId: string;
      merchantName: string | null;
      placeName: string | null;
      disabled: boolean;
      lastOkAtIso: string | null;
      lastError: string | null;
      envDefaults: { merchantId: string; placeId: string };
      preview: Preview | null;
    }
  | { ok: false; error: string };

export function StoryousSettingsClient({ restaurantId }: { restaurantId: string }) {
  const { t } = useAdminLanguage();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);
  const [placesLoading, setPlacesLoading] = React.useState(false);
  const [data, setData] = React.useState<StoryousGet | null>(null);
  const [merchantId, setMerchantId] = React.useState("");
  const [placeId, setPlaceId] = React.useState("");
  const [places, setPlaces] = React.useState<Place[] | null>(null);
  const [merchantName, setMerchantName] = React.useState<string | null>(null);
  const [desks, setDesks] = React.useState<Desk[] | null>(null);
  const [menuItemCount, setMenuItemCount] = React.useState<number | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const applyGet = React.useCallback((j: Extract<StoryousGet, { ok: true }>) => {
    setData(j);
    setMerchantId(j.merchantId || j.envDefaults.merchantId);
    setPlaceId(j.placeId || j.envDefaults.placeId);
    setMerchantName(j.merchantName);
    setDesks(j.preview?.desks ?? null);
    setMenuItemCount(typeof j.preview?.menuItemCount === "number" ? j.preview.menuItemCount : null);
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(restaurantId)}/storyous`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const j = (await r.json()) as StoryousGet;
      if (!j.ok) {
        setData(j);
        setErr(j.error ?? t("admin.storyous.loadErr"));
        return;
      }
      applyGet(j);
    } catch {
      setErr(t("admin.storyous.loadErr"));
    } finally {
      setLoading(false);
    }
  }, [applyGet, restaurantId, t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const loadPlaces = React.useCallback(async () => {
    const mid = merchantId.trim();
    if (!mid) {
      setErr(t("admin.storyous.needMerchantId"));
      return;
    }
    setPlacesLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/storyous/places?merchantId=${encodeURIComponent(mid)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const j = (await r.json()) as {
        ok?: boolean;
        merchantName?: string;
        places?: Place[];
        error?: string;
      };
      if (!r.ok || !j.ok) {
        setErr(typeof j.error === "string" ? j.error : t("admin.storyous.placesLoadErr"));
        setPlaces([]);
        return;
      }
      setMerchantName(j.merchantName ?? null);
      setPlaces(j.places ?? []);
    } catch {
      setErr(t("admin.storyous.placesLoadErr"));
    } finally {
      setPlacesLoading(false);
    }
  }, [merchantId, t]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(restaurantId)}/storyous`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId: merchantId.trim(), placeId: placeId.trim() }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        error?: string;
        merchantName?: string;
        placeName?: string;
        lastOkAtIso?: string | null;
        preview?: { desks?: Desk[]; menuItemCount?: number; deskCount?: number };
      };
      if (!r.ok || !j.ok) {
        setErr(typeof j.error === "string" ? j.error : t("admin.storyous.saveFailed"));
        return;
      }
      setMerchantName(j.merchantName ?? null);
      setDesks(j.preview?.desks ?? []);
      setMenuItemCount(typeof j.preview?.menuItemCount === "number" ? j.preview.menuItemCount : null);
      setMsg(
        t("admin.storyous.connected", {
          place: j.placeName ?? t("admin.storyous.placeFallback"),
          desks: j.preview?.deskCount ?? 0,
          items: j.preview?.menuItemCount ?? 0,
        }),
      );
      await load();
    } catch {
      setErr(t("admin.storyous.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async () => {
    if (!data || !data.ok || !data.hasRow) return;
    setToggling(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(restaurantId)}/storyous`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: !data.disabled }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setErr(typeof j.error === "string" ? j.error : t("admin.storyous.toggleFailed"));
        return;
      }
      await load();
    } catch {
      setErr(t("admin.storyous.toggleFailed"));
    } finally {
      setToggling(false);
    }
  };

  const connected = Boolean(data && data.ok && data.hasRow && !data.disabled);

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
      <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>{t("admin.storyous.title")}</h2>
      <p className="textMuted2" style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.55 }}>
        {t("admin.storyous.intro")}
      </p>

      {loading ? <p className="textMuted">{t("admin.storyous.loading")}</p> : null}

      {!loading && err ? (
        <p role="alert" style={{ color: "#fecaca", margin: "0 0 12px", fontSize: 13, lineHeight: 1.5 }}>
          {err}
        </p>
      ) : null}

      {!loading && !(data && data.ok) ? (
        <button type="button" className="chip" onClick={() => void load()} style={{ cursor: "pointer", marginBottom: 12 }}>
          {t("admin.storyous.retry")}
        </button>
      ) : null}

      {!loading && data && data.ok && !data.hasAppCredentials ? (
        <p role="alert" style={{ color: "#fecaca" }}>
          {t("admin.storyous.missingCreds")}
        </p>
      ) : null}

      {!loading && data && data.ok ? (
        <>
          <div style={{ display: "grid", gap: 6, margin: "0 0 12px" }}>
            <p className="textMuted2" style={{ margin: 0, fontSize: 13 }}>
              {t("admin.storyous.status")}{" "}
              {data.disabled ? (
                <strong style={{ color: "#fca5a5" }}>{t("admin.storyous.statusDisabled")}</strong>
              ) : data.hasRow ? (
                <strong style={{ color: "var(--success)" }}>{t("admin.storyous.statusActive")}</strong>
              ) : (
                <strong>{t("admin.storyous.statusNone")}</strong>
              )}
            </p>
            {data.merchantName || data.placeName ? (
              <p className="textMuted2" style={{ margin: 0, fontSize: 13 }}>
                {data.merchantName ?? "—"}
                {data.placeName ? ` · ${data.placeName}` : ""}
              </p>
            ) : null}
            {data.lastOkAtIso ? (
              <p className="textMuted2" style={{ margin: 0, fontSize: 12 }}>
                {t("admin.storyous.lastOk")} <span style={{ fontFamily: "ui-monospace, monospace" }}>{data.lastOkAtIso}</span>
              </p>
            ) : null}
            {data.lastError ? (
              <p role="alert" style={{ margin: 0, fontSize: 12, color: "#fecaca" }}>
                {t("admin.storyous.lastError")} <span style={{ fontFamily: "ui-monospace, monospace" }}>{data.lastError}</span>
              </p>
            ) : null}
          </div>

          <form onSubmit={(e) => void onSave(e)} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>{t("admin.storyous.merchantId")}</span>
              <input
                className="chip"
                style={{
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  background: "var(--bg-elevated)",
                  color: "var(--text)",
                  fontFamily: "ui-monospace, monospace",
                }}
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                placeholder={t("admin.storyous.merchantPlaceholder")}
                autoComplete="off"
              />
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                className="chip"
                onClick={() => void loadPlaces()}
                disabled={placesLoading || !data.hasAppCredentials}
                style={{ cursor: placesLoading ? "wait" : "pointer" }}
              >
                {placesLoading ? t("admin.storyous.loadingPlaces") : t("admin.storyous.loadPlaces")}
              </button>
              {data.hasRow ? (
                <button
                  type="button"
                  className="chip"
                  onClick={() => void onToggle()}
                  disabled={toggling}
                  style={{ cursor: toggling ? "wait" : "pointer" }}
                >
                  {toggling ? "…" : data.disabled ? t("admin.storyous.enable") : t("admin.storyous.disable")}
                </button>
              ) : null}
              <button type="button" className="chip" onClick={() => void load()} style={{ cursor: "pointer" }}>
                {t("admin.storyous.refreshStatus")}
              </button>
            </div>
            {merchantName ? (
              <p className="textMuted2" style={{ margin: 0, fontSize: 13 }}>
                {t("admin.storyous.merchantLabel")} <strong>{merchantName}</strong>
              </p>
            ) : null}
            <label style={{ display: "grid", gap: 6 }}>
              <span>{t("admin.storyous.placeLabel")}</span>
              {places && places.length > 0 ? (
                <select
                  className="chip"
                  aria-label={t("admin.storyous.placeAria")}
                  value={places.some((p) => p.placeId === placeId.trim()) ? placeId.trim() : ""}
                  onChange={(e) => {
                    if (e.target.value) setPlaceId(e.target.value);
                  }}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                    maxWidth: "100%",
                  }}
                >
                  <option value="">{t("admin.storyous.placePlaceholderOption")}</option>
                  {places.map((p) => (
                    <option key={p.placeId} value={p.placeId}>
                      {p.name}
                      {p.state ? ` (${p.state})` : ""}
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                className="chip"
                style={{
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  background: "var(--bg-elevated)",
                  color: "var(--text)",
                  fontFamily: "ui-monospace, monospace",
                }}
                value={placeId}
                onChange={(e) => setPlaceId(e.target.value)}
                placeholder={t("admin.storyous.placePlaceholder")}
                autoComplete="off"
              />
            </label>
            {msg ? (
              <p role="status" style={{ margin: 0, fontSize: 13 }}>
                {msg}
              </p>
            ) : null}
            <div>
              <button
                type="submit"
                className="btnPrimary"
                disabled={saving || !data.hasAppCredentials}
                style={{ cursor: saving || !data.hasAppCredentials ? "not-allowed" : "pointer" }}
              >
                {saving ? t("admin.storyous.verifying") : t("admin.storyous.verifySave")}
              </button>
            </div>
          </form>

          {connected && (desks != null || menuItemCount != null) ? (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>{t("admin.storyous.desksTitle")}</h3>
              {menuItemCount != null ? (
                <p className="textMuted2" style={{ margin: "0 0 8px", fontSize: 13 }}>
                  {t("admin.storyous.menuItemCount", { count: menuItemCount })}
                </p>
              ) : null}
              {desks && desks.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {desks.map((d) => (
                    <li key={d.deskId} style={{ fontSize: 13 }}>
                      {d.name} <span className="textMuted2">{t("admin.storyous.deskCode", { code: d.code })}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="textMuted2" style={{ margin: 0, fontSize: 13 }}>
                  {t("admin.storyous.desksEmpty")}
                </p>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
