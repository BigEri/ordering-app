"use client";

import * as React from "react";

import { FilePickButton } from "../../components/FilePickButton";
import { KioskAnchor } from "../../components/kiosk/KioskAnchor";

import { MenuItemOrderModal } from "../../components/MenuItemOrderModal";
import { MenuItem, type MenuItemData } from "../../components/MenuItem";
import type { DotykackaMenuSection } from "../../lib/dotykacka/dotykackaMenuSections";
import { applyMenuOverrides } from "../../lib/menu/applyMenuOverrides";
import { applyMenuIngredientOverrides } from "../../lib/menu/applyMenuIngredientOverrides";
import { applyMenuTextOverrides } from "../../lib/menu/applyMenuTextOverrides";
import { menuSectionCategoryKey } from "../../lib/menu/menuSectionKey";
import type { MenuOverridesPayload } from "../../lib/server/menuOverridesRead";
import type { MenuTextOverridesForLocale } from "../../lib/menu/menuTextOverridesTypes";
import type { MenuIngredientOverridesForLocale } from "../../lib/menu/menuIngredientOverridesTypes";
import { usePosTableFields } from "../../components/DeviceTableProvider";
import { useLanguage } from "../../components/LanguageProvider";
import { useMenuCart, type MenuCartState } from "../../components/MenuCartProvider";
import { useOrders } from "../../components/OrdersProvider";
import {
  buildDotykackaPosCustomizations,
  makeMenuCartLineKey,
} from "../../lib/menu/dotykackaLine";
import { buildOrderLineName, menuCartLineToSnapshot, orderLineUnitPriceCzk } from "../../lib/menu/orderLineLabel";
import { clearPendingOrderConfirmed, hasPendingOrderConfirmed, POS_QUEUE_ORDER_SENT } from "../../lib/pos/pendingPosQueue";
import { postPosJsonResilient } from "../../lib/pos/postPosJsonResilient";
import { buildDotykackaCustomizationAliasIndex, resolveDotykackaGroupLabel } from "../../lib/menu/dotykackaLabelMerge";
import { publicMenuUrlFromAdmin } from "../../lib/admin/publicMenuPreviewUrl";
import { useMenuIdleRedirect } from "../../hooks/useMenuIdleRedirect";
import { useBrowserOnline } from "../../components/OnlineBanner";

function formatCzk(value: number) {
  return `${value} Kč`;
}

function sectionHeading(sec: DotykackaMenuSection, t: (key: string) => string): string {
  if (sec.labelKey) {
    if (sec.name.trim()) return sec.name;
    return t(`menu.category.${sec.labelKey}`);
  }
  return sec.name;
}

/** Bezpečné `id` pro kotvu a scroll-spy (klíč kategorie z Dotykačky). */
function menuSectionDomId(catKey: string): string {
  const safe = catKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `menu-section-${safe}`;
}

type MenuBrowseClientProps = {
  sections: DotykackaMenuSection[];
  loadError: string | null;
  restaurantName: string;
  /** Jednoznačná provozovna pro úpravy / hosty (null jen při více provozovnách bez výběru kontextu). */
  restaurantId: string | null;
  /** `guest` = jen náhled pro zákazníky; `editor` = nástroje úprav (stránka /admin/menu). */
  menuVariant?: "guest" | "editor";
  /** SSR z `/menu` — skryté položky a pořadí bez čekání na `/api/menu/overrides`. */
  initialMenuOverrides?: MenuOverridesPayload;
  /** SSR překlady / ingredience / Dotyka labels — bez druhého vykreslení menu. */
  initialMenuUi?: {
    locale: string;
    text: MenuTextOverridesForLocale;
    ingredients: MenuIngredientOverridesForLocale;
    dotykacka: DotykackaLabelOverrides | null;
  };
  /** Náhled z administrace (`/menu?from=admin`) — zobrazit návrat do admin sekce. */
  adminPreview?: boolean;
};

type EditorStatus = { canEdit: boolean; reason?: string };

type DotykackaLabelOverrides = { groups: Record<string, string>; options: Record<string, string> };

function applyDotykackaLabelOverridesToItem(
  item: MenuItemData,
  ov: DotykackaLabelOverrides | null,
  aliasIndex: Map<string, string[]>,
): MenuItemData {
  if (!ov) return item;
  const groups = item.dotykackaCustomizationGroups;
  if (!groups || groups.length === 0) return item;
  const mapped = groups.map((g) => {
    const gid = String(g.customizationId ?? "").trim();
    const resolved = gid ? resolveDotykackaGroupLabel(ov.groups, gid, aliasIndex) : undefined;
    const sectionLabel = resolved ?? g.sectionLabel;
    const options = (g.options ?? []).map((o) => {
      const oid = String(o.productId ?? "").trim();
      const label = oid && ov.options[oid] ? ov.options[oid]! : o.label;
      return label === o.label ? o : { ...o, label };
    });
    const optionsChanged = (g.options ?? []).some((o, i) => options[i] !== o);
    return sectionLabel === g.sectionLabel && !optionsChanged ? g : { ...g, sectionLabel, options };
  });
  const groupsChanged = groups.some((g, i) => mapped[i] !== g);
  return groupsChanged ? { ...item, dotykackaCustomizationGroups: mapped } : item;
}

