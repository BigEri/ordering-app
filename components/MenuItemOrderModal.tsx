"use client";

import * as React from "react";

import { MenuItemBadgeRow, type MenuItemData } from "./MenuItem";
import { MenuItemPhoto } from "./MenuItemPhoto";
import type { Locale } from "../lib/i18n/messages";
import { allergenLabel } from "../lib/menu/allergens";
import {
  defaultDotykackaPicks,
  dotykackaExtraUnitPriceCzk,
  validateDotykackaPicks,
} from "../lib/menu/dotykackaLine";

export type MenuItemOrderConfirm = {
  excludedIngredients: string[];
  dotykackaPicks: Record<string, string[]>;
};

type MenuItemOrderModalProps = {
  item: MenuItemData;
  open: boolean;
  onClose: () => void;
  onConfirm: (result: MenuItemOrderConfirm) => void;
  t: (key: string) => string;
  locale?: Locale;
};

/** Názvy skupin z Dotykačky (sectionLabel) — např. „Sladké přísady · Přílohy“. */
function dotykackaGroupLabels(
  groups: NonNullable<MenuItemData["dotykackaCustomizationGroups"]>,
): string {
  const parts = groups
    .map((g) => g.sectionLabel.trim())
    .filter((s) => s.length > 0);
  return parts.join(" · ");
}

function togglePick(
  picks: Record<string, string[]>,
  groupId: string,
  optionId: string,
  maxPick: number,
  single: boolean,
): Record<string, string[]> {
  const next: Record<string, string[]> = { ...picks };
  const cur = [...(next[groupId] ?? [])];
  if (single) {
    next[groupId] = cur.includes(optionId) ? [] : [optionId];
    return next;
  }
  const idx = cur.indexOf(optionId);
  if (idx >= 0) cur.splice(idx, 1);
  else if (cur.length < maxPick) cur.push(optionId);
  next[groupId] = cur;
  return next;
}

