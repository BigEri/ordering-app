import type { MenuItemData } from "../../components/MenuItem";
import type { DotykackaMenuSection } from "../dotykacka/dotykackaMenuSections";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Stabilní číslo sekce z Storyous categoryId (string) — stejné na serveru i v editoru. */
export function storyousCategoryNumber(categoryId: string): number {
  const id = categoryId.trim();
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  const n = Math.abs(h);
  return n === 0 ? 1 : n;
}

function isProduct(node: Record<string, unknown>): boolean {
  return str(node.productId).length > 0;
}

function isCategory(node: Record<string, unknown>): boolean {
  return str(node.categoryId).length > 0 && !isProduct(node);
}

function childNodes(node: Record<string, unknown>): Record<string, unknown>[] {
  const buckets = [node.items, node.products, node.categories];
  const out: Record<string, unknown>[] = [];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const row of bucket) {
      const rec = asRecord(row);
      if (rec) out.push(rec);
    }
  }
  return out;
}

function priceRecord(raw: unknown): Record<string, unknown> | null {
  if (Array.isArray(raw)) return asRecord(raw[0]);
  const rec = asRecord(raw);
  if (!rec) return null;
  if (asRecord(rec.priceLevels)) return rec;
  for (const v of Object.values(rec)) {
    const inner = asRecord(v);
    if (inner && asRecord(inner.priceLevels)) return inner;
  }
  return rec;
}

function priceFromPlaceValues(node: Record<string, unknown>): { priceCzk: number; showInPos: boolean } | null {
  const rec = priceRecord(node.placeValues ?? node.placesValues);
  if (!rec) return null;
  const levels = asRecord(rec.priceLevels);
  const def = asRecord(levels?.default) ?? asRecord(levels?.defatult);
  const price = num(def?.price);
  if (price == null) return null;
  return { priceCzk: price, showInPos: rec.showInPos !== false };
}

function allergenCodes(node: Record<string, unknown>): number[] | undefined {
  const raw = node.allergens;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: number[] = [];
  for (const a of raw) {
    const n = num(a);
    if (n != null && n >= 1 && n <= 14) out.push(n);
  }
  return out.length ? out : undefined;
}

function shouldSkipProduct(node: Record<string, unknown>, priceCzk: number): boolean {
  if (node.isPriceVariable === true && priceCzk === 0) return true;
  const name = str(node.name);
  if (/^variabilní položka/i.test(name)) return true;
  return false;
}

/** Storyous thumbs jsou HTTPS; bere i protokol-relativní / http / vnořené { url }. */
export function storyousProductImageUrl(node: Record<string, unknown>): string | undefined {
  const candidates: unknown[] = [
    node.imageUrl,
    node.imageURL,
    node.image,
    node.photoUrl,
    node.photo,
    node.thumbnailUrl,
  ];
  const nested = asRecord(node.image) ?? asRecord(node.imageUrl);
  if (nested) {
    candidates.push(nested.url, nested.src, nested.imageUrl, nested.thumb, nested.thumbnail);
  }
  if (Array.isArray(node.images)) {
    for (const row of node.images) {
      candidates.push(row);
      const rec = asRecord(row);
      if (rec) candidates.push(rec.url, rec.src, rec.imageUrl);
    }
  }
  for (const raw of candidates) {
    const url = normalizePublicImageUrl(raw);
    if (url) return url;
  }
  return undefined;
}

function normalizePublicImageUrl(raw: unknown): string | undefined {
  let s = str(raw);
  if (!s || s === "null" || s === "undefined") return undefined;
  if (s.startsWith("//")) s = `https:${s}`;
  if (/^http:\/\//i.test(s)) s = `https://${s.slice(s.indexOf("://") + 3)}`;
  if (!/^https:\/\//i.test(s)) return undefined;
  return s;
}

function walkProducts(node: Record<string, unknown>, visit: (rec: Record<string, unknown>) => void): void {
  if (isProduct(node)) visit(node);
  for (const child of childNodes(node)) walkProducts(child, visit);
}

/** 0 Kč variabilní položka z pokladny — signály (personál / účet), ne hostitelské menu. */
export function findStoryousSignalProductId(json: unknown): string | null {
  const root = asRecord(json);
  if (!root) return null;
  let found: string | null = null;
  walkProducts(root, (rec) => {
    if (found) return;
    const priced = priceFromPlaceValues(rec);
    if (!priced) return;
    if (shouldSkipProduct(rec, priced.priceCzk)) {
      const id = str(rec.productId);
      if (id) found = id;
    }
  });
  return found;
}

export function mapStoryousProductToMenuItem(node: unknown): MenuItemData | null {
  const rec = asRecord(node);
  if (!rec || !isProduct(rec)) return null;
  const priced = priceFromPlaceValues(rec);
  if (!priced || !priced.showInPos) return null;
  if (shouldSkipProduct(rec, priced.priceCzk)) return null;
  const name = str(rec.marketingName) || str(rec.name);
  if (!name) return null;
  const description = str(rec.description) || undefined;
  const imageUrl = storyousProductImageUrl(rec);
  const allergens = allergenCodes(rec);
  return {
    id: str(rec.productId),
    name,
    priceCzk: priced.priceCzk,
    ...(description ? { description } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(allergens ? { allergenCodes: allergens } : {}),
  };
}

type CollectedSection = { categoryId: string; name: string; items: MenuItemData[] };

function collectSections(node: Record<string, unknown>, into: CollectedSection[]): void {
  const kids = childNodes(node);
  const products: MenuItemData[] = [];
  const nested: Record<string, unknown>[] = [];
  for (const child of kids) {
    if (isProduct(child)) {
      const item = mapStoryousProductToMenuItem(child);
      if (item) products.push(item);
    } else if (isCategory(child)) {
      nested.push(child);
    }
  }
  if (products.length > 0) {
    into.push({
      categoryId: str(node.categoryId) || `other-${into.length}`,
      name: str(node.name) || "Nabídka",
      items: products,
    });
  }
  for (const cat of nested) collectSections(cat, into);
}

function topLevelNodes(root: Record<string, unknown>): Record<string, unknown>[] {
  const fromChildren = childNodes(root);
  if (fromChildren.length > 0) return fromChildren;
  const data = Array.isArray(root.data)
    ? root.data.map(asRecord).filter((x): x is Record<string, unknown> => Boolean(x))
    : [];
  if (data.length > 0) return data;
  if (isCategory(root) || isProduct(root)) return [root];
  return [];
}

export function mapStoryousMenuTree(json: unknown): DotykackaMenuSection[] {
  const root = asRecord(json);
  if (!root) return [];
  const top = topLevelNodes(root);
  const collected: CollectedSection[] = [];
  const loose: MenuItemData[] = [];
  for (const node of top) {
    if (isProduct(node)) {
      const item = mapStoryousProductToMenuItem(node);
      if (item) loose.push(item);
      continue;
    }
    if (isCategory(node)) collectSections(node, collected);
  }
  const sections: DotykackaMenuSection[] = collected.map((s, i) => ({
    categoryId: storyousCategoryNumber(s.categoryId),
    name: s.name,
    sortOrder: i,
    items: s.items,
  }));
  if (loose.length > 0) {
    sections.push({
      categoryId: null,
      name: "",
      labelKey: "other",
      sortOrder: sections.length,
      items: loose,
    });
  }
  return sections.filter((s) => s.items.length > 0);
}
