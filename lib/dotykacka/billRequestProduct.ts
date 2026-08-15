/**
 * Položka 0 Kč v Dotykačce pro žádost o účet / platbu (na účet hosta; štítek může tisknout bon).
 * V mapě produktů: klíč → product id. Na položku posíláme štítek pro filtry tisku.
 */

/** Klíč v `productMap` / `DOTYKACKA_PRODUCT_MAP_JSON`. */
export const DOTYKACKA_BILL_REQUEST_PRODUCT_MAP_KEY = "oa-bill-request";

/**
 * Štítek na řádku objednávky i na produktu v Dotykačce (filtry tisku).
 * Účtenky: tisknout produkty, které tento štítek nemají.
 */
export const DOTYKACKA_BILL_REQUEST_PRINT_TAG = "oa-volani";

export function resolveBillRequestProductId(productMap: Record<string, number>): number | undefined {
  const fromMap = productMap[DOTYKACKA_BILL_REQUEST_PRODUCT_MAP_KEY];
  if (typeof fromMap === "number" && Number.isFinite(fromMap)) return fromMap;

  const envRaw = process.env.DOTYKACKA_BILL_REQUEST_PRODUCT_ID?.trim();
  if (envRaw) {
    const n = Number(envRaw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function fmtCzk(n: number): string {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  return `${v} Kč`;
}

export function paymentMethodLabelFromRaw(raw: string): string | null {
  if (raw === "CARD") return "Karta";
  if (raw === "CASH") return "Hotovost";
  if (raw === "MIX") return "Mix";
  return null;
}

export function buildBillRequestItemNote(input: {
  tableLabelOrId: string;
  paymentMethodRaw?: string;
  ordersTotal: number;
  tipPct: number;
  tipAmount: number;
  billTotal: number;
  timeLabel: string;
}): string {
  const raw = input.tableLabelOrId.trim();
  const human = raw ? (raw.match(/\d+/)?.[0] ?? raw) : "?";
  const pay = paymentMethodLabelFromRaw(input.paymentMethodRaw?.trim() ?? "");
  return [
    `CHCE ZAPLATIT: ${input.timeLabel}`,
    `STŮL - ${human}`,
    ...(pay ? [`platba ${pay}`] : []),
    `subtotal ${fmtCzk(input.ordersTotal)}`,
    Number.isFinite(input.tipPct)
      ? `tip ${Math.round(input.tipPct)}% (${fmtCzk(input.tipAmount)})`
      : `tip ${fmtCzk(input.tipAmount)}`,
    `total ${fmtCzk(input.billTotal)}`,
  ].join(" · ");
}
