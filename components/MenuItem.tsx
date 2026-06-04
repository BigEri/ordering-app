"use client";

import * as React from "react";

import type { Locale } from "../lib/i18n/messages";
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
  /** Značka rostlinného / vegan friendly jídla (list u názvu) */
  veganFriendly?: boolean;
  priceCzk: number;
  /** Načteno z Dotykačky (`include=customizations` + produkty v `_categoryId`). */
  dotykackaCustomizationGroups?: DotykackaCustomizationGroup[];
};

/** Ikona listu – stejná v kartě menu i v detailu */
export function VeganFriendlyBadge({ className }: { className?: string }) {
  return (
    <span
      className={className ?? "menuItemVeganBadge"}
      title="Vegan friendly"
      aria-label="Vegan friendly"
      role="img"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        width="1em"
        height="1em"
        aria-hidden="true"
      >
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 6.5 2 10a8 8 0 0 1-8 8Z" />
        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
      </svg>
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
   * UX: u pár prvních položek nad přehybem chceme rychlejší načtení média.
   * Používá se jen pro prefetch obrázku, samotné vykreslení zůstává stejné.
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

export function MenuItem({ item, onOpenDetails, guestTablet, locale = "cs", mediaPriority }: MenuItemProps) {
  const mediaRef = React.useRef<HTMLDivElement | null>(null);
  const [mediaVisible, setMediaVisible] = React.useState(Boolean(mediaPriority));

  React.useEffect(() => {
    if (mediaVisible) return;
    const el = mediaRef.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setMediaVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) return;
        if (e.isIntersecting) {
          setMediaVisible(true);
          io.disconnect();
        }
      },
      // Začni načítat chvíli před tím, než se karta dostane na obrazovku.
      { root: null, rootMargin: "600px 0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mediaVisible]);

  return (
    <article
      className={`menuItemCard${onOpenDetails ? " menuItemCardClickable" : ""}`}
      role={onOpenDetails ? "button" : undefined}
      tabIndex={onOpenDetails ? 0 : undefined}
      onClick={() => onOpenDetails?.(item)}
      onKeyDown={(e) => {
        if (!onOpenDetails) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetails(item);
        }
      }}
    >
      <div ref={mediaRef} className="menuItemMediaHost">
        <MenuItemPhoto
          imageUrl={item.imageUrl}
          seedId={item.id}
          visible={mediaVisible}
          priority={mediaPriority}
        />
        {!guestTablet ? <span className="menuItemBadge">{ILLUSTRATION_BADGE[locale]}</span> : null}
      </div>

      <header className="menuItemBody">
        <strong className="menuItemTitle menuItemTitleRow">
          <span>{item.name}</span>
          {item.veganFriendly ? <VeganFriendlyBadge /> : null}
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
            onOpenDetails?.(item);
          }}
        >
          +
        </button>
      </footer>
    </article>
  );
}
