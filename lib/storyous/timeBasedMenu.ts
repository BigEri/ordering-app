import type { DotykackaMenuSection } from "../dotykacka/dotykackaMenuSections";
import { isHhmmInHalfOpenWindow, normalizeHhmm } from "../menu/categoryHours";
import { formatRestaurantLocalHhmm } from "../restaurantLocalTime";
import { mapStoryousMenuTree } from "./mapMenu";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function rowsFromTimeBased(json: unknown): Record<string, unknown>[] {
  const rec = asRecord(json);
  const data = rec?.data ?? rec?.items ?? rec?.menus;
  if (Array.isArray(json)) {
    return json.map(asRecord).filter((x): x is Record<string, unknown> => Boolean(x));
  }
  if (Array.isArray(data)) {
    return data.map(asRecord).filter((x): x is Record<string, unknown> => Boolean(x));
  }
  if (rec && (rec.items || rec.categories || rec.products)) return [rec];
  return [];
}

function isoWindowActive(since: string, till: string, nowMs: number): boolean | null {
  const s = Date.parse(since);
  const t = Date.parse(till);
  if (!Number.isFinite(s) && !Number.isFinite(t)) return null;
  if (Number.isFinite(s) && nowMs < s) return false;
  if (Number.isFinite(t) && nowMs >= t) return false;
  return true;
}

export function isStoryousTimeWindowActive(
  since: string,
  till: string,
  now: Date = new Date(),
): boolean {
  const iso = isoWindowActive(since, till, now.getTime());
  if (iso != null) return iso;
  const from = normalizeHhmm(since);
  const until = normalizeHhmm(till);
  if (!from || !until) return true;
  return isHhmmInHalfOpenWindow(formatRestaurantLocalHhmm(now), from, until);
}

function timeBasedSectionTitle(row: Record<string, unknown>): string {
  const type = str(row.timeBasedMenuType);
  if (type === "dailyMenu") return "Denní menu";
  if (type === "happyHours") return "Happy hours";
  if (type === "fixedMenu") return "Menu";
  return str(row.name) || str(row.title) || type || "Nabídka";
}

function treeFromTimeBasedRow(row: Record<string, unknown>, additionCategories: unknown): Record<string, unknown> {
  const title = timeBasedSectionTitle(row);
  const items = row.items;
  const catalog = additionCategories != null ? { additionCategories } : {};
  if (Array.isArray(items)) {
    return {
      ...catalog,
      items: [
        {
          categoryId: `tb:${str(row.menuId) || str(row.timeBasedMenuType) || title}`,
          name: title,
          items,
        },
      ],
    };
  }
  const nested = asRecord(items) ?? asRecord(row.menu) ?? row;
  return { ...nested, ...catalog };
}

export function mapStoryousTimeBasedSections(
  json: unknown,
  mainMenuJson: unknown,
  now: Date = new Date(),
): DotykackaMenuSection[] {
  const rows = rowsFromTimeBased(json);
  const additionCategories = asRecord(mainMenuJson)?.additionCategories ?? asRecord(json)?.additionCategories;
  const out: DotykackaMenuSection[] = [];
  for (const row of rows) {
    const since = str(row.since) || str(row.from) || str(row.start);
    const till = str(row.till) || str(row.until) || str(row.end);
    if ((since || till) && !isStoryousTimeWindowActive(since, till, now)) continue;
    const mapped = mapStoryousMenuTree(treeFromTimeBasedRow(row, additionCategories));
    for (const sec of mapped) {
      out.push({
        ...sec,
        name: sec.name || timeBasedSectionTitle(row),
        sortOrder: -1000 + out.length,
      });
    }
  }
  return out.filter((s) => s.items.length > 0);
}

export function applyStoryousRemainingAmounts(
  sections: DotykackaMenuSection[],
  amountsJson: unknown,
): DotykackaMenuSection[] {
  const rec = asRecord(amountsJson);
  const raw = rec?.amounts ?? rec?.data ?? rec;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return sections;
  const amounts = raw as Record<string, unknown>;
  return sections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((item) => {
        const left = amounts[item.id];
        if (left == null) return true;
        const n = typeof left === "number" ? left : Number(left);
        if (!Number.isFinite(n)) return true;
        return n > 0;
      }),
    }))
    .filter((s) => s.items.length > 0);
}
