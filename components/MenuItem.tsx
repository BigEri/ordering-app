"use client";

import * as React from "react";

import type { Locale } from "../lib/i18n/messages";
import type { MenuItemBadgeKey } from "../lib/menu/menuItemBadges";
import { sameMenuItemBadgeList } from "../lib/menu/menuItemBadges";
import { MenuItemPhoto } from "./MenuItemPhoto";

export type MenuIngredientLine = {
  name: string;
  portionNote?: string;
  /** false = hlavní surovina jídla; zůstane v „Co obsahuje“, bez checkboxu v „Odebrat z jídla“ */
  allowExclude?: boolean;
};

export type MenuSideChoiceOption = {
  id: string;
  label: string;
  priceCzk: number;
  portionNote?: string;
};

/** Povinný výběr právě jedné přílohy (radio) */
export type MenuSideChoiceGroup = {
  sectionLabel: string;
  options: MenuSideChoiceOption[];
  /** V košíku / potvrzení místo výchozího „Příloha“ / „příloha“ */
  summaryLabel?: string;
};

/** Povinný výběr 1–N položek (checkboxy); první možnost = „bez…“, vzájemně výlučná s ostatními */
export type MenuMultiPickGroup = {
  id: string;
  sectionLabel: string;
  minPick: number;
  maxPick: number;
  options: MenuSideChoiceOption[];
};

/** Možnost u skupiny přizpůsobení z Dotykačky (produkt v kategorii volby). */
export type DotykackaCustomizationOption = {
  id: string;
  productId: number;
  label: string;
  priceCzk: number;
};

/** Skupina přizpůsobení z Product Customization API (`id` = klíč v košíku). */
export type DotykackaCustomizationGroup = {
  id: string;
  customizationId: number;
  sectionLabel: string;
  minPick: number;
  maxPick: number;
  options: DotykackaCustomizationOption[];
  /** výchozí volby z `_defaultProductIds` (id jako `dkp-…`) */
  defaultOptionIds: string[];
};

export type MenuItemData = {
  id: string;
  name: string;
  imageUrl?: string;
  description?: string;
  ingredients?: MenuIngredientLine[];
  /** Např. „cca 380 g včetně přílohy (± 10 %)“ – orientační hmotnost/objem */
  portionNote?: string;
  /** Alergeny 1–14 dle EU (v základní podobě jídla) */
  allergenCodes?: number[];
  sideChoice?: MenuSideChoiceGroup;
  /** Nadpis sekce addonů v detailu (výchozí „Možnosti“) */
  addonsSectionLabel?: string;
  /** Palačinka atd.: více skupin checkboxů (každá 1–maxPick), první volba vždy „bez“ */
  multiPickGroups?: MenuMultiPickGroup[];
  /** Palačinka: povinná právě jedna slaná poleva (radio) */
  savoryGlazeChoice?: MenuSideChoiceGroup;
  addons?: Array<{
    id: string;
    label: string;
    priceCzk: number;
    portionNote?: string;
    /** > 1: stejný addon lze přidat vícekrát (cena × počet), v detailu stepper místo jednoho checkboxu */
    quantityMax?: number;
  }>;
  /** Hostitelské štítky (vegan / doporučené / populární) — z Tableflow, ne z pokladny. */
  badges?: MenuItemBadgeKey[];
  priceCzk: number;
  /** Načteno z Dotykačky (`include=customizations` + produkty v `_categoryId`). */
  dotykackaCustomizationGroups?: DotykackaCustomizationGroup[];
};

const BADGE_LABEL: Record<MenuItemBadgeKey, Record<Locale, string>> = {
  vegan: { cs: "Veganské", en: "Vegan", ko: "비건" },
  recommended: { cs: "Doporučené", en: "Recommended", ko: "추천" },
  popular: { cs: "Populární", en: "Popular", ko: "인기" },
};

function BadgeIcon({ badge }: { badge: MenuItemBadgeKey }) {
  if (badge === "recommended") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em" aria-hidden="true">
        <path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z" />
        <path d="M6 17h12" />
      </svg>
    );
  }
  if (badge === "popular") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em" aria-hidden="true">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em" aria-hidden="true">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 6.5 2 10a8 8 0 0 1-8 8Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

