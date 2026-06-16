export type OpenOrderPick = { orderId: number; externalId?: string };

/**
 * Kandidáti pro `order/add-item` v prioritním pořadí (bez duplicit).
 * Nejdřív účet tabletu (external-id), pak bez external-id, pak všechny ostatní otevřené.
 */
export function pickTargetOpenOrdersForMerge(
  orders: OpenOrderPick[],
  sessionExternalId: string,
): OpenOrderPick[] {
  if (orders.length === 0) return [];

  const seen = new Set<number>();
  const out: OpenOrderPick[] = [];
  const push = (o: OpenOrderPick) => {
    if (seen.has(o.orderId)) return;
    seen.add(o.orderId);
    out.push(o);
  };

  for (const o of orders) {
    if (o.externalId === sessionExternalId) push(o);
  }
  for (const o of orders) {
    if (!o.externalId?.trim()) push(o);
  }
  for (const o of orders) push(o);

  return out;
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
