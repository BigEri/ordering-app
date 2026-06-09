import { cookies } from "next/headers";

import { activeRestaurantCookieName, getSessionFromCookieHeader } from "./auth";
import { prisma } from "./prisma";
import { assertSessionVersion } from "./sessionVersion";

export type AdminShellBootstrapMe = {
  ok: true;
  session: { userId: string; email: string; globalRole: "SUPER_ADMIN" | "USER" };
  activeRestaurantId: string | null;
  activeRestaurantName: string | null;
  memberships: { restaurantId: string; role: string }[];
};

export type AdminShellBootstrap = {
  me: AdminShellBootstrapMe;
  restaurants: { id: string; name: string }[];
  restaurantMap: Record<string, string>;
  activeLabel: string | null;
};

function cookieHeaderFromStore(store: Awaited<ReturnType<typeof cookies>>): string {
  return store
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
}

/** SSR data pro AdminShell — bez problikávání menu a aktivní provozovny po hydrataci. */
export async function getAdminShellBootstrap(): Promise<AdminShellBootstrap | null> {
  const store = await cookies();
  const session = getSessionFromCookieHeader(cookieHeaderFromStore(store));
  if (!session) return null;

  try {
    await assertSessionVersion(session);
  } catch {
    return null;
  }

  const rid = store.get(activeRestaurantCookieName())?.value?.trim() || null;

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    orderBy: { createdAtIso: "asc" },
    select: { restaurantId: true, role: true },
  });

  let restaurants: { id: string; name: string }[];
  if (session.globalRole === "SUPER_ADMIN") {
    restaurants = await prisma.restaurant.findMany({
      orderBy: { createdAtIso: "desc" },
      select: { id: true, name: true },
    });
  } else {
    const restIds = memberships.map((m) => m.restaurantId);
    if (restIds.length === 0) {
      restaurants = [];
    } else {
      const rows = await prisma.restaurant.findMany({
        where: { id: { in: restIds } },
        select: { id: true, name: true, createdAtIso: true },
      });
      restaurants = rows
        .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso) || a.id.localeCompare(b.id, "en"))
        .map((r) => ({ id: r.id, name: r.name }));
    }
  }

  const restaurantMap: Record<string, string> = {};
  for (const r of restaurants) restaurantMap[r.id] = r.name;

  let activeRestaurantName: string | null = null;
  if (rid) {
    activeRestaurantName = restaurantMap[rid] ?? null;
    if (!activeRestaurantName) {
      const rn = await prisma.restaurant.findUnique({ where: { id: rid }, select: { name: true } });
      activeRestaurantName = rn?.name?.trim() ? rn.name.trim() : null;
      if (activeRestaurantName) restaurantMap[rid] = activeRestaurantName;
    }
  }

  const activeLabel = activeRestaurantName ?? (rid ? restaurantMap[rid] ?? null : null);

  return {
    me: {
      ok: true,
      session: {
        userId: session.userId,
        email: session.email,
        globalRole: session.globalRole,
      },
      activeRestaurantId: rid,
      activeRestaurantName,
      memberships: memberships.map((m) => ({ restaurantId: m.restaurantId, role: m.role })),
    },
    restaurants,
    restaurantMap,
    activeLabel,
  };
}
