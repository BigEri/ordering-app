import { fetchDotykackaProductsForMenu } from "../../../../lib/dotykacka/fetchProducts";
import { applyMenuItemOverrides } from "../../../../lib/dotykacka/menuItemOverrides";
import { getAdminMenuRestaurantId } from "../../../../lib/server/adminMenuRestaurantContext";
import { getPublicRestaurantDisplayName } from "../../../../lib/server/publicRestaurantName";
import { MenuTranslationsClient } from "./MenuTranslationsClient";

export default async function MenuTranslationsPage() {
  const restaurantName = await getPublicRestaurantDisplayName();
  const restaurantId = await getAdminMenuRestaurantId();
  if (!restaurantId) {
    return (
      <main style={{ padding: "2rem", maxWidth: 560 }}>
        <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>Překlady menu</h1>
        <p style={{ lineHeight: 1.5 }}>
          Není zvolená provozovna. Vyberte ji na úvodní stránce administrace (/admin).
        </p>
      </main>
    );
  }
  const result = await fetchDotykackaProductsForMenu(restaurantId);
  const sections = result.ok
    ? result.sections.map((s) => ({
        ...s,
        items: s.items.map(applyMenuItemOverrides),
      }))
    : [];

  return (
    <MenuTranslationsClient
      restaurantId={restaurantId}
      restaurantName={restaurantName}
      sections={sections}
      loadError={result.ok ? null : result.error}
    />
  );
}
