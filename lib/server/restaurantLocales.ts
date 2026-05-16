import { nowIso } from "./db";
import { prisma } from "./prisma";

export type GlobalLocale = { code: string; label: string; enabled: boolean };
export type RestaurantLocale = { code: string; label: string; enabled: boolean };

export async function listGlobalLocales(): Promise<GlobalLocale[]> {
  const rows = await prisma.appLocale.findMany({
    orderBy: [{ createdAtIso: "asc" }, { code: "asc" }],
    select: { code: true, label: true, enabled: true },
  });
  return rows.map((r) => ({
    code: String(r.code ?? "").trim(),
    label: String(r.label ?? "").trim(),
    enabled: r.enabled === 1,
  }));
}

export async function listRestaurantLocalesWithLabels(restaurantId: string): Promise<RestaurantLocale[]> {
  const rid = restaurantId.trim();
  if (!rid) return [];
  const [rows, globalEnabled] = await prisma.$transaction([
    prisma.restaurantLocale.findMany({
      where: { restaurantId: rid },
      orderBy: [{ updatedAtIso: "asc" }, { locale: "asc" }],
      select: { locale: true, enabled: true },
    }),
    prisma.appLocale.findMany({
      where: { enabled: 1 },
      select: { code: true, label: true },
    }),
  ]);
  const labelByCode = new Map(
    globalEnabled
      .map((r) => [String(r.code ?? "").trim().toLowerCase(), String(r.label ?? "").trim()] as const)
      .filter(([c, l]) => !!c && !!l),
  );
  return rows
    .map((r) => ({
      code: String(r.locale ?? "").trim(),
      label: labelByCode.get(String(r.locale ?? "").trim().toLowerCase()) ?? "",
      enabled: r.enabled === 1,
    }))
    .filter((l) => !!l.code && !!l.label);
}

/** SUPER_ADMIN: nastaví povolené jazyky pro restauraci (allowlist) – vše se uloží jako enabled=1. */
export async function setRestaurantLocaleAllowlist(opts: {
  restaurantId: string;
  allowedLocales: string[];
  updatedByUserId: string | null;
}): Promise<void> {
  const rid = opts.restaurantId.trim();
  if (!rid) return;
  const now = nowIso();

  const cleaned = [...new Set(opts.allowedLocales.map((c) => String(c ?? "").trim().toLowerCase()).filter(Boolean))];
  const globalEnabled = await prisma.appLocale.findMany({ where: { enabled: 1 }, select: { code: true } });
  const globalSet = new Set(globalEnabled.map((r) => String(r.code ?? "").trim().toLowerCase()).filter(Boolean));
  const allowed = cleaned.filter((c) => globalSet.has(c));

  await prisma.$transaction(async (tx) => {
    await tx.restaurantLocale.deleteMany({ where: { restaurantId: rid } });
    if (allowed.length === 0) return;
    await tx.restaurantLocale.createMany({
      data: allowed.map((code) => ({
        restaurantId: rid,
        locale: code,
        enabled: 1,
        createdAtIso: now,
        updatedAtIso: now,
        updatedByUserId: opts.updatedByUserId,
      })),
    });
  });
}

/** RESTAURANT_ADMIN: pouze zapíná/vypíná už povolené jazyky (nesmí přidat nový locale). */
export async function updateRestaurantLocalesEnabled(opts: {
  restaurantId: string;
  enabledLocales: string[];
  updatedByUserId: string | null;
}): Promise<void> {
  const rid = opts.restaurantId.trim();
  if (!rid) return;
  const now = nowIso();

  const desired = new Set(opts.enabledLocales.map((c) => String(c ?? "").trim().toLowerCase()).filter(Boolean));
  const existing = await prisma.restaurantLocale.findMany({
    where: { restaurantId: rid },
    select: { locale: true },
  });
  const allowed = existing.map((r) => String(r.locale ?? "").trim().toLowerCase()).filter(Boolean);
  if (allowed.length === 0) return;

  await prisma.$transaction(
    allowed.map((code) =>
      prisma.restaurantLocale.updateMany({
        where: { restaurantId: rid, locale: code },
        data: { enabled: desired.has(code) ? 1 : 0, updatedAtIso: now, updatedByUserId: opts.updatedByUserId },
      }),
    ),
  );
}

export async function restaurantHasLocaleConfig(restaurantId: string): Promise<boolean> {
  const rid = restaurantId.trim();
  if (!rid) return false;
  const row = await prisma.restaurantLocale.findFirst({
    where: { restaurantId: rid },
    select: { restaurantId: true },
  });
  return Boolean(row?.restaurantId);
}

/** Host UI: vrať jen enabled jazyky pro restauraci; pokud chybí konfigurace, default je cs+en. */
export async function listEnabledLocalesForRestaurant(
  restaurantId: string,
): Promise<Array<{ code: string; label: string }>> {
  const rid = restaurantId.trim();

  const defaults = ["cs", "en"];
  const hasConfig = await restaurantHasLocaleConfig(rid);
  if (!hasConfig) {
    const rows = await prisma.appLocale.findMany({
      where: { enabled: 1, code: { in: defaults } },
      orderBy: [{ createdAtIso: "asc" }, { code: "asc" }],
      select: { code: true, label: true },
    });
    return rows
      .map((r) => ({ code: String(r.code ?? "").trim(), label: String(r.label ?? "").trim() }))
      .filter((l) => defaults.includes(l.code) && !!l.label);
  }

  const [rows, globalEnabled] = await prisma.$transaction([
    prisma.restaurantLocale.findMany({
      where: { restaurantId: rid, enabled: 1 },
      orderBy: [{ updatedAtIso: "asc" }, { locale: "asc" }],
      select: { locale: true },
    }),
    prisma.appLocale.findMany({
      where: { enabled: 1 },
      select: { code: true, label: true },
    }),
  ]);
  const labelByCode = new Map(
    globalEnabled
      .map((r) => [String(r.code ?? "").trim().toLowerCase(), String(r.label ?? "").trim()] as const)
      .filter(([c, l]) => !!c && !!l),
  );
  return rows
    .map((r) => {
      const code = String(r.locale ?? "").trim().toLowerCase();
      return { code, label: labelByCode.get(code) ?? "" };
    })
    .filter((l) => !!l.code && !!l.label);
}

