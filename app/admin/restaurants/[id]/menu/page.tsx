import { cookies } from "next/headers";

import { SyncActiveRestaurantCookie } from "../../../../../components/admin/SyncActiveRestaurantCookie";
import { ADMIN_LOCALE_COOKIE, normalizeAdminLocale } from "../../../../../lib/i18n/adminLocale";
import { tAdmin } from "../../../../../lib/i18n/tAdmin";
import { fetchRestaurantMenu } from "../../../../../lib/menu/fetchRestaurantMenu";
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
    const locale = normalizeAdminLocale((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
    const title =
      access.error === "unauthorized"
        ? tAdmin(locale, "admin.editor.access.unauthorizedTitle")
        : access.error === "forbidden"
          ? tAdmin(locale, "admin.editor.access.forbiddenTitle")
          : tAdmin(locale, "admin.editor.access.notFoundTitle");
    const body =
      access.error === "unauthorized"
        ? tAdmin(locale, "admin.editor.access.unauthorizedBody")
        : access.error === "forbidden"
          ? tAdmin(locale, "admin.editor.access.forbiddenBody")
          : tAdmin(locale, "admin.editor.access.notFoundBody");
    return (
      <main className="adminPage">
        <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>{title}</h1>
        <p style={{ lineHeight: 1.5 }}>{body}</p>
        <p>
          <a href="/admin" className="adminBreadcrumb__link">
            {tAdmin(locale, "admin.editor.access.backAdmin")}
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
    fetchRestaurantMenu(restaurantId),
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
      menuSource={result.source}
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
