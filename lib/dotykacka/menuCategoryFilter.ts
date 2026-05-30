/**
 * Skrýt z kioskového menu produkty z interních kategorií Dotykačky (ne samostatné jídlo na tabletu):
 * ingredience, přílohy jako pool pro customizace u hlavních jídel, atd.
 */

import { pickDotykackaLocalizedName } from "./dotykackaLocalizedName";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Výchozí: přesný název kategorie (bez ohledu na velikost písmen). */
const DEFAULT_HIDE_NAME_RE =
  /^\s*(ingredience|ingredients|ingredient|suroviny|surovina|přílohy|příloha|prilohy|priloha|sides|side\s*dishes?|garniture|garnitura)\s*$/i;

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
    const name = pickDotykackaLocalizedName(row as Record<string, unknown>) ?? "";
    if (!name) continue;
    const match = customRe ? customRe.test(name) : DEFAULT_HIDE_NAME_RE.test(name);
    if (match) hidden.add(id);
  }

  return hidden;
}

/**
 * Kategorie, jejichž produkty se v menu nezobrazí: ingredience / přílohy (pool) / env. skryté,
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
