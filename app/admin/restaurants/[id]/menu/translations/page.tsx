import { Suspense } from "react";

import { RestaurantAdminTabs } from "../../../../../../components/admin/RestaurantAdminTabs";
import { SyncActiveRestaurantCookie } from "../../../../../../components/admin/SyncActiveRestaurantCookie";
import { fetchDotykackaProductsForMenu } from "../../../../../../lib/dotykacka/fetchProducts";
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
    const title =
      access.error === "unauthorized"
        ? "Přihlaste se"
        : access.error === "forbidden"
          ? "Nemáte přístup"
          : "Provozovna nenalezena";
    const body =
      access.error === "unauthorized"
        ? "Pro překlady menu se přihlaste do administrace."
        : access.error === "forbidden"
          ? "K této provozovně nemáte oprávnění upravovat překlady."
          : "Tato provozovna neexistuje.";
    return (
      <main className="adminPage">
        <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>{title}</h1>
        <p style={{ lineHeight: 1.5 }}>{body}</p>
        <p>
          <a href="/admin" className="adminBreadcrumb__link">
            ← Přehled admin
          </a>
        </p>
      </main>
    );
  }

  const { restaurantId, name: restaurantName } = access;
  const [result, menuOverrides] = await Promise.all([
    fetchDotykackaProductsForMenu(restaurantId),
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
      <Suspense fallback={null}>
        <RestaurantAdminTabs restaurantId={restaurantId} active="menu" />
      </Suspense>
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
