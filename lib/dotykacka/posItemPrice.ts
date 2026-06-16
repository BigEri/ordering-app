function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Jednotková cena s DPH z položky v odpovědi pos-actions `order/list`. */
export function unitPriceCzkFromPosOrderItem(item: Record<string, unknown>): number | undefined {
  const priceKeys = ["price-with-vat", "priceWithVat", "price_with_vat"] as const;
  for (const key of priceKeys) {
    const pv = item[key];
    if (pv == null) continue;
    if (typeof pv === "number" && Number.isFinite(pv)) return Math.round(pv);
    if (typeof pv === "string" && pv.trim()) {
      const n = num(pv);
      if (n != null) return Math.round(n);
    }
    if (typeof pv === "object" && !Array.isArray(pv)) {
      const o = pv as Record<string, unknown>;
      const raw = o["unit-billed"] ?? o.unitBilled ?? o.unit;
      const n = num(raw);
      if (n != null) return Math.round(n);
    }
  }

  for (const key of ["billedUnitPriceWithVat", "unitPriceWithVat", "billed-unit-price-with-vat"] as const) {
    const n = num(item[key]);
    if (n != null) return Math.round(n);
  }

  return undefined;
}

/** Cena produktu z Dotykačka Products API (menu). */
export function priceCzkFromDotykackaProduct(raw: Record<string, unknown>): number {
  const pVat = num(raw.priceWithVat);
  if (pVat != null) return Math.round(pVat);
  const pNo = num(raw.priceWithoutVat);
  if (pNo == null) return 0;
  const vatMult = num(raw.vat);
  return Math.round(pNo * (vatMult != null && vatMult >= 1 ? vatMult : 1.21));
}
