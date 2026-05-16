/**
 * Pravidla pro důvěryhodnost `?rid=` u veřejného menu — bez toho by útočník mohl
 * zobrazit cizí provozovnu jen znalostí UUID (multi-tenant).
 */
export function isPublicMenuRidQueryTrusted(input: {
  ridQueryTrimmed: string;
  kioskRestaurantId: string;
  adminRestaurantId: string | null;
  /** Jedna výchozí provozovna (PUBLIC_RESTAURANT_ID / jediný řádek v DB). */
  defaultSingletonRestaurantId: string | null;
}): boolean {
  const q = input.ridQueryTrimmed.trim();
  if (!q) return false;
  const kiosk = input.kioskRestaurantId.trim();
  const admin = input.adminRestaurantId?.trim() ?? "";
  const single = input.defaultSingletonRestaurantId?.trim() ?? "";
  if (kiosk && q === kiosk) return true;
  if (admin && q === admin) return true;
  if (single && q === single) return true;
  return false;
}
