/** Query param: host přešel z úvodní stránky výběrem jazyka. */
export const MENU_FROM_WELCOME_PARAM = "fromWelcome";
export const MENU_FROM_WELCOME_VALUE = "1";

export function isMenuOpenedFromWelcome(searchParams: { fromWelcome?: string } | null | undefined): boolean {
  const v = searchParams?.fromWelcome?.trim();
  return v === MENU_FROM_WELCOME_VALUE || v === "true";
}

/** Server: přesměrování z /menu na úvod (zachová deviceId / rid). */
export function welcomeHomePathFromMenuParams(opts: {
  deviceId?: string;
  rid?: string;
}): string {
  const sp = new URLSearchParams();
  const did = opts.deviceId?.trim();
  if (did && did.length <= 200) sp.set("deviceId", did);
  const rid = opts.rid?.trim();
  if (rid) sp.set("rid", rid);
  const q = sp.toString();
  return q ? `/?${q}` : "/";
}

function readKioskDeviceIdFromBrowser(): string {
  if (typeof window === "undefined") return "";

  const fromQuery = new URLSearchParams(window.location.search).get("deviceId")?.trim();
  if (fromQuery) return fromQuery;

  try {
    const ls = localStorage.getItem("kiosk.deviceId")?.trim();
    if (ls) return ls;
  } catch {
    /* ignore */
  }

  const raw = document.cookie ?? "";
  for (const part of raw.split(";")) {
    const p = part.trim();
    if (!p.startsWith("kiosk_device_id=")) continue;
    const v = decodeURIComponent(p.slice("kiosk_device_id=".length)).trim();
    if (v) return v;
  }

  return "";
}

/** Úvodní stránka — s deviceId pro kiosk tablet. */
export function buildKioskWelcomeUrl(): string {
  const id = readKioskDeviceIdFromBrowser();
  if (!id) return "/";
  return `/?deviceId=${encodeURIComponent(id)}`;
}

/** Menu jen po výběru jazyka na úvodu (`fromWelcome=1`). */
export function buildKioskMenuUrl(): string {
  const sp = new URLSearchParams();
  sp.set(MENU_FROM_WELCOME_PARAM, MENU_FROM_WELCOME_VALUE);

  const id = readKioskDeviceIdFromBrowser();
  if (id) sp.set("deviceId", id);

  if (typeof window !== "undefined") {
    const rid = new URLSearchParams(window.location.search).get("rid")?.trim();
    if (rid) sp.set("rid", rid);
  }

  return `/menu?${sp.toString()}`;
}
