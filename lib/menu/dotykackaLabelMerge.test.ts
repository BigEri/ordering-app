import { describe, expect, it } from "vitest";

import {
  expandDotykackaGroupLabelsForSave,
  mergeDotykackaEditorGroups,
  type DotykackaEditorGroupRaw,
} from "./dotykackaLabelMerge";

describe("mergeDotykackaEditorGroups", () => {
  it("sloučí skupiny se stejným názvem a stejnými volbami", () => {
    const raw: DotykackaEditorGroupRaw[] = [
      {
        id: "1611928772061559",
        label: "Přílohy",
        options: [
          { id: "4009336567015057", label: "Brambory" },
          { id: "1428619567867575", label: "Hranolky" },
        ],
        usedBy: ["Řízek"],
      },
      {
        id: "1375572426975185",
        label: "Přílohy",
        options: [
          { id: "4009336567015057", label: "Brambory" },
          { id: "1428619567867575", label: "Hranolky" },
        ],
        usedBy: ["Burger"],
      },
    ];
    const merged = mergeDotykackaEditorGroups(raw);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.merged).toBe(true);
    expect(merged[0]!.aliasIds).toEqual(["1375572426975185", "1611928772061559"]);
    expect(merged[0]!.usedBy).toEqual(["Burger", "Řízek"]);
  });

  it("neruší odlišné skupiny", () => {
    const raw: DotykackaEditorGroupRaw[] = [
      {
        id: "1",
        label: "Úpravy burger",
        options: [{ id: "10", label: "Cheddar" }],
        usedBy: ["Burger"],
      },
      {
        id: "2",
        label: "Přílohy",
        options: [{ id: "20", label: "Rýže" }],
        usedBy: ["Řízek"],
      },
    ];
    expect(mergeDotykackaEditorGroups(raw)).toHaveLength(2);
  });
});

describe("expandDotykackaGroupLabelsForSave", () => {
  it("zkopíruje překlad na všechna alias ID", () => {
    const merged = mergeDotykackaEditorGroups([
      {
        id: "1375572426975185",
        label: "Přílohy",
        options: [{ id: "1", label: "A" }],
        usedBy: [],
      },
      {
        id: "1611928772061559",
        label: "Přílohy",
        options: [{ id: "1", label: "A" }],
        usedBy: [],
      },
    ]);
    const out = expandDotykackaGroupLabelsForSave({ "1375572426975185": "Sides" }, merged);
    expect(out["1375572426975185"]).toBe("Sides");
    expect(out["1611928772061559"]).toBe("Sides");
  });
});
