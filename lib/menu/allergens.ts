import type { Locale } from "../i18n/messages";

/** Čísla 1–14 dle nařízení EU o poskytování informací o potravinách (přehledové názvy). */
export const EU_ALLERGEN_LABELS_CS: Record<number, string> = {
  1: "Lepek",
  2: "Korýši",
  3: "Vejce",
  4: "Ryby",
  5: "Arašídy",
  6: "Sója",
  7: "Mléko",
  8: "Skořápkové plody",
  9: "Celer",
  10: "Hořčice",
  11: "Sezam",
  12: "Oxid siřičitý a siřičitany",
  13: "Vlčí bob",
  14: "Měkkýši",
};

export const EU_ALLERGEN_LABELS_EN: Record<number, string> = {
  1: "Cereals containing gluten",
  2: "Crustaceans",
  3: "Eggs",
  4: "Fish",
  5: "Peanuts",
  6: "Soybeans",
  7: "Milk",
  8: "Nuts",
  9: "Celery",
  10: "Mustard",
  11: "Sesame",
  12: "Sulphur dioxide and sulphites",
  13: "Lupin",
  14: "Molluscs",
};

/** EU 1–14 — 한국어 표기(요약명). */
export const EU_ALLERGEN_LABELS_KO: Record<number, string> = {
  1: "글루텐 함유 곡물",
  2: "갑각류",
  3: "달걀",
  4: "어류",
  5: "땅콩",
  6: "대두(콩)",
  7: "우유",
  8: "견과류",
  9: "셀러리",
  10: "겨자",
  11: "참깨(깨)",
  12: "이산화황 및 아황산염",
  13: "루핀",
  14: "연체동물",
};

export function allergenLabelCs(code: number): string {
  return EU_ALLERGEN_LABELS_CS[code] ?? `Neznámý kód (${code})`;
}

export function allergenLabel(code: number, locale: Locale): string {
  if (locale === "en") {
    return EU_ALLERGEN_LABELS_EN[code] ?? `Unknown code (${code})`;
  }
  if (locale === "ko") {
    return EU_ALLERGEN_LABELS_KO[code] ?? `알 수 없는 번호 (${code})`;
  }
  return allergenLabelCs(code);
}
