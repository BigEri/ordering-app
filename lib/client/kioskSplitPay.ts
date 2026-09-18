const KEY = "tableflow.splitPayContinue";

/** Krátce po split platbě — nenechat watcher skočit na welcome, když pokladna ještě dohání zbytek. */
export const KIOSK_SPLIT_PAY_CONTINUE_MS = 45_000;

export function markKioskSplitPayContinue(): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function peekKioskSplitPayContinue(maxAgeMs = KIOSK_SPLIT_PAY_CONTINUE_MS): boolean {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return false;
    const o = JSON.parse(raw) as { at?: number };
    const at = typeof o.at === "number" ? o.at : 0;
    return Date.now() - at < maxAgeMs;
  } catch {
    return false;
  }
}

export function clearKioskSplitPayContinue(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Po XPay: split s položkami na stole → další host platí.
 * `remaining === null` = nevíme (síť) — raději zůstat v platbě než na úvod.
 */
export function shouldResumeSplitAfterPay(input: {
  split: boolean;
  remaining: boolean | null;
}): "resume" | "welcome" {
  if (!input.split) return "welcome";
  if (input.remaining === false) return "welcome";
  return "resume";
}
