"use client";

import * as React from "react";

import { AdminChipLink } from "../../../../components/admin/AdminNavLink";
import { useAdminLanguage } from "../../../../components/admin/AdminLanguageProvider";
import { publicMenuUrlFromAdmin } from "../../../../lib/admin/publicMenuPreviewUrl";

import type { DotykackaMenuSection } from "../../../../lib/dotykacka/dotykackaMenuSections";
import { menuSectionCategoryKey } from "../../../../lib/menu/menuSectionKey";
import type { MenuTextOverridesForLocale } from "../../../../lib/menu/menuTextOverridesTypes";
import { seedTranslate, type SeedLocale } from "../../../../lib/menu/seedTranslations";
import type {
  MenuIngredientOverrideLine,
  MenuIngredientOverridesForLocale,
} from "../../../../lib/menu/menuIngredientOverridesTypes";
import {
  buildRawDotykackaGroupsFromSections,
  expandDotykackaGroupLabelsForSave,
  getMergedDotykackaGroupLabel,
  mergeDotykackaEditorGroups,
  type DotykackaEditorGroupMerged,
} from "../../../../lib/menu/dotykackaLabelMerge";

type LocaleCode = string;
type AdminLocale = { code: string; label: string; enabled: boolean };

const EMPTY_INGREDIENT_MARKER = "__EMPTY__";

