import { ADMIN_MESSAGES } from "./adminMessages";
import { normalizeAdminLocale } from "./adminLocale";
import { MESSAGES } from "./messages";

export function tAdmin(locale: string, key: string, vars?: Record<string, string | number>): string {
  const loc = normalizeAdminLocale(locale);
  let s =
    ADMIN_MESSAGES[loc][key] ??
    MESSAGES[loc][key] ??
    ADMIN_MESSAGES.cs[key] ??
    MESSAGES.cs[key] ??
    key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}
