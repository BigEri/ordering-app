/** Android kiosk APK přidává do User-Agent řetězec TableOrderingKiosk. */
export function isKioskWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  return /TableOrderingKiosk/i.test(navigator.userAgent);
}
