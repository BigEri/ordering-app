/** Společná struktura překladů položek menu (en, ko, …). */
export type IngredientPatch = { name?: string; portionNote?: string };
export type AddonPatch = { label?: string; portionNote?: string };
export type SideOptionPatch = { label?: string; portionNote?: string };

export type MenuItemLocalePatch = {
  name?: string;
  description?: string;
  portionNote?: string;
  addonsSectionLabel?: string;
  ingredients?: IngredientPatch[];
  addons?: Record<string, AddonPatch>;
  sideChoice?: {
    sectionLabel?: string;
    summaryLabel?: string;
    options?: Record<string, SideOptionPatch>;
  };
  multiPickGroups?: Array<{
    id: string;
    sectionLabel?: string;
    options?: Record<string, SideOptionPatch>;
  }>;
  savoryGlazeChoice?: {
    sectionLabel?: string;
    options?: Record<string, SideOptionPatch>;
  };
};
