import { activeRestaurantCookieName, getSessionFromCookieHeader, userHasRestaurantAccess } from "./auth";

export type AdminSession = NonNullable<ReturnType<typeof getSessionFromCookieHeader>>;

function cookieValue(cookieHeader: string | null | undefined, name: string): string {
  const raw = typeof cookieHeader === "string" ? cookieHeader : "";
  if (!raw) return "";
  const parts = raw.split(";").map((p) => p.trim());
  const hit = parts.find((p) => p.startsWith(`${name}=`));
  if (!hit) return "";
  return hit.slice(`${name}=`.length);
}

export function requireAdminSession(cookieHeader: string | null | undefined): AdminSession {
  const session = getSessionFromCookieHeader(cookieHeader);
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export function requireActiveRestaurantId(
  session: AdminSession,
  cookieHeader: string | null | undefined,
): Promise<string> {
  const rid = cookieValue(cookieHeader, activeRestaurantCookieName());
  if (session.globalRole === "SUPER_ADMIN") {
    return Promise.resolve(rid || "");
  }
  if (!rid) throw new Error("NO_RESTAURANT");
  return userHasRestaurantAccess(session.userId, rid).then((access) => {
    if (!access.ok) throw new Error("FORBIDDEN");
    return rid;
  });
}

