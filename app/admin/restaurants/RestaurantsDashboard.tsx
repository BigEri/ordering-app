"use client";

import * as React from "react";

import { useAdminLanguage } from "../../../components/admin/AdminLanguageProvider";
import { AdminChipLink } from "../../../components/admin/AdminNavLink";
import { postSelectActiveRestaurant } from "../../../lib/admin/clientRestaurantSelect";
import type { RestaurantsDashboardPageData } from "../../../lib/server/restaurantsDashboardPage";
import type { RestaurantOverviewItem, RestaurantsOverviewPayload } from "../../../lib/server/restaurantOverview";

type MeResponse =
  | {
      ok: true;
      session: { userId: string; email: string; globalRole: "SUPER_ADMIN" | "USER" };
      activeRestaurantId: string | null;
    }
  | { ok: false; error: string };

type OverviewResponse =
  | {
      ok: true;
      ts: string;
      summary: {
        total: number;
        operationalReady: number;
        incomplete: number;
        fullyOnboarded: number;
      };
      restaurants: RestaurantOverviewItem[];
    }
  | { ok: false; error: string };

type ListFilter = "all" | "incomplete" | "ready";

function OnboardingChecklist({ item }: { item: RestaurantOverviewItem }) {
  const { t } = useAdminLanguage();
  const steps: { key: keyof RestaurantOverviewItem["onboarding"]; label: string }[] = [
    { key: "dotykacka", label: t("admin.dashboard.stepDotykacka") },
    { key: "device", label: t("admin.dashboard.stepDevice") },
    { key: "welcome", label: t("admin.dashboard.stepWelcome") },
    { key: "menuPhoto", label: t("admin.dashboard.stepMenuPhoto") },
  ];
  return (
    <ul className="adminOnboardingChecklist" aria-label={t("admin.dashboard.checklistAria")}>
      {steps.map((s) => {
        const done = item.onboarding[s.key];
        return (
          <li key={s.key} className={done ? "adminOnboardingChecklist__item--done" : undefined}>
            <span className="adminOnboardingChecklist__mark" aria-hidden="true">
              {done ? "✓" : "○"}
            </span>
            <span>{s.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

function StatusBadge({ item }: { item: RestaurantOverviewItem }) {
  const { t } = useAdminLanguage();
  if (item.fullyOnboarded) {
    return <span className="adminRestaurantStatus adminRestaurantStatus--ok">{t("admin.dashboard.statusComplete")}</span>;
  }
  if (item.operationalReady) {
    return <span className="adminRestaurantStatus adminRestaurantStatus--ready">{t("admin.dashboard.statusReady")}</span>;
  }
  return <span className="adminRestaurantStatus adminRestaurantStatus--warn">{t("admin.dashboard.statusWarn")}</span>;
}

function meFromPageData(data: RestaurantsDashboardPageData): MeResponse | null {
  if (data.kind === "forbidden") {
    return {
      ok: true,
      session: { userId: "", email: data.email, globalRole: data.globalRole as "USER" },
      activeRestaurantId: data.activeRestaurantId,
    };
  }
  if (data.kind === "ok") {
    return {
      ok: true,
      session: { userId: "", email: data.email, globalRole: data.globalRole },
      activeRestaurantId: data.activeRestaurantId,
    };
  }
  return null;
}

function overviewFromPayload(payload: RestaurantsOverviewPayload): OverviewResponse {
  return payload;
}

type RestaurantsDashboardProps = {
  pageData: RestaurantsDashboardPageData;
};

export function RestaurantsDashboard({ pageData }: RestaurantsDashboardProps) {
  const { t } = useAdminLanguage();
  const hasInitialOverview = pageData.kind === "ok";
  const [me, setMe] = React.useState<MeResponse | null>(() => meFromPageData(pageData));
  const [overview, setOverview] = React.useState<OverviewResponse | null>(() =>
    pageData.kind === "ok" ? overviewFromPayload(pageData.overview) : null,
  );
  const [err, setErr] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [selecting, setSelecting] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [filterQ, setFilterQ] = React.useState("");
  const [listFilter, setListFilter] = React.useState<ListFilter>("all");

  const [restaurantName, setRestaurantName] = React.useState("");
  const [managerEmail, setManagerEmail] = React.useState("");
  const [managerPassword, setManagerPassword] = React.useState("");

  const load = React.useCallback(async (opts?: { background?: boolean }) => {
    if (!opts?.background) setErr(null);
    setRefreshing(true);
    try {
      const [meR, oR] = await Promise.all([
        fetch("/api/admin/me", { cache: "no-store", credentials: "same-origin" }),
        fetch("/api/admin/restaurants/overview", { cache: "no-store", credentials: "same-origin" }),
      ]);
      const meJ = (await meR.json()) as MeResponse;
      const oJ = (await oR.json()) as OverviewResponse;
      if (meR.ok && meJ.ok) setMe(meJ);
      if (oR.ok && oJ.ok) setOverview(oJ);
      if (!meR.ok || !meJ.ok) setErr(t("admin.dashboard.loadProfileErr"));
      if (!oR.ok || !oJ.ok) {
        const errMsg = "error" in oJ && oJ.error ? oJ.error : t("admin.dashboard.loadOverviewErr");
        if (!opts?.background || !overview?.ok) setErr(errMsg);
      }
    } catch {
      setErr(t("admin.dashboard.networkErr"));
    } finally {
      setRefreshing(false);
    }
  }, [overview, t]);

  React.useEffect(() => {
    if (hasInitialOverview) return;
    void load();
  }, [hasInitialOverview, load]);

  const onOpen = async (restaurantId: string, next = "/admin") => {
    setSelecting(restaurantId);
    setErr(null);
    try {
      const sel = await postSelectActiveRestaurant(restaurantId);
      if (!sel.ok) {
        setErr(sel.error ?? t("admin.dashboard.selectFailed"));
        return;
      }
      window.dispatchEvent(new Event("oa-restaurant-updated"));
      window.location.href = next;
    } catch {
      setErr(t("admin.dashboard.selectNetworkErr"));
    } finally {
      setSelecting(null);
    }
  };

  const forbidden = pageData.kind === "forbidden" || (me?.ok && me.session.globalRole !== "SUPER_ADMIN");
  const listReady = Boolean(overview?.ok);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setCreating(true);
    try {
      const r = await fetch("/api/admin/restaurants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          restaurantName,
          managerEmail,
          managerPassword,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string; restaurantId?: string };
      if (!r.ok || !j.ok || !j.restaurantId) {
        setErr(j.error ?? t("admin.dashboard.createFailed"));
        return;
      }
      setRestaurantName("");
      setManagerEmail("");
      setManagerPassword("");
      await load();
      window.location.href = `/admin/restaurants/${j.restaurantId}`;
    } catch {
      setErr(t("admin.dashboard.createNetworkErr"));
    } finally {
      setCreating(false);
    }
  };

  const activeId = me && me.ok ? me.activeRestaurantId : null;
  const allRows = overview && overview.ok ? overview.restaurants : [];
  const summary = overview && overview.ok ? overview.summary : null;
  const q = filterQ.trim().toLowerCase();

  const filtered = allRows.filter((r) => {
    if (listFilter === "incomplete" && r.operationalReady) return false;
    if (listFilter === "ready" && !r.operationalReady) return false;
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
  });

  return (
    <main className="adminPage">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: "1.5rem" }}>{t("admin.dashboard.title")}</h1>
          <p className="textMuted2" style={{ margin: 0, fontSize: 13, maxWidth: 720, lineHeight: 1.5 }}>
            {t("admin.dashboard.subtitle")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="chip"
            onClick={() => void load({ background: true })}
            disabled={refreshing}
            style={{ cursor: refreshing ? "wait" : "pointer" }}
          >
            {refreshing ? t("admin.dashboard.refreshing") : t("admin.dashboard.refresh")}
          </button>
        </div>
      </div>

      {forbidden ? (
        <p role="alert" style={{ marginTop: 12, color: "#fecaca" }}>
          {t("admin.dashboard.forbidden")}
        </p>
      ) : null}

      {err ? (
        <p role="alert" style={{ marginTop: 12, color: "#fecaca" }}>
          {err}
        </p>
      ) : null}

      {summary ? (
        <div className="adminRestaurantsStats" role="group" aria-label={t("admin.dashboard.statsAria")}>
          <div className="adminRestaurantsStat">
            <span className="adminRestaurantsStat__value">{summary.total}</span>
            <span className="adminRestaurantsStat__label">{t("admin.dashboard.statTotal")}</span>
          </div>
          <div className="adminRestaurantsStat adminRestaurantsStat--ok">
            <span className="adminRestaurantsStat__value">{summary.operationalReady}</span>
            <span className="adminRestaurantsStat__label">{t("admin.dashboard.statReady")}</span>
          </div>
          <div className="adminRestaurantsStat adminRestaurantsStat--warn">
            <span className="adminRestaurantsStat__value">{summary.incomplete}</span>
            <span className="adminRestaurantsStat__label">{t("admin.dashboard.statIncomplete")}</span>
          </div>
          <div className="adminRestaurantsStat">
            <span className="adminRestaurantsStat__value">{summary.fullyOnboarded}</span>
            <span className="adminRestaurantsStat__label">{t("admin.dashboard.statComplete")}</span>
          </div>
        </div>
      ) : null}

      {overview && overview.ok ? (
        <section style={{ marginTop: 20 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>{t("admin.dashboard.listTitle", { count: allRows.length })}</h2>
          <div className="adminRestaurantsToolbar">
            <label
              className="textMuted2"
              style={{
                fontSize: 13,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                flex: "1 1 240px",
                minWidth: 0,
                alignSelf: "flex-start",
              }}
            >
              <span>{t("admin.dashboard.searchLabel")}</span>
              <input
                className="adminRestaurantsSearch"
                value={filterQ}
                onChange={(e) => setFilterQ(e.target.value)}
                placeholder={t("admin.dashboard.searchPlaceholder")}
                autoComplete="off"
                aria-label={t("admin.dashboard.searchAria")}
              />
            </label>
            <fieldset className="adminRestaurantsFilterGroup">
              <legend className="sr-only">{t("admin.dashboard.filterLegend")}</legend>
              {(
                [
                  ["all", "admin.dashboard.filterAll"],
                  ["incomplete", "admin.dashboard.filterIncomplete"],
                  ["ready", "admin.dashboard.filterReady"],
                ] as const
              ).map(([id, labelKey]) => (
                <button
                  key={id}
                  type="button"
                  className={`chip adminRestaurantsFilterBtn${listFilter === id ? " adminRestaurantsFilterBtn--active" : ""}`}
                  onClick={() => setListFilter(id)}
                  aria-pressed={listFilter === id}
                >
                  {t(labelKey)}
                </button>
              ))}
            </fieldset>
            <span className="textMuted2" style={{ fontSize: 13, alignSelf: "center" }}>
              {t("admin.dashboard.shown")} <strong style={{ color: "var(--text)" }}>{filtered.length}</strong>
              {q || listFilter !== "all" ? t("admin.dashboard.shownOf", { total: allRows.length }) : null}
            </span>
          </div>

          {filtered.length === 0 ? (
            <p className="textMuted" style={{ marginTop: 8 }}>
              {t("admin.dashboard.emptyFilter")}
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filtered.map((r) => {
                const isActive = activeId === r.id;
                const busy = selecting === r.id;
                const actionsDisabled = !listReady || busy;
                return (
                  <div
                    key={r.id}
                    className={`adminRestaurantCard${isActive ? " adminRestaurantCard--active" : ""}${!r.operationalReady ? " adminRestaurantCard--incomplete" : ""}`}
                  >
                    <div className="adminRestaurantCard__meta">
                      <div className="adminRestaurantCard__titleRow">
                        <strong style={{ fontSize: "1.05rem" }}>{r.name}</strong>
                        <StatusBadge item={r} />
                      </div>
                      <span className="adminRestaurantCard__id" title={t("admin.dashboard.internalIdTitle")}>
                        {r.id}
                      </span>
                      <p className="adminRestaurantCard__metrics textMuted2">
                        {t("admin.dashboard.metrics", {
                          devices: r.deviceCount,
                          photos: r.menuImageCount,
                          managers: r.managerCount,
                        })}
                      </p>
                      {!r.dotykacka.syncConfigured && r.dotykacka.hint ? (
                        <p className="adminRestaurantCard__hint" role="status">
                          {r.dotykacka.hint}
                        </p>
                      ) : null}
                      <OnboardingChecklist item={r} />
                      {isActive ? (
                        <span className="textMuted2" style={{ fontSize: 12, marginTop: 6, display: "inline-block" }}>
                          {t("admin.dashboard.activeContext")}
                        </span>
                      ) : null}
                    </div>
                    <div className="adminRestaurantCard__actions">
                      <AdminChipLink href={`/admin/restaurants/${r.id}`}>
                        <strong>{t("admin.dashboard.detail")}</strong>
                      </AdminChipLink>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => void onOpen(r.id, `/admin/restaurants/${r.id}?tab=dotykacka`)}
                        disabled={actionsDisabled}
                        style={{ cursor: actionsDisabled ? "not-allowed" : "pointer" }}
                        title={t("admin.dashboard.actionDotykackaTitle")}
                      >
                        {busy ? "…" : t("admin.dashboard.actionDotykacka")}
                      </button>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => void onOpen(r.id, `/admin/restaurants/${r.id}/devices/pair`)}
                        disabled={actionsDisabled}
                        style={{ cursor: actionsDisabled ? "not-allowed" : "pointer" }}
                        title={t("admin.dashboard.actionPairTitle")}
                      >
                        {busy ? "…" : t("admin.dashboard.actionPair")}
                      </button>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => void onOpen(r.id, `/admin/restaurants/${r.id}/menu`)}
                        disabled={actionsDisabled}
                        style={{ cursor: actionsDisabled ? "not-allowed" : "pointer" }}
                        title={t("admin.dashboard.actionMenuTitle")}
                      >
                        {busy ? "…" : t("admin.dashboard.actionMenu")}
                      </button>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => void onOpen(r.id, `/admin/restaurants/${r.id}?tab=devices`)}
                        disabled={actionsDisabled}
                        style={{ cursor: actionsDisabled ? "not-allowed" : "pointer" }}
                      >
                        {busy ? "…" : t("admin.dashboard.actionDevices")}
                      </button>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => void onOpen(r.id, `/admin/restaurants/${r.id}?tab=welcome`)}
                        disabled={actionsDisabled}
                        style={{ cursor: actionsDisabled ? "not-allowed" : "pointer" }}
                      >
                        {busy ? "…" : t("admin.dashboard.actionWelcome")}
                      </button>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => void onOpen(r.id, `/admin/restaurants/${r.id}?tab=users`)}
                        disabled={actionsDisabled}
                        style={{ cursor: actionsDisabled ? "not-allowed" : "pointer" }}
                      >
                        {busy ? "…" : t("admin.dashboard.actionUsers")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : !err && !listReady && !hasInitialOverview ? (
        <p className="textMuted" style={{ marginTop: 16 }}>
          {t("admin.dashboard.loadingList")}
        </p>
      ) : null}

      {!forbidden ? (
        <section className="adminRestaurantsCreate">
          <h2 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>{t("admin.dashboard.createTitle")}</h2>
          <form onSubmit={onCreate} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>{t("admin.dashboard.createName")}</span>
              <input
                className="chip adminRestaurantsCreateInput"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>{t("admin.dashboard.createEmail")}</span>
              <input
                className="chip adminRestaurantsCreateInput"
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>{t("admin.dashboard.createPassword")}</span>
              <input
                type="password"
                className="chip adminRestaurantsCreateInput"
                value={managerPassword}
                onChange={(e) => setManagerPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <button type="submit" className="btnPrimary" disabled={creating} style={{ cursor: "pointer", justifySelf: "start" }}>
              {creating ? "…" : t("admin.dashboard.createSubmit")}
            </button>
            <p className="textMuted2" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
              {t("admin.dashboard.createHint")}
            </p>
          </form>
        </section>
      ) : null}
    </main>
  );
}
