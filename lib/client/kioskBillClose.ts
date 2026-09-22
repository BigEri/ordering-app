const KEY = "tableflow.billClose";

type StoredClose = {
  reason?: string;
  at?: number;
  amountCzk?: number;
  tipAmountCzk?: number;
  tipMissing?: boolean;
};

export type KioskXpayClose = {
  amountCzk: number | null;
  tipAmountCzk: number;
  tipMissing: boolean;
};

function finiteAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function readStored(maxAgeMs: number): StoredClose | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as StoredClose;
    if (o.reason !== "xpay") return null;
    const at = typeof o.at === "number" ? o.at : 0;
    if (Date.now() - at >= maxAgeMs) return null;
    return o;
  } catch {
    return null;
  }
}

function writeStored(next: StoredClose): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function markKioskBillPaidByXpay(detail?: { amountCzk?: number; tipAmountCzk?: number }): void {
  const prev = readStored(120_000);
  const amountCzk = finiteAmount(detail?.amountCzk) ?? finiteAmount(prev?.amountCzk);
  const tipAmountCzk = finiteAmount(detail?.tipAmountCzk) ?? finiteAmount(prev?.tipAmountCzk) ?? 0;
  writeStored({
    reason: "xpay",
    at: Date.now(),
    ...(amountCzk != null ? { amountCzk } : {}),
    tipAmountCzk,
    tipMissing: prev?.tipMissing === true,
  });
}

export function markKioskXpayTipMissing(missing: boolean): void {
  const prev = readStored(120_000);
  const amountCzk = finiteAmount(prev?.amountCzk);
  writeStored({
    reason: "xpay",
    at: prev?.at ?? Date.now(),
    ...(amountCzk != null ? { amountCzk } : {}),
    tipAmountCzk: finiteAmount(prev?.tipAmountCzk) ?? 0,
    tipMissing: missing,
  });
}

export function peekKioskBillPaidByXpay(maxAgeMs = 120_000): boolean {
  return readStored(maxAgeMs) != null;
}

/** Částka z karty (jídlo + spropitné), ne poslední otevřený účet bez dýška. */
export function peekKioskXpayClose(maxAgeMs = 120_000): KioskXpayClose | null {
  const o = readStored(maxAgeMs);
  if (!o) return null;
  return {
    amountCzk: finiteAmount(o.amountCzk),
    tipAmountCzk: finiteAmount(o.tipAmountCzk) ?? 0,
    tipMissing: o.tipMissing === true,
  };
}

export function clearKioskBillPaidByXpay(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
