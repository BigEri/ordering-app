export type SeedLocale = "en" | "ko";

type SeedEntry = Partial<Record<SeedLocale, string>>;

function normKey(cs: string): string {
  return cs.trim().toLowerCase();
}

/**
 * Základní slovník pro předvyplnění překladů.
 * Klíč je český (nebo interní) název, hodnoty jsou překlady.
 */
export const INGREDIENT_SEED: Record<string, SeedEntry> = Object.freeze({
  [normKey("Rajče")]: { en: "Tomato", ko: "토마토" },
  [normKey("Cibule")]: { en: "Onion", ko: "양파" },
  [normKey("Česnek")]: { en: "Garlic", ko: "마늘" },
  [normKey("Okurka")]: { en: "Cucumber", ko: "오이" },
  [normKey("Salát")]: { en: "Lettuce", ko: "상추" },
  [normKey("Sýr")]: { en: "Cheese", ko: "치즈" },
  [normKey("Cheddar")]: { en: "Cheddar", ko: "체더" },
  [normKey("Slanina")]: { en: "Bacon", ko: "베이컨" },
  [normKey("Šunka")]: { en: "Ham", ko: "햄" },
  [normKey("Hořčice")]: { en: "Mustard", ko: "머스터드" },
  [normKey("Kečup")]: { en: "Ketchup", ko: "케첩" },
  [normKey("Majonéza")]: { en: "Mayonnaise", ko: "마요네즈" },
});

export const SIDE_SEED: Record<string, SeedEntry> = Object.freeze({
  // Skupiny / obecné
  [normKey("Přílohy")]: { en: "Sides", ko: "사이드" },
  [normKey("Přílohy a úpravy")]: { en: "Sides & options", ko: "사이드 및 옵션" },

  [normKey("Brambory")]: { en: "Potatoes", ko: "감자" },
  [normKey("Hranolky")]: { en: "French fries", ko: "감자튀김" },
  [normKey("Šťouchané brambory")]: { en: "Mashed potatoes", ko: "매시드 포테이토" },
  [normKey("Bramborová kaše")]: { en: "Mashed potatoes", ko: "매시드 포테이토" },
  [normKey("Americké brambory")]: { en: "Wedges", ko: "웨지 감자" },
  [normKey("Batáty")]: { en: "Sweet potato fries", ko: "고구마튀김" },
  [normKey("Rýže")]: { en: "Rice", ko: "밥" },
});

export function seedTranslate(csOrKey: string, locale: SeedLocale): string | null {
  const k = normKey(csOrKey);
  const hit = INGREDIENT_SEED[k] ?? SIDE_SEED[k];
  const out = hit?.[locale];
  return out && out.trim() ? out.trim() : null;
}

