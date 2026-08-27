"use client";

import * as React from "react";

import type { CategoryHours, CategoryScheduleSave } from "../../lib/menu/categoryHours";
import { formatCategoryHoursLabel, isCategoryVisibleAtHhmm, normalizeHhmm } from "../../lib/menu/categoryHours";

type MenuCategoryHoursEditorProps = {
  categoryKey: string;
  hours: CategoryHours | undefined;
  alwaysVisible?: boolean;
  nowHhmm: string;
  /** Právě běží nějaké časové menu — základní sekce je teď pro hosty skrytá. */
  timedMenuActive?: boolean;
  disabled?: boolean;
  onSave: (next: CategoryScheduleSave) => Promise<void>;
};

export function MenuCategoryHoursEditor({
  categoryKey,
  hours,
  alwaysVisible = false,
  nowHhmm,
  timedMenuActive = false,
  disabled,
  onSave,
}: MenuCategoryHoursEditorProps) {
  const [from, setFrom] = React.useState(alwaysVisible ? "" : (hours?.visibleFrom ?? ""));
  const [until, setUntil] = React.useState(alwaysVisible ? "" : (hours?.visibleUntil ?? ""));
  const [saving, setSaving] = React.useState(false);
  const [alwaysOn, setAlwaysOn] = React.useState(alwaysVisible);
  const skipBlurPersistRef = React.useRef(false);
  const alwaysIntentRef = React.useRef(alwaysVisible);

  React.useEffect(() => {
    alwaysIntentRef.current = alwaysVisible;
    setAlwaysOn(alwaysVisible);
    setFrom(alwaysVisible ? "" : (hours?.visibleFrom ?? ""));
    setUntil(alwaysVisible ? "" : (hours?.visibleUntil ?? ""));
  }, [categoryKey, hours?.visibleFrom, hours?.visibleUntil, alwaysVisible]);

  const persist = async (nextFrom: string, nextUntil: string) => {
    if (skipBlurPersistRef.current) {
      skipBlurPersistRef.current = false;
      return;
    }
    if (alwaysIntentRef.current || alwaysVisible) return;
    const f = nextFrom.trim();
    const u = nextUntil.trim();
    if (f === "" && u === "") {
      if (!hours) return;
      setSaving(true);
      try {
        await onSave(null);
      } finally {
        setSaving(false);
      }
      return;
    }
    const nf = normalizeHhmm(f);
    const nu = normalizeHhmm(u);
    if (!nf || !nu || nf === nu) return;
    if (hours && hours.visibleFrom === nf && hours.visibleUntil === nu) return;
    alwaysIntentRef.current = false;
    setSaving(true);
    try {
      await onSave({ visibleFrom: nf, visibleUntil: nu });
    } finally {
      setSaving(false);
    }
  };

  const saveAlways = async () => {
    skipBlurPersistRef.current = true;
    if (alwaysOn) {
      alwaysIntentRef.current = false;
      setAlwaysOn(false);
      setSaving(true);
      try {
        await onSave(null);
      } finally {
        setSaving(false);
      }
      return;
    }
    alwaysIntentRef.current = true;
    setAlwaysOn(true);
    setFrom("");
    setUntil("");
    setSaving(true);
    try {
      await onSave({ always: true });
    } finally {
      setSaving(false);
    }
  };

  const inWindow = hours ? isCategoryVisibleAtHhmm(hours, nowHhmm) : true;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      {alwaysOn ? (
        <span style={{ fontSize: 12, fontWeight: 800, color: "#86efac" }}>Pořád zapnuto</span>
      ) : hours ? (
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: inWindow ? "rgba(187, 247, 208, 0.95)" : "rgba(251, 191, 36, 0.95)",
          }}
        >
          {formatCategoryHoursLabel(hours)}
          {inWindow ? "" : " · teď mimo čas"}
        </span>
      ) : (
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: timedMenuActive ? "rgba(251, 191, 36, 0.95)" : "rgba(148, 163, 184, 0.95)",
          }}
        >
          {timedMenuActive ? "základní · teď skryté" : "základní"}
        </span>
      )}
      <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
        Od
        <input
          type="time"
          value={from}
          disabled={disabled || saving || alwaysOn}
          onChange={(e) => setFrom(e.target.value)}
          onBlur={() => void persist(from, until)}
          style={{ fontSize: 13 }}
        />
      </label>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
        Do
        <input
          type="time"
          value={until}
          disabled={disabled || saving || alwaysOn}
          onChange={(e) => setUntil(e.target.value)}
          onBlur={() => void persist(from, until)}
          style={{ fontSize: 13 }}
        />
      </label>
      <button
        type="button"
        className={alwaysOn ? "chip chipAlwaysOn" : "chip"}
        disabled={disabled}
        aria-pressed={alwaysOn}
        onMouseDown={(e) => {
          e.preventDefault();
          skipBlurPersistRef.current = true;
        }}
        onClick={() => void saveAlways()}
        title={
          alwaysOn
            ? "Vypnout Pořád — sekce se zase bude chovat jako základní nabídka"
            : "Sekce bude vidět vždy, i během poledního menu"
        }
      >
        {alwaysOn ? "Pořád ✓" : "Pořád"}
      </button>
    </div>
  );
}
