"use client";

import Link from "next/link";
import * as React from "react";

import { tStaff } from "../../../../lib/i18n/tStaff";

type MePayload = {
  ok?: boolean;
  session?: { globalRole?: string };
  activeRestaurantId?: string | null;
  activeRestaurantName?: string | null;
};

type RestaurantRow = { id: string; name: string };
type DotyTable = { id: number; name: string };

export function PairKioskClient({ initialDeviceId }: { initialDeviceId?: string | null }) {
  const deviceFromWelcome = React.useMemo(
    () => (typeof initialDeviceId === "string" ? initialDeviceId.trim() : "").slice(0, 200),
    [initialDeviceId],
  );
  const [meLoading, setMeLoading] = React.useState(true);
  const [me, setMe] = React.useState<MePayload | null>(null);
  const [restaurants, setRestaurants] = React.useState<RestaurantRow[] | null>(null);
  const [restaurantId, setRestaurantId] = React.useState("");

  const [tables, setTables] = React.useState<DotyTable[] | null>(null);
  const [tablesLoading, setTablesLoading] = React.useState(false);
  const [tablesErr, setTablesErr] = React.useState<string | null>(null);

  const [tablePick, setTablePick] = React.useState("");
  const [tableId, setTableId] = React.useState("");
  const [tableLabel, setTableLabel] = React.useState("");
  const [code, setCode] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [pairedDeviceId, setPairedDeviceId] = React.useState<string | null>(null);

  const isSuper = me?.session?.globalRole === "SUPER_ADMIN";

  const loadTables = React.useCallback(async () => {
    setTablesLoading(true);
    setTablesErr(null);
    setTables(null);
    try {
      const r = await fetch("/api/admin/dotykacka/tables", { cache: "no-store", credentials: "same-origin" });
      const j = (await r.json()) as { ok?: boolean; tables?: DotyTable[]; error?: string };
      if (!r.ok || !j.ok) {
        setTablesErr(typeof j.error === "string" ? j.error : tStaff("admin.devices.pairKioskTablesErr"));
        setTables([]);
        return;
      }
      setTables(j.tables ?? []);
    } catch {
      setTablesErr(tStaff("admin.devices.pairKioskTablesErr"));
      setTables([]);
    } finally {
      setTablesLoading(false);
    }
  }, []);

  const applyActiveRestaurant = React.useCallback(
    async (rid: string) => {
      const id = rid.trim();
      if (!id) return;
      const r = await fetch("/api/admin/restaurant/select", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ restaurantId: id }),
      });
      if (!r.ok) {
        setTablesErr(tStaff("admin.devices.pairKioskSelectRestaurantErr"));
        return;
      }
      await loadTables();
    },
    [loadTables],
  );

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/admin/me", { cache: "no-store", credentials: "same-origin" });
        const j = (await r.json()) as MePayload;
        if (cancelled) return;
        if (!r.ok || !j.ok) {
          setMe(null);
          return;
        }
        setMe(j);
        const rr = await fetch("/api/admin/restaurants", { cache: "no-store", credentials: "same-origin" });
        const jr = (await rr.json()) as { ok?: boolean; restaurants?: RestaurantRow[] };
        if (cancelled || !rr.ok || !jr.ok || !jr.restaurants) return;
        setRestaurants(jr.restaurants);
        const active = j.activeRestaurantId?.trim();
        let initialRid = "";
        if (active && jr.restaurants.some((x) => x.id === active)) {
          initialRid = active;
        } else if (jr.restaurants.length === 1) {
          initialRid = jr.restaurants[0].id;
        }
        setRestaurantId(initialRid);
        if (initialRid && j.session?.globalRole === "SUPER_ADMIN") {
          await applyActiveRestaurant(initialRid);
        } else if (initialRid || j.session?.globalRole !== "SUPER_ADMIN") {
          await loadTables();
        }
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setMeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyActiveRestaurant, loadTables]);

  /** Po naskenování QR z úvodní stránky tabletu — načíst stejný párovací kód (tablet ho mezitím vygeneruje). */
  React.useEffect(() => {
    if (!deviceFromWelcome || me === null || meLoading) return;
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      if (cancelled || attempts++ > 28) return;
      try {
        const r = await fetch(
          `/api/public/device-pairing-lookup?deviceId=${encodeURIComponent(deviceFromWelcome)}`,
          { cache: "no-store" },
        );
        const j = (await r.json()) as { ok?: boolean; code?: string | null };
        if (!cancelled && r.ok && j.ok && typeof j.code === "string" && j.code) {
          setCode(j.code);
        }
      } catch {
        /* ignore */
      }
    };
    void poll();
    const t = window.setInterval(poll, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [deviceFromWelcome, me, meLoading]);

  const onRestaurantChange = async (rid: string) => {
    setRestaurantId(rid);
    setTablePick("");
    setTableId("");
    setTableLabel("");
    setMsg(null);
    setErr(null);
    if (!rid) {
      setTables(null);
      return;
    }
    if (isSuper) {
      await applyActiveRestaurant(rid);
    } else {
      await loadTables();
    }
  };

  const onTableSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setTablePick(v);
    setMsg(null);
    setErr(null);
    if (!v) {
      setTableId("");
      setTableLabel("");
      return;
    }
    if (v === "__manual__") {
      setTableId("");
      setTableLabel("");
      return;
    }
    const t = tables?.find((x) => String(x.id) === v);
    if (t) {
      setTableId(String(t.id));
      setTableLabel(t.name);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        code: code.trim().toUpperCase(),
        tableId: tableId.trim(),
        tableLabel: tableLabel.trim(),
      };
      if (isSuper && restaurantId.trim()) {
        body.restaurantId = restaurantId.trim();
      }
      const r = await fetch("/api/admin/devices/pair-by-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string; deviceId?: string };
      if (!r.ok || !j.ok) {
        setErr(typeof j.error === "string" ? j.error : tStaff("admin.devices.bindErr"));
        return;
      }
      setMsg(tStaff("admin.devices.pairKioskSuccess"));
      const did = typeof j.deviceId === "string" ? j.deviceId.trim() : "";
      setPairedDeviceId(did && did.length <= 200 ? did : deviceFromWelcome || null);
      setCode("");
      setTablePick("");
      setTableId("");
      setTableLabel("");
    } catch {
      setErr(tStaff("admin.devices.bindErr"));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    code.trim().length >= 4 &&
    tableId.trim() &&
    tableLabel.trim() &&
    (isSuper ? restaurantId.trim() : Boolean(me?.activeRestaurantId));

  if (meLoading) {
    return (
      <main className="adminPage">
        <p className="textMuted">{tStaff("admin.devices.loading")}</p>
      </main>
    );
  }

  if (me === null) {
    const nextPair =
      deviceFromWelcome.length > 0
        ? `/admin/devices/pair-kiosk?device=${encodeURIComponent(deviceFromWelcome)}`
        : "/admin/devices/pair-kiosk";
    const loginHref = `/admin/login?next=${encodeURIComponent(nextPair)}`;
    return (
      <main className="adminPage">
        <h1 style={{ margin: "0 0 12px", fontSize: "1.35rem" }}>{tStaff("admin.devices.pairKioskTitle")}</h1>
        <p className="textMuted" style={{ marginBottom: 12 }}>
          {tStaff("admin.devices.pairKioskLoginHint")}
        </p>
        {deviceFromWelcome ? (
          <p className="textMuted" style={{ marginBottom: 16, fontSize: 14, lineHeight: 1.5 }}>
            {tStaff("admin.devices.pairKioskFromQrHint")}
          </p>
        ) : null}
        <Link href={loginHref} className="chip" style={{ textDecoration: "none" }}>
          {tStaff("admin.devices.pairKioskLoginCta")}
        </Link>
      </main>
    );
  }

  return (
    <main className="adminPage">
      <h1 style={{ margin: "0 0 8px", fontSize: "1.5rem" }}>{tStaff("admin.devices.pairKioskTitle")}</h1>
      <p className="textMuted" style={{ margin: "0 0 20px", maxWidth: 56 * 16, lineHeight: 1.55 }}>
        {tStaff("admin.devices.pairKioskSubtitle")}
      </p>

      {deviceFromWelcome ? (
        <p className="textMuted2" style={{ margin: "-8px 0 16px", fontSize: 13, lineHeight: 1.5, wordBreak: "break-all" }}>
          {tStaff("admin.devices.pairKioskDeviceLinked")}: <code>{deviceFromWelcome}</code>
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <Link href="/admin/devices" className="chip" style={{ textDecoration: "none" }}>
          ← {tStaff("admin.devices.title")}
        </Link>
        <Link href="/pair" className="chip" style={{ textDecoration: "none" }}>
          {tStaff("admin.devices.pairKioskLegacyLink")}
        </Link>
        {pairedDeviceId ? (
          <Link
            href={`/menu?deviceId=${encodeURIComponent(pairedDeviceId)}`}
            className="chip"
            style={{ textDecoration: "none" }}
          >
            Otevřít kiosk menu →
          </Link>
        ) : null}
      </div>

      <form
        onSubmit={(e) => void onSubmit(e)}
        style={{
          maxWidth: 520,
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 20,
          background: "var(--panel)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {isSuper && restaurants && restaurants.length > 0 ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="textMuted2" style={{ fontSize: 13 }}>
              {tStaff("admin.devices.pairKioskRestaurant")}
            </span>
            <select
              className="chip"
              value={restaurantId}
              onChange={(e) => void onRestaurantChange(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--text)",
              }}
            >
              <option value="">{tStaff("admin.devices.pairKioskRestaurantPlaceholder")}</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {!isSuper && !me.activeRestaurantId ? (
          <p role="alert" style={{ color: "#fecaca", margin: 0 }}>
            {tStaff("admin.devices.pairKioskNoActiveRestaurant")}
          </p>
        ) : null}

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="textMuted2" style={{ fontSize: 13 }}>
            {tStaff("admin.devices.pairKioskCode")}
          </span>
          <input
            className="chip"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            placeholder="ABC12X"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text)",
              letterSpacing: "0.1em",
            }}
          />
        </label>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="textMuted2" style={{ fontSize: 13 }}>
            {tStaff("admin.devices.pairKioskTableFromDoty")}
          </span>
          {tablesLoading ? <p className="textMuted" style={{ margin: 0 }}>{tStaff("admin.devices.loading")}</p> : null}
          {!tablesLoading && tablesErr ? (
            <p role="alert" style={{ color: "#fecaca", margin: 0, fontSize: 14 }}>
              {tablesErr}
            </p>
          ) : null}
          {!tablesLoading && !tablesErr && tables && tables.length > 0 ? (
            <select
              className="chip"
              value={tablePick}
              onChange={onTableSelectChange}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--text)",
              }}
            >
              <option value="">{tStaff("admin.devices.pairKioskTablePlaceholder")}</option>
              {tables.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name} (id {t.id})
                </option>
              ))}
              <option value="__manual__">{tStaff("admin.devices.pairKioskTableManualOption")}</option>
            </select>
          ) : null}
          {!tablesLoading && !tablesErr && tables && tables.length === 0 && restaurantId ? (
            <p className="textMuted" style={{ margin: 0, fontSize: 14 }}>
              {tStaff("admin.devices.pairKioskNoTables")}
            </p>
          ) : null}
        </div>

        {(tablePick === "__manual__" || (tables && tables.length === 0 && !tablesLoading)) && (restaurantId || me.activeRestaurantId) ? (
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="textMuted2" style={{ fontSize: 13 }}>
                {tStaff("admin.devices.bindTableId")}
              </span>
              <input
                className="chip"
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg-elevated)",
                  color: "var(--text)",
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="textMuted2" style={{ fontSize: 13 }}>
                {tStaff("admin.devices.bindTableLabel")}
              </span>
              <input
                className="chip"
                value={tableLabel}
                onChange={(e) => setTableLabel(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg-elevated)",
                  color: "var(--text)",
                }}
              />
            </label>
          </div>
        ) : null}

        {err ? (
          <p role="alert" style={{ color: "#fecaca", margin: 0 }}>
            {err}
          </p>
        ) : null}
        {msg ? (
          <p role="status" style={{ color: "var(--success)", margin: 0 }}>
            {msg}
          </p>
        ) : null}

        <button
          type="submit"
          className="btnPrimary"
          disabled={submitting || !canSubmit}
          style={{ cursor: submitting || !canSubmit ? "not-allowed" : "pointer", alignSelf: "flex-start" }}
        >
          {submitting ? tStaff("admin.devices.pairKioskSubmitting") : tStaff("admin.devices.pairKioskSubmit")}
        </button>
      </form>
    </main>
  );
}
