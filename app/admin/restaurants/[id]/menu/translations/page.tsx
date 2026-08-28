import { cookies } from "next/headers";

import { SyncActiveRestaurantCookie } from "../../../../../../components/admin/SyncActiveRestaurantCookie";
import { ADMIN_LOCALE_COOKIE, normalizeAdminLocale } from "../../../../../../lib/i18n/adminLocale";
import { tAdmin } from "../../../../../../lib/i18n/tAdmin";
import { fetchRestaurantMenu } from "../../../../../../lib/menu/fetchRestaurantMenu";
import { applyMenuItemOverrides } from "../../../../../../lib/dotykacka/menuItemOverrides";
import { orderMenuSectionsLikeKiosk } from "../../../../../../lib/menu/menuSectionsDisplayOrder";
import { resolveAdminRestaurantPageAccess } from "../../../../../../lib/server/adminRestaurantPageAccess";
import { readMenuOverridesForRestaurant } from "../../../../../../lib/server/menuOverridesRead";
import { MenuTranslationsClient } from "../../../../menu/translations/MenuTranslationsClient";

export default async function RestaurantMenuTranslationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idRaw } = await params;
  const access = await resolveAdminRestaurantPageAccess(idRaw);

  if (!access.ok) {
    const locale = normalizeAdminLocale((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
    const title =
      access.error === "unauthorized"
        ? tAdmin(locale, "admin.translations.access.unauthorizedTitle")
        : access.error === "forbidden"
          ? tAdmin(locale, "admin.translations.access.forbiddenTitle")
          : tAdmin(locale, "admin.translations.access.notFoundTitle");
    const body =
      access.error === "unauthorized"
        ? tAdmin(locale, "admin.translations.access.unauthorizedBody")
        : access.error === "forbidden"
          ? tAdmin(locale, "admin.translations.access.forbiddenBody")
          : tAdmin(locale, "admin.translations.access.notFoundBody");
    return (
      <main className="adminPage">
        <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>{title}</h1>
        <p style={{ lineHeight: 1.5 }}>{body}</p>
        <p>
          <a href="/admin" className="adminBreadcrumb__link">
            {tAdmin(locale, "admin.translations.access.backAdmin")}
          </a>
        </p>
      </main>
    );
  }

  const { restaurantId, name: restaurantName } = access;
  const [result, menuOverrides] = await Promise.all([
    fetchRestaurantMenu(restaurantId),
    readMenuOverridesForRestaurant(restaurantId),
  ]);
  const sections = result.ok
    ? orderMenuSectionsLikeKiosk(
        result.sections.map((s) => ({
          ...s,
          items: s.items.map(applyMenuItemOverrides),
        })),
        {
          orderByCategory: menuOverrides.orderByCategory,
          images: menuOverrides.images,
          hiddenCategoryKeys: menuOverrides.hiddenCategoryKeys,
          hiddenItemIds: menuOverrides.hiddenItemIds,
        },
      )
    : [];

  return (
    <main className="adminPage" style={{ paddingTop: 0 }}>
      <SyncActiveRestaurantCookie restaurantId={restaurantId} />
      <div style={{ marginTop: 8 }}>
        <MenuTranslationsClient
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          sections={sections}
          loadError={result.ok ? null : result.error}
        />
      </div>
    </main>
  );
}
