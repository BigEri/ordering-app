import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { fetchRestaurantMenuCached } from "../../lib/menu/fetchRestaurantMenu";
import { applyMenuItemOverrides } from "../../lib/dotykacka/menuItemOverrides";
import { isMenuOpenedFromWelcome, welcomeHomePathFromMenuParams } from "../../lib/kiosk/welcomeEntry";
import { orderMenuSectionsLikeKiosk } from "../../lib/menu/menuSectionsDisplayOrder";
import { isMenuOpenedFromAdmin } from "../../lib/admin/publicMenuPreviewUrl";
import {
  readAllMenuUiBundlesForRestaurantCached,
  readMenuOverridesForRestaurantCached,
  readMenuUiBundleForLocaleCached,
} from "../../lib/server/menuOverridesCached";
import { isEnabledLocale } from "../../lib/server/menuTextOverrides";
import { resolvePublicMenuRestaurantIdSlimFromRequestUrl } from "../../lib/server/publicMenuRestaurantResolve";
import { getPublicRestaurantDisplayNameForRestaurantId } from "../../lib/server/publicRestaurantName";
import { MenuBrowseClient } from "./MenuBrowseClient";

type MenuPageProps = {
  searchParams?: Promise<{ rid?: string; deviceId?: string; from?: string; fromWelcome?: string }>;
};

export default async function MenuPage(props: MenuPageProps) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const adminPreview = isMenuOpenedFromAdmin(searchParams);
  const fromWelcome = isMenuOpenedFromWelcome(searchParams);
  const rid = typeof searchParams.rid === "string" ? searchParams.rid : undefined;
  const deviceId = typeof searchParams.deviceId === "string" ? searchParams.deviceId.trim() : "";

  if (!adminPreview && !fromWelcome) {
    redirect(
      welcomeHomePathFromMenuParams({
        deviceId: deviceId || undefined,
        rid,
      }),
    );
  }
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = new URL(`${proto}://${host}/menu`);
  if (rid) url.searchParams.set("rid", rid);
  if (deviceId && deviceId.length <= 200) url.searchParams.set("deviceId", deviceId);
  if (typeof searchParams.from === "string") url.searchParams.set("from", searchParams.from);

  const restaurantId = await resolvePublicMenuRestaurantIdSlimFromRequestUrl(
    new Request(url.toString(), { headers: { cookie: cookieHeader } }),
  );
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

  const [result, menuOverrides, initialMenuUiByLocale] = await Promise.all([
    fetchRestaurantMenuCached(restaurantId),
    readMenuOverridesForRestaurantCached(restaurantId),
    readAllMenuUiBundlesForRestaurantCached(restaurantId),
  ]);
  const activeUi = initialMenuUiByLocale[locale] ?? (await readMenuUiBundleForLocaleCached(restaurantId, locale));

  if (!result.ok) {
    return (
      <MenuBrowseClient
        sections={[]}
        loadError={result.error}
        restaurantName={restaurantName}
        restaurantId={restaurantId}
        menuVariant="guest"
        adminPreview={adminPreview}
        menuSource={result.source}
        initialMenuUiByLocale={initialMenuUiByLocale}
        initialMenuUi={{
          locale,
          text: activeUi.text,
          ingredients: activeUi.ingredients,
          dotykacka: activeUi.dotykacka,
        }}
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
      menuSource={result.source}
      initialMenuOverrides={menuOverrides}
      initialMenuUiByLocale={initialMenuUiByLocale}
      initialMenuUi={{
        locale,
        text: activeUi.text,
        ingredients: activeUi.ingredients,
        dotykacka: activeUi.dotykacka,
      }}
      adminPreview={adminPreview}
    />
  );
}
