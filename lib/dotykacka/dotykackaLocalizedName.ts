/**
 * Název jako ve správě položek v Dotyce: hlavní `name`, pak `translatedName` (cs, …), pak `alternativeName`.
 */

export function pickDotykackaLocalizedName(row: Record<string, unknown>): string | null {
  const n = row.name;
  if (typeof n === "string" && n.trim()) return n.trim();

  const tn = row.translatedName;
  if (tn && typeof tn === "object" && !Array.isArray(tn)) {
    const map = tn as Record<string, unknown>;
    for (const k of ["cs", "cs-CZ", "sk", "en", "en-US"]) {
      const v = map[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    for (const [key, v] of Object.entries(map)) {
      if (/^cs(-[a-z]{2})?$/i.test(key) && typeof v === "string" && v.trim()) return v.trim();
    }
    for (const v of Object.values(map)) {
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }

  const alt = row.alternativeName;
  if (typeof alt === "string" && alt.trim()) return alt.trim();

  return null;
}

/** Prázdné řetězce z API (např. name: "") neblokují při sloučení s plnějším záznamem. */
export function omitEmptyStringFields(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === "") continue;
    out[k] = v;
  }
  return out;
}
