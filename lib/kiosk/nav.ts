/** Plná navigace — spolehlivá v Android WebView (na rozdíl od Next.js client router). */
export function kioskNavigate(href: string): void {
  if (typeof window === "undefined") return;
  window.location.href = href;
}

/** URL menu s `deviceId` z query / localStorage / cookie (kiosk tablet). */
export function buildKioskMenuUrl(): string {
  if (typeof window === "undefined") return "/menu";

  const sp = new URLSearchParams(window.location.search);
  const fromQuery = sp.get("deviceId")?.trim();
  if (fromQuery) return `/menu?deviceId=${encodeURIComponent(fromQuery)}`;

  try {
    const ls = localStorage.getItem("kiosk.deviceId")?.trim();
    if (ls) return `/menu?deviceId=${encodeURIComponent(ls)}`;
  } catch {
    /* ignore */
  }

  const raw = document.cookie ?? "";
  for (const part of raw.split(";")) {
    const p = part.trim();
    if (!p.startsWith("kiosk_device_id=")) continue;
    const v = decodeURIComponent(p.slice("kiosk_device_id=".length)).trim();
    if (v) return `/menu?deviceId=${encodeURIComponent(v)}`;
  }

  return "/menu";
}
