import { headers } from "next/headers";

import { WelcomePage } from "../components/WelcomePage";
import { resolvePublicMenuRestaurantIdSlimFromRequestUrl } from "../lib/server/publicMenuRestaurantResolve";
import { getPublicRestaurantDisplayNameForRestaurantId } from "../lib/server/publicRestaurantName";
import { getWelcomeShowcaseForPublicCached } from "../lib/server/welcomeShowcaseCached";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = new URL(`${proto}://${host}/`);
  const restaurantId = await resolvePublicMenuRestaurantIdSlimFromRequestUrl(
    new Request(url.toString(), { headers: { cookie: cookieHeader } }),
  );
  const [brandName, showcase] = await Promise.all([
    getPublicRestaurantDisplayNameForRestaurantId(restaurantId),
    getWelcomeShowcaseForPublicCached(restaurantId),
  ]);
  return (
    <WelcomePage
      brandName={brandName}
      showcaseImageUrls={showcase.imageUrls}
      layoutPreset={showcase.layoutPreset}
    />
  );
}
