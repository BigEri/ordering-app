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

const UI_MESSAGE_BATCH_SIZE = 100;

/** Seed locales + customer UI strings without one long interactive transaction (Neon / pooler safe). */
export async function ensureCoreLocalesAndMessages() {
  const createdAtIso = nowIso();
  const updatedAtIso = createdAtIso;

  // Keep ui_messages focused on customer-facing UI. Admin UI text stays in-code (English/CS as needed).
  await prisma.uiMessage.deleteMany({ where: { msgKey: { startsWith: "admin." } } });

  await Promise.all(
    LOCALES.map((loc) =>
      prisma.appLocale.upsert({
        where: { code: loc.code },
        update: {},
        create: { code: loc.code, label: loc.label, createdAtIso, enabled: 1 },
      }),
    ),
  );

  const rows: Array<{
    locale: string;
    msgKey: string;
    msgValue: string;
    updatedAtIso: string;
    updatedByUserId: null;
  }> = [];

  for (const locale of Object.keys(MESSAGES) as Locale[]) {
    const table = MESSAGES[locale];
    for (const [msgKey, msgValue] of Object.entries(table)) {
      if (msgKey.startsWith("admin.")) continue;
      rows.push({ locale, msgKey, msgValue, updatedAtIso, updatedByUserId: null });
    }
  }

  for (let i = 0; i < rows.length; i += UI_MESSAGE_BATCH_SIZE) {
    const chunk = rows.slice(i, i + UI_MESSAGE_BATCH_SIZE);
    await prisma.uiMessage.createMany({ data: chunk, skipDuplicates: true });
  }
}

