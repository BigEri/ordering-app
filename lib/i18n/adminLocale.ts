export type AdminLocale = "cs" | "en";

export const ADMIN_LOCALE_COOKIE = "admin-locale";
export const ADMIN_LOCALE_STORAGE = "admin-locale";

export const ADMIN_LOCALES: { code: AdminLocale; label: string; flagCode: "cz" | "gb" }[] = [
  { code: "cs", label: "Čeština", flagCode: "cz" },
  { code: "en", label: "English", flagCode: "gb" },
];

export function normalizeAdminLocale(x: string | null | undefined): AdminLocale {
  return String(x ?? "").trim().toLowerCase() === "en" ? "en" : "cs";
}
