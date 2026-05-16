export type WelcomeLayoutPreset = "mosaic" | "fade" | "split_half" | "grid_four";

export function parseWelcomeLayoutPreset(raw: string | null | undefined): WelcomeLayoutPreset {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "fade") return "fade";
  if (s === "split_half" || s === "split-half" || s === "splithalf") return "split_half";
  if (s === "grid_four" || s === "grid-four" || s === "gridfour" || s === "quarters") return "grid_four";
  return "mosaic";
}
