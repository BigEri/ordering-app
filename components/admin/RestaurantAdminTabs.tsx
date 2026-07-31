"use client";

import { usePathname, useSearchParams } from "next/navigation";
import * as React from "react";

export type RestaurantAdminTabId = "overview" | "menu" | "users" | "devices" | "welcome" | "dotykacka";

const TAB_DEFS: { id: RestaurantAdminTabId; label: string }[] = [
  { id: "overview", label: "Přehled" },
  { id: "menu", label: "Menu" },
  { id: "users", label: "Uživatelé" },
  { id: "devices", label: "Zařízení" },
  { id: "welcome", label: "Úvodní obrazovka" },
  { id: "dotykacka", label: "Dotykačka" },
];

function tabHref(restaurantId: string, tab: RestaurantAdminTabId): string {
  const base = `/admin/restaurants/${encodeURIComponent(restaurantId)}`;
  if (tab === "overview") return base;
  if (tab === "menu") return `${base}/menu`;
  return `${base}?tab=${tab}`;
}

function resolveActiveTab(
  pathname: string,
  searchTab: string | null,
  forced?: RestaurantAdminTabId,
): RestaurantAdminTabId {
  if (forced) return forced;
  if (pathname.includes("/menu")) return "menu";
  if (searchTab === "users") return "users";
  if (searchTab === "devices") return "devices";
  if (searchTab === "welcome") return "welcome";
  if (searchTab === "dotykacka") return "dotykacka";
  if (searchTab === "menu") return "menu";
  return "overview";
}

export function RestaurantAdminTabs({
  restaurantId,
  active: forcedActive,
}: {
  restaurantId: string;
  /** When set, overrides URL detection (e.g. translations page → Menu). */
  active?: RestaurantAdminTabId;
}) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const active = resolveActiveTab(pathname, searchParams.get("tab"), forcedActive);
  const rid = restaurantId.trim();
  if (!rid) return null;

  return (
    <ul className="adminTabs" role="tablist" aria-label="Sekce detailu restaurace">
      {TAB_DEFS.map((t) => {
        const selected = active === t.id;
        return (
          <li key={t.id} style={{ display: "contents" }}>
            <a
              href={tabHref(rid, t.id)}
              className={`adminTab${selected ? " adminTab--active" : ""}`}
              role="tab"
              aria-selected={selected}
            >
              {t.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
