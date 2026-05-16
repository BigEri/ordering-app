import { MESSAGES } from "./messages";

/** Texty pro personál, POS, úvod, topbar — vždy čeština (ne jazyk hosta v menu). */
export function tStaff(key: string): string {
  return MESSAGES.cs[key] ?? key;
}
