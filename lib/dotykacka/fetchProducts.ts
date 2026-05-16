import type { DotykackaCustomizationGroup, MenuItemData } from "../../components/MenuItem";
import { getDotykackaAccessTokenForCloud } from "./accessToken";
import { getDotykackaMenuFetchConfig } from "./config";
import { omitEmptyStringFields, pickDotykackaLocalizedName } from "./dotykackaLocalizedName";
import {
  buildDotykackaMenuSections,
  buildFlatMenuSection,
  type DotykackaMenuSection,
} from "./dotykackaMenuSections";
import { productCategoryId, resolveProductExcludedCategoryIds } from "./menuCategoryFilter";

export type { DotykackaMenuSection } from "./dotykackaMenuSections";

type PaginatedEnvelope<T> = {
  data?: T[];
  currentPage?: string | number;
  lastPage?: string | number;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function priceCzkFromProduct(raw: Record<string, unknown>): number {
  const pVat = num(raw.priceWithVat);
  const pNo = num(raw.priceWithoutVat);
  return Math.round(pVat ?? (pNo != null ? pNo * 1.21 : 0));
}

/** Produkt má v Dotyce zapnuté zobrazení (pole `display`). */
function isDotykackaProductDisplayed(raw: Record<string, unknown>): boolean {
  const d = raw.display;
  if (d === false) return false;
  if (d === 0) return false;
  if (typeof d === "string" && d.trim().toLowerCase() === "false") return false;
  return true;
}

function mergeCustomizationEmbedded(
  embedded: Record<string, unknown>,
  full: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const e = omitEmptyStringFields(embedded);
  if (!full) return e;
  return { ...e, ...omitEmptyStringFields(full) };
}

async function fetchPagedProducts(
  cfg: { apiBase: string; cloudId: number },
  accessToken: string,
  querySuffix: string,
): Promise<{ ok: true; rows: Record<string, unknown>[] } | { ok: false; error: string }> {
  const collected: Record<string, unknown>[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const url = `${cfg.apiBase}/v2/clouds/${cfg.cloudId}/products?page=${page}&limit=100${querySuffix}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        error: `Dotykačka products ${res.status}: ${text.slice(0, 400)}`,
      };
    }
    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      return { ok: false, error: "Dotykačka products: neplatné JSON tělo odpovědi." };
    }
    const env = json as PaginatedEnvelope<Record<string, unknown>>;
    const rows = Array.isArray(env.data) ? env.data : [];
    for (const row of rows) {
      if (row && typeof row === "object") collected.push(row as Record<string, unknown>);
    }
    const last = num(env.lastPage) ?? page;
    lastPage = last;
    page += 1;
  } while (page <= lastPage);

  return { ok: true, rows: collected };
}

async function fetchPagedCategories(
  cfg: { apiBase: string; cloudId: number },
  accessToken: string,
): Promise<{ ok: true; rows: Record<string, unknown>[] } | { ok: false; error: string }> {
  const collected: Record<string, unknown>[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const url = `${cfg.apiBase}/v2/clouds/${cfg.cloudId}/categories?page=${page}&limit=100`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        error: `Dotykačka categories ${res.status}: ${text.slice(0, 400)}`,
      };
    }
    let json: unknown;
    try {
      json = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      return { ok: false, error: "Dotykačka categories: neplatné JSON tělo odpovědi." };
    }

    if (Array.isArray(json)) {
      for (const row of json) {
        if (row && typeof row === "object") collected.push(row as Record<string, unknown>);
      }
      break;
    }

    const env = json as PaginatedEnvelope<Record<string, unknown>>;
    const rows = Array.isArray(env.data) ? env.data : [];
    for (const row of rows) {
      if (row && typeof row === "object") collected.push(row as Record<string, unknown>);
    }
    const last = num(env.lastPage) ?? page;
    lastPage = last;
    page += 1;
  } while (page <= lastPage);

  return { ok: true, rows: collected };
}

/** Plné záznamy customizací (název / překlady jako ve správě položek — u produktu bývá v include oříznuté). */
async function fetchPagedProductCustomizations(
  cfg: { apiBase: string; cloudId: number },
  accessToken: string,
): Promise<{ ok: true; rows: Record<string, unknown>[] } | { ok: false; error: string }> {
  const collected: Record<string, unknown>[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const filter = encodeURIComponent("deleted|eq|false");
    const url = `${cfg.apiBase}/v2/clouds/${cfg.cloudId}/product-customizations?page=${page}&limit=100&filter=${filter}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        error: `Dotykačka product-customizations ${res.status}: ${text.slice(0, 400)}`,
      };
    }
    let json: unknown;
    try {
      json = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      return { ok: false, error: "Dotykačka product-customizations: neplatné JSON tělo odpovědi." };
    }

    if (Array.isArray(json)) {
      for (const row of json) {
        if (row && typeof row === "object") collected.push(row as Record<string, unknown>);
      }
      break;
    }

    const env = json as PaginatedEnvelope<Record<string, unknown>>;
    const rows = Array.isArray(env.data) ? env.data : [];
    for (const row of rows) {
      if (row && typeof row === "object") collected.push(row as Record<string, unknown>);
    }
    const last = num(env.lastPage) ?? page;
    lastPage = last;
    page += 1;
  } while (page <= lastPage);

  return { ok: true, rows: collected };
}

