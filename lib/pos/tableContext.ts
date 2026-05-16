/**
 * Dynamický stůl zajišťuje `DeviceTableProvider` + `usePosTableFields()`.
 * Legacy konstanty jen pro kód bez React kontextu (testy).
 */
export const POS_TABLE_ID = "1";
export const POS_TABLE_LABEL = "Stůl 1";

export function posTableFields() {
  return { tableId: POS_TABLE_ID, tableLabel: POS_TABLE_LABEL };
}

export function tableLabelFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Neuvedený stůl";
  const o = payload as Record<string, unknown>;
  if (typeof o.tableLabel === "string" && o.tableLabel.trim()) return o.tableLabel.trim();
  if (o.tableId != null && String(o.tableId).trim() !== "") return `Stůl ${o.tableId}`;
  return "Neuvedený stůl";
}
