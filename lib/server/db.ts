import { LOCALES, MESSAGES, type Locale } from "../i18n/messages";
import { prisma } from "./prisma";

export type GlobalRole = "SUPER_ADMIN" | "USER";
export type MembershipRole = "RESTAURANT_ADMIN" | "STAFF";

export type DbUser = {
  id: string;
  email: string;
  passwordHash: string;
  globalRole: GlobalRole;
  createdAtIso: string;
};

export type DbRestaurant = {
  id: string;
  name: string;
  createdAtIso: string;
};

export type DbMembership = {
  userId: string;
  restaurantId: string;
  role: MembershipRole;
  createdAtIso: string;
};

/**
 * Legacy helper kept temporarily so the build keeps compiling while we migrate
 * all call sites to Prisma. Do not use in new code.
 */
export function getDb(): never {
  throw new Error("SQLite getDb() removed; use Prisma client instead.");
}

export function nowIso() {
  return new Date().toISOString();
}

export async function ensureCoreLocalesAndMessages() {
  const createdAtIso = nowIso();
  const updatedAtIso = createdAtIso;

  // Keep ui_messages focused on customer-facing UI. Admin UI text stays in-code (English/CS as needed).
  await prisma.uiMessage.deleteMany({ where: { msgKey: { startsWith: "admin." } } });

  await prisma.$transaction(async (tx) => {
    for (const loc of LOCALES) {
      await tx.appLocale.upsert({
        where: { code: loc.code },
        update: {},
        create: { code: loc.code, label: loc.label, createdAtIso, enabled: 1 },
      });
    }

    for (const locale of Object.keys(MESSAGES) as Locale[]) {
      const table = MESSAGES[locale];
      for (const [msgKey, msgValue] of Object.entries(table)) {
        if (msgKey.startsWith("admin.")) continue;
        await tx.uiMessage.upsert({
          where: { locale_msgKey: { locale, msgKey } },
          update: {},
          create: { locale, msgKey, msgValue, updatedAtIso, updatedByUserId: null },
        });
      }
    }
  });
}

