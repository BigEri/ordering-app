import { fetchDotykackaProductsForMenu } from "../../../lib/dotykacka/fetchProducts";
import { applyMenuItemOverrides } from "../../../lib/dotykacka/menuItemOverrides";
import { getAdminMenuRestaurantId } from "../../../lib/server/adminMenuRestaurantContext";
import { getPublicRestaurantDisplayName } from "../../../lib/server/publicRestaurantName";
import { MenuBrowseClient } from "../../menu/MenuBrowseClient";

export default async function AdminMenuPage() {
  const restaurantName = await getPublicRestaurantDisplayName();
  const restaurantId = await getAdminMenuRestaurantId();
  if (!restaurantId) {
    return (
      <main style={{ padding: "2rem", maxWidth: 560 }}>
        <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>Editor menu</h1>
        <p style={{ lineHeight: 1.5 }}>
          Není zvolená provozovna. Na úvodní stránce administrace (/admin) vyberte restauraci, u které chcete menu
          upravovat.
        </p>
      </main>
    );
  }
  const result = await fetchDotykackaProductsForMenu(restaurantId);
  if (!result.ok) {
    return (
      <MenuBrowseClient
        sections={[]}
        loadError={result.error}
        restaurantName={restaurantName}
        restaurantId={restaurantId}
        menuVariant="editor"
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
    />
  );
}
