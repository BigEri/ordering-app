export type MenuItemImageFit = {
  objectFit: "cover" | "contain";
  objectPosition: string;
};

/** Jak zobrazit fotku v pevném rámečku karty — bez ořezu na „půlku láhve“. */
export function resolveMenuItemImageFit(naturalWidth: number, naturalHeight: number): MenuItemImageFit {
  if (!Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight) || naturalWidth <= 0 || naturalHeight <= 0) {
    return { objectFit: "cover", objectPosition: "center" };
  }
  const ratio = naturalHeight / naturalWidth;
  if (ratio >= 1.12) {
    return { objectFit: "contain", objectPosition: "center" };
  }
  if (ratio >= 1.02) {
    return { objectFit: "cover", objectPosition: "center 30%" };
  }
  return { objectFit: "cover", objectPosition: "center" };
}

export function menuItemMediaFallbackGradient(seedId: string): string {
  const hue = Math.abs(Array.from(seedId).reduce((acc, ch) => acc + ch.charCodeAt(0) * 17, 0) % 360);
  return (
    `radial-gradient(600px 240px at 30% 20%, hsla(${hue}, 90%, 65%, 0.35), transparent 55%), ` +
    `radial-gradient(500px 220px at 80% 10%, hsla(${(hue + 60) % 360}, 90%, 60%, 0.25), transparent 60%), ` +
    `linear-gradient(180deg, rgba(255,255,255,0.10), rgba(0,0,0,0.10))`
  );
}
