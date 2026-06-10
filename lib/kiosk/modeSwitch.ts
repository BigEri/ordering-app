import { isKioskWebView } from "./isKioskWebView";
import { buildKioskWelcomeUrl } from "./welcomeEntry";

export async function logoutAdminSession(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  } catch {
    /* ignore */
  }
}

/** Přepnutí mezi host (kiosk) a admin — v APK přes native volbu, v prohlížeči přímá navigace. */
export async function navigateToKioskMode(target: "host" | "admin"): Promise<void> {
  await logoutAdminSession();
  if (isKioskWebView()) {
    window.location.href = `/kiosk/reset-mode?to=${target}`;
    return;
  }
  window.location.href = target === "admin" ? "/admin/login" : buildKioskWelcomeUrl();
}
