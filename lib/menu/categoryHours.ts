/** Denní okno viditelnosti sekce. Časy HH:mm, zóna Evropa/Praha (volá se s už převedeným HH:mm). */
export type CategoryHours = {
  visibleFrom: string;
  visibleUntil: string;
};

const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

/** `12:00` / `9:05` / `12:00:00` → `12:00`, jinak null. */
export function normalizeHhmm(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const m = HHMM_RE.exec(raw.trim());
  if (!m) return null;
  return `${m[1]!.padStart(2, "0")}:${m[2]}`;
}

export function hhmmToMinutes(hhmm: string): number | null {
  const n = normalizeHhmm(hhmm);
  if (!n) return null;
  const [h, min] = n.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

/**
 * Half-open [from, until). Přes půlnoc: from > until → [from, 24:00) ∪ [00:00, until).
 * Stejný from i until = prázdné okno (nikdy).
 */
export function isHhmmInHalfOpenWindow(nowHhmm: string, fromHhmm: string, untilHhmm: string): boolean {
  const now = hhmmToMinutes(nowHhmm);
  const from = hhmmToMinutes(fromHhmm);
  const until = hhmmToMinutes(untilHhmm);
  if (now == null || from == null || until == null) return true;
  if (from === until) return false;
  if (from < until) return now >= from && now < until;
  return now >= from || now < until;
}

export function isCategoryVisibleAtHhmm(hours: CategoryHours | null | undefined, nowHhmm: string): boolean {
  if (!hours) return true;
  const from = normalizeHhmm(hours.visibleFrom);
  const until = normalizeHhmm(hours.visibleUntil);
  if (!from || !until) return true;
  return isHhmmInHalfOpenWindow(nowHhmm, from, until);
}

/** Právě běží aspoň jedno denní okno (polední menu apod.). */
export function anyTimedCategoryActive(
  hoursMap: Record<string, CategoryHours> | null | undefined,
  nowHhmm: string,
): boolean {
  if (!hoursMap) return false;
  return Object.values(hoursMap).some((h) => isCategoryVisibleAtHhmm(h, nowHhmm));
}

/**
 * Viditelnost sekce: okno jen v intervalu, Pořád vždy, prázdné Od–Do = základní
 * nabídka (schová se, když zrovna běží nějaké časové menu).
 */
export function isCategoryVisibleWithExclusiveSchedule(
  categoryKey: string,
  hoursMap: Record<string, CategoryHours> | null | undefined,
  alwaysKeys: ReadonlySet<string>,
  nowHhmm: string,
): boolean {
  const key = categoryKey.trim();
  if (!key) return true;
  if (alwaysKeys.has(key)) return true;
  const hours = hoursMap?.[key];
  if (hours) return isCategoryVisibleAtHhmm(hours, nowHhmm);
  return !anyTimedCategoryActive(hoursMap, nowHhmm);
}

/** null = základní nabídka; `{ always: true }` = Pořád; jinak denní okno. */
export type CategoryScheduleSave = CategoryHours | { always: true } | null;

export function isAlwaysScheduleSave(next: CategoryScheduleSave): next is { always: true } {
  return typeof next === "object" && next !== null && "always" in next && next.always === true;
}

export function formatCategoryHoursLabel(hours: CategoryHours): string {
  const from = normalizeHhmm(hours.visibleFrom) ?? hours.visibleFrom;
  const until = normalizeHhmm(hours.visibleUntil) ?? hours.visibleUntil;
  return `${from}–${until}`;
}

export function parseCategoryHoursMap(raw: unknown): Record<string, CategoryHours> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, CategoryHours> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const k = key.trim();
    if (!k || !val || typeof val !== "object") continue;
    const o = val as Record<string, unknown>;
    const from = normalizeHhmm(typeof o.visibleFrom === "string" ? o.visibleFrom : "");
    const until = normalizeHhmm(typeof o.visibleUntil === "string" ? o.visibleUntil : "");
    if (!from || !until || from === until) continue;
    out[k] = { visibleFrom: from, visibleUntil: until };
  }
  return out;
}
