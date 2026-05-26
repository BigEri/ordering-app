import { activeRestaurantCookieName, getSessionFromCookieHeader, userHasRestaurantAccess } from "./auth";
import { assertSessionVersion } from "./sessionVersion";
import type { SessionPayload } from "./sessionToken";

export type AdminSession = SessionPayload;

function cookieValue(cookieHeader: string | null | undefined, name: string): string {
  const raw = typeof cookieHeader === "string" ? cookieHeader : "";
  if (!raw) return "";
  const parts = raw.split(";").map((p) => p.trim());
  const hit = parts.find((p) => p.startsWith(`${name}=`));
  if (!hit) return "";
  return hit.slice(`${name}=`.length);
}

/** Ověří cookie a že session nebyla zrušena změnou hesla. */
export async function requireAdminSession(cookieHeader: string | null | undefined): Promise<AdminSession> {
  const session = getSessionFromCookieHeader(cookieHeader);
  if (!session) throw new Error("UNAUTHORIZED");
  try {
    await assertSessionVersion(session);
  } catch (e) {
    if (e instanceof Error && e.message === "SESSION_REVOKED") throw new Error("UNAUTHORIZED");
    throw e;
  }
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
