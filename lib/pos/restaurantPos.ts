export const RESTAURANT_POS = ["dotykacka", "storyous"] as const;

export type RestaurantPos = (typeof RESTAURANT_POS)[number];

export function parseRestaurantPos(value: unknown): RestaurantPos | null {
  if (value === "dotykacka" || value === "storyous") return value;
  return null;
}

export function restaurantPosTab(pos: RestaurantPos): "dotykacka" | "storyous" {
  return pos === "storyous" ? "storyous" : "dotykacka";
}
