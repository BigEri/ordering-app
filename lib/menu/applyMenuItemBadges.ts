import type { DotykackaMenuSection } from "../dotykacka/dotykackaMenuSections";
import { sameMenuItemBadgeList, type MenuItemBadgeKey } from "./menuItemBadges";

/**
 * Připojí hostitelské štítky z admin úprav.
 * Položka bez záznamu v mapě si nechá štítky z pokladny (Storyous labels).
 */
export function applyMenuItemBadges(
  sections: DotykackaMenuSection[],
  badgesByItemId: Record<string, MenuItemBadgeKey[]> | undefined,
): DotykackaMenuSection[] {
  if (!badgesByItemId || Object.keys(badgesByItemId).length === 0) return sections;
  return sections.map((sec) => {
    let changed = false;
    const items = sec.items.map((item) => {
      if (!Object.prototype.hasOwnProperty.call(badgesByItemId, item.id)) return item;
      const nextBadges = badgesByItemId[item.id];
      const badges = nextBadges && nextBadges.length > 0 ? nextBadges : undefined;
      if (sameMenuItemBadgeList(item.badges, badges)) return item;
      changed = true;
      return badges ? { ...item, badges } : { ...item, badges: undefined };
    });
    return changed ? { ...sec, items } : sec;
  });
}
