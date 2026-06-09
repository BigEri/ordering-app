import { cookies } from "next/headers";

import { fetchDotykackaProductsForMenuCached } from "../../../lib/dotykacka/fetchProductsCached";
import { applyMenuItemOverrides } from "../../../lib/dotykacka/menuItemOverrides";
import { getAdminMenuRestaurantId } from "../../../lib/server/adminMenuRestaurantContext";
import { readDotykackaLabelsForRestaurantLocale } from "../../../lib/server/menuDotykackaLabels";
import { readMenuIngredientOverridesForRestaurantLocale } from "../../../lib/server/menuIngredientOverrides";
import { readMenuOverridesForRestaurant } from "../../../lib/server/menuOverridesRead";
import { isEnabledLocale, readMenuTextOverridesForRestaurantLocale } from "../../../lib/server/menuTextOverrides";
import { getPublicRestaurantDisplayName } from "../../../lib/server/publicRestaurantName";
import { MenuBrowseClient } from "../../menu/MenuBrowseClient";

export default async function AdminMenuPage() {
  const [restaurantName, restaurantId] = await Promise.all([
    getPublicRestaurantDisplayName(),
    getAdminMenuRestaurantId(),
  ]);
  if (!restaurantId) {
    return (
      <main style={{ padding: "2rem", maxWidth: 560 }}>
        <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>Editor menu</h1>
        <p style={{ lineHeight: 1.5 }}>
          Není nastavená vaše restaurace. Otevřete Přehled v administraci (/admin) a dokončete nastavení, pak můžete menu upravovat.
        </p>
      </main>
    );
  }
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
        menuVariant="editor"
        initialMenuOverrides={menuOverrides}
        initialMenuUi={{
          locale,
          text: textOverrides,
          ingredients: ingredientOverrides,
          dotykacka: dotykackaLabels,
        }}
      />
    );
  }
  return (
    <MenuBrowseClient
      sections={result.sections.map((s) => ({
        ...s,
        items: s.items.map(applyMenuItemOverrides),
      }))}
      loadError={null}
      restaurantName={restaurantName}
      restaurantId={restaurantId}
      menuVariant="editor"
      initialMenuOverrides={menuOverrides}
      initialMenuUi={{
        locale,
        text: textOverrides,
        ingredients: ingredientOverrides,
        dotykacka: dotykackaLabels,
      }}
    />
  );
}