export function MenuBrowseClient({
  sections,
  loadError,
  restaurantName,
  restaurantId,
  menuVariant = "guest",
  initialMenuOverrides,
  initialMenuUi,
  adminPreview = false,
}: MenuBrowseClientProps) {
  useMenuIdleRedirect();
  const online = useBrowserOnline();
  const {
    posTableFields,
    tableLabel: tableLabelDisplay,
    pairingCode,
    pairingExpiresAtIso,
    needsPairing,
  } = usePosTableFields();
  const { locale, t } = useLanguage();
  const menuLocale = (locale === "cs" || locale === "en" || locale === "ko" ? locale : "cs") as "cs" | "en" | "ko";
  const [added, setAdded] = React.useState<string | null>(null);
  const { cart, setCart } = useMenuCart();
  // Pravý sloupec košíku držíme otevřený, ať je pořád vidět, co se bude objednávat.
  const [cartOpen, setCartOpen] = React.useState(true);
  const [orderConfirmedOpen, setOrderConfirmedOpen] = React.useState(false);
  const [orderPosErrorKey, setOrderPosErrorKey] = React.useState<string | null>(null);
  /** Doplňující text ze serveru (např. chyba Dotykačky), zobrazí se pod překladem `orderPosErrorKey`. */
  const [orderPosErrorDetail, setOrderPosErrorDetail] = React.useState<string | null>(null);
  const [orderConfirmLoading, setOrderConfirmLoading] = React.useState(false);
  const [cartPendingModal, setCartPendingModal] = React.useState<MenuCartState | null>(null);
  const [customizeItem, setCustomizeItem] = React.useState<MenuItemData | null>(null);
  const orderPosErrRef = React.useRef<string | null>(null);
  const hasPendingOrderRef = React.useRef(false);
  const cartRef = React.useRef<HTMLElement | null>(null);
  const { addOrder } = useOrders();

  const [overrides, setOverrides] = React.useState<MenuOverridesPayload>(() =>
    initialMenuOverrides ?? {
      images: {},
      orderByCategory: {},
      hiddenItemIds: [],
      hiddenCategoryKeys: [],
    },
  );
  const hiddenSet = React.useMemo(() => new Set<string>(overrides.hiddenItemIds ?? []), [overrides.hiddenItemIds]);
  const hiddenCategorySet = React.useMemo(
    () => new Set<string>(overrides.hiddenCategoryKeys ?? []),
    [overrides.hiddenCategoryKeys],
  );
  const [textOverrides, setTextOverrides] = React.useState<MenuTextOverridesForLocale>(
    () => initialMenuUi?.text ?? { items: {}, categories: {} },
  );
  const [ingredientOverrides, setIngredientOverrides] = React.useState<MenuIngredientOverridesForLocale>(
    () => initialMenuUi?.ingredients ?? { items: {} },
  );
  const [dotykackaLabelOverrides, setDotykackaLabelOverrides] = React.useState<DotykackaLabelOverrides | null>(
    () => initialMenuUi?.dotykacka ?? null,
  );
  const initialMenuUiLocale = initialMenuUi?.locale ?? null;
  const dotykackaCustomizationAliasIndex = React.useMemo(
    () => buildDotykackaCustomizationAliasIndex(sections),
    [sections],
  );
  const [editorStatus, setEditorStatus] = React.useState<EditorStatus | null>(null);
  const [photoModal, setPhotoModal] = React.useState<MenuItemData | null>(null);
  const [photoUrlDraft, setPhotoUrlDraft] = React.useState("");
  const [photoSaving, setPhotoSaving] = React.useState(false);
  const [photoUploading, setPhotoUploading] = React.useState(false);
  const [photoUploadErr, setPhotoUploadErr] = React.useState<string | null>(null);
  const [menuEditorErr, setMenuEditorErr] = React.useState<string | null>(null);
  const [menuImagesHealthErr, setMenuImagesHealthErr] = React.useState<string | null>(null);
  const [brokenMenuImageUrls, setBrokenMenuImageUrls] = React.useState<Array<{ url: string; status?: number; reason?: string }>>([]);
  const [menuImagesHealthCheckedAtIso, setMenuImagesHealthCheckedAtIso] = React.useState<string | null>(null);
  const [menuImagesHealthCheckedCount, setMenuImagesHealthCheckedCount] = React.useState<number | null>(null);
  const [orderSavingKey, setOrderSavingKey] = React.useState<string | null>(null);
  const [activeCategoryKey, setActiveCategoryKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!restaurantId) return;
    // `/menu` already fetched overrides on the server; avoid a duplicate no-store request on first paint.
    if (initialMenuOverrides) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/menu/overrides?restaurantId=${encodeURIComponent(restaurantId)}`, { cache: "no-store" });
        const j = (await r.json()) as {
          ok?: boolean;
          images?: Record<string, string>;
          orderByCategory?: Record<string, string[]>;
          hiddenItemIds?: string[];
          hiddenCategoryKeys?: string[];
        };
        if (cancelled || !r.ok || !j.ok) return;
        setOverrides({
          images: j.images ?? {},
          orderByCategory: j.orderByCategory ?? {},
          hiddenItemIds: Array.isArray(j.hiddenItemIds) ? j.hiddenItemIds : [],
          hiddenCategoryKeys: Array.isArray(j.hiddenCategoryKeys) ? j.hiddenCategoryKeys : [],
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, initialMenuOverrides]);

  React.useEffect(() => {
    if (initialMenuOverrides) setOverrides(initialMenuOverrides);
  }, [initialMenuOverrides]);

  React.useEffect(() => {
    if (!restaurantId) {
      setTextOverrides({ items: {}, categories: {} });
      setIngredientOverrides({ items: {} });
      setDotykackaLabelOverrides(null);
      return;
    }
    if (initialMenuUi && menuLocale === initialMenuUiLocale) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/menu/ui-overrides?locale=${encodeURIComponent(menuLocale)}`, { cache: "no-store" });
        const j = (await r.json()) as {
          ok?: boolean;
          text?: { items?: Record<string, { name?: string; description?: string }>; categories?: Record<string, { name?: string }> };
          ingredients?: { items?: Record<string, unknown> };
          dotykacka?: { groups?: Record<string, string>; options?: Record<string, string> };
        };
        if (cancelled || !r.ok || !j.ok) return;
        setTextOverrides({
          items: j.text?.items ?? {},
          categories: j.text?.categories ?? {},
        });
        setIngredientOverrides({ items: (j.ingredients?.items ?? {}) as Record<string, any> });
        setDotykackaLabelOverrides({ groups: j.dotykacka?.groups ?? {}, options: j.dotykacka?.options ?? {} });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [menuLocale, restaurantId, initialMenuUi, initialMenuUiLocale]);

  React.useEffect(() => {
    if (menuVariant !== "editor" || !restaurantId) {
      setEditorStatus(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/admin/menu/editor-status?restaurantId=${encodeURIComponent(restaurantId)}`, { cache: "no-store" });
        const j = (await r.json()) as { ok?: boolean; canEdit?: boolean; reason?: string };
        if (cancelled) return;
        if (!r.ok) {
          setEditorStatus({ canEdit: false });
          return;
        }
        setEditorStatus({ canEdit: Boolean(j.canEdit), reason: j.reason });
      } catch {
        if (!cancelled) setEditorStatus({ canEdit: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [menuVariant, restaurantId]);

  const canEditMenu = menuVariant === "editor" && Boolean(restaurantId && editorStatus?.canEdit);

  React.useEffect(() => {
    if (menuVariant !== "editor" || !restaurantId || !editorStatus) return;
    if (!editorStatus.canEdit) return;
    let cancelled = false;
    void (async () => {
      setMenuImagesHealthErr(null);
      try {
        const r = await fetch(`/api/admin/menu/images-health?restaurantId=${encodeURIComponent(restaurantId)}`, { cache: "no-store" });
        const j = (await r.json()) as {
          ok?: boolean;
          broken?: Array<{ url?: string; status?: number; reason?: string }>;
          checkedCount?: number;
          error?: string;
        };
        if (cancelled) return;
        if (!r.ok || !j.ok) {
          setMenuImagesHealthErr(j.error ?? "Nelze ověřit externí URL obrázků v menu.");
          setBrokenMenuImageUrls([]);
          setMenuImagesHealthCheckedAtIso(new Date().toISOString());
          setMenuImagesHealthCheckedCount(null);
          return;
        }
        const broken = Array.isArray(j.broken)
          ? j.broken
              .map((x) => ({ url: String(x.url ?? ""), status: x.status, reason: x.reason }))
              .filter((x) => x.url)
          : [];
        setBrokenMenuImageUrls(broken);
        setMenuImagesHealthCheckedAtIso(new Date().toISOString());
        setMenuImagesHealthCheckedCount(typeof j.checkedCount === "number" ? j.checkedCount : null);
      } catch {
        if (cancelled) return;
        setMenuImagesHealthErr("Nepodařilo se ověřit externí odkazy na obrázky (zřejmě výpadek připojení).");
        setBrokenMenuImageUrls([]);
        setMenuImagesHealthCheckedAtIso(new Date().toISOString());
        setMenuImagesHealthCheckedCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [menuVariant, restaurantId, editorStatus]);

  const displaySections = React.useMemo(() => {
    const base = !restaurantId ? sections : applyMenuOverrides(sections, overrides.images, overrides.orderByCategory);
    if (!restaurantId) return base;
    const withText = applyMenuTextOverrides(base, textOverrides);
    const withIngredients = applyMenuIngredientOverrides(withText, ingredientOverrides);
    const shouldHide = menuVariant !== "editor" || !canEditMenu;
    if (!shouldHide) return withIngredients;
    // Host menu: sekce už přišly odfiltrované ze serveru; znovu nefiltrovat (hydratace = stejný DOM).
    if (menuVariant === "guest") return withIngredients;
    // Editor: dokud se načítá oprávnění, držíme stejný výřez jako host (bez přidání skrytých položek).
    if (editorStatus === null) {
      if (hiddenSet.size === 0 && hiddenCategorySet.size === 0) return withIngredients;
      return withIngredients
        .filter((sec) => !hiddenCategorySet.has(menuSectionCategoryKey(sec)))
        .map((sec) => ({ ...sec, items: sec.items.filter((it) => !hiddenSet.has(it.id)) }))
        .filter((sec) => sec.items.length > 0);
    }
    // V editoru mimo edit mód skryjeme položky, které admin označil jako hidden.
    if (hiddenSet.size === 0 && hiddenCategorySet.size === 0) return withIngredients;
    return withIngredients
      .filter((sec) => !hiddenCategorySet.has(menuSectionCategoryKey(sec)))
      .map((sec) => ({ ...sec, items: sec.items.filter((it) => !hiddenSet.has(it.id)) }))
      .filter((sec) => sec.items.length > 0);
  }, [
    sections,
    restaurantId,
    overrides,
    textOverrides,
    ingredientOverrides,
    menuVariant,
    canEditMenu,
    hiddenSet,
    hiddenCategorySet,
    editorStatus,
  ]);

  const setHidden = React.useCallback(
    async (menuItemId: string, hidden: boolean) => {
      if (!restaurantId || !canEditMenu) return;
      setMenuEditorErr(null);
      // Optimistic.
      setOverrides((o) => {
        const prev = new Set<string>(Array.isArray(o.hiddenItemIds) ? o.hiddenItemIds : []);
        if (hidden) prev.add(menuItemId);
        else prev.delete(menuItemId);
        return { ...o, hiddenItemIds: [...prev] };
      });
      try {
        const r = await fetch("/api/admin/menu/item-visibility", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ restaurantId, menuItemId, hidden }),
        });
        const j = (await r.json()) as { ok?: boolean; error?: string };
        if (!r.ok || !j.ok) {
          setMenuEditorErr(j.error ?? "Uložení viditelnosti selhalo.");
          // Re-sync from server.
          const rr = await fetch(`/api/menu/overrides?restaurantId=${encodeURIComponent(restaurantId)}`, { cache: "no-store" });
          const jo = (await rr.json()) as {
            ok?: boolean;
            images?: Record<string, string>;
            orderByCategory?: Record<string, string[]>;
            hiddenItemIds?: string[];
            hiddenCategoryKeys?: string[];
          };
          if (rr.ok && jo.ok) {
            setOverrides({
              images: jo.images ?? {},
              orderByCategory: jo.orderByCategory ?? {},
              hiddenItemIds: Array.isArray(jo.hiddenItemIds) ? jo.hiddenItemIds : [],
              hiddenCategoryKeys: Array.isArray(jo.hiddenCategoryKeys) ? jo.hiddenCategoryKeys : [],
            });
          }
        }
      } catch {
        setMenuEditorErr("Nepodařilo se uložit změnu (zřejmě výpadek připojení). Zkuste to prosím znovu.");
      }
    },
    [restaurantId, canEditMenu],
  );

  const setCategoryHidden = React.useCallback(
    async (categoryKey: string, hidden: boolean) => {
      if (!restaurantId || !canEditMenu) return;
      setMenuEditorErr(null);
      setOverrides((o) => {
        const prev = new Set<string>(Array.isArray(o.hiddenCategoryKeys) ? o.hiddenCategoryKeys : []);
        if (hidden) prev.add(categoryKey);
        else prev.delete(categoryKey);
        return { ...o, hiddenCategoryKeys: [...prev] };
      });
      try {
        const r = await fetch("/api/admin/menu/category-visibility", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ restaurantId, categoryKey, hidden }),
        });
        const j = (await r.json()) as { ok?: boolean; error?: string };
        if (!r.ok || !j.ok) {
          setMenuEditorErr(j.error ?? "Uložení viditelnosti kategorie selhalo.");
          const rr = await fetch(`/api/menu/overrides?restaurantId=${encodeURIComponent(restaurantId)}`, { cache: "no-store" });
          const jo = (await rr.json()) as {
            ok?: boolean;
            images?: Record<string, string>;
            orderByCategory?: Record<string, string[]>;
            hiddenItemIds?: string[];
            hiddenCategoryKeys?: string[];
          };
          if (rr.ok && jo.ok) {
            setOverrides({
              images: jo.images ?? {},
              orderByCategory: jo.orderByCategory ?? {},
              hiddenItemIds: Array.isArray(jo.hiddenItemIds) ? jo.hiddenItemIds : [],
              hiddenCategoryKeys: Array.isArray(jo.hiddenCategoryKeys) ? jo.hiddenCategoryKeys : [],
            });
          }
        }
      } catch {
        setMenuEditorErr("Nepodařilo se uložit změnu (zřejmě výpadek připojení). Zkuste to prosím znovu.");
      }
    },
    [restaurantId, canEditMenu],
  );

  const categoryKeys = React.useMemo(
    () => displaySections.map((s) => menuSectionCategoryKey(s)),
    [displaySections],
  );

  const scrollToCategory = React.useCallback((catKey: string) => {
    const el = document.getElementById(menuSectionDomId(catKey));
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveCategoryKey(catKey);
  }, []);

  React.useEffect(() => {
    if (categoryKeys.length === 0) {
      setActiveCategoryKey(null);
      return;
    }
    setActiveCategoryKey((prev) => (prev && categoryKeys.includes(prev) ? prev : categoryKeys[0]!));
  }, [categoryKeys]);

  React.useEffect(() => {
    if (categoryKeys.length === 0) return;
    const onScroll = () => {
      const anchorY = window.scrollY + 112;
      let current = categoryKeys[0]!;
      for (const k of categoryKeys) {
        const el = document.getElementById(menuSectionDomId(k));
        if (!el) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top <= anchorY) current = k;
      }
      setActiveCategoryKey(current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [categoryKeys]);

  const persistOrder = React.useCallback(
    async (categoryKey: string, orderedMenuItemIds: string[]) => {
      if (!restaurantId) return false;
      setOrderSavingKey(categoryKey);
      setMenuEditorErr(null);
      try {
        const r = await fetch("/api/admin/menu/item-order", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ restaurantId, categoryKey, orderedMenuItemIds }),
        });
        const j = (await r.json()) as { ok?: boolean };
        if (!r.ok || !j.ok) {
          setMenuEditorErr("Pořadí se nepodařilo uložit.");
          return false;
        }
        return true;
      } catch {
        setMenuEditorErr("Pořadí se nepodařilo uložit (zřejmě výpadek připojení). Zkuste to prosím znovu.");
        return false;
      } finally {
        setOrderSavingKey(null);
      }
    },
    [restaurantId],
  );

  const moveItem = React.useCallback(
    async (categoryKey: string, itemId: string, dir: -1 | 1) => {
      if (menuVariant !== "editor" || !canEditMenu) return;
      const sec = displaySections.find((s) => menuSectionCategoryKey(s) === categoryKey);
      if (!sec) return;
      const idx = sec.items.findIndex((i) => i.id === itemId);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= sec.items.length) return;
      const nextItems = [...sec.items];
      const t = nextItems[idx]!;
      nextItems[idx] = nextItems[j]!;
      nextItems[j] = t;
      const orderedMenuItemIds = nextItems.map((i) => i.id);
      setOverrides((o) => ({
        ...o,
        orderByCategory: { ...o.orderByCategory, [categoryKey]: orderedMenuItemIds },
      }));
      const ok = await persistOrder(categoryKey, orderedMenuItemIds);
      if (!ok && restaurantId) {
        try {
          const r = await fetch(`/api/menu/overrides?restaurantId=${encodeURIComponent(restaurantId)}`, { cache: "no-store" });
          const jso = (await r.json()) as {
            ok?: boolean;
            images?: Record<string, string>;
            orderByCategory?: Record<string, string[]>;
            hiddenItemIds?: string[];
            hiddenCategoryKeys?: string[];
          };
          if (r.ok && jso.ok) {
            setOverrides({
              images: jso.images ?? {},
              orderByCategory: jso.orderByCategory ?? {},
              hiddenItemIds: Array.isArray(jso.hiddenItemIds) ? jso.hiddenItemIds : [],
              hiddenCategoryKeys: Array.isArray(jso.hiddenCategoryKeys) ? jso.hiddenCategoryKeys : [],
            });
          }
        } catch {
          /* ignore */
        }
      }
    },
    [menuVariant, canEditMenu, displaySections, persistOrder, restaurantId],
  );

  const savePhotoUrl = React.useCallback(async () => {
    if (!restaurantId || !photoModal) return;
    const trimmed = photoUrlDraft.trim();
    const imageUrl = trimmed === "" ? null : trimmed;
    setPhotoSaving(true);
    setMenuEditorErr(null);
    try {
      const r = await fetch("/api/admin/menu/item-image", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ restaurantId, menuItemId: photoModal.id, imageUrl }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setMenuEditorErr(j.error ?? "Fotku se nepodařilo uložit.");
        return;
      }
      setOverrides((o) => {
        const images = { ...o.images };
        if (imageUrl == null) delete images[photoModal.id];
        else images[photoModal.id] = imageUrl;
        return { ...o, images };
      });
      setPhotoModal(null);
    } catch {
      setMenuEditorErr("Fotku se nepodařilo uložit (zřejmě výpadek připojení). Zkuste to prosím znovu.");
    } finally {
      setPhotoSaving(false);
    }
  }, [restaurantId, photoModal, photoUrlDraft]);

  const deletePhoto = React.useCallback(async () => {
    if (!restaurantId || !photoModal) return;
    setPhotoSaving(true);
    setMenuEditorErr(null);
    try {
      const r = await fetch("/api/admin/menu/item-image", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ restaurantId, menuItemId: photoModal.id, imageUrl: null }),
      });
      const j = (await r.json()) as { ok?: boolean };
      if (!r.ok || !j.ok) {
        setMenuEditorErr("Fotku se nepodařilo odstranit.");
        return;
      }
      setOverrides((o) => {
        const images = { ...o.images };
        delete images[photoModal.id];
        return { ...o, images };
      });
      setPhotoModal(null);
    } catch {
      setMenuEditorErr("Fotku se nepodařilo odstranit (zřejmě výpadek připojení). Zkuste to prosím znovu.");
    } finally {
      setPhotoSaving(false);
    }
  }, [restaurantId, photoModal]);

  const uploadMenuPhotoFile = React.useCallback(
    async (file: File) => {
      if (!restaurantId || !photoModal) return;
      setPhotoUploading(true);
      setMenuEditorErr(null);
      setPhotoUploadErr(null);
      try {
        const fd = new FormData();
        fd.set("restaurantId", restaurantId);
        fd.set("menuItemId", photoModal.id);
        fd.set("file", file);
        const r = await fetch("/api/admin/menu/item-image/upload", {
          method: "POST",
          body: fd,
          credentials: "same-origin",
        });
        const j = (await r.json()) as { ok?: boolean; imageUrl?: string; error?: string };
        if (!r.ok || !j.ok || !j.imageUrl) {
          const msg = j.error ?? "Nahrání fotky se nezdařilo.";
          setMenuEditorErr(msg);
          setPhotoUploadErr(msg);
          return;
        }
        setOverrides((o) => ({ ...o, images: { ...o.images, [photoModal.id]: j.imageUrl! } }));
        setPhotoUrlDraft(j.imageUrl);
        setPhotoUploadErr(null);
        setPhotoModal(null);
      } catch {
        const msg = "Nahrání se nezdařilo (zřejmě výpadek připojení). Zkuste to prosím znovu.";
        setMenuEditorErr(msg);
        setPhotoUploadErr(msg);
      } finally {
        setPhotoUploading(false);
      }
    },
    [restaurantId, photoModal],
  );

  React.useEffect(() => {
    orderPosErrRef.current = orderPosErrorKey;
  }, [orderPosErrorKey]);

  const syncPendingFromIdb = React.useCallback(() => {
    void hasPendingOrderConfirmed().then((v) => {
      hasPendingOrderRef.current = v;
    });
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void hasPendingOrderConfirmed().then((v) => {
      if (!cancelled) hasPendingOrderRef.current = v;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyCart = React.useCallback(
    (action: React.SetStateAction<MenuCartState>, opts?: { skipPendingGuard?: boolean }) => {
      if (opts?.skipPendingGuard) {
        setCart(action);
        return;
      }
      setCart((prev) => {
        const next = typeof action === "function" ? (action as (p: MenuCartState) => MenuCartState)(prev) : action;
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;

        const guard = orderPosErrRef.current === "pos.error.queued" || hasPendingOrderRef.current;
        if (!guard) return next;

        setCartPendingModal(next);
        return prev;
      });
    },
    [setCart],
  );

  const cartEntries = React.useMemo(() => Object.entries(cart), [cart]);
  const hasCart = cartEntries.length > 0;

  const cartTotal = React.useMemo(
    () =>
      cartEntries.reduce(
        (sum, [, l]) => sum + l.qty * orderLineUnitPriceCzk(menuCartLineToSnapshot(l)),
        0,
      ),
    [cartEntries],
  );

  const cartBadgeCount = React.useMemo(
    () => cartEntries.reduce((sum, [, l]) => sum + l.qty, 0),
    [cartEntries],
  );

  const addToCartDirect = React.useCallback(
    (
      item: MenuItemData,
      opts?: { dotykackaPicks?: Record<string, string[]>; excludedIngredients?: string[] },
    ) => {
      const picks = opts?.dotykackaPicks;
      const excluded = opts?.excludedIngredients ?? [];
      const key = makeMenuCartLineKey(item.id, picks, excluded);
      setAdded(item.id);
      window.setTimeout(() => setAdded(null), 400);
      applyCart((prev) => {
        const existing = prev[key];
        return {
          ...prev,
          [key]: {
            item,
            excludedIngredients: existing?.excludedIngredients ?? excluded,
            selectedAddonIds: existing?.selectedAddonIds ?? [],
            dotykackaPicks:
              existing?.dotykackaPicks ??
              (picks && Object.keys(picks).length > 0 ? picks : undefined),
            qty: (existing?.qty ?? 0) + 1,
          },
        };
      });
      setCartOpen(true);
    },
    [applyCart],
  );

  const openMenuItem = React.useCallback(
    (item: MenuItemData) => {
      setCustomizeItem(
        applyDotykackaLabelOverridesToItem(item, dotykackaLabelOverrides, dotykackaCustomizationAliasIndex),
      );
    },
    [dotykackaCustomizationAliasIndex, dotykackaLabelOverrides],
  );

  const confirmOrder = React.useCallback(async () => {
    if (cartEntries.length === 0) return;

    setOrderPosErrorKey(null);
    setOrderPosErrorDetail(null);

    const linesBase = cartEntries.map(([, l]) => {
      const snap = menuCartLineToSnapshot(l);
      return {
        l,
        unitPriceCzk: orderLineUnitPriceCzk(snap),
      };
    });

    const linesStore = linesBase.map(({ l, unitPriceCzk }) => {
      const snap = menuCartLineToSnapshot(l);
      return {
        name: buildOrderLineName(snap, locale),
        qty: l.qty,
        unitPriceCzk,
        snapshot: snap,
      };
    });

    const totalCzk = linesStore.reduce((sum, line) => sum + line.qty * line.unitPriceCzk, 0);

    if (adminPreview) {
      addOrder({ lines: linesStore, totalCzk });
      applyCart(() => ({}), { skipPendingGuard: true });
      setCartOpen(false);
      setOrderConfirmedOpen(true);
      return;
    }

    const fields = posTableFields();
    if (!/^\d+$/.test(String(fields.tableId ?? "").trim())) {
      setOrderPosErrorKey("pos.error.tableId");
      return;
    }

    const linesPos = linesBase.map(({ l, unitPriceCzk }) => {
      const snap = menuCartLineToSnapshot(l);
      const dk = buildDotykackaPosCustomizations(l.item, l.dotykackaPicks);
      return {
        name: buildOrderLineName(snap, "cs"),
        qty: l.qty,
        unitPriceCzk,
        menuItemId: l.item.id,
        ...(dk.length > 0 ? { dotykackaCustomizations: dk } : {}),
      };
    });

    if (linesPos.some((x) => !x.menuItemId || typeof x.menuItemId !== "string" || !x.menuItemId.trim())) {
      setOrderPosErrorKey("pos.error.http");
      setOrderPosErrorDetail(null);
      return;
    }

    const totalCzkPos = linesPos.reduce((sum, line) => sum + line.qty * line.unitPriceCzk, 0);

    setOrderConfirmLoading(true);
    try {
      const r = await postPosJsonResilient(
        "/api/pos/order-confirmed",
        {
          ...fields,
          ...(restaurantId ? { restaurantId } : {}),
          lines: linesPos,
          totalCzk: totalCzkPos,
        },
        { clientOrderSnapshot: { lines: linesStore, totalCzk: totalCzkPos } },
      );

      if (r.ok) {
        addOrder({ lines: linesStore, totalCzk: totalCzkPos });
        hasPendingOrderRef.current = false;
        applyCart(() => ({}), { skipPendingGuard: true });
        syncPendingFromIdb();
        setCartOpen(false);
        setOrderConfirmedOpen(true);
        return;
      }
      if (r.kind === "queued") {
        hasPendingOrderRef.current = true;
        setOrderPosErrorKey("pos.error.queued");
        setOrderPosErrorDetail(null);
        return;
      }
      if (r.kind === "network") {
        setOrderPosErrorKey("pos.error.network");
        setOrderPosErrorDetail(null);
        return;
      }
      setOrderPosErrorKey("pos.error.http");
      setOrderPosErrorDetail(r.kind === "http" && r.detail ? r.detail : null);
    } finally {
      setOrderConfirmLoading(false);
    }
  }, [adminPreview, applyCart, cartEntries, addOrder, locale, posTableFields, restaurantId, syncPendingFromIdb]);

  React.useEffect(() => {
    const onQueueSent = (e: Event) => {
      const d = (e as CustomEvent<{ lines: { name: string; qty: number; unitPriceCzk: number }[]; totalCzk: number }>)
        .detail;
      if (!d?.lines) return;
      addOrder({ lines: d.lines, totalCzk: d.totalCzk });
      hasPendingOrderRef.current = false;
      applyCart(() => ({}), { skipPendingGuard: true });
      syncPendingFromIdb();
      setCartOpen(true);
      setOrderConfirmedOpen(true);
      setOrderPosErrorKey(null);
      setOrderPosErrorDetail(null);
    };
    window.addEventListener(POS_QUEUE_ORDER_SENT, onQueueSent as EventListener);
    return () => window.removeEventListener(POS_QUEUE_ORDER_SENT, onQueueSent as EventListener);
  }, [addOrder, applyCart, syncPendingFromIdb]);

  React.useEffect(() => {
    if (cartEntries.length === 0) {
      setOrderPosErrorKey(null);
      setOrderPosErrorDetail(null);
    }
  }, [cartEntries.length]);

  React.useEffect(() => {
    if (!orderConfirmedOpen) return;
    const t = window.setTimeout(() => setOrderConfirmedOpen(false), 5000);
    return () => window.clearTimeout(t);
  }, [orderConfirmedOpen]);

  React.useEffect(() => {
    if (!hasCart) setCartOpen(true);
  }, [hasCart]);

  React.useEffect(() => {
    // už nezavíráme klikem mimo – košík je permanentní sidebar
    return;
  }, [cartOpen]);

  if (menuVariant === "guest" && needsPairing && !adminPreview) {
    return (
      <main style={{ maxWidth: 720, margin: "36px auto", padding: "0 20px" }}>
        <h1 style={{ fontSize: "1.35rem", marginBottom: 8 }}>{restaurantName}</h1>
        <p style={{ lineHeight: 1.55, opacity: 0.9, marginBottom: 18 }}>
          Tablet ještě není spárovaný se stolem. Pro zobrazení menu ho nejdřív propojte v administraci.
        </p>

        <section
          role="status"
          style={{
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid rgba(96,165,250,0.35)",
            background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.12))",
          }}
        >
          <strong style={{ display: "block", marginBottom: 8 }}>Párovací kód</strong>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <code
              style={{
                fontSize: "1.4em",
                fontWeight: 800,
                letterSpacing: "0.14em",
                padding: "6px 10px",
                borderRadius: 10,
                background: "rgba(0,0,0,0.25)",
              }}
            >
              {pairingCode ?? "—"}
            </code>
            {pairingExpiresAtIso ? (
              <span style={{ opacity: 0.85, fontSize: 13 }}>
                Platnost do {new Date(pairingExpiresAtIso).toLocaleString("cs-CZ")}
              </span>
            ) : null}
          </div>
          <p style={{ margin: "12px 0 0", lineHeight: 1.5, opacity: 0.9 }}>
            Personál: přihlaste se do administrace a otevřete <strong>Zařízení → Párování u stolů</strong>.
          </p>
          <div style={{ marginTop: 10 }}>
            <KioskAnchor href="/admin/login" style={{ textDecoration: "underline", fontWeight: 600 }}>
              Přihlásit se (personál) →
            </KioskAnchor>
          </div>
        </section>
      </main>
    );
  }

  const showCategoryNav = categoryKeys.length > 0;
  const gridClass = showCategoryNav ? " menuPageGrid--withCategoryNav" : " menuPageGrid--twoCol";

  return (
    <main
      className={`menuPage menuPageGrid${gridClass}${adminPreview ? " menuPageGrid--adminPreview" : ""}${online ? "" : " menuPage--offline"}`}
    >
      {showCategoryNav ? (
        <nav className="menuPageNavCol sideNav" aria-label={t("menu.sideNav.aria")}>
          <div className="sideNavHeader">
            <span className="sideNavKicker">{t("menu.sideNav.sub")}</span>
          </div>
          <div className="sideNavList">
            {displaySections.map((sec) => {
              const catKey = menuSectionCategoryKey(sec);
              const label = sectionHeading(sec, t);
              const active = activeCategoryKey === catKey;
              return (
                <button
                  key={catKey}
                  type="button"
                  className={`sideNavBtn${active ? " sideNavBtnActive" : ""}`}
                  onClick={() => scrollToCategory(catKey)}
                >
                  <span className="sideNavLabel">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      ) : null}
      <div className="menuPageCenterCol">
        <header className="menuPageHero">
          {menuVariant === "guest" && adminPreview ? (
            <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <KioskAnchor href="/admin/menu" className="chip" style={{ textDecoration: "none", display: "inline-flex" }}>
                ← Zpět do administrace
              </KioskAnchor>
              <span className="menuPageMetaChip" style={{ fontSize: 13 }}>
                Náhled — horní lišta a košík bez Dotykačky
              </span>
            </div>
          ) : null}
          <div className="menuPageTitleRow">
            <h1 className="menuPageTitle">{restaurantName}</h1>
            <span className="menuPageMetaChip">{tableLabelDisplay}</span>
          </div>
          <p className="menuPageIntro">{t("menu.intro")}</p>

          {menuVariant === "editor" ? (
            <p className="menuEditorHint" role="note">
              <strong>Úprava veřejného menu.</strong> Změny se projeví i na stránce{" "}
              <KioskAnchor href="/menu">/menu</KioskAnchor> pro zákazníky.
            </p>
          ) : null}

          {menuVariant === "editor" && editorStatus?.canEdit ? (
            brokenMenuImageUrls.length > 0 ? (
              <p className="menuEditorHint menuEditorHint--warn" role="alert">
                Některé externí URL obrázků v menu se nepodařilo ověřit ({brokenMenuImageUrls.length}). Položky mohou být
                bez fotky.{" "}
                <span className="textMuted2" style={{ display: "block", marginTop: 6 }}>
                  {brokenMenuImageUrls
                    .slice(0, 3)
                    .map((x) => x.url)
                    .join(" • ")}
                  {brokenMenuImageUrls.length > 3 ? "…" : ""}
                </span>
              </p>
            ) : menuImagesHealthErr ? (
              <p className="menuEditorHint menuEditorHint--warn" role="alert">
                {menuImagesHealthErr}
              </p>
            ) : (
              <p className="menuEditorHint" role="status" style={{ color: "#86efac" }}>
                {menuImagesHealthCheckedCount === 0
                  ? "Žádné externí URL obrázků v menu k ověření."
                  : `Externí URL obrázků v menu ověřeny${typeof menuImagesHealthCheckedCount === "number" ? ` (${menuImagesHealthCheckedCount})` : ""}: vše v pořádku.`}
                {menuImagesHealthCheckedAtIso ? (
                  <span className="textMuted2" style={{ display: "block", marginTop: 6 }}>
                    Zkontrolováno {new Date(menuImagesHealthCheckedAtIso).toLocaleString("cs-CZ")}
                  </span>
                ) : null}
              </p>
            )
          ) : null}

          {menuVariant === "editor" && !restaurantId ? (
            <p className="menuEditorHint menuEditorHint--muted" role="status">
              Veřejné menu pro hosty zatím není správně nastavené — dokončete nastavení v{" "}
              <KioskAnchor href="/admin">Přehledu administrace</KioskAnchor>, nebo párujte tablet v{" "}
              <KioskAnchor href="/admin/devices">Zařízení</KioskAnchor> /{" "}
              <KioskAnchor href="/admin/devices/pair-kiosk">párování u stolů</KioskAnchor>.
            </p>
          ) : null}

          {menuVariant === "editor" && restaurantId && editorStatus && !editorStatus.canEdit && editorStatus.reason === "active_mismatch" ? (
            <p className="menuEditorHint menuEditorHint--warn" role="status">
              <strong>Vaše restaurace</strong> nesedí s tímto menu. V{" "}
              <KioskAnchor href="/admin">Přehledu administrace</KioskAnchor> zkontrolujte nastavení.
            </p>
          ) : null}

          {menuVariant === "editor" && restaurantId && editorStatus && !editorStatus.canEdit && editorStatus.reason === "no_active" ? (
            <p className="menuEditorHint menuEditorHint--warn" role="status">
              Dokončete nastavení v <KioskAnchor href="/admin">Přehledu administrace</KioskAnchor>, aby odpovídalo tomuto menu.
            </p>
          ) : null}

          {menuVariant === "editor" && restaurantId && editorStatus && !editorStatus.canEdit && editorStatus.reason === "no_membership" ? (
            <p className="menuEditorHint menuEditorHint--warn" role="status">
              K úpravám potřebujete roli vedoucího nebo personálu ve vaší restauraci.
            </p>
          ) : null}

          {menuVariant === "editor" && restaurantId && editorStatus && !editorStatus.canEdit && editorStatus.reason === "unauthorized" ? (
            <p className="menuEditorHint">
              <KioskAnchor href="/admin/login">Přihlaste se</KioskAnchor> do administrace.
            </p>
          ) : null}

          {menuVariant === "editor" && canEditMenu ? (
            <div className="menuEditorBar">
              <KioskAnchor href={publicMenuUrlFromAdmin()} className="chip" style={{ textDecoration: "none" }}>
                Náhled pro zákazníka ↗
              </KioskAnchor>
              <KioskAnchor href="/admin" className="chip" style={{ textDecoration: "none" }}>
                Přehled admin ↗
              </KioskAnchor>
              <KioskAnchor href="/admin/menu/translations" className="chip" style={{ textDecoration: "none" }}>
                Překlady jazyků ↗
              </KioskAnchor>
            </div>
          ) : null}

          {menuVariant === "editor" && menuEditorErr ? (
            <p role="alert" className="menuEditorErrLine">
              {menuEditorErr}
            </p>
          ) : null}
        </header>

        {loadError ? (
          <p role="alert" style={{ color: "#fecaca", padding: "0 24px 8px" }}>
            {loadError}
          </p>
        ) : null}

        {menuVariant === "guest" && needsPairing && pairingCode && !adminPreview ? (
          <aside
            role="status"
            className="menuPairingBanner"
            style={{
              margin: "0 24px 16px",
              padding: "12px 16px",
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.12))",
              border: "1px solid rgba(96,165,250,0.35)",
              fontSize: 15,
              lineHeight: 1.45,
            }}
          >
            <strong style={{ display: "block", marginBottom: 6 }}>Párování tabletu</strong>
            <span style={{ opacity: 0.95 }}>
              Na telefonu nebo v administraci zadejte kód{" "}
              <code
                style={{
                  fontSize: "1.15em",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: "rgba(0,0,0,0.25)",
                }}
              >
                {pairingCode}
              </code>
              {pairingExpiresAtIso ? (
                <span style={{ opacity: 0.85, display: "block", marginTop: 6, fontSize: 13 }}>
                  Platnost kódu do {new Date(pairingExpiresAtIso).toLocaleString("cs-CZ")}.
                </span>
              ) : null}
            </span>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              <KioskAnchor href="/admin/devices/pair-kiosk" style={{ textDecoration: "underline", fontWeight: 600 }}>
                Pro obsluhu: párování u stolů (výběr z Dotykačky) →
              </KioskAnchor>
            </div>
          </aside>
        ) : null}

        <section className="menuPageMainCol" style={{ padding: "0 24px 24px" }}>
          {displaySections.map((sec) => {
            const catKey = menuSectionCategoryKey(sec);
            const catHidden = hiddenCategorySet.has(catKey);
            return (
              <div
                id={menuSectionDomId(catKey)}
                key={`${sec.sortOrder}-${sec.categoryId ?? sec.labelKey ?? "sec"}`}
                className="menuPageCategorySection"
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <h2 className="menuPageCategoryTitle" style={{ margin: 0 }}>
                      {sectionHeading(sec, t)}
                    </h2>
                    {menuVariant === "editor" && canEditMenu && catHidden ? (
                      <div style={{ fontSize: 12, color: "rgba(251,191,36,0.95)", fontWeight: 700 }}>
                        Kategorie skrytá pro hosty
                      </div>
                    ) : null}
                  </div>
                  {menuVariant === "editor" && canEditMenu ? (
                    <button
                      type="button"
                      className="chip"
                      onClick={() => void setCategoryHidden(catKey, !catHidden)}
                      style={catHidden ? { borderColor: "rgba(251,191,36,0.55)" } : undefined}
                      title={catHidden ? "Zobrazit kategorii pro hosty" : "Skrýt kategorii pro hosty"}
                    >
                      {catHidden ? "Zobrazit kategorii" : "Skrýt kategorii"}
                    </button>
                  ) : null}
                </div>
                <div className="menuItemGrid menuItemGrid--cols2">
                  {sec.items.map((item, itemIdx) =>
                    menuVariant === "editor" && canEditMenu ? (
                      <div key={`${sec.categoryId ?? sec.labelKey ?? "s"}-${item.id}`} className="menuItemAdminWrap">
                        <div
                          className="menuItemAdminTools"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <span className="menuItemAdminToolsLabel">Úpravy</span>
                          <button
                            type="button"
                            className="chip menuItemAdminToolBtn"
                            title={hiddenSet.has(item.id) ? "Zobrazit v menu pro hosty" : "Skrýt v menu pro hosty"}
                            onClick={() => void setHidden(item.id, !hiddenSet.has(item.id))}
                            style={hiddenSet.has(item.id) ? { borderColor: "rgba(251,191,36,0.55)" } : undefined}
                          >
                            {hiddenSet.has(item.id) ? "Zobrazit" : "Skrýt"}
                          </button>
                          <button
                            type="button"
                            className="chip menuItemAdminToolBtn"
                            disabled={orderSavingKey === catKey || itemIdx === 0}
                            title="Posunout nahoru v kategorii"
                            onClick={() => void moveItem(catKey, item.id, -1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="chip menuItemAdminToolBtn"
                            disabled={orderSavingKey === catKey || itemIdx >= sec.items.length - 1}
                            title="Posunout dolů v kategorii"
                            onClick={() => void moveItem(catKey, item.id, 1)}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="chip menuItemAdminToolBtn"
                            onClick={() => {
                              setPhotoModal(item);
                              setPhotoUrlDraft(item.imageUrl ?? "");
                              setPhotoUploadErr(null);
                            }}
                          >
                            Foto
                          </button>
                        </div>
                        <div style={hiddenSet.has(item.id) ? { opacity: 0.55 } : undefined}>
                          {hiddenSet.has(item.id) ? (
                            <div style={{ fontSize: 12, margin: "0 0 6px", color: "rgba(251,191,36,0.95)", fontWeight: 700 }}>
                              Skryto pro hosty
                            </div>
                          ) : null}
                          <MenuItem
                            item={item}
                            guestTablet
                            locale={menuLocale}
                            mediaPriority={itemIdx < 3}
                            onOpenDetails={() => openMenuItem(item)}
                          />
                        </div>
                      </div>
                    ) : (
                      <MenuItem
                        key={`${sec.categoryId ?? sec.labelKey ?? "s"}-${item.id}`}
                        item={item}
                        guestTablet
                        locale={menuLocale}
                        mediaPriority={itemIdx < 3}
                        onOpenDetails={() => openMenuItem(item)}
                      />
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>

      <aside
        aria-label={t("menu.order.aria")}
        ref={(el) => {
          cartRef.current = el;
        }}
        className={`menuCartDock menuPageCartCol${cartOpen ? " menuCartDock--open" : " menuCartDock--collapsed"}`}
        style={
          added
            ? {
                animation: "cart-shake 0.35s ease-out",
              }
            : undefined
        }
      >
        {cartOpen ? (
          <header className="menuCartDockHeader">
            <strong>{t("menu.order.title")}</strong>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="chip"
                onClick={(e) => {
                  e.stopPropagation();
                  applyCart(() => ({}));
                }}
                style={{ cursor: "pointer" }}
              >
                {t("menu.order.clear")}
              </button>
            </div>
          </header>
        ) : (
          <div aria-label={t("menu.order.openAria")} className="menuCartDockCollapsed">
            <div className="menuCartDockCollapsedHead">
              <span aria-hidden="true" className="menuCartDockIcon">
                🤵
              </span>
              <span className="menuCartDockCollapsedTitle">{t("menu.order.title")}</span>
            </div>
            {cartEntries.length > 0 ? (
              <ul className="menuCartDockPreview" aria-label={t("menu.order.previewAria")}>
                {cartEntries.slice(0, 4).map(([lineKey, line]) => (
                  <li
                    key={lineKey}
                    className="menuCartDockPreviewLine"
                    title={buildOrderLineName(menuCartLineToSnapshot(line), locale)}
                  >
                    {buildOrderLineName(menuCartLineToSnapshot(line), locale)}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="menuCartDockCollapsedStats">
              <span className="menuCartDockBadge">{cartBadgeCount}</span>
              <span className="menuCartDockCollapsedTotal">{cartTotal} Kč</span>
            </div>
            <p className="menuCartDockHint">{t("menu.order.tapToReview")}</p>
          </div>
        )}

        {cartOpen ? (
          <>
            <div style={{ display: "grid", gap: 8, maxHeight: "52vh", overflow: "auto", paddingRight: 2 }}>
              {cartEntries.map(([lineKey, l]) => (
                <div
                  key={lineKey}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div>
                    <strong>{buildOrderLineName(menuCartLineToSnapshot(l), locale)}</strong>
                    <div className="textMuted2" style={{ fontSize: 13 }}>
                      {formatCzk(orderLineUnitPriceCzk(menuCartLineToSnapshot(l)))} / ks
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      className="chip"
                      onClick={(e) => {
                        e.stopPropagation();
                        applyCart((prev) => {
                          const next = { ...prev };
                          const cur = next[lineKey];
                          if (!cur) return prev;
                          if (cur.qty <= 1) delete next[lineKey];
                          else next[lineKey] = { ...cur, qty: cur.qty - 1 };
                          return next;
                        });
                      }}
                    >
                      −
                    </button>
                    <span className="tabular-nums">{l.qty}</span>
                    <button
                      type="button"
                      className="chip"
                      onClick={(e) => {
                        e.stopPropagation();
                        applyCart((prev) => {
                          const next = { ...prev };
                          const cur = next[lineKey];
                          if (!cur) return prev;
                          next[lineKey] = { ...cur, qty: cur.qty + 1 };
                          return next;
                        });
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <footer style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <strong>{t("menu.order.total")}</strong>
                <strong className="tabular-nums">{formatCzk(cartTotal)}</strong>
              </div>
              {orderPosErrorKey ? (
                <p role="alert" style={{ color: "#fecaca", fontSize: 14, marginBottom: 8, whiteSpace: "pre-wrap" }}>
                  {t(orderPosErrorKey)}
                  {orderPosErrorDetail ? (
                    <>
                      <br />
                      <span className="textMuted2" style={{ fontSize: 13 }}>
                        {orderPosErrorDetail}
                      </span>
                    </>
                  ) : null}
                </p>
              ) : null}
              {adminPreview ? (
                <p className="textMuted2" style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.45 }}>
                  Náhled — objednávka se uloží jen v prohlížeči (pro test lišty Účet / Objednávky), do Dotykačky nejde.
                </p>
              ) : null}
              <button
                type="button"
                className="btnPrimary"
                disabled={cartEntries.length === 0 || orderConfirmLoading}
                onClick={(e) => {
                  e.stopPropagation();
                  void confirmOrder();
                }}
                style={{ width: "100%", cursor: "pointer" }}
                title={adminPreview ? "Náhled — bez odeslání do Dotykačky" : undefined}
              >
                {orderConfirmLoading ? "…" : t("menu.order.confirm")}
              </button>
            </footer>
          </>
        ) : null}
      </aside>

      {orderConfirmedOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("menu.confirmed.aria")}
          onClick={() => setOrderConfirmedOpen(false)}
          className="modalOverlay modalOverlay--60"
        >
          <div onClick={(e) => e.stopPropagation()} className="modalCard">
            <strong className="modalTitle">{t("menu.confirmed.title")}</strong>
            <p className="textMuted" style={{ margin: 0 }}>
              {t("menu.confirmed.body")}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="chip"
                onClick={() => setOrderConfirmedOpen(false)}
                style={{ cursor: "pointer" }}
              >
                {t("menu.confirmed.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {customizeItem ? (
        <MenuItemOrderModal
          item={customizeItem}
          open
          onClose={() => setCustomizeItem(null)}
          onConfirm={(result) => {
            addToCartDirect(customizeItem, {
              dotykackaPicks: result.dotykackaPicks,
              excludedIngredients: result.excludedIngredients,
            });
            setCustomizeItem(null);
          }}
          t={t}
          locale={menuLocale}
        />
      ) : null}

      {cartPendingModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("menu.cart.pendingWarningTitle")}
          onClick={() => setCartPendingModal(null)}
          className="modalOverlay modalOverlay--60"
        >
          <div onClick={(e) => e.stopPropagation()} className="modalCard">
            <strong className="modalTitle">{t("menu.cart.pendingWarningTitle")}</strong>
            <p className="textMuted" style={{ margin: 0 }}>
              {t("menu.cart.pendingWarningBody")}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 12 }}>
              <button type="button" className="chip" onClick={() => setCartPendingModal(null)} style={{ cursor: "pointer" }}>
                {t("menu.cart.pendingCancel")}
              </button>
              <button
                type="button"
                className="btnPrimary"
                onClick={() => {
                  void (async () => {
                    await clearPendingOrderConfirmed();
                    hasPendingOrderRef.current = false;
                    setOrderPosErrorKey(null);
                    setOrderPosErrorDetail(null);
                    const next = cartPendingModal;
                    setCartPendingModal(null);
                    if (next) setCart(next);
                  })();
                }}
                style={{ cursor: "pointer" }}
              >
                {t("menu.cart.pendingConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {menuVariant === "editor" && photoModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Úprava fotky jídla"
          onClick={() => setPhotoModal(null)}
          className="modalOverlay modalOverlay--60"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="modalCard"
            style={{ maxWidth: 480 }}
          >
            <strong className="modalTitle">Fotka: {photoModal.name}</strong>
            <p className="textMuted2" style={{ margin: "8px 0 12px", fontSize: 13 }}>
              Nahrajte obrázek z počítače nebo z galerie (mobil), nebo vložte veřejnou HTTPS adresu (např. Cloudinary). Hosté ji uvidí na kartě jídla.
            </p>
            <p className="textMuted2" style={{ margin: "0 0 12px", fontSize: 13 }}>
              Max. velikost pro nahrání: <strong>5&nbsp;MB</strong>. Podporované typy: <strong>JPEG/PNG/WebP</strong>.
            </p>
            <p className="textMuted2" style={{ margin: "0 0 12px", fontSize: 13 }}>
              Máte-li zároveň vyplněnou URL i nahrajete soubor, použije se <strong>nahraný soubor</strong> — ten se zobrazí hostům na kartě jídla.
            </p>
            <div style={{ marginBottom: 12 }}>
              <FilePickButton
                className="chip"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={photoSaving || photoUploading || !restaurantId}
                onFile={(f) => void uploadMenuPhotoFile(f)}
              >
                {photoUploading ? "Nahrávám…" : "Vybrat soubor…"}
              </FilePickButton>
            </div>
            {photoUploadErr ? (
              <p role="alert" style={{ margin: "0 0 12px", color: "#fecaca", fontSize: 14 }}>
                {photoUploadErr}
              </p>
            ) : null}
            <label style={{ display: "grid", gap: 6 }}>
              <span>URL obrázku</span>
              <input
                className="chip"
                value={photoUrlDraft}
                onChange={(e) => setPhotoUrlDraft(e.target.value)}
                placeholder="https://… nebo /uploads/menu/…"
                style={{ padding: "10px 12px", width: "100%", boxSizing: "border-box" }}
                autoComplete="off"
                disabled={photoUploading}
              />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="chip"
                onClick={() => setPhotoModal(null)}
                disabled={photoUploading}
                style={{ cursor: "pointer" }}
              >
                Zrušit
              </button>
              <button
                type="button"
                className="chip"
                disabled={photoSaving || photoUploading}
                onClick={() => void deletePhoto()}
                style={{ cursor: "pointer" }}
              >
                Odstranit fotku
              </button>
              <button
                type="button"
                className="btnPrimary"
                disabled={photoSaving || photoUploading}
                onClick={() => void savePhotoUrl()}
                style={{ cursor: "pointer" }}
              >
                {photoSaving ? "…" : "Uložit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
