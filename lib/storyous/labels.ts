import { parseMenuItemBadgeList, type MenuItemBadgeKey } from "../menu/menuItemBadges";

function labelText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const rec = value as Record<string, unknown>;
  for (const key of ["code", "name", "title", "label", "id"] as const) {
    const v = rec[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** Mapuje Storyous `labels` na kiosk štítky vegan / doporučené / populární. */
export function badgesFromStoryousLabels(raw: unknown): MenuItemBadgeKey[] | undefined {
  const texts: string[] = [];
  if (typeof raw === "string") texts.push(raw);
  else if (Array.isArray(raw)) {
    for (const row of raw) {
      const t = labelText(row);
      if (t) texts.push(t);
    }
  } else {
    const t = labelText(raw);
    if (t) texts.push(t);
  }
  const found: string[] = [];
  for (const t of texts) {
    const s = t.toLowerCase();
    if (/(vegan|vegansk)/i.test(s)) found.push("vegan");
    if (/(recommend|doporuč)/i.test(s)) found.push("recommended");
    if (/(popular|populár|oblíben|\bhit\b)/i.test(s)) found.push("popular");
  }
  const list = parseMenuItemBadgeList(found);
  return list.length ? list : undefined;
}
