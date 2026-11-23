export type TableBillApplyLine = {
  name: string;
  detail?: string;
  qty: number;
  unitPriceCzk: number;
  itemId?: number;
  orderId?: number;
};

export type TableBillApply =
  | { action: "apply"; lines: TableBillApplyLine[]; totalCzk: number }
  | { action: "keep-local" }
  | { action: "close-issued" };

/**
 * Co udělat s účtem na tabletu podle odpovědi z pokladny.
 * Prázdný / neotevřený účet nesmí smazat lokální objednávky, dokud tablet
 * aspoň jednou neviděl otevřený účet v kase (jinak první objednávka zmizí,
 * než pokladna stihne účet otevřít).
 */
export function decideTableBillApply(input: {
  open: boolean;
  lines: TableBillApplyLine[];
  totalCzk: number;
  hadOpenBillFromTill: boolean;
  splitPayContinue: boolean;
}): TableBillApply {
  const lines = Array.isArray(input.lines) ? input.lines : [];
  const totalCzk = typeof input.totalCzk === "number" && Number.isFinite(input.totalCzk) ? input.totalCzk : 0;

  if (input.open && lines.length > 0) {
    return { action: "apply", lines, totalCzk };
  }
  if (input.open && lines.length === 0) {
    return { action: "keep-local" };
  }
  if (input.splitPayContinue) {
    return { action: "keep-local" };
  }
  if (!input.hadOpenBillFromTill) {
    return { action: "keep-local" };
  }
  return { action: "close-issued" };
}
