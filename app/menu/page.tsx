import { cookies, headers } from "next/headers";

import { fetchDotykackaProductsForMenuCached } from "../../lib/dotykacka/fetchProductsCached";
import { applyMenuItemOverrides } from "../../lib/dotykacka/menuItemOverrides";
import { orderMenuSectionsLikeKiosk } from "../../lib/menu/menuSectionsDisplayOrder";
import { isMenuOpenedFromAdmin } from "../../lib/admin/publicMenuPreviewUrl";
import { getKioskDeviceBinding } from "../../lib/server/kioskDeviceBindings";
import { readDotykackaLabelsForRestaurantLocale } from "../../lib/server/menuDotykackaLabels";
import { readMenuIngredientOverridesForRestaurantLocale } from "../../lib/server/menuIngredientOverrides";
import { readMenuOverridesForRestaurant } from "../../lib/server/menuOverridesRead";
import { isEnabledLocale, readMenuTextOverridesForRestaurantLocale } from "../../lib/server/menuTextOverrides";
import { resolvePublicMenuRestaurantIdFromRequestUrl } from "../../lib/server/publicMenuRestaurantResolve";
import { getPublicRestaurantDisplayNameForRestaurantId } from "../../lib/server/publicRestaurantName";
import { MenuBrowseClient } from "./MenuBrowseClient";

type MenuPageProps = {
  searchParams?: Promise<{ rid?: string; deviceId?: string; from?: string }>;
};

export default async function MenuPage(props: MenuPageProps) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const adminPreview = isMenuOpenedFromAdmin(searchParams);
  const rid = typeof searchParams.rid === "string" ? searchParams.rid : undefined;
  const deviceId = typeof searchParams.deviceId === "string" ? searchParams.deviceId.trim() : "";
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = new URL(`${proto}://${host}/menu`);
  if (rid) url.searchParams.set("rid", rid);
  let restaurantId: string | null = null;
  if (deviceId && deviceId.length <= 200) {
    const binding = await getKioskDeviceBinding(deviceId);
    restaurantId = binding?.restaurantId ?? null;
  } else {
    restaurantId = await resolvePublicMenuRestaurantIdFromRequestUrl(
      new Request(url.toString(), { headers: { cookie: cookieHeader } }),
    );
  }
  if (!restaurantId) {
    return (
      <MenuBrowseClient
        sections={[]}
        loadError={
          deviceId
            ? "Tablet není spárovaný. Přepněte ho do servisního režimu a proveďte pairing."
            : "Chybí kontext restaurace."
        }
        restaurantName={"Restaurace"}
        restaurantId={""}
        menuVariant="guest"
        adminPreview={adminPreview}
      />
    );
  }
  const restaurantName = await getPublicRestaurantDisplayNameForRestaurantId(restaurantId);

  const cookieStore = await cookies();
  const localeRaw = cookieStore.get("ordering-locale")?.value?.trim() ?? "cs";
  const locale = (await isEnabledLocale(localeRaw)) ? localeRaw.toLowerCase() : "cs";

  const [result, menuOverrides, textOverrides, ingredientOverrides, dotykackaLabels] = await Promise.all([
    fetchDotykackaProductsForMenuCached(restaurantId),
    readMenuOverridesForRestaurant(restaurantId),
    readMenuTextOverridesForRestaurantLocale(restaurantId, locale),
    readMenuIngredientOverridesForRestaurantLocale(restaurantId, locale),
    readDotykackaLabelsForRestaurantLocale(restaurantId, locale),
  ]);
  if (!result.ok) {
    return (
      <MenuBrowseClient
        sections={[]}
        loadError={result.error}
        restaurantName={restaurantName}
        restaurantId={restaurantId}
        menuVariant="guest"
        adminPreview={adminPreview}
      />
    );
  }
  const sections = orderMenuSectionsLikeKiosk(
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
  );

  return (
    <MenuBrowseClient
      sections={sections}
      loadError={null}
      restaurantName={restaurantName}
      restaurantId={restaurantId}
      menuVariant="guest"
      initialMenuOverrides={menuOverrides}
      initialMenuUi={{
        locale,
        text: textOverrides,
        ingredients: ingredientOverrides,
        dotykacka: dotykackaLabels,
      }}
      adminPreview={adminPreview}
    />
  );
}
