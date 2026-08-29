import { getDotykackaIntegrationStatus } from "./integrationsStatus";
import { prisma } from "./prisma";

export type RestaurantOnboardingFlags = {
  dotykacka: boolean;
  device: boolean;
  welcome: boolean;
  menuPhoto: boolean;
};

export type RestaurantOverviewItem = {
  id: string;
  name: string;
  dotykacka: { syncConfigured: boolean; hint: string | null };
  deviceCount: number;
  menuImageCount: number;
  hasWelcome: boolean;
  managerCount: number;
  onboarding: RestaurantOnboardingFlags;
  /** Pokladna (Storyous nebo Dotykačka) + alespoň jeden spárovaný tablet — minimum pro provoz kiosku. */
  operationalReady: boolean;
  /** Všechny čtyři kroky onboardingu. */
  fullyOnboarded: boolean;
};

export type RestaurantsOverviewSummary = {
  total: number;
  operationalReady: number;
  incomplete: number;
  fullyOnboarded: number;
};

export type RestaurantsOverviewPayload = {
  ok: true;
  ts: string;
  summary: RestaurantsOverviewSummary;
  restaurants: RestaurantOverviewItem[];
};

function parseWelcomeHasCustom(imageUrlsJson: string | null | undefined): boolean {
  if (!imageUrlsJson?.trim()) return false;
  try {
    const parsed = JSON.parse(imageUrlsJson) as unknown;
    if (!Array.isArray(parsed)) return false;
    return parsed.some((x) => typeof x === "string" && x.trim().length > 0);
  } catch {
    return false;
  }
}

export async function buildRestaurantsOverview(): Promise<RestaurantsOverviewPayload> {
  const rows = await prisma.restaurant.findMany({
    orderBy: { createdAtIso: "desc" },
    select: { id: true, name: true },
  });

  if (rows.length === 0) {
    return {
      ok: true,
      ts: new Date().toISOString(),
      summary: { total: 0, operationalReady: 0, incomplete: 0, fullyOnboarded: 0 },
      restaurants: [],
    };
  }

  const ids = rows.map((r) => r.id);

  const [deviceCounts, menuImageCounts, welcomeRows, managerCounts, storyousRows] = await Promise.all([
    prisma.kioskDeviceBinding.groupBy({
      by: ["restaurantId"],
      where: { restaurantId: { in: ids } },
      _count: { deviceId: true },
    }),
    prisma.menuImage.groupBy({
      by: ["restaurantId"],
      where: { restaurantId: { in: ids } },
      _count: { menuItemId: true },
    }),
    prisma.restaurantWelcome.findMany({
      where: { restaurantId: { in: ids } },
      select: { restaurantId: true, imageUrlsJson: true },
    }),
    prisma.membership.groupBy({
      by: ["restaurantId"],
      where: { restaurantId: { in: ids }, role: "RESTAURANT_ADMIN" },
      _count: { userId: true },
    }),
    prisma.restaurantStoryous.findMany({
      where: { restaurantId: { in: ids }, disabled: 0 },
      select: { restaurantId: true, merchantId: true, placeId: true },
    }),
  ]);

  const devicesByRid = new Map(deviceCounts.map((g) => [g.restaurantId, g._count.deviceId]));
  const imagesByRid = new Map(menuImageCounts.map((g) => [g.restaurantId, g._count.menuItemId]));
  const welcomeByRid = new Map(
    welcomeRows.map((w) => [w.restaurantId, parseWelcomeHasCustom(w.imageUrlsJson)]),
  );
  const managersByRid = new Map(managerCounts.map((g) => [g.restaurantId, g._count.userId]));
  const storyousByRid = new Set(
    storyousRows
      .filter((s) => s.merchantId.trim() && s.placeId.trim())
      .map((s) => s.restaurantId),
  );

  const dotykackaStatuses = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      status: await getDotykackaIntegrationStatus(r.id),
    })),
  );
  const dotykackaByRid = new Map(dotykackaStatuses.map((d) => [d.id, d.status]));

  const restaurants: RestaurantOverviewItem[] = rows.map((r) => {
    const dotykacka = dotykackaByRid.get(r.id) ?? { syncConfigured: false, hint: null };
    const deviceCount = devicesByRid.get(r.id) ?? 0;
    const menuImageCount = imagesByRid.get(r.id) ?? 0;
    const hasWelcome = welcomeByRid.get(r.id) ?? false;
    const managerCount = managersByRid.get(r.id) ?? 0;

    const posConfigured = storyousByRid.has(r.id) || dotykacka.syncConfigured;
    const onboarding: RestaurantOnboardingFlags = {
      dotykacka: posConfigured,
      device: deviceCount >= 1,
      welcome: hasWelcome,
      menuPhoto: menuImageCount >= 1,
    };

    const operationalReady = onboarding.dotykacka && onboarding.device;
    const fullyOnboarded =
      onboarding.dotykacka && onboarding.device && onboarding.welcome && onboarding.menuPhoto;

    return {
      id: r.id,
      name: r.name,
      dotykacka: {
        syncConfigured: posConfigured,
        hint: posConfigured
          ? null
          : storyousByRid.has(r.id)
            ? null
            : dotykacka.hint,
      },
      deviceCount,
      menuImageCount,
      hasWelcome,
      managerCount,
      onboarding,
      operationalReady,
      fullyOnboarded,
    };
  });

  const operationalReady = restaurants.filter((x) => x.operationalReady).length;
  const fullyOnboarded = restaurants.filter((x) => x.fullyOnboarded).length;

  return {
    ok: true,
    ts: new Date().toISOString(),
    summary: {
      total: restaurants.length,
      operationalReady,
      incomplete: restaurants.length - operationalReady,
      fullyOnboarded,
    },
    restaurants,
  };
}
