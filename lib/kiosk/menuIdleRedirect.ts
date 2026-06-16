/** Výchozí: 2 min 30 s bez interakce na `/menu` → welcome. */
export const MENU_IDLE_REDIRECT_MS_DEFAULT = 150_000;

const MIN_MS = 5_000;
const MAX_MS = 600_000;

/**
 * Doba idle před redirectem na welcome.
 * Volitelně `NEXT_PUBLIC_MENU_IDLE_REDIRECT_MS` (ms), např. `10000` pro rychlý lokální test scénáře 3.
 */
export function getMenuIdleRedirectMs(): number {
  const raw = process.env.NEXT_PUBLIC_MENU_IDLE_REDIRECT_MS?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = Number.parseInt(raw, 10);
    if (n >= MIN_MS && n <= MAX_MS) return n;
  }
  return MENU_IDLE_REDIRECT_MS_DEFAULT;
}

export type MenuIdlePauseInput = {
  adminPreview?: boolean;
  menuVariant?: "guest" | "editor";
  cartHasItems: boolean;
  hasOpenTableBill: boolean;
};

/** Pozastaví idle redirect, když host ještě objednává nebo u stolu běží účet v Dotyce. */
export function shouldPauseMenuIdleRedirect(input: MenuIdlePauseInput): boolean {
  if (input.adminPreview) return false;
  if (input.menuVariant !== "guest") return false;
  return input.cartHasItems || input.hasOpenTableBill;
}
