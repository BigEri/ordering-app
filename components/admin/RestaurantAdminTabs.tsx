"use client";

/**
 * @deprecated Visual tabs removed — workspace sections live in AdminShell sidebar.
 * Re-export helpers for any leftover imports.
 */
export type { RestaurantWorkspaceSection as RestaurantAdminTabId } from "./restaurantWorkspaceNav";
export {
  RESTAURANT_WORKSPACE_NAV as TAB_DEFS,
  restaurantWorkspaceHref as tabHref,
  resolveRestaurantWorkspaceSection as resolveActiveTab,
} from "./restaurantWorkspaceNav";

export function RestaurantAdminTabs(_props: {
  restaurantId: string;
  active?: import("./restaurantWorkspaceNav").RestaurantWorkspaceSection;
}) {
  return null;
}
