export type OpenOrderPick = { orderId: number; externalId?: string };

/**
 * Kandidáti pro `order/add-item`: nejdřív účet z tohoto tabletu (external-id relace),
 * jinak jediný otevřený účet na stole, jinak účet bez external-id (personál v Dotypos),
 * jinak první otevřený.
 */
export function pickTargetOpenOrdersForMerge(
  orders: OpenOrderPick[],
  sessionExternalId: string,
): OpenOrderPick[] {
  if (orders.length === 0) return [];
  const ours = orders.filter((o) => o.externalId === sessionExternalId);
  if (ours.length > 0) return ours;
  if (orders.length === 1) return orders;
  const withoutExt = orders.filter((o) => !o.externalId?.trim());
  if (withoutExt.length > 0) return withoutExt;
  return [orders[0]!];
}

export function parseDotykackaPosActionCode(data: unknown): number | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const code = (data as { code?: unknown }).code;
  return typeof code === "number" && Number.isFinite(code) ? code : undefined;
}

export function parseDotykackaPosActionCodeFromText(text: string): number | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    return parseDotykackaPosActionCode(JSON.parse(trimmed) as unknown);
  } catch {
    return undefined;
  }
}

/** Po selhání create zkusit znovu add-item (účet mezitím mohl vzniknout / odemknout se). */
export function shouldRelistOrdersAfterCreateFailure(code: number | undefined): boolean {
  if (code === undefined) return true;
  return code === 2001 || code === 2009 || code === 2005 || code === 2002;
}

/** Zkusit další otevřený účet na stole. */
export function shouldTryNextOpenOrder(code: number | undefined): boolean {
  if (code === undefined) return false;
  return code === 2001 || code === 2002;
}