export function MenuItemOrderModal({
  item,
  open,
  onClose,
  onConfirm,
  t,
  locale = "cs",
}: MenuItemOrderModalProps) {
  const groups = item.dotykackaCustomizationGroups ?? [];
  const excludable = React.useMemo(
    () => item.ingredients?.filter((i) => i.allowExclude !== false) ?? [],
    [item.ingredients],
  );
  const [picks, setPicks] = React.useState<Record<string, string[]>>({});
  const [excludedNames, setExcludedNames] = React.useState<Set<string>>(() => new Set());
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setPicks(defaultDotykackaPicks(item));
    setExcludedNames(new Set());
    setErr(null);
  }, [open, item]);

  const allergens = React.useMemo(() => {
    const codes = item.allergenCodes ?? [];
    const uniq = Array.from(new Set(codes)).filter((n) => typeof n === "number" && Number.isFinite(n));
    uniq.sort((a, b) => a - b);
    return uniq;
  }, [item.allergenCodes]);

  if (!open) return null;

  const unitExtra = dotykackaExtraUnitPriceCzk(item, picks);
  const totalUnit = item.priceCzk + unitExtra;

  const handleConfirm = () => {
    const v = validateDotykackaPicks(item, picks);
    if (v) {
      setErr(v);
      return;
    }
    const excludedIngredients = excludable.filter((ing) => excludedNames.has(ing.name)).map((ing) => ing.name);
    onConfirm({ excludedIngredients, dotykackaPicks: picks });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
      onClick={onClose}
      className="modalOverlay modalOverlay--60"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modalCard modalCard--md modalCard--detail"
      >
        <header className="menuDetailHeader">
          <MenuItemPhoto
            imageUrl={item.imageUrl}
            seedId={item.id}
            visible
            className="menuItemMedia menuDetailMedia"
          />
          <div className="menuDetailHeaderText">
            <strong className="modalTitle modalTitleRow">
              <span>{item.name}</span>
            </strong>
            <MenuItemBadgeRow badges={item.badges} locale={locale} variant="label" className="menuItemBadgeRow menuItemBadgeRow--detail" />
            {item.description ? (
              <p
                className="textMuted"
                style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}
              >
                {item.description}
              </p>
            ) : null}
            {item.portionNote ? <p className="modalPortionNote textMuted2">{item.portionNote}</p> : null}
          </div>
        </header>

        <div style={{ display: "grid", gap: 16, minHeight: 0 }}>
          <section className="modalMetaSection">
            <div className="modalSectionLabel">{t("menu.detail.allergens")}</div>
            {allergens.length > 0 ? (
              <ul className="modalAllergenList" aria-label={t("menu.detail.allergenListAria")}>
                {allergens.map((code) => (
                  <li key={code} className="modalAllergenChip">
                    <span className="modalAllergenChipNum">{code}</span>
                    <span>{allergenLabel(code, locale)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="textMuted2" style={{ margin: 0 }}>
                {t("menu.detail.allergenNoneTablet")}
              </p>
            )}
          </section>

          {excludable.length > 0 ? (
            <section className="modalMetaSection">
              <div className="modalSectionLabel">{t("menu.detail.removeFrom")}</div>
              <div style={{ display: "grid", gap: 8 }}>
                {excludable.map((ing) => {
                  const checked = excludedNames.has(ing.name);
                  const label = ing.name;
                  return (
                    <label
                      key={ing.name}
                      className="modalCheckRow"
                      style={{ opacity: checked ? 1 : 0.96 }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setErr(null);
                          setExcludedNames((prev) => {
                            const next = new Set(prev);
                            if (next.has(ing.name)) next.delete(ing.name);
                            else next.add(ing.name);
                            return next;
                          });
                        }}
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </section>
          ) : null}

          {groups.map((g) => {
            const single = g.minPick === 1 && g.maxPick === 1;
            const sel = picks[g.id] ?? [];
            return (
              <section key={g.id} className="modalMetaSection">
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div className="modalSectionLabel">{g.sectionLabel.trim() ? g.sectionLabel : "\u00A0"}</div>
                  {g.minPick === 1 ? <span className="modalPovinneBadge">{t("menu.detail.multi.required")}</span> : null}
                  {!single && g.maxPick > 1 ? <span className="textMuted2 tabular-nums">max {g.maxPick}</span> : null}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {g.options.map((o) => {
                    const checked = sel.includes(o.id);
                    const inputType = single ? "radio" : "checkbox";
                    const name = `dk-${g.id}`;
                    return (
                      <label
                        key={o.id}
                        className={`modalCheckRow modalCheckRow--split`}
                        style={{ opacity: !checked && !single && sel.length >= g.maxPick ? 0.55 : 1 }}
                      >
                        <span className="modalCheckRowStart">
                          <input
                            type={inputType}
                            name={single ? name : undefined}
                            {...(single ? { value: o.id } : {})}
                            checked={checked}
                            disabled={!single && !checked && sel.length >= g.maxPick}
                            onChange={() => {
                              setErr(null);
                              setPicks((prev) => togglePick(prev, g.id, o.id, g.maxPick, single));
                            }}
                          />
                          <span style={{ minWidth: 0 }}>
                            {o.label}
                            {o.priceCzk !== 0 ? (
                              <span className="textMuted2 tabular-nums" style={{ marginLeft: 8 }}>
                                {o.priceCzk > 0 ? "+" : ""}
                                {o.priceCzk} Kč
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className="textMuted2 tabular-nums">{checked ? "✓" : "\u00A0"}</span>
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {err ? (
          <p role="alert" style={{ color: "#fecaca", fontSize: 14, marginTop: 12 }}>
            {err}
          </p>
        ) : null}

        <div className="modalCard__footer">
          <span className="tabular-nums" style={{ fontWeight: 600 }}>
            {totalUnit} Kč <span className="textMuted2" style={{ fontWeight: 400 }}>/ ks</span>
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="chip" onClick={onClose} style={{ cursor: "pointer" }}>
              {t("menu.dotykacka.cancel")}
            </button>
            <button type="button" className="btnPrimary" onClick={handleConfirm} style={{ cursor: "pointer" }}>
              {t("menu.dotykacka.add")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
