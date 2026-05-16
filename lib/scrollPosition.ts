/** Čtení / obnovení vertikálního scrollu — na iOS a v některých WebView je scroll na `documentElement`, ne jen `window`. */

export function getScrollY(): number {
  if (typeof window === "undefined") return 0;
  return (
    window.scrollY ||
    window.pageYOffset ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  );
}

/** Obnoví pozici po zámku `body` (tablet / Safari často ignorují jen `window.scrollTo`). */
export function setScrollY(y: number): void {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: y, left: 0, behavior: "instant" });
  document.documentElement.scrollTop = y;
  document.body.scrollTop = y;
}

/** Po přepnutí layoutu (např. odstranění `position: fixed`) obnov až po vykreslení. */
export function restoreScrollYAfterPaint(y: number): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setScrollY(y);
    });
  });
}
