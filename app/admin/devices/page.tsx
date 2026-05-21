"use client";

import * as React from "react";

import { tStaff } from "../../../lib/i18n/tStaff";

type DeviceRow = {
  deviceId: string;
  tableId: string;
  tableLabel: string;
  lastSeen: number;
  online: boolean;
  userAgent?: string;
  restaurantId?: string | null;
  pairingLocked?: number;
};

type HealthPayload = {
  ok?: boolean;
  ts?: string;
  pos?: { externalUrlConfigured?: boolean };
  sentry?: { configured?: boolean };
  dotykacka?: { syncConfigured?: boolean };
};

type DotyTable = { id: number; name: string };

export default function AdminDevicesPage() {
  const [devices, setDevices] = React.useState<DeviceRow[] | null>(null);
  const [loadErr, setLoadErr] = React.useState(false);
  const [health, setHealth] = React.useState<HealthPayload | null>(null);
  const [healthLoading, setHealthLoading] = React.useState(true);
  const [healthErr, setHealthErr] = React.useState(false);
  const [reloadErr, setReloadErr] = React.useState(false);
  const [reloadingId, setReloadingId] = React.useState<string | null>(null);
  const [bindDeviceId, setBindDeviceId] = React.useState("");
  const [bindTableId, setBindTableId] = React.useState("");
  const [bindTableLabel, setBindTableLabel] = React.useState("");
  const [dotyTables, setDotyTables] = React.useState<DotyTable[] | null>(null);
  const [dotyTablesErr, setDotyTablesErr] = React.useState(false);
  const [bindMsg, setBindMsg] = React.useState<"ok" | "err" | null>(null);
  const [bindLoading, setBindLoading] = React.useState(false);
  const [activeRestaurantId, setActiveRestaurantId] = React.useState<string | null>(null);
  const [activeRestaurantName, setActiveRestaurantName] = React.useState<string | null>(null);

  const [tableEditDevice, setTableEditDevice] = React.useState<DeviceRow | null>(null);
  const [editTableId, setEditTableId] = React.useState("");
  const [editTableLabel, setEditTableLabel] = React.useState("");
  const [editTableSaving, setEditTableSaving] = React.useState(false);
  const [editTableMsg, setEditTableMsg] = React.useState<"ok" | "err" | null>(null);

  const [lockSavingId, setLockSavingId] = React.useState<string | null>(null);
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoadErr(false);
    try {
      const r = await fetch("/api/devices", { cache: "no-store", credentials: "same-origin" });
      const data = (await r.json()) as { ok?: boolean; devices?: DeviceRow[] };
      if (!r.ok || !data.ok || !data.devices) {
        setLoadErr(true);
        return;
      }
      setDevices(data.devices);
    } catch {
      setLoadErr(true);
    }
  }, []);

  const loadHealth = React.useCallback(async () => {
    setHealthErr(false);
    setHealthLoading(true);
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      const data = (await r.json()) as HealthPayload;
      if (!r.ok || !data.ok) {
        setHealthErr(true);
        setHealth(null);
        return;
      }
      setHealth(data);
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
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/admin/me", { cache: "no-store", credentials: "same-origin" });
        const j = (await r.json()) as {
          ok?: boolean;
          activeRestaurantId?: string | null;
          activeRestaurantName?: string | null;
        };
        if (cancelled || !r.ok || !j.ok) return;
        setActiveRestaurantId(j.activeRestaurantId ?? null);
        setActiveRestaurantName(j.activeRestaurantName ?? null);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

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
    setDotyTablesErr(false);
    void (async () => {
      try {
        const r = await fetch("/api/admin/dotykacka/tables", { cache: "no-store" });
        const j = (await r.json()) as { ok?: boolean; tables?: DotyTable[] };
        if (cancelled) return;
        if (!r.ok || !j.ok || !j.tables) {
          setDotyTablesErr(true);
          setDotyTables(null);
          return;
        }
        setDotyTables(j.tables);
      } catch {
        if (!cancelled) {
          setDotyTablesErr(true);
          setDotyTables(null);
        }
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

  const onForceReload = async (deviceId: string) => {
    setReloadErr(false);
    setReloadingId(deviceId);
    try {
      const r = await fetch("/api/devices/reload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      if (!r.ok) {
        setReloadErr(true);
        return;
      }
    } catch {
      setReloadErr(true);
    } finally {
      setReloadingId(null);
    }
  };

  const onTogglePairingLock = async (d: DeviceRow) => {
    const rid = (d.restaurantId ?? activeRestaurantId ?? "").trim();
    if (!rid) return;
    setLockSavingId(d.deviceId);
    try {
      const nextLocked = (d.pairingLocked ?? 0) !== 1;
      const r = await fetch("/api/admin/devices/pairing-lock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ deviceId: d.deviceId, locked: nextLocked, restaurantId: rid }),
      });
      if (!r.ok) return;
      await load();
    } catch {
      /* ignore */
    } finally {
      setLockSavingId(null);
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

  const onBind = async (e: React.FormEvent) => {
    e.preventDefault();
    setBindMsg(null);
    setBindLoading(true);
    try {
      const r = await fetch("/api/devices/bind", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceId: bindDeviceId.trim(),
          tableId: bindTableId.trim(),
          tableLabel: bindTableLabel.trim(),
          restaurantId: activeRestaurantId ?? "",
        }),
      });
      if (!r.ok) {
        setBindMsg("err");
        return;
      }
      setBindMsg("ok");
      setBindDeviceId("");
      setBindTableId("");
      setBindTableLabel("");
      await load();
    } catch {
      setBindMsg("err");
    } finally {
      setBindLoading(false);
    }
  };

  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleString("cs-CZ", {
      dateStyle: "short",
      timeStyle: "medium",
    });

  return (
    <main className="adminPage">
      <h1 style={{ margin: "0 0 8px", fontSize: "1.5rem" }}>{tStaff("admin.devices.title")}</h1>
      <p className="textMuted" style={{ margin: "0 0 20px", maxWidth: 52 * 16 }}>
        {tStaff("admin.devices.subtitle")}
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          className="chip"
          onClick={() => {
            void load();
            void loadHealth();
          }}
          style={{ cursor: "pointer" }}
          title={tStaff("admin.devices.refreshAllHint")}
        >
          {tStaff("admin.devices.refresh")}
        </button>
        <a href="/menu" className="chip" style={{ textDecoration: "none" }}>
          {tStaff("admin.devices.backMenu")}
        </a>
        <a href="/admin/devices/pair-kiosk" className="chip" style={{ textDecoration: "none" }}>
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
        {!healthLoading && !healthErr && health ? (
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
            <li style={{ color: "var(--success)" }}>{tStaff("admin.devices.healthOk")}</li>
            {health.ts ? (
              <li className="textMuted2" style={{ fontSize: 13 }}>
                {health.ts}
              </li>
            ) : null}
            <li className="textMuted">
              {health.pos?.externalUrlConfigured
                ? tStaff("admin.devices.healthPosYes")
                : tStaff("admin.devices.healthPosNo")}
            </li>
            <li className="textMuted">
              {health.sentry?.configured ? tStaff("admin.devices.healthSentryYes") : tStaff("admin.devices.healthSentryNo")}
            </li>
            <li className="textMuted">
              {health.dotykacka?.syncConfigured
                ? tStaff("admin.devices.healthDotykackaYes")
                : tStaff("admin.devices.healthDotykackaNo")}
            </li>
          </ul>
        ) : null}
      </section>

      {reloadErr ? (
        <p role="alert" style={{ color: "#fecaca", marginBottom: 12 }}>
          {tStaff("admin.devices.reloadErr")}
        </p>
      ) : null}

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
                <th style={{ textAlign: "left", padding: "10px 12px" }}>{tStaff("admin.devices.col.restaurant")}</th>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>{tStaff("admin.devices.col.status")}</th>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>{tStaff("admin.devices.col.last")}</th>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>{tStaff("admin.devices.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
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
                  <td style={{ padding: "10px 12px", fontSize: 12, fontFamily: "ui-monospace, monospace", wordBreak: "break-all" }}>
                    {d.restaurantId ? <span title={d.restaurantId}>{d.restaurantId}</span> : "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {d.online ? (
                      <span style={{ color: "var(--success)" }}>{tStaff("admin.devices.online")}</span>
                    ) : (
                      <span className="textMuted">{tStaff("admin.devices.offline")}</span>
                    )}
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
                        title={!d.restaurantId && !activeRestaurantId ? "Chybí provozovna u zařízení" : undefined}
                      >
                        {tStaff("admin.devices.editTable")}
                      </button>
                      <button
                        type="button"
                        className="chip"
                        disabled={lockSavingId === d.deviceId || (!d.restaurantId && !activeRestaurantId)}
                        onClick={() => void onTogglePairingLock(d)}
                        style={{ cursor: d.restaurantId || activeRestaurantId ? "pointer" : "not-allowed" }}
                        title={!d.restaurantId && !activeRestaurantId ? "Chybí provozovna u zařízení" : undefined}
                      >
                        {(d.pairingLocked ?? 0) === 1 ? "Povolit pairing" : "Zakázat pairing"}
                      </button>
                      <button
                        type="button"
                        className="chip"
                        disabled={reloadingId === d.deviceId}
                        onClick={() => void onForceReload(d.deviceId)}
                        style={{ cursor: "pointer" }}
                      >
                        {tStaff("admin.devices.reload")}
                      </button>
                      <button
                        type="button"
                        className="chip"
                        disabled={removingId === d.deviceId}
                        onClick={() => void onRemoveDevice(d)}
                        style={{ cursor: removingId === d.deviceId ? "wait" : "pointer" }}
                      >
                        Odstranit zařízení
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <section
        style={{
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 20,
          background: "var(--panel)",
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>{tStaff("admin.devices.bindTitle")}</h2>
        <p className="textMuted2" style={{ margin: "0 0 16px", fontSize: 13 }}>
          {tStaff("admin.devices.bindHint")}
        </p>
        <p className="textMuted2" style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.55 }}>
          {tStaff("admin.devices.bindRestaurantHint")}
        </p>
        {activeRestaurantId ? (
          <p className="textMuted" style={{ margin: "0 0 16px", fontSize: 13 }}>
            Aktivní provozovna: <strong>{activeRestaurantName ?? activeRestaurantId}</strong>
          </p>
        ) : (
          <p role="alert" style={{ margin: "0 0 16px", fontSize: 13, color: "#fecaca" }}>
            Není vybraná aktivní restaurace — v Přehledu nebo u detailu provozovny ji vyberte (pill „Aktivní“), jinak přiřazení nelze uložit.
          </p>
        )}
        <p className="textMuted2" style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.5 }}>
          {tStaff("admin.devices.dotykackaHint")}
        </p>
        {dotyTablesErr ? (
          <p className="textMuted2" style={{ margin: "0 0 8px", fontSize: 13 }}>
            Seznam stolů z Dotyky se nepovedlo načíst (zkontrolujte Dotyku u aktivní restaurace v administraci nebo{" "}
            <code>.env</code>). ID stolu můžete zadat ručně níže — z administrace Dotyky nebo z API{" "}
            <code>…/tables</code> (<code>data[].id</code>).
          </p>
        ) : null}
        <form onSubmit={onBind} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span>{tStaff("admin.devices.bindDeviceId")}</span>
            <input
              className="chip"
              style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", color: "var(--text)" }}
              value={bindDeviceId}
              onChange={(e) => setBindDeviceId(e.target.value)}
              autoComplete="off"
            />
          </label>
          <div style={{ display: "grid", gap: 8 }}>
            <span>{tStaff("admin.devices.bindTableId")}</span>
            {(dotyTables?.length ?? 0) > 0 ? (
              <label style={{ display: "grid", gap: 4 }}>
                <span className="textMuted2" style={{ fontSize: 12 }}>
                  Rychlý výběr ze seznamu Dotyky (volitelné)
                </span>
                <select
                  className="chip"
                  style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", color: "var(--text)" }}
                  value=""
                  onChange={(e) => {
                    const nextId = e.target.value;
                    if (!nextId) return;
                    setBindTableId(nextId);
                    const hit = dotyTables?.find((t) => String(t.id) === nextId);
                    setBindTableLabel(hit ? hit.name : `Stůl ${nextId}`);
                  }}
                >
                  <option value="">— vyberte stůl ze seznamu —</option>
                  {dotyTables!.map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {t.name} ({t.id})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label style={{ display: "grid", gap: 4 }}>
              <span className="textMuted2" style={{ fontSize: 12 }}>
                {(dotyTables?.length ?? 0) > 0 ? "Nebo zadejte ručně (povinné, pokud nic nevyberete výše)" : "Povinné — číslo ID stolu z Dotyky"}
              </span>
              <input
                className="chip"
                placeholder="např. 374619822"
                style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", color: "var(--text)" }}
                value={bindTableId}
                onChange={(e) => setBindTableId(e.target.value.trim())}
                autoComplete="off"
              />
            </label>
          </div>
          <label style={{ display: "grid", gap: 4 }}>
            <span>{tStaff("admin.devices.bindTableLabel")}</span>
            <input
              className="chip"
              style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-elevated)", color: "var(--text)" }}
              value={bindTableLabel}
              onChange={(e) => setBindTableLabel(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="btnPrimary"
            disabled={bindLoading || !activeRestaurantId}
            style={{ cursor: bindLoading || !activeRestaurantId ? "not-allowed" : "pointer", justifySelf: "start" }}
          >
            {tStaff("admin.devices.bindSubmit")}
          </button>
        </form>
        {bindMsg === "ok" ? (
          <p style={{ margin: "12px 0 0", color: "var(--success)" }}>{tStaff("admin.devices.bindOk")}</p>
        ) : null}
        {bindMsg === "err" ? (
          <p role="alert" style={{ margin: "12px 0 0", color: "#fecaca" }}>
            {tStaff("admin.devices.bindErr")}
          </p>
        ) : null}
      </section>

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
                    Rychlý výběr ze seznamu Dotyky
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
    </main>
  );
}
