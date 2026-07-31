export type RestaurantWorkspaceSection =
  | "overview"
  | "menu"
  | "users"
  | "devices"
  | "welcome"
  | "dotykacka";

export const RESTAURANT_WORKSPACE_NAV: { id: RestaurantWorkspaceSection; label: string }[] = [
  { id: "overview", label: "Přehled" },
  { id: "menu", label: "Menu" },
  { id: "users", label: "Uživatelé" },
  { id: "devices", label: "Zařízení" },
  { id: "welcome", label: "Úvodní obrazovka" },
  { id: "dotykacka", label: "Dotykačka" },
];

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
