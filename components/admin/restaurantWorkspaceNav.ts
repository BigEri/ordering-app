export type RestaurantWorkspaceSection =
  | "overview"
  | "menu"
  | "users"
  | "devices"
  | "welcome"
  | "dotykacka"
  | "storyous";

export const RESTAURANT_WORKSPACE_NAV: { id: RestaurantWorkspaceSection; label: string }[] = [
  { id: "overview", label: "Přehled" },
  { id: "menu", label: "Menu" },
  { id: "users", label: "Uživatelé" },
  { id: "devices", label: "Zařízení" },
  { id: "welcome", label: "Úvodní obrazovka" },
  { id: "dotykacka", label: "Dotykačka" },
  { id: "storyous", label: "Storyous" },
];

/** Vedoucí nevidí Přehled (název, jazyky, PIN, restart, mazání) — jen SUPER_ADMIN. */
export function workspaceNavForRole(isSuperAdmin: boolean): typeof RESTAURANT_WORKSPACE_NAV {
  if (isSuperAdmin) return RESTAURANT_WORKSPACE_NAV;
  return RESTAURANT_WORKSPACE_NAV.filter((x) => x.id !== "overview");
}

export function managerRestaurantHomeHref(restaurantId: string): string {
  return restaurantWorkspaceHref(restaurantId, "menu");
}

export function restaurantWorkspaceHref(restaurantId: string, section: RestaurantWorkspaceSection): string {
  const base = `/admin/restaurants/${encodeURIComponent(restaurantId)}`;
  if (section === "overview") return base;
  if (section === "menu") return `${base}/menu`;
  return `${base}?tab=${section}`;
}

export function resolveRestaurantWorkspaceSection(
  pathname: string,
  searchTab: string | null,
): RestaurantWorkspaceSection {
  if (pathname.includes("/menu")) return "menu";
  if (searchTab === "users") return "users";
  if (searchTab === "devices") return "devices";
  if (searchTab === "welcome") return "welcome";
  if (searchTab === "dotykacka") return "dotykacka";
  if (searchTab === "storyous") return "storyous";
  if (searchTab === "menu") return "menu";
  return "overview";
}

/** Replace restaurant id in a workspace path, preserve trailing path + query. */
export function swapRestaurantIdInPath(pathname: string, search: string, fromId: string, toId: string): string {
  const escaped = fromId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nextPath = pathname.replace(
    new RegExp(`^/admin/restaurants/${escaped}(?=/|$)`),
    `/admin/restaurants/${encodeURIComponent(toId)}`,
  );
  return `${nextPath}${search}`;
}
