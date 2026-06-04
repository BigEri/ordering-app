/** Jednotné zobrazení fotek v kartě menu — celý produkt + rozmazané pozadí (jako Coca-Cola). */
export const MENU_ITEM_IMAGE_FRAMED = {
  objectFit: "contain" as const,
  objectPosition: "center",
  useBlurBackdrop: true,
};

export function menuItemMediaFallbackGradient(seedId: string): string {
  const hue = Math.abs(Array.from(seedId).reduce((acc, ch) => acc + ch.charCodeAt(0) * 17, 0) % 360);
  return (
    `radial-gradient(600px 240px at 30% 20%, hsla(${hue}, 90%, 65%, 0.35), transparent 55%), ` +
    `radial-gradient(500px 220px at 80% 10%, hsla(${(hue + 60) % 360}, 90%, 60%, 0.25), transparent 60%), ` +
    `linear-gradient(180deg, rgba(255,255,255,0.10), rgba(0,0,0,0.10))`
  );
}
