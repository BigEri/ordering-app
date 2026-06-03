/** Query param: náhled veřejného menu otevřený z administrace (ne kiosk). */
export const MENU_FROM_ADMIN = "from";
export const MENU_FROM_ADMIN_VALUE = "admin";

export function isMenuOpenedFromAdmin(searchParams: { from?: string } | null | undefined): boolean {
  return searchParams?.from === MENU_FROM_ADMIN_VALUE;
}

/** Client: `?from=admin` v aktuální URL (náhled z administrace, ne kiosk). */
export function isAdminMenuPreviewOnClient(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get(MENU_FROM_ADMIN) === MENU_FROM_ADMIN_VALUE;
}

/** Veřejné `/menu` s příznakem náhledu z adminu — na kiosku tento param nepoužívat. */
export function publicMenuUrlFromAdmin(opts?: { deviceId?: string; rid?: string }): string {
  const params = new URLSearchParams();
  params.set(MENU_FROM_ADMIN, MENU_FROM_ADMIN_VALUE);
  if (opts?.deviceId?.trim()) params.set("deviceId", opts.deviceId.trim());
  if (opts?.rid?.trim()) params.set("rid", opts.rid.trim());
  return `/menu?${params.toString()}`;
}
