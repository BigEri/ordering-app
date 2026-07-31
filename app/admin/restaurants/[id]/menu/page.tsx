import { cookies } from "next/headers";

import { SyncActiveRestaurantCookie } from "../../../../../components/admin/SyncActiveRestaurantCookie";
import { fetchDotykackaProductsForMenuCached } from "../../../../../lib/dotykacka/fetchProductsCached";
import { applyMenuItemOverrides } from "../../../../../lib/dotykacka/menuItemOverrides";
import { resolveAdminRestaurantPageAccess } from "../../../../../lib/server/adminRestaurantPageAccess";
import {
  readAllMenuUiBundlesForRestaurantCached,
  readMenuOverridesForRestaurantCached,
  readMenuUiBundleForLocaleCached,
} from "../../../../../lib/server/menuOverridesCached";
import { isEnabledLocale } from "../../../../../lib/server/menuTextOverrides";
import { MenuBrowseClient } from "../../../../menu/MenuBrowseClient";

export default async function RestaurantMenuEditorPage({
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
        ? "Pro úpravy menu se přihlaste do administrace."
        : access.error === "forbidden"
          ? "K této provozovně nemáte oprávnění upravovat menu."
          : "Tato provozovna neexistuje.";
    return (
      <main className="adminPage">
        <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>{title}</h1>
        <p style={{ lineHeight: 1.5 }}>{body}</p>
        <p>
          <a href="/admin" className="adminBreadcrumb__link">
            ← Zpět do adminu
          </a>
        </p>
      </main>
    );
  }

  const { restaurantId, name: restaurantName } = access;
  const cookieStore = await cookies();
  const localeRaw = cookieStore.get("ordering-locale")?.value?.trim() ?? "cs";
  const locale = (await isEnabledLocale(localeRaw)) ? localeRaw.toLowerCase() : "cs";

  const [result, menuOverrides, initialMenuUiByLocale] = await Promise.all([
    fetchDotykackaProductsForMenuCached(restaurantId),
    readMenuOverridesForRestaurantCached(restaurantId),
    readAllMenuUiBundlesForRestaurantCached(restaurantId),
  ]);
  const activeUi = initialMenuUiByLocale[locale] ?? (await readMenuUiBundleForLocaleCached(restaurantId, locale));

  const editor = (
    <MenuBrowseClient
      sections={
        result.ok
          ? result.sections.map((s) => ({
              ...s,
              items: s.items.map(applyMenuItemOverrides),
            }))
          : []
      }
      loadError={result.ok ? null : result.error}
      restaurantName={restaurantName}
      restaurantId={restaurantId}
      menuVariant="editor"
      initialMenuOverrides={menuOverrides}
      initialMenuUiByLocale={initialMenuUiByLocale}
      initialMenuUi={{
        locale,
        text: activeUi.text,
        ingredients: activeUi.ingredients,
        dotykacka: activeUi.dotykacka,
      }}
    />
  );

  return (
    <main className="adminPage" style={{ paddingTop: 0 }}>
      <SyncActiveRestaurantCookie restaurantId={restaurantId} />
      <div style={{ marginTop: 12 }}>{editor}</div>
    </main>
  );
}
