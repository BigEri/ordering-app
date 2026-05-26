import {
  activeRestaurantCookieName,
  getSessionFromCookieHeader,
  userHasRestaurantAccess,
} from "./auth";
import { prisma } from "./prisma";
import { getDefaultPublicMenuRestaurantId } from "./publicRestaurantName";
import { isPublicMenuRidQueryTrusted } from "./publicMenuRidTrust";

/**
 * Cookie pro hosty / kiosky: která provozovna se zobrazí na `/menu` (fotky, úpravy, Dotyka).
 * Nastaví se např. po párování tabletu (viz POST `/api/public/kiosk-menu-cookie`).
 */
export const PUBLIC_MENU_RESTAURANT_COOKIE = "oa_menu_rid";

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

/**
 * Pořadí: důvěryhodné `?rid=` (viz níže) → aktivní restaurace admina → cookie `oa_menu_rid` → výchozí provozovna.
 * Neověřené `?rid=` se ignoruje (multi-tenant).
 */
export function resolvePublicMenuRestaurantIdSync(opts: {
  ridQuery?: string | null;
  /** Z `resolveAdminActiveRestaurantForPublicMenu` — jen pokud je platná relace a přístup. */
  adminActiveRestaurantId?: string | null;
  cookieRestaurantId?: string | null;
}): string | null {
  void opts;
  throw new Error("Use resolvePublicMenuRestaurantIdAsync (Prisma refactor)");
}

/** Pro API routy s `Request` — cookie + volitelně ověřené `rid` na stejném requestu. */
export async function resolvePublicMenuRestaurantIdFromRequestUrl(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  const cookieHeader = req.headers.get("cookie");
  const adminActive = await resolveAdminActiveRestaurantForPublicMenuAsync(cookieHeader);
  const kioskRid = cookieValue(cookieHeader, PUBLIC_MENU_RESTAURANT_COOKIE)?.trim() ?? "";
  const ridRaw = url.searchParams.get("rid")?.trim() ?? "";

  let trustedRidQuery: string | null = null;
  if (ridRaw && (await restaurantExistsInDb(ridRaw))) {
    const singleton = await getDefaultPublicMenuRestaurantId();
    if (
      isPublicMenuRidQueryTrusted({
        ridQueryTrimmed: ridRaw,
        kioskRestaurantId: kioskRid,
        adminRestaurantId: adminActive,
        defaultSingletonRestaurantId: singleton,
      })
    ) {
      trustedRidQuery = ridRaw;
    }
  }

  // Priority: trusted ?rid= → aktivní admin restaurace → kiosk cookie → výchozí
  if (trustedRidQuery) return trustedRidQuery;
  if (adminActive && (await restaurantExistsInDb(adminActive))) return adminActive;
  if (kioskRid && (await restaurantExistsInDb(kioskRid))) return kioskRid;
  return await getDefaultPublicMenuRestaurantId();
}

/**
 * Veřejné GET API (`/api/menu/*`) — parametr `restaurantId` musí sedět s cookie/URL kontextem, pokud ten je.
 */
export function resolvePublicMenuApiRestaurantId(req: Request):
  | { ok: true; restaurantId: string }
  | { ok: false; status: number; error: string } {
  // NOTE: now async in Prisma version; keep sync wrapper for compatibility.
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
    const def = await getDefaultPublicMenuRestaurantId();
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
