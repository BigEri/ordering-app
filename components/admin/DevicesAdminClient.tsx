"use client";

import * as React from "react";

import { tStaff } from "../../lib/i18n/tStaff";

export type DevicesAdminClientProps = {
  /** Restaurant to list/manage — preferred over cookie alone. */
  restaurantId: string;
  restaurantName?: string | null;
  /** When true, omit outer adminPage main (embedded in restaurant tabs). */
  embedded?: boolean;
  /** Pairing flow link (defaults to restaurant-scoped pair route). */
  pairHref?: string;
};

type DeviceRow = {
  deviceId: string;
  tableId: string;
  tableLabel: string;
  lastSeen: number;
  online: boolean;
  userAgent?: string;
  restaurantId?: string | null;
  kioskApkVersionCode?: number | null;
};

type KioskRelease = {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  sha256: string | null;
} | null;

type HealthPayload = {
  ok?: boolean;
  ts?: string;
  imageStorageConfigured?: boolean;
  pos?: { configured?: boolean };
  sentry?: { configured?: boolean };
  dotykacka?: { syncConfigured?: boolean; hint?: string | null };
};

type IntegrationsStatusPayload = {
  ok?: boolean;
  ts?: string;
  pos?: { configured?: boolean };
  sentry?: { configured?: boolean };
  dotykacka?: { syncConfigured?: boolean; hint?: string | null };
};

type DotyTable = { id: number; name: string };

function resolveDotykackaTableDisplay(
  tableId: string,
  tableLabel: string,
  dotyById: Map<string, DotyTable>,
): { name: string; fromDotyka: boolean } {
  const tid = tableId.trim();
  const hit = tid ? dotyById.get(tid) : undefined;
  if (hit?.name) return { name: hit.name, fromDotyka: true };
  const lbl = tableLabel.trim();
  if (lbl) return { name: lbl, fromDotyka: false };
  if (tid) return { name: `Stůl ${tid}`, fromDotyka: false };
  return { name: "—", fromDotyka: false };
}

