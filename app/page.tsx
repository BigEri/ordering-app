import { WelcomePage } from "../components/WelcomePage";
import { requestFromIncomingHeaders } from "../lib/server/incomingPublicRequest";
import { resolvePublicMenuRestaurantIdSlimFromRequestUrl } from "../lib/server/publicMenuRestaurantResolve";
import { getPublicRestaurantDisplayNameForRestaurantId } from "../lib/server/publicRestaurantName";
import { getWelcomeShowcaseForPublicCached } from "../lib/server/welcomeShowcaseCached";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const req = await requestFromIncomingHeaders("/");
  const restaurantId = await resolvePublicMenuRestaurantIdSlimFromRequestUrl(req);
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