/** API často vrátí maxSelected ≈ INT_MAX jako „bez horního limitu“ — omezíme na počet možností. */
function normalizeCustomizationPickBounds(
  minS: number,
  maxS: number,
  optionCount: number,
): { minPick: number; maxPick: number } {
  const n = optionCount;
  if (n <= 0) return { minPick: minS, maxPick: maxS };
  let minPick = Math.min(n, Math.max(0, minS));
  let maxPick = Math.max(minPick, maxS);
  if (maxPick > 10_000 || maxPick > n + 1000) {
    maxPick = Math.max(minPick, n);
  }
  maxPick = Math.min(maxPick, n);
  return { minPick, maxPick };
}

function buildCategoryById(rows: Record<string, unknown>[]): Map<number, Record<string, unknown>> {
  const m = new Map<number, Record<string, unknown>>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const id = num(row.id);
    if (id == null) continue;
    m.set(id, row as Record<string, unknown>);
  }
  return m;
}

function mapCustomizationGroups(
  raw: Record<string, unknown>,
  optionsByCategoryId: Map<number, Record<string, unknown>[]>,
  customizationById: Map<number, Record<string, unknown>>,
  categoryById: Map<number, Record<string, unknown>>,
): DotykackaCustomizationGroup[] {
  const custRaw = raw.customizations;
  if (!Array.isArray(custRaw) || custRaw.length === 0) return [];

  const groups: DotykackaCustomizationGroup[] = [];

  for (const c of custRaw) {
    if (!c || typeof c !== "object") continue;
    const row = c as Record<string, unknown>;

    const custId = num(row.id);
    const categoryId = num(row._categoryId);
    if (custId == null || categoryId == null) continue;

    const full = customizationById.get(custId);
    const merged = mergeCustomizationEmbedded(row, full);
    if (merged.deleted === true) continue;

    const optionRows = optionsByCategoryId.get(categoryId) ?? [];
    const options = optionRows
      .filter((p) => p.deleted !== true && isDotykackaProductDisplayed(p as Record<string, unknown>))
      .map((p) => {
        const pid = num(p.id);
        if (pid == null) return null;
        const rawOpt = pickDotykackaLocalizedName(p as Record<string, unknown>) ?? "";
        const name = rawOpt.trim() || "Položka";
        return {
          id: `dkp-${pid}`,
          productId: pid,
          label: name,
          priceCzk: priceCzkFromProduct(p),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    if (options.length === 0) continue;

    /** Název skupiny customizace; pokud chybí, ve Dotyce se často bere kategorie příplatkových produktů (`_categoryId`). */
    const fromCustomization =
      pickDotykackaLocalizedName(merged) ||
      (full ? pickDotykackaLocalizedName(full) : null) ||
      pickDotykackaLocalizedName(row);
    const catRow = categoryById.get(categoryId);
    const fromCategory = catRow ? pickDotykackaLocalizedName(catRow) : null;
    const sectionLabel = fromCustomization || fromCategory || "";

    const rawMin = Math.max(0, num(merged.minSelected) ?? 0);
    const rawMax = Math.max(rawMin, num(merged.maxSelected) ?? 1);

    const defaultsRaw = merged._defaultProductIds;
    const defaultNums: number[] = Array.isArray(defaultsRaw)
      ? defaultsRaw
          .map((x) => num(x))
          .filter((x): x is number => x != null)
      : [];

    const defaultOptionIds = defaultNums
      .map((pid) => `dkp-${pid}`)
      .filter((oid) => options.some((o) => o.id === oid));

    let visibleOptions = options;
    const skipSubsetFilter =
      process.env.DOTYKACKA_MENU_CUSTOMIZATION_NO_DEFAULT_SUBSET_FILTER === "1";
    if (
      !skipSubsetFilter &&
      rawMin === 0 &&
      defaultOptionIds.length > 0 &&
      defaultOptionIds.length < options.length
    ) {
      const allowed = new Set(defaultOptionIds);
      visibleOptions = options.filter((o) => allowed.has(o.id));
    }
    if (visibleOptions.length === 0) {
      visibleOptions = options;
    }

    const { minPick: minS, maxPick: maxS } = normalizeCustomizationPickBounds(
      rawMin,
      rawMax,
      visibleOptions.length,
    );

    const defaultOptionIdsInView = defaultOptionIds.filter((oid) =>
      visibleOptions.some((o) => o.id === oid),
    );

    groups.push({
      id: `dk-${custId}`,
      customizationId: custId,
      sectionLabel,
      minPick: minS,
      maxPick: maxS,
      options: visibleOptions,
      defaultOptionIds: defaultOptionIdsInView,
    });
  }

  return groups;
}

function mapApiProductToMenuItem(
  raw: Record<string, unknown>,
  optionsByCategoryId: Map<number, Record<string, unknown>[]>,
  customizationById: Map<number, Record<string, unknown>>,
  categoryById: Map<number, Record<string, unknown>>,
): MenuItemData | null {
  const idRaw = raw.id;
  const idStr =
    typeof idRaw === "number" || typeof idRaw === "string" ? String(idRaw).trim() : "";
  if (!idStr) return null;
  if (raw.deleted === true) return null;
  if (!isDotykackaProductDisplayed(raw)) return null;

  const name = pickDotykackaLocalizedName(raw) ?? "Produkt";

  const priceCzk = priceCzkFromProduct(raw);

  const desc = typeof raw.description === "string" ? raw.description : undefined;

  const allergensRaw = (raw as Record<string, unknown>).allergens;
  // Dotypos může vracet alergeny v různých tvarech (čísla, řetězce, objekty).
  const allergenCodes = (() => {
    if (!Array.isArray(allergensRaw)) return undefined;
    const out: number[] = [];
    for (const x of allergensRaw) {
      if (typeof x === "number" && Number.isFinite(x)) {
        out.push(x);
        continue;
      }
      if (typeof x === "string" && x.trim()) {
        const n = Number.parseInt(x.trim(), 10);
        if (Number.isFinite(n)) out.push(n);
        continue;
      }
      if (x && typeof x === "object") {
        const o = x as Record<string, unknown>;
        const v = o.code ?? o.id ?? o.number ?? o.value;
        if (typeof v === "number" && Number.isFinite(v)) out.push(v);
        else if (typeof v === "string" && v.trim()) {
          const n = Number.parseInt(v.trim(), 10);
          if (Number.isFinite(n)) out.push(n);
        }
      }
    }
    const uniq = Array.from(new Set(out.filter((n) => n >= 1 && n <= 14)));
    uniq.sort((a, b) => a - b);
    return uniq.length > 0 ? uniq : undefined;
  })();

  const dotykackaCustomizationGroups = mapCustomizationGroups(
    raw,
    optionsByCategoryId,
    customizationById,
    categoryById,
  );

  return {
    id: idStr,
    name,
    description: desc,
    priceCzk,
    allergenCodes,
    ...(dotykackaCustomizationGroups.length > 0 ? { dotykackaCustomizationGroups } : {}),
  };
}

/**
 * Stáhne produkty z Dotyky seřazené do sekcí podle kategorií (název a pořadí jako v administraci).
 * `item.id` = product id z Dotyky (řetězec) — pro POS sync stačí i bez DOTYKACKA_PRODUCT_MAP_JSON.
 */
export async function fetchDotykackaProductsForMenu(
  restaurantId?: string | null,
): Promise<{ ok: true; sections: DotykackaMenuSection[] } | { ok: false; error: string }> {
  const cfg = await getDotykackaMenuFetchConfig(restaurantId);
  if (!cfg) {
    const rid = restaurantId?.trim();
    return {
      ok: false,
      error: rid
        ? "Pro tuto provozovnu není v aplikaci připojená vlastní Dotykačka — v administraci otevřete detail restaurace, záložka Dotykačka, a dokončete OAuth (cloud z jiné restaurace se už nepoužívá)."
        : "Nastavte DOTYKACKA_REFRESH_TOKEN a DOTYKACKA_CLOUD_ID v .env, nebo u více provozoven připojte Dotyku pro každou restauraci zvlášť.",
    };
  }

  try {
    const accessToken = await getDotykackaAccessTokenForCloud(cfg);

    const main = await fetchPagedProducts(
      cfg,
      accessToken,
      "&include=customizations&filter=" + encodeURIComponent("display|eq|true"),
    );
    if (!main.ok) return main;

    const customizationById = new Map<number, Record<string, unknown>>();
    const custFull = await fetchPagedProductCustomizations(cfg, accessToken);
    if (custFull.ok) {
      for (const cr of custFull.rows) {
        const cid = num(cr.id);
        if (cid != null) customizationById.set(cid, cr);
      }
    }

    const cats = await fetchPagedCategories(cfg, accessToken);
    const excludedCategoryIds = cats.ok ? resolveProductExcludedCategoryIds(cats.rows) : new Set<number>();
    const categoryById = cats.ok ? buildCategoryById(cats.rows) : new Map<number, Record<string, unknown>>();

    const categoryIds = new Set<number>();
    for (const row of main.rows) {
      const custRaw = row.customizations;
      if (!Array.isArray(custRaw)) continue;
      for (const c of custRaw) {
        if (!c || typeof c !== "object") continue;
        const cat = num((c as Record<string, unknown>)._categoryId);
        if (cat != null) categoryIds.add(cat);
      }
    }

    const optionsByCategoryId = new Map<number, Record<string, unknown>[]>();
    for (const catId of categoryIds) {
      const filter = encodeURIComponent(`deleted|eq|false;_categoryId|eq|${catId};display|eq|true`);
      const catFetch = await fetchPagedProducts(cfg, accessToken, `&filter=${filter}`);
      if (!catFetch.ok) {
        optionsByCategoryId.set(catId, []);
        continue;
      }
      optionsByCategoryId.set(catId, catFetch.rows);
    }

    const itemsByCategoryId = new Map<number | null, MenuItemData[]>();
    for (const row of main.rows) {
      const pCat = productCategoryId(row);
      if (pCat != null && excludedCategoryIds.has(pCat)) continue;

      const item = mapApiProductToMenuItem(row, optionsByCategoryId, customizationById, categoryById);
      if (!item) continue;

      const bucketKey: number | null = pCat ?? null;
      const list = itemsByCategoryId.get(bucketKey) ?? [];
      list.push(item);
      itemsByCategoryId.set(bucketKey, list);
    }

    const sections = cats.ok
      ? buildDotykackaMenuSections(itemsByCategoryId, cats.rows, excludedCategoryIds)
      : buildFlatMenuSection(
          [...itemsByCategoryId.values()].flat(),
        );

    return { ok: true, sections };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Nepodařilo se načíst produkty z Dotyky.",
    };
  }
}
