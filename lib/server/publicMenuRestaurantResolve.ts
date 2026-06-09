import { cache } from "react";

import { isMenuOpenedFromAdmin } from "../admin/publicMenuPreviewUrl";
import {
  activeRestaurantCookieName,
  getSessionFromCookieHeader,
  userHasRestaurantAccess,
  type SessionPayload,
} from "./auth";
import { getKioskDeviceBinding } from "./kioskDeviceBindings";
import { prisma } from "./prisma";
import { getDefaultPublicMenuRestaurantId } from "./publicRestaurantName";
import { isPublicMenuRidQueryTrusted } from "./publicMenuRidTrust";

const getDefaultPublicMenuRestaurantIdCached = cache(getDefaultPublicMenuRestaurantId);

/**
 * Cookie pro hosty / kiosky: která provozovna se zobrazí na `/menu` (fotky, úpravy, Dotyka).
 * Nastaví se např. po párování tabletu (viz POST `/api/public/kiosk-menu-cookie`).
 */
export const PUBLIC_MENU_RESTAURANT_COOKIE = "oa_menu_rid";

/** Stejná cookie jako v DeviceTableProvider — SSR musí znát deviceId tabletu. */
export const KIOSK_DEVICE_ID_COOKIE = "kiosk_device_id";

export type PublicMenuRestaurantPickInput = {
  fromAdmin: boolean;
  deviceBoundRestaurantId: string | null;
  adminActiveRestaurantId: string | null;
  /** Přihlášený personál / vedoucí — jen vlastní provozovna (ne SUPER_ADMIN bez náhledu). */
  staffGuestRestaurantId: string | null;
  trustedRidQuery: string | null;
  kioskCookieRestaurantId: string | null;
  defaultRestaurantId: string | null;
};

/** Čistá priorita — kiosk vazba vždy první; admin aktivní jen u `?from=admin`. */
export function pickPublicMenuRestaurantId(input: PublicMenuRestaurantPickInput): string | null {
  if (input.deviceBoundRestaurantId) return input.deviceBoundRestaurantId;
  if (input.fromAdmin && input.adminActiveRestaurantId) return input.adminActiveRestaurantId;
  if (input.staffGuestRestaurantId) return input.staffGuestRestaurantId;
  if (input.trustedRidQuery) return input.trustedRidQuery;
  if (input.kioskCookieRestaurantId) return input.kioskCookieRestaurantId;
  return input.defaultRestaurantId;
}

export async function restaurantExistsInDb(id: string): Promise<boolean> {
  const t = id.trim();
  if (!t) return false;
  const row = await prisma.restaurant.findUnique({ where: { id: t }, select: { id: true } });
  return Boolean(row?.id);
}

/**
 * Přihlášený admin + aktivní provozovna (`oa_rid`) — stejný kontext jako v administraci.
 */
export async function resolveAdminActiveRestaurantForPublicMenuAsync(
  cookieHeader: string | null | undefined,
): Promise<string | null> {
  const session = getSessionFromCookieHeader(cookieHeader);
  if (!session) return null;
  const rid = cookieValue(cookieHeader, activeRestaurantCookieName())?.trim() ?? "";
  if (!rid) return null;
  if (session.globalRole === "SUPER_ADMIN") return rid;
  const access = await userHasRestaurantAccess(session.userId, rid);
  if (!access.ok) return null;
  return rid;
}

/** Vazba tabletu podle `deviceId` v URL nebo cookie `kiosk_device_id`. */
export async function resolveRestaurantIdFromKioskDeviceRequest(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  let deviceId = url.searchParams.get("deviceId")?.trim() ?? "";
  if (!deviceId || deviceId.length > 200) {
    deviceId = cookieValue(req.headers.get("cookie"), KIOSK_DEVICE_ID_COOKIE)?.trim() ?? "";
  }
  if (!deviceId || deviceId.length > 200) return null;

  const binding = await getKioskDeviceBinding(deviceId);
  const rid = binding?.restaurantId?.trim() ?? "";
  if (!rid) return null;
  if (!(await restaurantExistsInDb(rid))) return null;
  return rid;
}

/**
 * Personál / vedoucí na host stránkách — jen provozovna, ke které patří.
 * SUPER_ADMIN bez `?from=admin` nevidí cizí menu přes `oa_rid`.
 */
