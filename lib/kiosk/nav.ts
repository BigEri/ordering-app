import { buildKioskMenuUrl, buildKioskWelcomeUrl } from "./welcomeEntry";

export { buildKioskMenuUrl, buildKioskWelcomeUrl };

/** Plná navigace — spolehlivá v Android WebView (na rozdíl od Next.js client router). */
export function kioskNavigate(href: string): void {
  if (typeof window === "undefined") return;
  window.location.href = href;
}
