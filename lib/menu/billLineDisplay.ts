import type { OrderLineSnapshotInput } from "./orderLineLabel";
import { buildOrderLineName } from "./orderLineLabel";
import { localizeMenuItem } from "./menuEnPatches";
import type { Locale } from "../i18n/messages";

export type BillLineDisplay = {
  title: string;
  detail?: string;
};

function normalizeKnownLocale(raw: string): Locale {
  const lc = raw.trim().toLowerCase();
  if (lc === "en" || lc === "ko" || lc === "cs") return lc;
  return "cs";
}

/** Odřízne název jídla z plného popisu — zbude customizace v závorkách. */
export function detailAfterTitle(title: string, full: string): string | undefined {
  const t = title.trim();
  const f = full.trim();
  if (!t || !f || f === t) return undefined;
  let rest = f.startsWith(t) ? f.slice(t.length).trim() : f;
  if (!rest) return undefined;
  rest = rest.replace(/^\(|\)$/g, "").replace(/\)\s*\(/g, " · ").trim();
  return rest || undefined;
}

export function billLineTitleAndDetail(
  line: { name: string; detail?: string; snapshot?: OrderLineSnapshotInput },
  textLocale: string,
): BillLineDisplay {
  if (line.snapshot) {
    const locale = normalizeKnownLocale(textLocale);
    const title = localizeMenuItem(line.snapshot.item, locale).name.trim() || line.name;
    const full = buildOrderLineName(line.snapshot, textLocale);
    const detail = detailAfterTitle(title, full);
    return detail ? { title, detail } : { title };
  }
  const detail = line.detail?.trim();
  return detail ? { title: line.name, detail } : { title: line.name };
}
