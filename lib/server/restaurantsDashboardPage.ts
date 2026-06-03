import { cookies } from "next/headers";

import { activeRestaurantCookieName, getSessionFromCookieHeader } from "./auth";
import { buildRestaurantsOverview, type RestaurantsOverviewPayload } from "./restaurantOverview";
import { assertSessionVersion } from "./sessionVersion";

export type RestaurantsDashboardPageData =
  | { kind: "unauthorized" }
  | {
      kind: "forbidden";
      email: string;
      globalRole: string;
      activeRestaurantId: string | null;
    }
  | {
      kind: "ok";
      overview: RestaurantsOverviewPayload;
      email: string;
      globalRole: "SUPER_ADMIN";
      activeRestaurantId: string | null;
    };

function cookieHeaderFromStore(store: Awaited<ReturnType<typeof cookies>>): string {
  return store
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
}

/** SSR data pro /admin/restaurants — bez čekání na client fetch po kliknutí. */
export async function getRestaurantsDashboardPageData(): Promise<RestaurantsDashboardPageData> {
  const store = await cookies();
  const session = getSessionFromCookieHeader(cookieHeaderFromStore(store));
  if (!session) return { kind: "unauthorized" };

  try {
    await assertSessionVersion(session);
  } catch {
    return { kind: "unauthorized" };
  }

  const activeRestaurantId = store.get(activeRestaurantCookieName())?.value?.trim() || null;

  if (session.globalRole !== "SUPER_ADMIN") {
    return {
      kind: "forbidden",
      email: session.email,
      globalRole: session.globalRole,
      activeRestaurantId,
    };
  }

  const overview = await buildRestaurantsOverview();
  return {
    kind: "ok",
    overview,
    email: session.email,
    globalRole: "SUPER_ADMIN",
    activeRestaurantId,
  };
}