export function MenuItemBadgeMark({
  badge,
  locale = "cs",
  variant = "icon",
  labeled = true,
}: {
  badge: MenuItemBadgeKey;
  locale?: Locale;
  variant?: "icon" | "chip" | "label";
  labeled?: boolean;
}) {
  const label = BADGE_LABEL[badge][locale];
  if (variant === "label") {
    return (
      <span className={`menuItemFlagBadge menuItemFlagBadge--${badge} menuItemFlagBadge--label`}>
        <BadgeIcon badge={badge} />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span
      className={`menuItemFlagBadge menuItemFlagBadge--${badge}${variant === "chip" ? " menuItemFlagBadge--chip" : ""}`}
      title={labeled ? label : undefined}
      aria-label={labeled ? label : undefined}
      aria-hidden={labeled ? undefined : true}
      role={labeled ? "img" : undefined}
    >
      <BadgeIcon badge={badge} />
    </span>
  );
}

export function MenuItemBadgeRow({
  badges,
  locale = "cs",
  variant = "icon",
  className,
}: {
  badges: MenuItemBadgeKey[] | undefined;
  locale?: Locale;
  variant?: "icon" | "chip" | "label";
  className?: string;
}) {
  if (!badges?.length) return null;
  return (
    <span className={className ?? "menuItemBadgeRow"}>
      {badges.map((badge) => (
        <MenuItemBadgeMark key={badge} badge={badge} locale={locale} variant={variant} />
      ))}
    </span>
  );
}

export type MenuItemProps = {
  item: MenuItemData;
  onOpenDetails?: (item: MenuItemData) => void;
  /** Režim tablet na stole: bez štítku u obrázku a bez popisu pod názvem */
  guestTablet?: boolean;
  /** Pro přístupnost a štítek u média (výchozí cs) */
  locale?: Locale;
  /**
   * UX: u prvních karet nad přehybem chceme rychlejší načtení média (`loading=eager`).
   * Ostatní karty nechají stažení na prohlížeči (`loading=lazy`).
   */
  mediaPriority?: boolean;
};

const ILLUSTRATION_BADGE: Record<Locale, string> = {
  cs: "Ilustrační obrázek",
  en: "Illustrative image",
  ko: "참고 이미지",
};

const OPEN_DETAILS_ARIA: Record<Locale, string> = {
  cs: "Otevřít detail",
  en: "Open details",
  ko: "상세 보기",
};

export function MenuItemInner({ item, onOpenDetails, guestTablet, locale = "cs", mediaPriority }: MenuItemProps) {
  const openDetails = React.useCallback(
    (from: HTMLElement) => {
      onOpenDetails?.(item);
      from.blur();
    },
    [item, onOpenDetails],
  );

  return (
    <article
      className={`menuItemCard${onOpenDetails ? " menuItemCardClickable" : ""}`}
      role={onOpenDetails ? "button" : undefined}
      tabIndex={onOpenDetails ? 0 : undefined}
      onClick={(e) => {
        if (!onOpenDetails) return;
        openDetails(e.currentTarget);
      }}
      onKeyDown={(e) => {
        if (!onOpenDetails) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetails(e.currentTarget);
        }
      }}
    >
      <div className="menuItemMediaHost">
        <MenuItemPhoto
          imageUrl={item.imageUrl}
          seedId={item.id}
          visible
          priority={mediaPriority}
        />
        {!guestTablet ? <span className="menuItemBadge">{ILLUSTRATION_BADGE[locale]}</span> : null}
        <MenuItemBadgeRow badges={item.badges} locale={locale} variant="chip" className="menuItemBadgeRow menuItemBadgeRow--media" />
      </div>

      <header className="menuItemBody">
        <strong className="menuItemTitle menuItemTitleRow">
          <span>{item.name}</span>
          <MenuItemBadgeRow badges={item.badges} locale={locale} />
        </strong>
        {!guestTablet && item.description ? <p className="menuItemDesc">{item.description}</p> : null}
      </header>

      <footer className="menuItemFooter">
        <span className="menuItemPrice">{item.priceCzk} Kč</span>
        <button
          type="button"
          className="menuItemAddBtn"
          aria-label={`${OPEN_DETAILS_ARIA[locale]}: ${item.name}`}
          onClick={(e) => {
            e.stopPropagation();
            openDetails(e.currentTarget.closest("article") ?? e.currentTarget);
          }}
        >
          +
        </button>
      </footer>
    </article>
  );
}

function menuItemPropsAreEqual(prev: MenuItemProps, next: MenuItemProps): boolean {
  if (prev.guestTablet !== next.guestTablet) return false;
  if (prev.locale !== next.locale) return false;
  if (prev.mediaPriority !== next.mediaPriority) return false;
  if (prev.onOpenDetails !== next.onOpenDetails) return false;
  const a = prev.item;
  const b = next.item;
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.imageUrl === b.imageUrl &&
    a.description === b.description &&
    a.priceCzk === b.priceCzk &&
    sameMenuItemBadgeList(a.badges, b.badges)
  );
}

export const MenuItem = React.memo(MenuItemInner, menuItemPropsAreEqual);
