/**
 * Skrýt z kioskového menu produkty z interních kategorií Dotykačky (ne samostatné jídlo na tabletu):
 * ingredience, sklad, přílohy jako pool pro customizace u hlavních jídel, atd.
 */

import { pickDotykackaLocalizedName } from "./dotykackaLocalizedName";
import { foldDotykackaText, recordHasInternalHideTag } from "./menuProductFilter";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Interní / skladové / pool kategorie — shoda v názvu, ne jen přesný celý název
 * (chytí i „Přílohy burger“, „Sklad suroviny“).
 */
const INTERNAL_CATEGORY_NAME_RES: readonly RegExp[] = [
  /\bingredien/,
  /\bsurovin/,
  /\bpriloh/,
  /\bsides?\b/,
  /\bside\s+dishes?\b/,
  /\bgarnitur/,
  /\bsklad/,
  /\bwarehouse\b/,
  /\binternal\b/,
  /\bintern\b/,
  /\bintern[ei](ch|mi|ho|m|mu)?\b/,
  /\bpomocn/,
  /\bobal(y|u|em|ech|um)?\b/,
  /\bspotrebn/,
  /\bdroger/,
  /\buklid/,
  /\bchemi/,
  /\breceptur/,
  /\bstock\b/,
];

export function isInternalDotykackaCategoryName(name: string): boolean {
  const folded = foldDotykackaText(name);
  if (!folded) return false;
  return INTERNAL_CATEGORY_NAME_RES.some((re) => re.test(folded));
}

function parseEnvCategoryIds(raw: string | undefined): Set<number> {
  const set = new Set<number>();
  if (!raw?.trim()) return set;
  for (const part of raw.split(/[,;\s]+/)) {
    const p = part.trim();
    if (!p) continue;
    const n = Number(p);
    if (Number.isFinite(n)) set.add(n);
  }
  return set;
}

function nameRegexFromEnv(): RegExp | null {
  const raw = process.env.DOTYKACKA_MENU_HIDE_CATEGORY_NAME_REGEX?.trim();
  if (!raw) return null;
  try {
    return new RegExp(raw, "i");
  } catch {
    return null;
  }
}

/**
 * ID kategorií, jejichž produkty se nezobrazí v menu (stále jdou do customizací / POS).
 */
export function resolveHiddenMenuCategoryIds(categoryRows: Record<string, unknown>[]): Set<number> {
  const hidden = new Set<number>();
  const envIds = parseEnvCategoryIds(process.env.DOTYKACKA_MENU_HIDE_CATEGORY_IDS);
  for (const id of envIds) hidden.add(id);

  const customRe = nameRegexFromEnv();

  for (const row of categoryRows) {
    if (!row || typeof row !== "object") continue;
    if (row.deleted === true) continue;
    const id = num(row.id);
    if (id == null) continue;
    if (recordHasInternalHideTag(row)) {
      hidden.add(id);
      continue;
    }
    const name = pickDotykackaLocalizedName(row as Record<string, unknown>) ?? "";
    if (name && isInternalDotykackaCategoryName(name)) {
      hidden.add(id);
      continue;
    }
    if (name && customRe?.test(name)) hidden.add(id);
  }

  return hidden;
}

/**
 * Kategorie, jejichž produkty se v menu nezobrazí: ingredience / sklad / přílohy (pool) / env. skryté,
 * smazané kategorie a kategorie se zákazem zobrazení v Dotyce (`display === false`).
 */
export function resolveProductExcludedCategoryIds(categoryRows: Record<string, unknown>[]): Set<number> {
  const excluded = resolveHiddenMenuCategoryIds(categoryRows);
  for (const row of categoryRows) {
    if (!row || typeof row !== "object") continue;
    const id = num(row.id);
    if (id == null) continue;
    if (row.deleted === true) {
      excluded.add(id);
      continue;
    }
    if (row.display === false) excluded.add(id);
  }
  return excluded;
}

export function productCategoryId(raw: Record<string, unknown>): number | null {
  return num(raw._categoryId);
}
