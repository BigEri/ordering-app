"use client";

import * as React from "react";

import type { CategoryHours } from "../../lib/menu/categoryHours";
import { formatCategoryHoursLabel, isCategoryVisibleAtHhmm, normalizeHhmm } from "../../lib/menu/categoryHours";

type MenuCategoryHoursEditorProps = {
  categoryKey: string;
  hours: CategoryHours | undefined;
  nowHhmm: string;
  disabled?: boolean;
  onSave: (next: CategoryHours | null) => Promise<void>;
};

export function MenuCategoryHoursEditor({
  categoryKey,
  hours,
  nowHhmm,
  disabled,
  onSave,
}: MenuCategoryHoursEditorProps) {
  const [from, setFrom] = React.useState(hours?.visibleFrom ?? "");
  const [until, setUntil] = React.useState(hours?.visibleUntil ?? "");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setFrom(hours?.visibleFrom ?? "");
    setUntil(hours?.visibleUntil ?? "");
  }, [categoryKey, hours?.visibleFrom, hours?.visibleUntil]);

  const persist = async (nextFrom: string, nextUntil: string) => {
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
    setSaving(true);
    try {
      await onSave({ visibleFrom: nf, visibleUntil: nu });
    } finally {
      setSaving(false);
    }
  };

  const inWindow = hours ? isCategoryVisibleAtHhmm(hours, nowHhmm) : true;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      {hours ? (
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
      ) : null}
      <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
        Od
        <input
          type="time"
          value={from}
          disabled={disabled || saving}
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
          disabled={disabled || saving}
          onChange={(e) => setUntil(e.target.value)}
          onBlur={() => void persist(from, until)}
          style={{ fontSize: 13 }}
        />
      </label>
      {hours ? (
        <button
          type="button"
          className="chip"
          disabled={disabled || saving}
          onClick={() => {
            setFrom("");
            setUntil("");
            void persist("", "");
          }}
          title="Sekce bude vidět celý den"
        >
          Pořád
        </button>
      ) : null}
    </div>
  );
}