export async function resolveStaffRestaurantForGuestViewAsync(
  session: SessionPayload | null,
  adminActiveRestaurantId: string | null,
): Promise<string | null> {
  if (!session || session.globalRole === "SUPER_ADMIN") return null;
  return resolveRestaurantForNonSuperAdminUser(session.userId, adminActiveRestaurantId);
}

/** Admin editor menu — personál nikdy nevidí cizí provozovnu kvůli cizímu `oa_rid`. */
export async function resolveAdminMenuRestaurantIdForSession(
  session: SessionPayload | null,
  activeRestaurantId: string | null,
): Promise<string | null> {
  if (!session) return null;
  if (session.globalRole === "SUPER_ADMIN") {
    const active = activeRestaurantId?.trim() ?? "";
    return active || null;
  }
  return resolveRestaurantForNonSuperAdminUser(session.userId, activeRestaurantId);
}

async function resolveRestaurantForNonSuperAdminUser(
  userId: string,
  activeRestaurantId: string | null,
): Promise<string | null> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { restaurantId: true },
  });
  if (memberships.length === 0) return null;

  const active = activeRestaurantId?.trim() ?? "";
  if (active && memberships.some((m) => m.restaurantId === active)) {
    return active;
  }
  if (memberships.length === 1) {
    return memberships[0]!.restaurantId;
  }
  return null;
}

/**
 * Pořadí: vazba tabletu → admin náhled (`?from=admin`) → vlastní provozovna personálu →
 * důvěryhodné `?rid=` → cookie `oa_menu_rid` → výchozí provozovna.
 */
export function resolvePublicMenuRestaurantIdSync(opts: {
  ridQuery?: string | null;
  adminActiveRestaurantId?: string | null;
  cookieRestaurantId?: string | null;
}): string | null {
  void opts;
  throw new Error("Use resolvePublicMenuRestaurantIdFromRequestUrl (Prisma refactor)");
}

/** Pro API routy a SSR host stránek — cookie + query na stejném requestu. */
export async function resolvePublicMenuRestaurantIdFromRequestUrl(req: Request): Promise<string | null> {
  return resolvePublicMenuRestaurantIdFullFromRequestUrl(req);
}

/**
 * Rychlejší varianta pro úvodní stránku / tablet bez přihlášeného admina:
 * po vazbě zařízení nebo cookie `oa_menu_rid` nevolá membership / staff větve.
 */
export async function resolvePublicMenuRestaurantIdSlimFromRequestUrl(req: Request): Promise<string | null> {
  const deviceBound = await resolveRestaurantIdFromKioskDeviceRequest(req);
  if (deviceBound) return deviceBound;

  const url = new URL(req.url);
  const cookieHeader = req.headers.get("cookie");
  const session = getSessionFromCookieHeader(cookieHeader);
  const fromAdmin = isMenuOpenedFromAdmin({ from: url.searchParams.get("from") ?? undefined });

  if (!session && !fromAdmin) {
    return resolveGuestKioskRestaurantId(cookieHeader, url);
  }

  return resolvePublicMenuRestaurantIdFullFromRequestUrl(req, deviceBound);
}

async function resolveGuestKioskRestaurantId(
  cookieHeader: string | null | undefined,
  url: URL,
): Promise<string | null> {
  const kioskRid = cookieValue(cookieHeader, PUBLIC_MENU_RESTAURANT_COOKIE)?.trim() ?? "";
  const ridRaw = url.searchParams.get("rid")?.trim() ?? "";
  const defaultRestaurantId = await getDefaultPublicMenuRestaurantIdCached();

  if (ridRaw && (await restaurantExistsInDb(ridRaw))) {
    if (
      isPublicMenuRidQueryTrusted({
        ridQueryTrimmed: ridRaw,
        kioskRestaurantId: kioskRid,
        adminRestaurantId: null,
        deviceBoundRestaurantId: null,
        defaultSingletonRestaurantId: defaultRestaurantId,
      })
    ) {
      return ridRaw;
    }
  }

  if (kioskRid && (await restaurantExistsInDb(kioskRid))) return kioskRid;

  if (defaultRestaurantId && (await restaurantExistsInDb(defaultRestaurantId))) return defaultRestaurantId;
  return null;
}

