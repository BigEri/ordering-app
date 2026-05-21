import type { DotykackaMenuSection } from "../dotykacka/dotykackaMenuSections";

export type DotykackaEditorOption = { id: string; label: string };

export type DotykackaEditorGroupRaw = {
  id: string;
  label: string;
  options: DotykackaEditorOption[];
  usedBy: string[];
};

/** Skupina v editoru — duplicity se stejným obsahem jsou sloučeny pod `id` (kanonické ID). */
export type DotykackaEditorGroupMerged = DotykackaEditorGroupRaw & {
  aliasIds: string[];
  /** true = v Dotyce existuje víc ID se stejným názvem a stejnými volbami */
  merged: boolean;
};

function normLabelKey(s: string): string {
  return s.trim().toLowerCase();
}

/** Klíč pro sloučení skupin se stejným českým názvem a stejnou sadou produktů (voleb). */
export function dotykackaGroupMergeFingerprint(label: string, optionIds: readonly string[]): string {
  const opts = optionIds
    .map((id) => String(id).trim())
    .filter(Boolean)
    .sort()
    .join(",");
  return `${normLabelKey(label)}\0${opts}`;
}

function sortIds(ids: readonly string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Všechny unikátní skupiny customizací z menu + u kterých jídel se vyskytují. */
export function buildRawDotykackaGroupsFromSections(sections: readonly DotykackaMenuSection[]): DotykackaEditorGroupRaw[] {
  const byId = new Map<string, DotykackaEditorGroupRaw>();

  for (const sec of sections) {
    for (const it of sec.items) {
      const gs = it.dotykackaCustomizationGroups ?? [];
      for (const g of gs) {
        const gid = String(g.customizationId ?? "").trim();
        if (!gid) continue;

        const dish = (it.name || "").trim() || `Produkt ${it.id}`;
        const options = (g.options ?? [])
          .map((o) => ({ id: String(o.productId ?? "").trim(), label: o.label }))
          .filter((o) => o.id);

        const existing = byId.get(gid);
        if (!existing) {
          byId.set(gid, {
            id: gid,
            label: g.sectionLabel,
            options,
            usedBy: [dish],
          });
          continue;
        }
        if (!existing.usedBy.includes(dish)) existing.usedBy.push(dish);
      }
    }
  }

  for (const g of byId.values()) {
    g.usedBy.sort((a, b) => a.localeCompare(b, "cs"));
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** Sloučí skupiny se stejným fingerprintem (např. dvě „Přílohy“ z Dotyky). */
export function mergeDotykackaEditorGroups(raw: readonly DotykackaEditorGroupRaw[]): DotykackaEditorGroupMerged[] {
  const clusters = new Map<string, DotykackaEditorGroupRaw[]>();

  for (const r of raw) {
    const fp = dotykackaGroupMergeFingerprint(
      r.label,
      r.options.map((o) => o.id),
    );
    const list = clusters.get(fp) ?? [];
    list.push(r);
    clusters.set(fp, list);
  }

  const out: DotykackaEditorGroupMerged[] = [];

  for (const cluster of clusters.values()) {
    const aliasIds = sortIds(cluster.map((c) => c.id));
    const canonicalId = aliasIds[0]!;
    const best =
      cluster.reduce((a, b) => ((a.options?.length ?? 0) >= (b.options?.length ?? 0) ? a : b)) ?? cluster[0]!;
    const usedBySet = new Set<string>();
    for (const c of cluster) {
      for (const name of c.usedBy) usedBySet.add(name);
    }
    const usedBy = [...usedBySet].sort((a, b) => a.localeCompare(b, "cs"));

    out.push({
      id: canonicalId,
      aliasIds,
      merged: aliasIds.length > 1,
      label: best.label,
      options: best.options,
      usedBy,
    });
  }

  return out.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

export function buildDotykackaCustomizationAliasIndex(
  sections: readonly DotykackaMenuSection[],
): Map<string, string[]> {
  const merged = mergeDotykackaEditorGroups(buildRawDotykackaGroupsFromSections(sections));
  const index = new Map<string, string[]>();
  for (const m of merged) {
    for (const id of m.aliasIds) index.set(id, m.aliasIds);
  }
  return index;
}

/** Hodnota překladu skupiny — bere první neprázdnou z aliasů (kanonické ID první). */
export function getMergedDotykackaGroupLabel(
  groups: Record<string, string> | undefined,
  merged: Pick<DotykackaEditorGroupMerged, "id" | "aliasIds">,
): string {
  const map = groups ?? {};
  for (const id of merged.aliasIds) {
    const v = (map[id] ?? "").trim();
    if (v) return map[id] ?? "";
  }
  return map[merged.id] ?? "";
}

/** Před uložením zkopíruje překlad názvu skupiny na všechna alias ID v Dotyce. */
export function expandDotykackaGroupLabelsForSave(
  groups: Record<string, string> | undefined,
  mergedList: readonly DotykackaEditorGroupMerged[],
): Record<string, string> {
  const out = { ...(groups ?? {}) };
  for (const m of mergedList) {
    const val = getMergedDotykackaGroupLabel(out, m).trim();
    if (!val) {
      for (const id of m.aliasIds) delete out[id];
      continue;
    }
    for (const id of m.aliasIds) out[id] = val;
  }
  return out;
}

/** Na hostovi: překlad skupiny i když je v DB jen pod jiným alias ID. */
export function resolveDotykackaGroupLabel(
  groups: Record<string, string> | undefined,
  customizationId: string,
  aliasIndex: Map<string, string[]>,
): string | undefined {
  const gid = customizationId.trim();
  if (!gid) return undefined;
  const map = groups ?? {};
  const direct = (map[gid] ?? "").trim();
  if (direct) return map[gid];

  const aliases = aliasIndex.get(gid) ?? [gid];
  for (const id of aliases) {
    const v = (map[id] ?? "").trim();
    if (v) return map[id];
  }
  return undefined;
}
