/**
 * Skrytá položka Dotykačky pro přivolání obsluhy (bon / notifikace).
 * V mapě produktů: klíč → product id. Na položku posíláme štítek pro filtry tisku.
 */

/** Klíč v `productMap` / `DOTYKACKA_PRODUCT_MAP_JSON`. */
export const DOTYKACKA_STAFF_CALL_PRODUCT_MAP_KEY = "oa-staff-call";

/**
 * Štítek na řádku objednávky (pos-actions `tags`) i doporučený štítek produktu v Dotykačce.
 * Tisk objednávek: jen tento štítek. Tisk účtenek: bez něj (nebo „produkty bez tohoto štítku“).
 */
export const DOTYKACKA_STAFF_CALL_PRINT_TAG = "oa-volani";

export function resolveStaffCallProductId(productMap: Record<string, number>): number | undefined {
  const fromMap = productMap[DOTYKACKA_STAFF_CALL_PRODUCT_MAP_KEY];
  if (typeof fromMap === "number" && Number.isFinite(fromMap)) return fromMap;

  const envRaw = process.env.DOTYKACKA_STAFF_CALL_PRODUCT_ID?.trim();
  if (envRaw) {
    const n = Number(envRaw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function buildStaffCallItemNote(tableLabelOrId: string): string {
  const raw = tableLabelOrId.trim();
  const human = raw ? (raw.match(/\d+/)?.[0] ?? raw) : "?";
  return `STŮL - ${human} · VOLÁ OBSLUHU`;
}