function sameString(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

function asSeedLocale(code: string): SeedLocale | null {
  const lc = code.trim().toLowerCase();
  if (lc === "en" || lc === "ko") return lc;
  return null;
}

function normLabelKey(s: string): string {
  return s.trim().toLowerCase();
}

function sectionDisplayName(sec: DotykackaMenuSection, t: (key: string) => string): string {
  if (sec.labelKey === "other") return t("admin.translations.sectionOther");
  if (sec.labelKey === "all") return t("admin.translations.sectionAll");
  return (sec.name || "").trim() || t("admin.translations.sectionUnnamed");
}

/** Text pro štítek ID kategorie v editoru (ne product-customization). */
function sectionCategoryIdLabel(sec: DotykackaMenuSection): string {
  if (sec.labelKey === "other") return "other";
  if (sec.labelKey === "all") return "all";
  if (sec.categoryId != null) return String(sec.categoryId);
  return "—";
}

function emptyLocale(): MenuTextOverridesForLocale {
  return { items: {}, categories: {} };
}

function mergeLoaded(
  locales: readonly AdminLocale[],
  by: Record<string, MenuTextOverridesForLocale | undefined>,
): Record<string, MenuTextOverridesForLocale> {
  const out: Record<string, MenuTextOverridesForLocale> = {};
  for (const l of locales) {
    const cur = by[l.code] ?? emptyLocale();
    out[l.code] = { items: { ...(cur.items ?? {}) }, categories: { ...(cur.categories ?? {}) } };
  }
  return out;
}

function mergeLoadedIngredients(
  locales: readonly AdminLocale[],
  by: Record<string, MenuIngredientOverridesForLocale | undefined>,
): Record<string, MenuIngredientOverridesForLocale> {
  const out: Record<string, MenuIngredientOverridesForLocale> = {};
  for (const l of locales) {
    const cur = by[l.code] ?? { items: {} };
    out[l.code] = { items: { ...(cur.items ?? {}) } };
  }
  return out;
}

function stableStringify(v: unknown): string {
  const seen = new WeakSet<object>();
  const norm = (x: any): any => {
    if (x == null) return x;
    if (typeof x !== "object") return x;
    if (seen.has(x)) return null;
    seen.add(x);
    if (Array.isArray(x)) return x.map(norm);
    const keys = Object.keys(x).sort();
    const out: Record<string, any> = {};
    for (const k of keys) out[k] = norm(x[k]);
    return out;
  };
  return JSON.stringify(norm(v));
}

type MenuTranslationsClientProps = {
  restaurantId: string | null;
  restaurantName: string;
  sections: DotykackaMenuSection[];
  loadError: string | null;
};

export function MenuTranslationsClient({ restaurantId, restaurantName, sections, loadError }: MenuTranslationsClientProps) {
  const { t } = useAdminLanguage();
  const [locales, setLocales] = React.useState<AdminLocale[]>([
    { code: "cs", label: "Čeština", enabled: true },
    { code: "en", label: "English", enabled: true },
    { code: "ko", label: "한국어", enabled: true },
  ]);
  const [activeLocale, setActiveLocale] = React.useState<LocaleCode>("cs");
  const [byLocale, setByLocale] = React.useState<Record<string, MenuTextOverridesForLocale>>({});
  const [ingredientsByLocale, setIngredientsByLocale] = React.useState<Record<string, MenuIngredientOverridesForLocale>>({});
  const [dotykackaLabelsByLocale, setDotykackaLabelsByLocale] = React.useState<Record<string, { groups: Record<string, string>; options: Record<string, string> }>>({});
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [autoSaveState, setAutoSaveState] = React.useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [autoSaveErr, setAutoSaveErr] = React.useState<string | null>(null);
  const lastSavedKeyRef = React.useRef<string | null>(null);
  const savingRef = React.useRef(false);
  const autoSavePendingRef = React.useRef(false);
  const byLocaleRef = React.useRef(byLocale);
  const ingredientsByLocaleRef = React.useRef(ingredientsByLocale);
  const dotykackaLabelsByLocaleRef = React.useRef(dotykackaLabelsByLocale);
  const activeLocaleRef = React.useRef(activeLocale);

  React.useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  React.useEffect(() => {
    byLocaleRef.current = byLocale;
  }, [byLocale]);

  React.useEffect(() => {
    ingredientsByLocaleRef.current = ingredientsByLocale;
  }, [ingredientsByLocale]);

  React.useEffect(() => {
    dotykackaLabelsByLocaleRef.current = dotykackaLabelsByLocale;
  }, [dotykackaLabelsByLocale]);

  React.useEffect(() => {
    activeLocaleRef.current = activeLocale;
  }, [activeLocale]);

  const currentSaveKey = React.useCallback(
    () =>
      stableStringify({
        textByLocale: byLocaleRef.current,
        ingredientsByLocale: ingredientsByLocaleRef.current,
        dotykackaLabelsByLocale: dotykackaLabelsByLocaleRef.current,
      }),
    [],
  );

  const markDirty = React.useCallback(() => {
    setAutoSaveState((s) => (s === "saving" ? s : "dirty"));
    setAutoSaveErr(null);
  }, []);

  const enabledLocales = React.useMemo(() => locales.filter((l) => l.enabled), [locales]);
  const enabledLocaleCodes = React.useMemo(() => enabledLocales.map((l) => l.code), [enabledLocales]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/admin/locales", { cache: "no-store" });
        const j = (await r.json()) as { ok?: boolean; locales?: AdminLocale[]; error?: string };
        if (cancelled) return;
        if (!r.ok || !j.ok || !Array.isArray(j.locales)) {
          return;
        }
        const cleaned = j.locales
          .map((x) => ({
            code: typeof x?.code === "string" ? x.code.trim() : "",
            label: typeof x?.label === "string" ? x.label.trim() : "",
            enabled: x?.enabled === true,
          }))
          .filter((x) => !!x.code && !!x.label);
        if (cleaned.length > 0) {
          setLocales(cleaned);
          setActiveLocale((prev) => {
            const set = new Set(cleaned.filter((l) => l.enabled).map((l) => l.code));
            return set.has(prev) ? prev : set.has("cs") ? "cs" : set.has("en") ? "en" : cleaned[0]!.code;
          });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!restaurantId) {
      setByLocale(mergeLoaded(enabledLocales, {}));
      setIngredientsByLocale(mergeLoadedIngredients(enabledLocales, {}));
      setDotykackaLabelsByLocale({});
      lastSavedKeyRef.current = null;
      setAutoSaveState("idle");
      setAutoSaveErr(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void (async () => {
      try {
        const r = await fetch(
          `/api/admin/menu/ui-overrides?restaurantId=${encodeURIComponent(restaurantId)}`,
          { cache: "no-store" },
        );
        const j = (await r.json()) as {
          ok?: boolean;
          text?: Record<string, MenuTextOverridesForLocale>;
          ingredients?: Record<string, MenuIngredientOverridesForLocale>;
          dotykacka?: Record<string, { groups?: Record<string, string>; options?: Record<string, string> }>;
          error?: string;
        };
        if (cancelled) return;
        if (!r.ok || !j.ok || !j.text) {
          setErr(j.error ?? t("admin.translations.loadErr"));
          return;
        }
        setByLocale(mergeLoaded(enabledLocales, j.text));
        if (j.ingredients) {
          setIngredientsByLocale(mergeLoadedIngredients(enabledLocales, j.ingredients));
        } else {
          setIngredientsByLocale(mergeLoadedIngredients(enabledLocales, {}));
        }
        const dotykackaMap: Record<string, { groups: Record<string, string>; options: Record<string, string> }> = {};
        for (const [code, val] of Object.entries(j.dotykacka ?? {})) {
          dotykackaMap[code] = { groups: val?.groups ?? {}, options: val?.options ?? {} };
        }
        setDotykackaLabelsByLocale(dotykackaMap);

        lastSavedKeyRef.current = null;
        setAutoSaveState("idle");
        setAutoSaveErr(null);
      } catch {
        if (!cancelled) setErr(t("admin.translations.loadNetworkErr"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabledLocales, restaurantId]);

  const setItemName = React.useCallback((locale: LocaleCode, itemId: string, name: string) => {
    markDirty();
    setByLocale((prev) => {
      const cur = prev[locale] ?? emptyLocale();
      const nextItems = { ...cur.items };
      // Netrimujeme během psaní – jinak nejde napsat mezera na konci slova (\"Main Dish\" → \"MainDish\").
      const existing = (nextItems[itemId] ?? {}) as { name?: string; description?: string };
      if (name === "") {
        const { description } = existing;
        if (typeof description === "string") nextItems[itemId] = { description };
        else delete nextItems[itemId];
      } else {
        nextItems[itemId] = { ...existing, name };
      }
      return { ...prev, [locale]: { ...cur, items: nextItems } };
    });
  }, [markDirty]);

  const setItemDescription = React.useCallback((locale: LocaleCode, itemId: string, description: string) => {
    markDirty();
    setByLocale((prev) => {
      const cur = prev[locale] ?? emptyLocale();
      const nextItems = { ...cur.items };
      const existing = (nextItems[itemId] ?? {}) as { name?: string; description?: string };
      if (description.trim() === "") {
        const { name } = existing;
        if (typeof name === "string" && name.trim() !== "") nextItems[itemId] = { name };
        else delete nextItems[itemId];
      } else {
        nextItems[itemId] = { ...existing, description };
      }
      return { ...prev, [locale]: { ...cur, items: nextItems } };
    });
  }, [markDirty]);

  const setCategoryName = React.useCallback((locale: LocaleCode, categoryKey: string, name: string) => {
    markDirty();
    setByLocale((prev) => {
      const cur = prev[locale] ?? emptyLocale();
      const nextCats = { ...cur.categories };
      if (name === "") delete nextCats[categoryKey];
      else nextCats[categoryKey] = { name };
      return { ...prev, [locale]: { ...cur, categories: nextCats } };
    });
  }, [markDirty]);

  const buildDefaultIngredientLines = React.useCallback((item: { ingredients?: { name: string; allowExclude?: boolean }[] }) => {
    const arr = item.ingredients ?? [];
    return arr.map((ing) => ({
      sourceName: ing.name,
      label: ing.name,
      allowExclude: ing.allowExclude !== false,
    })) satisfies MenuIngredientOverrideLine[];
  }, []);

  const setIngredientLine = React.useCallback(
    (
      locale: LocaleCode,
      itemId: string,
      idx: number,
      patch: Partial<MenuIngredientOverrideLine>,
      baseList: MenuIngredientOverrideLine[],
    ) => {
      markDirty();
      setIngredientsByLocale((prev) => {
        const next = { ...prev };
        const codes = enabledLocaleCodes.length > 0 ? enabledLocaleCodes : [locale];

        // Změna interního názvu (sourceName) musí být synchronní napříč jazyky,
        // aby se daly detekovat chybějící překlady a aby měl admin konzistentní klíč.
        const propagateSourceName = typeof patch.sourceName === "string";
        const newSource = typeof patch.sourceName === "string" ? patch.sourceName : null;

        // Změny label/allowExclude/hidden necháváme jen pro aktivní jazyk (locale),
        // protože jsou jazykově specifické.
        for (const code of codes) {
          const cur = next[code] ?? { items: {} };
          const hasStored = Object.prototype.hasOwnProperty.call(cur.items ?? {}, itemId);
          const currentList =
            (cur.items[itemId] as MenuIngredientOverrideLine[] | undefined) ??
            (code === locale ? (baseList ?? []) : hasStored ? [] : []);

          const oldLine = currentList[idx] ?? {
            sourceName: propagateSourceName ? (newSource ?? "") : "",
            label: "",
            allowExclude: true,
          };
          const shouldApplyAll = code === locale;
          const patchForCode: Partial<MenuIngredientOverrideLine> = {};
          if (propagateSourceName) patchForCode.sourceName = newSource ?? "";
          if (shouldApplyAll) Object.assign(patchForCode, patch);
          const nextList = [...currentList];
          while (nextList.length <= idx) {
            nextList.push({ sourceName: "", label: "", allowExclude: true });
          }
          nextList[idx] = { ...oldLine, ...nextList[idx], ...patchForCode };

          // Auto-fill překladů: pokud v cílovém jazyce chybí label a známe překlad interního názvu, doplníme ho.
          if (!shouldApplyAll) {
            const seedLc = asSeedLocale(code);
            if (seedLc) {
              const src = (nextList[idx]?.sourceName ?? "").trim();
              const lbl = (nextList[idx]?.label ?? "").trim();
              if (src && !lbl) {
                const hit = seedTranslate(src, seedLc);
                if (hit) nextList[idx] = { ...nextList[idx]!, label: hit };
              }
            }
          }

          next[code] = { items: { ...cur.items, [itemId]: nextList } };
        }
        return next;
      });
    },
    [enabledLocaleCodes, markDirty],
  );

  const addIngredientLine = React.useCallback((locale: LocaleCode, itemId: string) => {
    markDirty();
    setIngredientsByLocale((prev) => {
      const next: MenuIngredientOverrideLine = { sourceName: "", label: "", allowExclude: true };
      const out = { ...prev };
      const codes = enabledLocaleCodes.length > 0 ? enabledLocaleCodes : [locale];
      for (const code of codes) {
        const cur = out[code] ?? { items: {} };
        const currentList = cur.items[itemId] ?? [];
        out[code] = { items: { ...cur.items, [itemId]: [...currentList, { ...next }] } };
      }
      return out;
    });
  }, [enabledLocaleCodes, markDirty]);

  const removeIngredientLine = React.useCallback((locale: LocaleCode, itemId: string, idx: number, baseList: MenuIngredientOverrideLine[]) => {
    markDirty();
    setIngredientsByLocale((prev) => {
      const out = { ...prev };
      const codes = enabledLocaleCodes.length > 0 ? enabledLocaleCodes : [locale];
      for (const code of codes) {
        const cur = out[code] ?? { items: {} };
        const currentList = cur.items[itemId] ?? (baseList ?? []);
        const nextList = currentList.filter((_, i) => i !== idx);
        const nextItems = { ...cur.items };
        // Prázdný seznam je autoritativní (tzn. nevracet fallback z Dotykačky / lokálních defaultů).
        nextItems[itemId] = nextList;
        out[code] = { items: nextItems };
      }
      return out;
    });
  }, [enabledLocaleCodes, markDirty]);

  const missingIngredientTranslations = React.useMemo(() => {
    const codes = enabledLocaleCodes;
    if (!restaurantId || codes.length === 0) return [];
    const out: Array<{ itemId: string; sourceName: string; missingLocales: string[] }> = [];

    // Pro každý item vezmeme union interních názvů napříč jazyky.
    const allItemIds = new Set<string>();
    for (const code of codes) {
      const items = ingredientsByLocale[code]?.items ?? {};
      for (const itemId of Object.keys(items)) allItemIds.add(itemId);
    }
    for (const itemId of allItemIds) {
      const union = new Set<string>();
      for (const code of codes) {
        const list = ingredientsByLocale[code]?.items?.[itemId] ?? [];
        for (const l of list) {
          const s = (l?.sourceName ?? "").trim();
            if (s && s !== EMPTY_INGREDIENT_MARKER) union.add(s);
        }
      }
      for (const src of union) {
        const missing: string[] = [];
        for (const code of codes) {
          const list = ingredientsByLocale[code]?.items?.[itemId] ?? [];
          const line = list.find((l) => l && sameString(l.sourceName ?? "", src));
          const label = (line?.label ?? "").trim();
          if (!label) missing.push(code);
        }
        if (missing.length > 0) out.push({ itemId, sourceName: src, missingLocales: missing });
      }
    }
    return out;
  }, [enabledLocaleCodes, ingredientsByLocale, restaurantId]);

  const hasMissingIngredientTranslations = missingIngredientTranslations.length > 0;

  const dotykackaGroupsMergedForEditor = React.useMemo(
    () => mergeDotykackaEditorGroups(buildRawDotykackaGroupsFromSections(sections)),
    [sections],
  );

  const dotykackaGroupLabelKeys = React.useMemo(() => {
    const keys = new Set<string>();
    for (const g of dotykackaGroupsMergedForEditor) {
      const l = (g.label ?? "").trim();
      if (l) keys.add(normLabelKey(l));
    }
    return keys;
  }, [dotykackaGroupsMergedForEditor]);

  const menuCategoriesForEditor = React.useMemo(() => {
    const unnamed = t("admin.translations.sectionUnnamed");
    return sections.map((sec) => {
      const catKey = menuSectionCategoryKey(sec);
      const dotykaName = sectionDisplayName(sec, t);
      const idLabel = sectionCategoryIdLabel(sec);
      const ambiguous =
        dotykaName !== unnamed && dotykackaGroupLabelKeys.has(normLabelKey(dotykaName));
      return { sec, catKey, dotykaName, idLabel, ambiguous };
    });
  }, [sections, dotykackaGroupLabelKeys, t]);

  const setDotykackaGroupLabel = React.useCallback(
    (locale: string, merged: Pick<DotykackaEditorGroupMerged, "aliasIds">, val: string) => {
      markDirty();
      setDotykackaLabelsByLocale((prev) => {
        const cur = prev[locale] ?? { groups: {}, options: {} };
        const nextGroups = { ...cur.groups };
        for (const id of merged.aliasIds) {
          if (val.trim()) nextGroups[id] = val;
          else delete nextGroups[id];
        }
        return { ...prev, [locale]: { ...cur, groups: nextGroups } };
      });
    },
    [markDirty],
  );
  const setDotykackaOptionLabel = React.useCallback((locale: string, optionId: string, val: string) => {
    markDirty();
    setDotykackaLabelsByLocale((prev) => {
      const cur = prev[locale] ?? { groups: {}, options: {} };
      return { ...prev, [locale]: { ...cur, options: { ...cur.options, [optionId]: val } } };
    });
  }, [markDirty]);

  // Auto-fill seed překladů pro Dotyka "Přílohy/úpravy" při přepnutí na en/ko (jen do prázdných polí).
  React.useEffect(() => {
    const seedLc = asSeedLocale(activeLocale);
    if (!seedLc) return;
    if (dotykackaGroupsMergedForEditor.length === 0) return;
    setDotykackaLabelsByLocale((prev) => {
      const cur = prev[activeLocale] ?? { groups: {}, options: {} };
      let changed = false;
      const nextGroups = { ...(cur.groups ?? {}) };
      const nextOptions = { ...(cur.options ?? {}) };

      for (const g of dotykackaGroupsMergedForEditor) {
        const hasAny = g.aliasIds.some((id) => (nextGroups[id] ?? "").trim());
        if (!hasAny && (g.label ?? "").trim()) {
          const hit = seedTranslate(g.label, seedLc);
          if (hit) {
            for (const id of g.aliasIds) nextGroups[id] = hit;
            changed = true;
          }
        }
        for (const o of g.options ?? []) {
          const oid = String(o.id ?? "").trim();
          if (oid && !(nextOptions[oid] ?? "").trim() && (o.label ?? "").trim()) {
            const hit = seedTranslate(o.label, seedLc);
            if (hit) {
              nextOptions[oid] = hit;
              changed = true;
            }
          }
        }
      }

      if (!changed) return prev;
      return { ...prev, [activeLocale]: { groups: nextGroups, options: nextOptions } };
    });
  }, [activeLocale, dotykackaGroupsMergedForEditor]);

  const onSave = React.useCallback(
    async (opts?: { silent?: boolean }) => {
    if (!restaurantId) return;
    if (savingRef.current) {
      // Pokud už se ukládá, po doběhu zkusíme znovu (např. blur během ukládání).
      autoSavePendingRef.current = true;
      return;
    }
    const silent = opts?.silent === true;
    const locale = activeLocaleRef.current;
    setSaving(true);
    if (!silent) setErr(null);
    setAutoSaveErr(null);
    setAutoSaveState("saving");
    try {
      const payload = byLocaleRef.current[locale] ?? emptyLocale();
      const ingredientsSnapshot = ingredientsByLocaleRef.current;
      const dotykackaSnapshot = dotykackaLabelsByLocaleRef.current;
      const [rText, ...rIngAll] = await Promise.all([
        fetch("/api/admin/menu/text-overrides", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            restaurantId,
            locale,
            items: payload.items,
            categories: payload.categories,
          }),
        }),
        ...enabledLocaleCodes.map((loc) => {
          const payloadIng = ingredientsSnapshot[loc] ?? { items: {} };
          // Server zatím neukládá prázdné seznamy (0 řádků) — pro "autoritatívně prázdno"
          // posíláme skrytý marker řádek, který se ve veřejném menu i editoru ignoruje.
          const itemsWithEmptyMarkers: Record<string, MenuIngredientOverrideLine[]> = {};
          for (const [itemId, list] of Object.entries(payloadIng.items ?? {})) {
            const arr = Array.isArray(list) ? list : [];
            if (arr.length === 0) {
              itemsWithEmptyMarkers[itemId] = [{ sourceName: EMPTY_INGREDIENT_MARKER, label: "", allowExclude: false, hidden: true }];
            } else {
              itemsWithEmptyMarkers[itemId] = arr;
            }
          }
          return fetch("/api/admin/menu/ingredient-overrides", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              restaurantId,
              locale: loc,
              items: itemsWithEmptyMarkers,
            }),
          });
        }),
      ]);

      const jText = (await rText.json()) as {
        ok?: boolean;
        byLocale?: Record<string, MenuTextOverridesForLocale>;
        error?: string;
      };

      if (!rText.ok || !jText.ok || !jText.byLocale) {
        const msg = jText.error ?? t("admin.translations.saveTextFailed");
        if (silent) setAutoSaveErr(msg);
        else setErr(msg);
        setAutoSaveState("error");
        return;
      }
      // Ingredience ukládáme pro všechny povolené jazyky, aby se interní klíče synchronizovaly a nechyběly překlady.
      for (const rIng of rIngAll) {
        const jIng = (await rIng.json()) as {
          ok?: boolean;
          byLocale?: Record<string, MenuIngredientOverridesForLocale>;
          error?: string;
        };
        if (!rIng.ok || !jIng.ok || !jIng.byLocale) {
          const msg = jIng.error ?? t("admin.translations.saveIngredientsFailed");
          if (silent) setAutoSaveErr(msg);
          else setErr(msg);
          setAutoSaveState("error");
          return;
        }
      }

      // Uložíme Dotyka labels jen pro aktivní jazyk (ostatní zůstávají jak jsou).
      try {
        const dl = dotykackaSnapshot[locale] ?? { groups: {}, options: {} };
        const rDl = await fetch("/api/admin/menu/dotykacka-labels", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            restaurantId,
            locale,
            groups: expandDotykackaGroupLabelsForSave(dl.groups, dotykackaGroupsMergedForEditor),
            options: dl.options,
          }),
        });
        if (!rDl.ok && !silent) setErr(t("admin.translations.saveDotykackaFailed"));
      } catch {
        if (!silent) setErr(t("admin.translations.saveDotykackaNetworkErr"));
      }

      setSavedAt(Date.now());
      setAutoSaveState("saved");

      // Lokální stav nepřepisujeme odpovědí serveru — při psaní by mizely znaky.
      lastSavedKeyRef.current = currentSaveKey();
    } catch {
      const msg = t("admin.translations.saveNetworkErr");
      if (silent) setAutoSaveErr(msg);
      else setErr(msg);
      setAutoSaveState("error");
    } finally {
      setSaving(false);
      if (autoSavePendingRef.current) {
        autoSavePendingRef.current = false;
        if (lastSavedKeyRef.current != null && currentSaveKey() !== lastSavedKeyRef.current) {
          window.setTimeout(() => {
            void onSave({ silent: true });
          }, 0);
        }
      }
    }
    },
    [currentSaveKey, dotykackaGroupsMergedForEditor, enabledLocaleCodes, restaurantId, t],
  );

  const saveWhenDirty = React.useCallback(() => {
    if (!restaurantId || loading) return;
    if (lastSavedKeyRef.current != null && currentSaveKey() === lastSavedKeyRef.current) return;
    void onSave({ silent: true });
  }, [currentSaveKey, loading, onSave, restaurantId]);

  const saveOnBlur = React.useCallback(() => {
    saveWhenDirty();
  }, [saveWhenDirty]);

  const autoSaveKey = React.useMemo(() => {
    return stableStringify({
      textByLocale: byLocale,
      ingredientsByLocale,
      dotykackaLabelsByLocale,
    });
  }, [byLocale, dotykackaLabelsByLocale, ingredientsByLocale]);

  const flushPendingSaves = React.useCallback(async () => {
    if (!restaurantId) return true;

    // Pokud se nic nezměnilo, není co řešit.
    if (lastSavedKeyRef.current != null && autoSaveKey === lastSavedKeyRef.current && !savingRef.current) {
      return true;
    }

    // Zkusíme uložit aktuální stav (silent).
    await onSave({ silent: true });

    // Počkáme krátce, až se doběhne případné ukládání + případné "pending" uložení.
    const startedAt = Date.now();
    while (Date.now() - startedAt < 7000) {
      if (!savingRef.current && lastSavedKeyRef.current != null && lastSavedKeyRef.current === currentSaveKey()) {
        return true;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((r) => window.setTimeout(r, 120));
    }
    return false;
  }, [autoSaveKey, currentSaveKey, onSave, restaurantId]);

  React.useEffect(() => {
    // Varování při zavření/refresh – jen když jsou neuložené změny.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const dirty = lastSavedKeyRef.current != null && autoSaveKey !== lastSavedKeyRef.current;
      if (!dirty && !savingRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    // Při kliknutí mimo stránku: pokud jsou změny, nejdřív uložit a teprve pak navigovat.
    const onDocClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (!(e.target instanceof Element)) return;
      const a = e.target.closest("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (!href) return;
      if (href.startsWith("#")) return;
      if (href.startsWith("/admin/menu/translations")) return;
      if (/\/admin\/restaurants\/[^/]+\/menu\/translations/.test(href)) return;

      const dirty = lastSavedKeyRef.current != null && autoSaveKey !== lastSavedKeyRef.current;
      if (!dirty && !savingRef.current && !hasMissingIngredientTranslations) return;

      e.preventDefault();
      e.stopPropagation();

      if (hasMissingIngredientTranslations) {
        const ok = window.confirm(t("admin.translations.leaveConfirm"));
        if (!ok) return;
      }

      void (async () => {
        const ok = await flushPendingSaves();
        if (!ok) {
          window.alert(t("admin.translations.flushFailed"));
          return;
        }
        window.location.href = href;
      })();
    };
    document.addEventListener("click", onDocClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onDocClick, true);
    };
  }, [autoSaveKey, flushPendingSaves, hasMissingIngredientTranslations, t]);

  React.useEffect(() => {
    if (!restaurantId || loading) return;
    if (lastSavedKeyRef.current == null) {
      lastSavedKeyRef.current = autoSaveKey;
      setAutoSaveState("idle");
      setAutoSaveErr(null);
    }
  }, [autoSaveKey, loading, restaurantId]);

  React.useEffect(() => {
    if (!restaurantId || loading) return;
    if (lastSavedKeyRef.current == null) return;
    if (autoSaveKey === lastSavedKeyRef.current) {
      if (autoSaveState === "dirty") setAutoSaveState("idle");
      return;
    }
    setAutoSaveState((s) => (s === "saving" ? s : "dirty"));
    setAutoSaveErr(null);
  }, [autoSaveKey, autoSaveState, loading, restaurantId]);

  React.useEffect(() => {
    if (savedAt == null) return;
    const t = window.setTimeout(() => setSavedAt(null), 2500);
    return () => window.clearTimeout(t);
  }, [savedAt]);

  React.useEffect(() => {
    if (autoSaveState !== "saved") return;
    const t = window.setTimeout(() => setAutoSaveState("idle"), 2000);
    return () => window.clearTimeout(t);
  }, [autoSaveState]);

  if (!restaurantId) {
    return (
      <div style={{ padding: 24, maxWidth: 720 }}>
        <h1 style={{ marginTop: 0, fontSize: 26, fontWeight: 700 }}>
          {t("admin.translations.title")}
        </h1>
        <p className="textMuted2">
          {t("admin.translations.needSetup")}
        </p>
        <AdminChipLink href="/admin">
          {t("admin.translations.backAdmin")}
        </AdminChipLink>
      </div>
    );
  }

  return (
    <div style={{ padding: "8px 0 24px", maxWidth: 960 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ marginTop: 0, fontSize: 26, fontWeight: 700 }}>
            {t("admin.translations.title")}
          </h1>
          <p className="textMuted2" style={{ margin: "4px 0 0" }}>
            {t("admin.translations.subtitle", { name: restaurantName })}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <AdminChipLink href={`/admin/restaurants/${encodeURIComponent(restaurantId)}/menu`}>
            {t("admin.translations.linkMenu")}
          </AdminChipLink>
          <AdminChipLink href={publicMenuUrlFromAdmin({ rid: restaurantId })}>{t("admin.translations.linkPublic")}</AdminChipLink>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 12,
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div style={{ fontWeight: 650, marginBottom: 6 }}>{t("admin.translations.whatTitle")}</div>
        <ul className="textMuted2" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>{t("admin.translations.whatItems")}</li>
          <li>{t("admin.translations.whatCategories")}</li>
          <li>{t("admin.translations.whatAddons")}</li>
          <li>{t("admin.translations.whatIngredients")}</li>
        </ul>
        <p className="textMuted2" style={{ margin: "10px 0 0", lineHeight: 1.55 }}>
          {t("admin.translations.tipCs")}
        </p>
        <p className="textMuted2" style={{ margin: "8px 0 0", lineHeight: 1.55 }}>
          {t("admin.translations.tipAutosave")}
        </p>
      </div>

      {loadError ? (
        <p role="alert" style={{ color: "#fecaca", marginTop: 16 }}>
          {loadError}
        </p>
      ) : null}

      {err ? (
        <p role="alert" style={{ color: "#fecaca", marginTop: 12 }}>
          {err}
        </p>
      ) : null}

      {hasMissingIngredientTranslations ? (
        <p role="alert" style={{ color: "#fde68a", marginTop: 12, lineHeight: 1.55 }}>
          {t("admin.translations.missingIngredients", { count: missingIngredientTranslations.length })}
          <span className="textMuted2" style={{ display: "block", marginTop: 6 }}>
            {missingIngredientTranslations
              .slice(0, 3)
              .map((m) =>
                t("admin.translations.missingIngredientLine", {
                  source: m.sourceName,
                  locales: m.missingLocales.join(", "),
                }),
              )
              .join(" • ")}
            {missingIngredientTranslations.length > 3 ? "…" : ""}
          </span>
        </p>
      ) : null}

      {savedAt ? (
        <p role="status" style={{ color: "#86efac", marginTop: 8, fontSize: 14 }}>
          {t("admin.translations.saved")}
        </p>
      ) : null}

      <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span className="textMuted2" style={{ fontSize: 13 }}>
          {t("admin.translations.editLocale")}
        </span>
        {enabledLocales.map((l) => (
          <button
            key={l.code}
            type="button"
            className={`adminTab${activeLocale === l.code ? " adminTab--active" : ""}`}
            onClick={() => {
              void (async () => {
                if (activeLocale === l.code) return;
                if (hasMissingIngredientTranslations) {
                  const ok = window.confirm(t("admin.translations.switchConfirm"));
                  if (!ok) return;
                }
                const saved = await flushPendingSaves();
                if (!saved) {
                  window.alert(t("admin.translations.flushFailedShort"));
                  return;
                }
                setActiveLocale(l.code);
              })();
            }}
          >
            {l.label}
          </button>
        ))}
        <button type="button" className="btnPrimary" disabled={saving || loading} onClick={() => void onSave()} style={{ cursor: "pointer" }}>
          {saving ? t("admin.translations.saving") : t("admin.translations.save")}
        </button>
        {autoSaveState === "dirty" ? <span className="textMuted2">{t("admin.translations.dirty")}</span> : null}
        {autoSaveState === "saving" ? <span className="textMuted2">{t("admin.translations.saving")}</span> : null}
        {autoSaveState === "saved" ? <span className="textMuted2">{t("admin.translations.savedShort")}</span> : null}
        {autoSaveState === "error" ? (
          <span className="textMuted2" style={{ color: "#fecaca" }}>
            {t("admin.translations.saveFailed", { detail: autoSaveErr ? `: ${autoSaveErr}` : "" })}
          </span>
        ) : null}
        {loading ? <span className="textMuted2">{t("admin.translations.loading")}</span> : null}
      </div>

      <section style={{ marginTop: 24, display: "grid", gap: 28 }}>
        {menuCategoriesForEditor.length > 0 ? (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>{t("admin.translations.categoriesTitle")}</h2>
            <p className="textMuted2" style={{ margin: "0 0 12px", lineHeight: 1.55 }}>
              {t("admin.translations.categoriesHint")}
            </p>
            <div style={{ display: "grid", gap: 12 }}>
              {menuCategoriesForEditor.map(({ sec, catKey, dotykaName, idLabel, ambiguous }) => (
                <div
                  key={`cat-${sec.sortOrder}-${catKey}`}
                  style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}
                >
                  <div className="textMuted2" style={{ fontSize: 13, marginBottom: 4 }}>
                    {t("admin.translations.categoryId", { id: idLabel })}
                  </div>
                  <div className="textMuted2" style={{ fontSize: 12, marginBottom: ambiguous ? 6 : 8, lineHeight: 1.45 }}>
                    {t("admin.translations.csInDotyka")} <strong>{dotykaName}</strong>
                  </div>
                  {ambiguous ? (
                    <p
                      className="textMuted2"
                      style={{
                        margin: "0 0 8px",
                        fontSize: 12,
                        lineHeight: 1.45,
                        color: "#fde68a",
                        borderLeft: "3px solid rgba(253, 230, 138, 0.5)",
                        paddingLeft: 8,
                      }}
                    >
                      {t("admin.translations.ambiguousCategory")}
                    </p>
                  ) : null}
                  <label style={{ display: "grid", gap: 6 }}>
                    <span className="textMuted2" style={{ fontSize: 13 }}>
                      {t("admin.translations.categoryName", { locale: activeLocale })}
                    </span>
                    <input
                      className="chip"
                      value={(byLocale[activeLocale] ?? emptyLocale()).categories[catKey]?.name ?? ""}
                      onChange={(e) => setCategoryName(activeLocale, catKey, e.target.value)}
                      onBlur={saveOnBlur}
                      placeholder={dotykaName}
                      style={{ padding: "10px 12px", width: "100%", boxSizing: "border-box" }}
                      autoComplete="off"
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>{t("admin.translations.itemsTitle")}</h2>
          <p className="textMuted2" style={{ margin: "0 0 16px", lineHeight: 1.55 }}>
            {t("admin.translations.itemsHint")}
          </p>
        {sections.map((sec, secIdx) => {
          const catKey = menuSectionCategoryKey(sec);
          const dotykaName = sectionDisplayName(sec, t);
          const idLabel = sectionCategoryIdLabel(sec);
          return (
            <div key={`${sec.sortOrder}-${catKey}`} style={{ marginTop: secIdx === 0 ? 0 : 20 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600 }}>
                <span className="textMuted2" style={{ fontWeight: 500 }}>
                  {t("admin.translations.itemCategoryHeading", { id: idLabel })}
                </span>
                {" · "}
                {dotykaName}
              </h3>
              <div style={{ display: "grid", gap: 12 }}>
                {sec.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: 12,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {item.name}
                      <span className="textMuted2" style={{ fontWeight: 500, fontSize: 12, marginLeft: 8 }}>
                        {t("admin.translations.productId", { id: item.id })}
                      </span>
                    </div>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="textMuted2" style={{ fontSize: 13 }}>
                        {t("admin.translations.itemName", { locale: activeLocale })}
                      </span>
                      <input
                        className="chip"
                        value={(byLocale[activeLocale] ?? emptyLocale()).items[item.id]?.name ?? ""}
                        onChange={(e) => setItemName(activeLocale, item.id, e.target.value)}
                        onBlur={saveOnBlur}
                        placeholder={item.name}
                        style={{ padding: "10px 12px", width: "100%", boxSizing: "border-box" }}
                        autoComplete="off"
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="textMuted2" style={{ fontSize: 13 }}>
                        {t("admin.translations.itemDescription", { locale: activeLocale })}
                      </span>
                      <textarea
                        className="chip"
                        value={(byLocale[activeLocale] ?? emptyLocale()).items[item.id]?.description ?? ""}
                        onChange={(e) => setItemDescription(activeLocale, item.id, e.target.value)}
                        onBlur={saveOnBlur}
                        placeholder={item.description ?? t("admin.translations.itemDescriptionPlaceholder")}
                        style={{
                          padding: "10px 12px",
                          width: "100%",
                          boxSizing: "border-box",
                          minHeight: 84,
                          resize: "vertical",
                          lineHeight: 1.45,
                        }}
                      />
                    </label>

                    <div style={{ marginTop: 4, display: "grid", gap: 8 }}>
                      <div className="textMuted2" style={{ fontSize: 13 }}>
                        {t("admin.translations.ingredientsTitle", { locale: activeLocale })}
                      </div>
                      <div className="textMuted2" style={{ fontSize: 13, lineHeight: 1.45 }}>
                        {t("admin.translations.ingredientsHint")}
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {(() => {
                          const curItems = (ingredientsByLocale[activeLocale] ?? { items: {} }).items ?? {};
                          const hasStored = Object.prototype.hasOwnProperty.call(curItems, item.id);
                          const storedRaw = hasStored ? (curItems[item.id] ?? []) : null;
                          const storedVisible = Array.isArray(storedRaw)
                            ? storedRaw.filter((l) => l && typeof l === "object" && (l as MenuIngredientOverrideLine).sourceName !== EMPTY_INGREDIENT_MARKER && (l as MenuIngredientOverrideLine).hidden !== true)
                            : [];
                          const list = hasStored ? storedVisible : buildDefaultIngredientLines(item);
                          const effective = list;
                          return effective.map((l, idx) => (
                            <div
                              key={`${item.id}-${idx}`}
                              style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8, alignItems: "center" }}
                            >
                              <label style={{ display: "grid", gap: 6 }}>
                                <span className="textMuted2" style={{ fontSize: 13 }}>
                                  {t("admin.translations.ingredientSource")}
                                </span>
                                <input
                                  className="chip"
                                  value={l.sourceName}
                                  onChange={(e) => setIngredientLine(activeLocale, item.id, idx, { sourceName: e.target.value }, list)}
                                  onBlur={saveOnBlur}
                                  placeholder={t("admin.translations.ingredientPlaceholder")}
                                  style={{ padding: "10px 12px", width: "100%", boxSizing: "border-box" }}
                                  autoComplete="off"
                                />
                              </label>
                              <label style={{ display: "grid", gap: 6 }}>
                                <span className="textMuted2" style={{ fontSize: 13 }}>
                                  {t("admin.translations.ingredientLabel", { locale: activeLocale })}
                                </span>
                                <input
                                  className="chip"
                                  value={l.label}
                                  onChange={(e) => setIngredientLine(activeLocale, item.id, idx, { label: e.target.value }, list)}
                                  onBlur={saveOnBlur}
                                  placeholder={t("admin.translations.ingredientPlaceholder")}
                                  style={{ padding: "10px 12px", width: "100%", boxSizing: "border-box" }}
                                  autoComplete="off"
                                />
                              </label>
                              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={l.allowExclude !== false}
                                  onChange={(e) => {
                                    setIngredientLine(activeLocale, item.id, idx, { allowExclude: e.target.checked }, list);
                                    window.setTimeout(() => saveWhenDirty(), 0);
                                  }}
                                />
                                <span className="textMuted2" style={{ fontSize: 13 }}>{t("admin.translations.ingredientAllowExclude")}</span>
                              </label>
                              <button
                                type="button"
                                className="chip"
                                onClick={() => {
                                  removeIngredientLine(activeLocale, item.id, idx, list);
                                  window.setTimeout(() => saveWhenDirty(), 0);
                                }}
                                style={{ cursor: "pointer" }}
                              >
                                {t("admin.translations.ingredientRemove")}
                              </button>
                            </div>
                          ));
                        })()}
                      </div>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => {
                          addIngredientLine(activeLocale, item.id);
                          window.setTimeout(() => saveWhenDirty(), 0);
                        }}
                        style={{ cursor: "pointer", justifySelf: "start" }}
                      >
                        {t("admin.translations.ingredientAdd")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        </div>

        {dotykackaGroupsMergedForEditor.length > 0 ? (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>{t("admin.translations.addonsTitle")}</h2>
            <p className="textMuted2" style={{ margin: "0 0 12px", lineHeight: 1.55 }}>
              {t("admin.translations.addonsHint", { locale: activeLocale })}
              {activeLocale === "cs" ? t("admin.translations.addonsHintCs") : null}
            </p>
            <div style={{ display: "grid", gap: 14 }}>
              {dotykackaGroupsMergedForEditor.map((g) => (
                <div key={g.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                  <div className="textMuted2" style={{ fontSize: 13, marginBottom: 4 }}>
                    {t("admin.translations.groupId", {
                      id: g.merged
                        ? `${g.id}${t("admin.translations.groupMerged", { ids: g.aliasIds.filter((x) => x !== g.id).join(", ") })}`
                        : g.id,
                    })}
                  </div>
                  <div className="textMuted2" style={{ fontSize: 12, marginBottom: 6, lineHeight: 1.45 }}>
                    {t("admin.translations.csInDotyka")} <strong>{g.label.trim() ? g.label : "—"}</strong>
                  </div>
                  {g.usedBy.length > 0 ? (
                    <div className="textMuted2" style={{ fontSize: 12, marginBottom: 8, lineHeight: 1.45 }}>
                      {t("admin.translations.usedBy")}{" "}
                      <strong>
                        {g.usedBy.length <= 6
                          ? g.usedBy.join(", ")
                          : `${g.usedBy.slice(0, 6).join(", ")}${t("admin.translations.usedByMore", { count: g.usedBy.length - 6 })}`}
                      </strong>
                    </div>
                  ) : null}
                  <input
                    className="chip"
                    value={getMergedDotykackaGroupLabel(dotykackaLabelsByLocale[activeLocale]?.groups, g)}
                    onChange={(e) => setDotykackaGroupLabel(activeLocale, g, e.target.value)}
                    onBlur={saveOnBlur}
                    placeholder={g.label || t("admin.translations.groupPlaceholder")}
                    style={{ padding: "10px 12px", width: "100%", boxSizing: "border-box" }}
                    autoComplete="off"
                  />
                  {g.options.length > 0 ? (
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {g.options.map((o) => (
                        <div key={o.id} style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
                          <span className="textMuted2" style={{ fontSize: 13 }}>
                            {t("admin.translations.optionId", { id: o.id })}
                          </span>
                          <input
                            className="chip"
                            value={(dotykackaLabelsByLocale[activeLocale]?.options ?? {})[o.id] ?? ""}
                            onChange={(e) => setDotykackaOptionLabel(activeLocale, o.id, e.target.value)}
                            onBlur={saveOnBlur}
                            placeholder={o.label || t("admin.translations.optionPlaceholder")}
                            style={{ padding: "10px 12px", width: "100%", boxSizing: "border-box" }}
                            autoComplete="off"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