async function resolvePublicMenuRestaurantIdFullFromRequestUrl(
  req: Request,
  knownDeviceBound?: string | null,
): Promise<string | null> {
  const url = new URL(req.url);
  const cookieHeader = req.headers.get("cookie");
  const fromAdmin = isMenuOpenedFromAdmin({ from: url.searchParams.get("from") ?? undefined });

  const deviceBound = knownDeviceBound ?? (await resolveRestaurantIdFromKioskDeviceRequest(req));
  const session = getSessionFromCookieHeader(cookieHeader);
  const adminActive = await resolveAdminActiveRestaurantForPublicMenuAsync(cookieHeader);
  const staffGuest = await resolveStaffRestaurantForGuestViewAsync(session, adminActive);
  const kioskRid = cookieValue(cookieHeader, PUBLIC_MENU_RESTAURANT_COOKIE)?.trim() ?? "";
  const ridRaw = url.searchParams.get("rid")?.trim() ?? "";

  let trustedRidQuery: string | null = null;
  if (ridRaw && (await restaurantExistsInDb(ridRaw))) {
    const singleton = await getDefaultPublicMenuRestaurantIdCached();
    if (
      isPublicMenuRidQueryTrusted({
        ridQueryTrimmed: ridRaw,
        kioskRestaurantId: kioskRid,
        adminRestaurantId: fromAdmin ? adminActive : null,
        deviceBoundRestaurantId: deviceBound,
        defaultSingletonRestaurantId: singleton,
      })
    ) {
      trustedRidQuery = ridRaw;
    }
  }

  const defaultRestaurantId = await getDefaultPublicMenuRestaurantIdCached();

  const picked = pickPublicMenuRestaurantId({
    fromAdmin,
    deviceBoundRestaurantId: deviceBound,
    adminActiveRestaurantId: adminActive,
    staffGuestRestaurantId: staffGuest,
    trustedRidQuery,
    kioskCookieRestaurantId: kioskRid || null,
    defaultRestaurantId,
  });

  if (!picked) return null;
  if (picked === deviceBound || picked === trustedRidQuery) return picked;
  if (await restaurantExistsInDb(picked)) return picked;
  return null;
}

/**
 * Veřejné GET API (`/api/menu/*`) — parametr `restaurantId` musí sedět s cookie/URL kontextem, pokud ten je.
 */
export function resolvePublicMenuApiRestaurantId(req: Request):
  | { ok: true; restaurantId: string }
  | { ok: false; status: number; error: string } {
  void req;
  throw new Error("Use resolvePublicMenuApiRestaurantIdAsync (Prisma refactor)");
}

export async function resolvePublicMenuApiRestaurantIdAsync(req: Request): Promise<
  | { ok: true; restaurantId: string }
  | { ok: false; status: number; error: string }
> {
  const url = new URL(req.url);
  const requested = url.searchParams.get("restaurantId")?.trim() ?? "";
  const resolved = await resolvePublicMenuRestaurantIdFromRequestUrl(req);
  if (!requested && !resolved) {
    return { ok: false, status: 400, error: "No restaurant context" };
  }
  if (requested && resolved && requested !== resolved) {
    return { ok: false, status: 403, error: "Restaurant mismatch" };
  }
  if (requested && !resolved) {
    const def = await getDefaultPublicMenuRestaurantIdCached();
    if (!def || requested !== def) {
      return { ok: false, status: 403, error: "Restaurant context required" };
    }
  }
  const restaurantId = requested || resolved;
  if (!restaurantId) {
    return { ok: false, status: 400, error: "No restaurant context" };
  }
  if (!(await restaurantExistsInDb(restaurantId))) {
    return { ok: false, status: 404, error: "Not found" };
  }
  return { ok: true, restaurantId };
}

function cookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  const raw = typeof cookieHeader === "string" ? cookieHeader : "";
  if (!raw) return null;
  const parts = raw.split(";").map((p) => p.trim());
  const hit = parts.find((p) => p.startsWith(`${name}=`));
  if (!hit) return null;
  try {
    return decodeURIComponent(hit.slice(name.length + 1));
  } catch {
    return hit.slice(name.length + 1);
  }
}
