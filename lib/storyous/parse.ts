export type StoryousPlace = {
  placeId: string;
  name: string;
  state: string | null;
};

export type StoryousDesk = {
  deskId: string;
  name: string;
  code: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : value != null ? String(value).trim() : "";
}

export function parseMerchantPlaces(json: unknown): { merchantName: string; places: StoryousPlace[] } {
  const rec = asRecord(json);
  const merchantName = str(rec?.name) || "—";
  const raw = rec?.places ?? rec?.data;
  const places: StoryousPlace[] = [];
  if (Array.isArray(raw)) {
    for (const row of raw) {
      const p = asRecord(row);
      if (!p) continue;
      const placeId = str(p.placeId) || str(p.id);
      const name = str(p.name) || placeId;
      if (!placeId) continue;
      places.push({
        placeId,
        name,
        state: str(p.state) || null,
      });
    }
  }
  return { merchantName, places };
}

export function parseDesks(json: unknown): StoryousDesk[] {
  const rec = asRecord(json);
  const fromData = Array.isArray(rec?.data) ? rec.data : [];
  const fromDesks = Array.isArray(rec?.desks) ? rec.desks : [];
  const fromSections = Array.isArray(rec?.sections)
    ? rec.sections.flatMap((s) => {
        const sec = asRecord(s);
        return Array.isArray(sec?.desks) ? sec.desks : [];
      })
    : [];
  const rows = fromData.length ? fromData : fromDesks.length ? fromDesks : fromSections;
  const out: StoryousDesk[] = [];
  for (const row of rows) {
    const d = asRecord(row);
    if (!d) continue;
    const deskId = str(d.deskId) || str(d.id);
    if (!deskId) continue;
    const name = str(d.name) || str(d.code) || `Stůl ${deskId}`;
    const code = str(d.code) || deskId;
    if (d._removed === true) continue;
    out.push({ deskId, name, code });
  }
  return out;
}

export function countMenuItems(json: unknown): number {
  const rec = asRecord(json);
  if (Array.isArray(rec?.items)) return rec.items.length;
  if (Array.isArray(rec?.products)) return rec.products.length;
  if (Array.isArray(rec?.data)) return rec.data.length;
  return 0;
}