export function DevicesAdminClient({
  restaurantId,
  restaurantName = null,
  embedded = false,
  pairHref,
}: DevicesAdminClientProps) {
  const rid = restaurantId.trim();
  const resolvedPairHref =
    pairHref?.trim() ||
    (rid ? `/admin/restaurants/${encodeURIComponent(rid)}/devices/pair` : "/admin/devices/pair-kiosk");

  const [devices, setDevices] = React.useState<DeviceRow[] | null>(null);
  const [loadErr, setLoadErr] = React.useState(false);
  const [health, setHealth] = React.useState<HealthPayload | null>(null);
  const [healthLoading, setHealthLoading] = React.useState(true);
  const [healthErr, setHealthErr] = React.useState(false);
  const [healthWarn, setHealthWarn] = React.useState<string | null>(null);
  const [reloadErr, setReloadErr] = React.useState(false);
  const [reloadErrDetail, setReloadErrDetail] = React.useState<string | null>(null);
  const [reloadOk, setReloadOk] = React.useState<string | null>(null);
  const [reloadingId, setReloadingId] = React.useState<string | null>(null);
  const [menuRefreshLoading, setMenuRefreshLoading] = React.useState(false);
  const [menuRefreshOk, setMenuRefreshOk] = React.useState<string | null>(null);
  const [menuRefreshErr, setMenuRefreshErr] = React.useState(false);
  const [menuRefreshErrDetail, setMenuRefreshErrDetail] = React.useState<string | null>(null);
  const [reloadAllLoading, setReloadAllLoading] = React.useState(false);
  const [apkUpdateErr, setApkUpdateErr] = React.useState(false);
  const [apkUpdateErrDetail, setApkUpdateErrDetail] = React.useState<string | null>(null);
  const [apkUpdatingId, setApkUpdatingId] = React.useState<string | null>(null);
  const [apkUpdateOk, setApkUpdateOk] = React.useState<string | null>(null);
  const [apkUpdatePending, setApkUpdatePending] = React.useState<string | null>(null);
  const [apkConfirmDevice, setApkConfirmDevice] = React.useState<DeviceRow | null>(null);
  const [kioskRelease, setKioskRelease] = React.useState<KioskRelease>(null);
  const [dotyTables, setDotyTables] = React.useState<DotyTable[] | null>(null);
  const activeRestaurantId = rid || null;
  const activeRestaurantName = restaurantName;

  const [tableEditDevice, setTableEditDevice] = React.useState<DeviceRow | null>(null);
  const [editTableId, setEditTableId] = React.useState("");
  const [editTableLabel, setEditTableLabel] = React.useState("");
  const [editTableSaving, setEditTableSaving] = React.useState(false);
  const [editTableMsg, setEditTableMsg] = React.useState<"ok" | "err" | null>(null);

  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [listRefreshing, setListRefreshing] = React.useState(false);

  const devicesListUrl = React.useMemo(() => {
    if (!rid) return "/api/devices";
    return `/api/devices?restaurantId=${encodeURIComponent(rid)}`;
  }, [rid]);

  const load = React.useCallback(async () => {
    setLoadErr(false);
    if (!rid) {
      setLoadErr(true);
      return;
    }
    try {
      const r = await fetch(devicesListUrl, { cache: "no-store", credentials: "same-origin" });
      const data = (await r.json()) as { ok?: boolean; devices?: DeviceRow[]; kioskRelease?: KioskRelease };
      if (!r.ok || !data.ok || !data.devices) {
        setLoadErr(true);
        return;
      }
      setDevices(data.devices);
      setKioskRelease(data.kioskRelease ?? null);
    } catch {
      setLoadErr(true);
    }
  }, [devicesListUrl, rid]);

  const loadHealth = React.useCallback(async (restaurantId: string | null) => {
    setHealthErr(false);
    setHealthWarn(null);
    setHealthLoading(true);
    try {
      const intQs =
        restaurantId != null && restaurantId !== ""
          ? `?restaurantId=${encodeURIComponent(restaurantId)}`
          : "";
      const [healthRes, intRes] = await Promise.all([
        fetch("/api/health", { cache: "no-store" }),
        fetch(`/api/admin/integrations-status${intQs}`, {
          cache: "no-store",
          credentials: "same-origin",
        }),
      ]);

      let merged: HealthPayload | null = null;
      let healthFailed = false;

      if (healthRes.ok) {
        const data = (await healthRes.json()) as HealthPayload;
        if (data.ok) {
          merged = { ...data };
        } else {
          healthFailed = true;
        }
      } else {
        healthFailed = true;
      }

      if (intRes.ok) {
        const intData = (await intRes.json()) as IntegrationsStatusPayload;
        if (intData.ok !== false) {
          merged = {
            ...(merged ?? { ok: true }),
            ts: intData.ts ?? merged?.ts,
            pos: { configured: intData.pos?.configured },
            sentry: { configured: intData.sentry?.configured },
            dotykacka: {
              syncConfigured: intData.dotykacka?.syncConfigured,
              hint: intData.dotykacka?.hint ?? null,
            },
          };
        }
      }

      if (merged) {
        setHealth(merged);
        setHealthErr(false);
        if (healthFailed) {
          setHealthWarn(tStaff("admin.devices.healthDbWarn"));
        }
        return;
      }

      setHealthErr(true);
      setHealth(null);
    } catch {
      setHealthErr(true);
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    void loadHealth(activeRestaurantId);
  }, [loadHealth, activeRestaurantId]);

  React.useEffect(() => {
    if (!tableEditDevice) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTableEditDevice(null);
        setEditTableMsg(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tableEditDevice]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/admin/dotykacka/tables", { cache: "no-store" });
        const j = (await r.json()) as { ok?: boolean; tables?: DotyTable[] };
        if (cancelled) return;
        if (!r.ok || !j.ok || !j.tables) {
          setDotyTables(null);
          return;
        }
        setDotyTables(j.tables);
      } catch {
        if (!cancelled) setDotyTables(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openTableEdit = (d: DeviceRow) => {
    setTableEditDevice(d);
    setEditTableId(d.tableId);
    setEditTableLabel(d.tableLabel);
    setEditTableMsg(null);
  };

  const closeTableEdit = () => {
    setTableEditDevice(null);
    setEditTableMsg(null);
  };

  const onSaveTableEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableEditDevice) return;
    const rid = (tableEditDevice.restaurantId ?? activeRestaurantId ?? "").trim();
    if (!rid) {
      setEditTableMsg("err");
      return;
    }
    const tid = editTableId.trim();
    const lbl = editTableLabel.trim();
    if (!tid || !lbl) {
      setEditTableMsg("err");
      return;
    }
    setEditTableSaving(true);
    setEditTableMsg(null);
    try {
      const r = await fetch("/api/devices/bind", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceId: tableEditDevice.deviceId,
          tableId: tid,
          tableLabel: lbl,
          restaurantId: rid,
        }),
      });
      if (!r.ok) {
        setEditTableMsg("err");
        return;
      }
      setEditTableMsg("ok");
      await load();
      closeTableEdit();
    } catch {
      setEditTableMsg("err");
    } finally {
      setEditTableSaving(false);
    }
  };

  const onRefreshList = React.useCallback(async () => {
    setListRefreshing(true);
    try {
      await load();
      await loadHealth(activeRestaurantId);
    } finally {
      setListRefreshing(false);
    }
  }, [activeRestaurantId, load, loadHealth]);

  const onApkUpdate = async (device: DeviceRow) => {
    if (!kioskRelease) return;
    setApkConfirmDevice(null);
    setApkUpdateErr(false);
    setApkUpdateErrDetail(null);
    setApkUpdateOk(null);
    setApkUpdatePending(null);
    setApkUpdatingId(device.deviceId);
    const targetCode = kioskRelease.versionCode;
    const targetLabel = tStaff("admin.devices.apkVersionFmt")
      .replace("{name}", kioskRelease.versionName)
      .replace("{code}", String(targetCode));

    let sentNonce: number | null = null;
    try {
      const r = await fetch("/api/devices/apk-update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ deviceId: device.deviceId }),
      });
      const data = (await r.json()) as { ok?: boolean; apkUpdateNonce?: number; error?: string };
      if (!r.ok || !data.ok) {
        setApkUpdateErr(true);
        setApkUpdateErrDetail(data.error ?? null);
        return;
      }
      sentNonce = typeof data.apkUpdateNonce === "number" ? data.apkUpdateNonce : null;

      const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
      for (let i = 0; i < 30; i++) {
        await sleep(i === 0 ? 2000 : 4000);
        const listRes = await fetch(devicesListUrl, { cache: "no-store", credentials: "same-origin" });
        const listData = (await listRes.json()) as { ok?: boolean; devices?: DeviceRow[] };
        if (!listRes.ok || !listData.ok || !listData.devices) continue;
        setDevices(listData.devices);
        const row = listData.devices.find((d) => d.deviceId === device.deviceId);
        const reported = row?.kioskApkVersionCode;
        if (reported != null && reported >= targetCode) {
          const versionLabel = tStaff("admin.devices.apkVersionFmt")
            .replace("{name}", kioskRelease.versionName)
            .replace("{code}", String(reported));
          setApkUpdateOk(
            tStaff("admin.devices.apkUpdateOk")
              .replace("{table}", device.tableLabel)
              .replace("{version}", versionLabel)
              .replace("{code}", String(reported)),
          );
          return;
        }
      }

      setApkUpdatePending(
        tStaff("admin.devices.apkUpdatePending")
          .replace("{nonce}", sentNonce != null ? String(sentNonce) : "?")
          .replace("{target}", targetLabel),
      );
    } catch {
      setApkUpdateErr(true);
    } finally {
      setApkUpdatingId(null);
    }
  };

  const openApkConfirm = (device: DeviceRow) => {
    if (!kioskRelease) return;
    setApkConfirmDevice(device);
  };

  const formatApkOnDevice = (code: number | null | undefined) => {
    if (code == null) return tStaff("admin.devices.apkVersionUnknown");
    const name =
      kioskRelease && code === kioskRelease.versionCode ? kioskRelease.versionName : String(code);
    return tStaff("admin.devices.apkVersionFmt").replace("{name}", name).replace("{code}", String(code));
  };

  const formatApkOnServer = () => {
    if (!kioskRelease) return "—";
    return tStaff("admin.devices.apkVersionFmt")
      .replace("{name}", kioskRelease.versionName)
      .replace("{code}", String(kioskRelease.versionCode));
  };

  const onForceReload = async (deviceId: string) => {
    setReloadErr(false);
    setReloadErrDetail(null);
    setReloadOk(null);
    setReloadingId(deviceId);
    try {
      const r = await fetch("/api/devices/reload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ deviceId }),
      });
      const data = (await r.json()) as { ok?: boolean; reloadNonce?: number; error?: string };
      if (!r.ok || !data.ok) {
        setReloadErr(true);
        setReloadErrDetail(data.error ?? null);
        return;
      }
      const n = typeof data.reloadNonce === "number" ? data.reloadNonce : "?";
      const shortId = `${deviceId.slice(0, 24)}${deviceId.length > 24 ? "…" : ""}`;
      setReloadOk(
        tStaff("admin.devices.reloadOk").replace("{device}", shortId).replace("{nonce}", String(n)),
      );
    } catch {
      setReloadErr(true);
    } finally {
      setReloadingId(null);
    }
  };

  const onForceReloadAll = async () => {
    if (!rid) return;
    setReloadErr(false);
    setReloadErrDetail(null);
    setReloadOk(null);
    setReloadAllLoading(true);
    try {
      const r = await fetch(`/api/admin/restaurants/${encodeURIComponent(rid)}/kiosk-reload-all`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await r.json()) as { ok?: boolean; devicesSignaled?: number; error?: string };
      if (!r.ok || !data.ok) {
        setReloadErr(true);
        setReloadErrDetail(data.error ?? null);
        return;
      }
      const n = typeof data.devicesSignaled === "number" ? data.devicesSignaled : 0;
      setReloadOk(tStaff("admin.devices.reloadAllOk").replace("{devices}", String(n)));
    } catch {
      setReloadErr(true);
    } finally {
      setReloadAllLoading(false);
    }
  };

  const onRefreshMenuFromDotykacka = async () => {
    setMenuRefreshErr(false);
    setMenuRefreshErrDetail(null);
    setMenuRefreshOk(null);
    setMenuRefreshLoading(true);
    try {
      const r = await fetch("/api/admin/menu/refresh-from-dotykacka", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ bumpDevices: true, restaurantId: rid }),
      });
      const data = (await r.json()) as {
        ok?: boolean;
        error?: string;
        devicesNotified?: number;
        sectionCount?: number;
        menuPrefetchOk?: boolean;
        menuPrefetchError?: string;
      };
      if (!r.ok || !data.ok) {
        setMenuRefreshErr(true);
        setMenuRefreshErrDetail(data.error ?? null);
        return;
      }
      if (data.menuPrefetchOk === false) {
        setMenuRefreshOk(
          tStaff("admin.devices.refreshMenuFromDotykackaWarn").replace(
            "{error}",
            data.menuPrefetchError ?? "?",
          ),
        );
        return;
      }
      const sections = typeof data.sectionCount === "number" ? data.sectionCount : "?";
      const devices = typeof data.devicesNotified === "number" ? data.devicesNotified : 0;
      setMenuRefreshOk(
        tStaff("admin.devices.refreshMenuFromDotykackaOk")
          .replace("{sections}", String(sections))
          .replace("{devices}", String(devices)),
      );
    } catch {
      setMenuRefreshErr(true);
    } finally {
      setMenuRefreshLoading(false);
    }
  };

  const onRemoveDevice = async (d: DeviceRow) => {
    const ok = window.confirm(`Opravdu odstranit zařízení?\n\n${d.tableLabel} (${d.tableId})\n${d.deviceId}`);
    if (!ok) return;
    setRemovingId(d.deviceId);
    try {
      const r = await fetch("/api/admin/devices/remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ deviceId: d.deviceId }),
      });
      if (!r.ok) return;
      await load();
    } catch {
      /* ignore */
    } finally {
      setRemovingId(null);
    }
  };

  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleString("cs-CZ", {
      dateStyle: "short",
      timeStyle: "medium",
    });

  const dotyTableById = React.useMemo(() => {
    const m = new Map<string, DotyTable>();
    for (const t of dotyTables ?? []) {
      m.set(String(t.id), t);
    }
    return m;
  }, [dotyTables]);

  return (
    <div className={embedded ? undefined : "adminPage"}>
      {embedded ? null : (
        <>
          <h1 style={{ margin: "0 0 8px", fontSize: "1.5rem" }}>{tStaff("admin.devices.title")}</h1>
          <p className="textMuted" style={{ margin: "0 0 20px", maxWidth: 52 * 16 }}>
            {tStaff("admin.devices.subtitle")}
          </p>
        </>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          className="chip"
          disabled={listRefreshing}
          onClick={() => void onRefreshList()}
          style={{ cursor: listRefreshing ? "wait" : "pointer" }}
          title={tStaff("admin.devices.refreshAllHint")}
        >
          {listRefreshing ? "…" : tStaff("admin.devices.refresh")}
        </button>
        <button
          type="button"
          className="chip"
          disabled={reloadAllLoading || !activeRestaurantId}
          onClick={() => void onForceReloadAll()}
          style={{ cursor: reloadAllLoading || !activeRestaurantId ? "not-allowed" : "pointer" }}
          title={tStaff("admin.devices.reloadAllHint")}
        >
          {reloadAllLoading ? "…" : tStaff("admin.devices.reloadAll")}
        </button>
        <button
          type="button"
          className="chip"
          disabled={menuRefreshLoading || !activeRestaurantId}
          onClick={() => void onRefreshMenuFromDotykacka()}
          style={{ cursor: menuRefreshLoading || !activeRestaurantId ? "not-allowed" : "pointer" }}
          title={tStaff("admin.devices.refreshMenuFromDotykackaHint")}
        >
          {menuRefreshLoading ? "…" : tStaff("admin.devices.refreshMenuFromDotykacka")}
        </button>
        <a href={resolvedPairHref} className="chip" style={{ textDecoration: "none" }}>
          Párování u stolů (Dotykačka)
        </a>
      </div>

      <section
        style={{
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 16,
          marginBottom: 20,
          background: "var(--panel)",
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: "1.05rem" }}>{tStaff("admin.devices.healthTitle")}</h2>
        {activeRestaurantName ? (
          <p className="textMuted2" style={{ margin: "0 0 8px", fontSize: 13 }}>
            Kontrola Dotykačky pro: <strong>{activeRestaurantName}</strong>
          </p>
        ) : null}
        {healthLoading ? (
          <p className="textMuted" style={{ margin: 0 }}>
            {tStaff("admin.devices.healthLoading")}
          </p>
        ) : null}
        {healthErr ? (
          <p role="alert" style={{ margin: 0, color: "#fecaca" }}>
            {tStaff("admin.devices.healthErr")}
          </p>
        ) : null}
        {healthWarn ? (
          <p role="status" style={{ margin: healthErr ? "8px 0 0" : 0, color: "#fcd34d", fontSize: 14 }}>
            {healthWarn}
          </p>
        ) : null}
        {!healthLoading && !healthErr && health ? (
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
            <li style={{ color: "var(--success)" }}>{tStaff("admin.devices.healthOk")}</li>
            {health.ts ? (
              <li className="textMuted2" style={{ fontSize: 13 }}>
                {health.ts}
              </li>
            ) : null}
            <li className="textMuted2" style={{ fontSize: 13 }}>
              {health.imageStorageConfigured
                ? tStaff("admin.devices.healthImageYes")
                : tStaff("admin.devices.healthImageNo")}
            </li>
            <li className="textMuted2" style={{ fontSize: 13 }}>
              {health.pos?.configured
                ? tStaff("admin.devices.healthPosYes")
                : tStaff("admin.devices.healthPosNo")}
            </li>
            <li className="textMuted2" style={{ fontSize: 13 }}>
              {health.sentry?.configured
                ? tStaff("admin.devices.healthSentryYes")
                : tStaff("admin.devices.healthSentryNo")}
            </li>
            <li
              style={{
                color: health.dotykacka?.syncConfigured ? "var(--success)" : "#fcd34d",
                fontSize: 13,
              }}
            >
              {health.dotykacka?.syncConfigured
                ? tStaff("admin.devices.healthDotykackaYes")
                : tStaff("admin.devices.healthDotykackaNo")}
              {health.dotykacka?.syncConfigured === false && health.dotykacka?.hint ? (
                <span className="textMuted2" style={{ display: "block", marginTop: 4, color: "var(--muted)" }}>
                  {health.dotykacka.hint}
                </span>
              ) : null}
            </li>
          </ul>
        ) : null}
      </section>

      {reloadOk ? (
        <p role="status" style={{ color: "#bbf7d0", marginBottom: 12, fontSize: 14 }}>
          {reloadOk}
        </p>
      ) : null}
      {menuRefreshOk ? (
        <p role="status" style={{ color: "#bbf7d0", marginBottom: 12, fontSize: 14 }}>
          {menuRefreshOk}
        </p>
      ) : null}
      {menuRefreshErr ? (
        <p role="alert" style={{ color: "#fecaca", marginBottom: 12 }}>
          {menuRefreshErrDetail ?? tStaff("admin.devices.refreshMenuFromDotykackaErr")}
        </p>
      ) : null}
      {reloadErr ? (
        <p role="alert" style={{ color: "#fecaca", marginBottom: 12 }}>
          {reloadErrDetail ?? tStaff("admin.devices.reloadErr")}
        </p>
      ) : null}

      {apkUpdateErr ? (
        <p role="alert" style={{ color: "#fecaca", marginBottom: 12 }}>
          {apkUpdateErrDetail ?? tStaff("admin.devices.apkUpdateErr")}
        </p>
      ) : null}
      {apkUpdateOk ? (
        <p role="status" style={{ color: "#bbf7d0", marginBottom: 12, fontSize: 14 }}>
          {apkUpdateOk}
        </p>
      ) : null}
      {apkUpdatePending ? (
        <p role="status" style={{ color: "#fde68a", marginBottom: 12, fontSize: 14 }}>
          {apkUpdatePending}
        </p>
      ) : null}

      <p className="textMuted" style={{ margin: "0 0 12px", maxWidth: 52 * 16, lineHeight: 1.5, fontSize: 13 }}>
        {tStaff("admin.devices.apkUpdateHint")}
        {kioskRelease ? (
          <>
            {" "}
            {tStaff("admin.devices.apkRelease")}: <strong>{kioskRelease.versionName}</strong> (code{" "}
            {kioskRelease.versionCode}).
          </>
        ) : (
          <> {tStaff("admin.devices.apkUpdateNoRelease")}</>
        )}
      </p>

      {loadErr ? (
        <p role="alert" style={{ color: "#fecaca" }}>
          {tStaff("admin.devices.loadErr")}
        </p>
      ) : null}

      {!loadErr && devices === null ? (
        <p className="textMuted" style={{ marginBottom: 16 }}>
          {tStaff("admin.devices.loading")}
        </p>
      ) : null}

      {!loadErr && devices && devices.length === 0 ? (
        <p className="textMuted" style={{ marginBottom: 16, maxWidth: 52 * 16, lineHeight: 1.5 }}>
          {tStaff("admin.devices.emptyList")}
        </p>
      ) : null}

      {devices && devices.length > 0 ? (
        <div style={{ overflowX: "auto", marginBottom: 28 }}>
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
                <th style={{ textAlign: "left", padding: "10px 12px" }}>{tStaff("admin.devices.col.device")}</th>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>{tStaff("admin.devices.col.table")}</th>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>{tStaff("admin.devices.col.dotykackaTable")}</th>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>{tStaff("admin.devices.apkOnDevice")}</th>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>{tStaff("admin.devices.col.status")}</th>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>{tStaff("admin.devices.col.last")}</th>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>{tStaff("admin.devices.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => {
                const doty = resolveDotykackaTableDisplay(d.tableId, d.tableLabel, dotyTableById);
                return (
                <tr key={d.deviceId} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                    {d.deviceId}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <strong>{d.tableLabel}</strong>
                    <span className="textMuted2" style={{ marginLeft: 6 }}>
                      ({d.tableId})
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <strong style={{ fontSize: 15 }}>{doty.name}</strong>
                    <div className="textMuted2" style={{ marginTop: 4, fontSize: 12, fontFamily: "ui-monospace, monospace" }}>
                      ID {d.tableId || "—"}
                      {doty.fromDotyka ? (
                        <span style={{ marginLeft: 8, fontFamily: "inherit" }}>· z Dotykačky</span>
                      ) : (
                        <span style={{ marginLeft: 8, fontFamily: "inherit" }}>· jen v aplikaci</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                    {d.kioskApkVersionCode != null ? (
                      <>
                        {formatApkOnDevice(d.kioskApkVersionCode)}
                        {kioskRelease && d.kioskApkVersionCode < kioskRelease.versionCode ? (
                          <span style={{ marginLeft: 6, color: "#fbbf24" }}>↑</span>
                        ) : kioskRelease && d.kioskApkVersionCode >= kioskRelease.versionCode ? (
                          <span style={{ marginLeft: 6, color: "var(--success)" }}>✓</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="textMuted2">{tStaff("admin.devices.apkVersionUnknown")}</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {d.online ? (
                      <span style={{ color: "var(--success)" }}>{tStaff("admin.devices.online")}</span>
                    ) : (
                      <span className="textMuted">{tStaff("admin.devices.offline")}</span>
                    )}
                    {d.lastSeen > 0 ? (
                      <div className="textMuted2" style={{ marginTop: 4, fontSize: 11 }}>
                        {tStaff("admin.devices.lastSeenHint")}: {fmtTime(d.lastSeen)}
                      </div>
                    ) : null}
                  </td>
                  <td style={{ padding: "10px 12px" }}>{fmtTime(d.lastSeen)}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                      <button
                        type="button"
                        className="chip"
                        disabled={!d.restaurantId && !activeRestaurantId}
                        onClick={() => openTableEdit(d)}
                        style={{ cursor: d.restaurantId || activeRestaurantId ? "pointer" : "not-allowed" }}
                        title={!d.restaurantId && !activeRestaurantId ? "Chybí vazba na vaši restauraci" : undefined}
                      >
                        {tStaff("admin.devices.editTable")}
                      </button>
                      <button
                        type="button"
                        className="chip"
                        disabled={!kioskRelease || apkUpdatingId === d.deviceId}
                        onClick={() => openApkConfirm(d)}
                        style={{ cursor: kioskRelease ? "pointer" : "not-allowed" }}
                        title={!kioskRelease ? tStaff("admin.devices.apkUpdateNoRelease") : undefined}
                      >
                        {apkUpdatingId === d.deviceId ? "…" : tStaff("admin.devices.apkUpdate")}
                      </button>
                      <button
                        type="button"
                        className="chip"
                        disabled={reloadingId === d.deviceId}
                        onClick={() => void onForceReload(d.deviceId)}
                        style={{ cursor: "pointer" }}
                        title={tStaff("admin.devices.reloadHint")}
                      >
                        {reloadingId === d.deviceId ? "…" : tStaff("admin.devices.reload")}
                      </button>
                      <button
                        type="button"
                        className="chip"
                        disabled={removingId === d.deviceId}
                        onClick={() => void onRemoveDevice(d)}
                        style={{ cursor: removingId === d.deviceId ? "wait" : "pointer" }}
                      >
                        {removingId === d.deviceId ? "…" : "Odstranit zařízení"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {apkConfirmDevice && kioskRelease ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.78)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setApkConfirmDevice(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="apk-update-confirm-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 480,
              width: "100%",
              borderRadius: 16,
              padding: 20,
              background: "var(--menu-card-bg)",
              border: "1px solid var(--border-strong)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <h2 id="apk-update-confirm-title" style={{ margin: "0 0 12px", fontSize: "1.15rem" }}>
              {tStaff("admin.devices.apkUpdateConfirmTitle")}
            </h2>
            <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-line" }}>
              {tStaff("admin.devices.apkUpdateConfirmBody")
                .replace("{table}", apkConfirmDevice.tableLabel)
                .replace(
                  "{device}",
                  `${apkConfirmDevice.deviceId.slice(0, 28)}${apkConfirmDevice.deviceId.length > 28 ? "…" : ""}`,
                )
                .replace("{current}", formatApkOnDevice(apkConfirmDevice.kioskApkVersionCode))
                .replace("{target}", formatApkOnServer())}
            </p>
            {apkConfirmDevice.kioskApkVersionCode != null &&
            apkConfirmDevice.kioskApkVersionCode >= kioskRelease.versionCode ? (
              <p className="textMuted2" style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.5 }}>
                {tStaff("admin.devices.apkUpdateAlreadyCurrent")}
              </p>
            ) : null}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="chip" onClick={() => setApkConfirmDevice(null)}>
                {tStaff("admin.devices.editTableCancel")}
              </button>
              <button
                type="button"
                className="chip"
                disabled={apkUpdatingId === apkConfirmDevice.deviceId}
                onClick={() => void onApkUpdate(apkConfirmDevice)}
                style={{ cursor: "pointer" }}
              >
                {apkUpdatingId === apkConfirmDevice.deviceId ? "…" : tStaff("admin.devices.apkUpdate")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tableEditDevice ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.78)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={closeTableEdit}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="device-edit-table-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 440,
              width: "100%",
              borderRadius: 16,
              padding: 20,
              background: "var(--menu-card-bg)",
              border: "1px solid var(--border-strong)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <h2 id="device-edit-table-title" style={{ margin: "0 0 8px", fontSize: "1.15rem" }}>
              {tStaff("admin.devices.editTableTitle")}
            </h2>
            <p className="textMuted2" style={{ margin: "0 0 6px", fontSize: 12, fontFamily: "ui-monospace, monospace", wordBreak: "break-all" }}>
              {tableEditDevice.deviceId}
            </p>
            <p className="textMuted2" style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.5 }}>
              {tStaff("admin.devices.editTableHint")}
            </p>
            <form onSubmit={(ev) => void onSaveTableEdit(ev)} style={{ display: "grid", gap: 12 }}>
              {(dotyTables?.length ?? 0) > 0 ? (
                <label style={{ display: "grid", gap: 4 }}>
                  <span className="textMuted2" style={{ fontSize: 12 }}>
                    Rychlý výběr ze seznamu Dotykačky
                  </span>
                  <select
                    className="chip"
                    style={{
                      padding: "10px 12px",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      background: "var(--bg-elevated)",
                      color: "var(--text)",
                    }}
                    value=""
                    onChange={(e) => {
                      const nextId = e.target.value;
                      if (!nextId) return;
                      setEditTableId(nextId);
                      const hit = dotyTables?.find((t) => String(t.id) === nextId);
                      setEditTableLabel(hit ? hit.name : `Stůl ${nextId}`);
                    }}
                  >
                    <option value="">— vyberte stůl —</option>
                    {dotyTables!.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.name} ({t.id})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label style={{ display: "grid", gap: 4 }}>
                <span>{tStaff("admin.devices.bindTableId")}</span>
                <input
                  className="chip"
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                  }}
                  value={editTableId}
                  onChange={(e) => setEditTableId(e.target.value.trim())}
                  autoComplete="off"
                />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span>{tStaff("admin.devices.bindTableLabel")}</span>
                <input
                  className="chip"
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    background: "var(--bg-elevated)",
                    color: "var(--text)",
                  }}
                  value={editTableLabel}
                  onChange={(e) => setEditTableLabel(e.target.value)}
                  autoComplete="off"
                />
              </label>
              {editTableMsg === "err" ? (
                <p role="alert" style={{ margin: 0, color: "#fecaca", fontSize: 14 }}>
                  {tStaff("admin.devices.editTableErr")}
                </p>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
                <button type="submit" className="btnPrimary" disabled={editTableSaving} style={{ cursor: editTableSaving ? "wait" : "pointer" }}>
                  {editTableSaving ? tStaff("admin.devices.editTableSaving") : tStaff("admin.devices.editTableSave")}
                </button>
                <button type="button" className="chip" onClick={closeTableEdit} style={{ cursor: "pointer" }}>
                  {tStaff("admin.devices.editTableCancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
