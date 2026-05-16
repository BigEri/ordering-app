/**
 * Předvolby fotek na úvodní stránce (stejný vizuální styl jako výchozí mozaika).
 * URL musí být buď lokální pod `/images/`, nebo HTTPS.
 */
import type { WelcomeLayoutPreset } from "./welcomeLayoutPreset";

/**
 * Předvolby mají nastavovat hlavně rozložení + počet slotů.
 * Konkrétní fotky si restaurace nahraje sama (nechceme držet staré demo fotky).
 */
export const WELCOME_SHOWCASE_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  layoutPreset: WelcomeLayoutPreset;
  slots: number;
}> = [
  { id: "mosaic", label: "Klasické (mozaika)", layoutPreset: "mosaic", slots: 3 },
  { id: "split_half", label: "Dvě poloviny (50/50)", layoutPreset: "split_half", slots: 2 },
  { id: "grid_four", label: "Čtyři čtvrtiny (2×2)", layoutPreset: "grid_four", slots: 4 },
  { id: "fade", label: "Jedna plocha (střídání)", layoutPreset: "fade", slots: 1 },
];
