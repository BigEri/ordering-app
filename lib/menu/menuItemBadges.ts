export const MENU_ITEM_BADGE_KEYS = ["vegan", "recommended", "popular"] as const;

export type MenuItemBadgeKey = (typeof MENU_ITEM_BADGE_KEYS)[number];

const BADGE_KEY_SET = new Set<string>(MENU_ITEM_BADGE_KEYS);

export function isMenuItemBadgeKey(value: unknown): value is MenuItemBadgeKey {
  return typeof value === "string" && BADGE_KEY_SET.has(value);
}

/** Canonical pořadí: vegan → recommended → popular. */
export function parseMenuItemBadgeList(raw: unknown): MenuItemBadgeKey[] {
  if (!Array.isArray(raw)) return [];
  const present = new Set<string>();
  for (const item of raw) {
    if (typeof item === "string" && BADGE_KEY_SET.has(item)) present.add(item);
  }
  return MENU_ITEM_BADGE_KEYS.filter((key) => present.has(key));
}

export function parseMenuItemBadgesMap(raw: unknown): Record<string, MenuItemBadgeKey[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, MenuItemBadgeKey[]> = {};
  for (const [id, val] of Object.entries(raw as Record<string, unknown>)) {
    const key = id.trim();
    if (!key) continue;
    const list = parseMenuItemBadgeList(val);
    if (list.length) out[key] = list;
  }
  return out;
}

export function parseMenuItemBadgesJson(json: string): MenuItemBadgeKey[] {
  try {
    return parseMenuItemBadgeList(JSON.parse(json) as unknown);
  } catch {
    return [];
  }
}

export function stringifyMenuItemBadges(badges: MenuItemBadgeKey[]): string {
  return JSON.stringify(parseMenuItemBadgeList(badges));
}

export function toggleMenuItemBadge(
  list: readonly MenuItemBadgeKey[] | undefined,
  badge: MenuItemBadgeKey,
  enabled: boolean,
): MenuItemBadgeKey[] {
  const next = new Set(list ?? []);
  if (enabled) next.add(badge);
  else next.delete(badge);
  return parseMenuItemBadgeList([...next]);
}

export function sameMenuItemBadgeList(
  a: readonly MenuItemBadgeKey[] | undefined,
  b: readonly MenuItemBadgeKey[] | undefined,
): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  return left.every((key, i) => key === right[i]);
}
