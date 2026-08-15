/** Chyba Dotykačky, kterou můžeme ukázat hostovi jako „účet je otevřený v pokladně“. */
export function isDotykackaAccountLockedError(detail: string | null | undefined): boolean {
  if (!detail) return false;
  const d = detail.toLowerCase();
  return d.includes("zamkla účet") || d.includes("2001") || d.includes("order_locked");
}
