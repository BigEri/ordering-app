/** Jednou za relaci stránky — úvod může volat warm víckrát, ale HTTP jen jednou. */
const warmedKeys = new Set<string>();

function warmKey(deviceId: string): string {
  const id = deviceId.trim();
  return id || "__cookie__";
}

/**
 * Na pozadí z úvodní stránky přednahřeje server cache pro `/menu`.
 * Volat až když je tablet spárovaný (`ready` + `deviceId`).
 */
export function prefetchMenuCacheFromWelcome(deviceId: string): void {
  if (typeof window === "undefined") return;
  const key = warmKey(deviceId);
  if (warmedKeys.has(key)) return;
  warmedKeys.add(key);

  const u = new URL("/api/public/warm-menu-cache", window.location.origin);
  const id = deviceId.trim();
  if (id) u.searchParams.set("deviceId", id);

  void fetch(u.toString(), { credentials: "same-origin", cache: "no-store" })
    .then((r) => {
      if (!r.ok) warmedKeys.delete(key);
    })
    .catch(() => {
      warmedKeys.delete(key);
    });
}

/** Pro testy — reset stavu deduplikace. */
export function resetMenuCacheWarmStateForTests(): void {
  warmedKeys.clear();
}
