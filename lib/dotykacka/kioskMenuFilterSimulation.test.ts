import { describe, expect, it } from "vitest";

import {
  SIMULATION_EXPECTED_SHOWN,
  simulationCategories,
  simulationIngredientRows,
  simulationProducts,
} from "./kioskMenuFilterSimulation.fixture";
import {
  formatKioskFilterSimulationReport,
  simulateKioskMenuFilter,
} from "./kioskMenuFilterSimulation";

describe("simulateKioskMenuFilter — fiktivní restaurace", () => {
  const decisions = simulateKioskMenuFilter({
    categories: simulationCategories,
    products: simulationProducts,
    ingredientRows: simulationIngredientRows,
  });

  it("má 50 položek jako v katalogu Dotykačky", () => {
    expect(simulationProducts).toHaveLength(50);
    expect(decisions).toHaveLength(50);
  });

  it("nechá hostovi jen opravdová jídla a nápoje", () => {
    const shown = decisions.filter((d) => d.shown).map((d) => d.name);
    expect(shown).toEqual([...SIMULATION_EXPECTED_SHOWN]);
  });

  it("schová sklad, suroviny z receptur, pool příloh, obaly a ruční cenu", () => {
    const hidden = decisions.filter((d) => !d.shown);
    expect(hidden).toHaveLength(30);

    const byReason = Object.fromEntries(
      [...new Set(hidden.map((d) => d.reason))].map((reason) => [
        reason,
        hidden.filter((d) => d.reason === reason).map((d) => d.name),
      ]),
    );

    expect(byReason["category-name"]).toEqual(
      expect.arrayContaining([
        "Hovězí zadní",
        "Sůl",
        "Olej",
        "Hranolky",
        "BBQ dip",
        "Ubrousky",
        "Dezinfekce",
      ]),
    );
    expect(byReason["price-entry"]).toEqual(["Volná položka"]);
    expect(byReason["internal-tag"]).toEqual(["Hadřík"]);
  });

  it("Hranolky zůstanou u Fish & chips (receptura), ale ne jako samostatné jídlo", () => {
    const hranolky = decisions.find((d) => d.name === "Hranolky");
    const fish = decisions.find((d) => d.name === "Fish & chips");
    expect(hranolky?.shown).toBe(false);
    expect(hranolky?.reason).toBe("category-name");
    expect(fish?.shown).toBe(true);
  });

  it("sestaví čitelný report pro schůzku", () => {
    const report = formatKioskFilterSimulationReport(decisions);
    expect(report).toContain("20 jídel / nápojů viditelných");
    expect(report).toContain("+ Svíčková");
    expect(report).toContain("− Sůl");
    expect(report).toContain("− Hranolky");
  });
});

describe("simulateKioskMenuFilter — mezery v datech z Dotyky", () => {
  it("sůl omylem v Hlavních jídlech bez receptury a bez štítku kiosk neuvidí jako surovinu", () => {
    const decisions = simulateKioskMenuFilter({
      categories: [{ id: 1, name: "Hlavní jídla", display: true, deleted: false }],
      products: [
        {
          id: 9,
          name: "Sůl kuchyně",
          _categoryId: 1,
          display: true,
          deleted: false,
          unit: "Piece",
        },
      ],
      ingredientRows: [],
    });
    expect(decisions[0]?.shown).toBe(true);
  });

  it("olej v kg schová i když leží v Hlavních jídlech", () => {
    const decisions = simulateKioskMenuFilter({
      categories: [{ id: 1, name: "Hlavní jídla", display: true, deleted: false }],
      products: [
        {
          id: 8,
          name: "Olej",
          _categoryId: 1,
          display: true,
          deleted: false,
          unit: "Kilogram",
        },
      ],
      ingredientRows: [],
    });
    expect(decisions[0]).toMatchObject({ shown: false, reason: "weight-unit" });
  });

  it("sůl v Hlavních jídlech schová, jakmile je v receptuře jídla", () => {
    const decisions = simulateKioskMenuFilter({
      categories: [{ id: 1, name: "Hlavní jídla", display: true, deleted: false }],
      products: [
        { id: 10, name: "Svíčková", _categoryId: 1, display: true, deleted: false, unit: "Piece" },
        { id: 20, name: "Sůl", _categoryId: 1, display: true, deleted: false, unit: "Piece" },
      ],
      ingredientRows: [{ _parentProductId: 10, _productId: 20 }],
    });
    expect(decisions.find((d) => d.name === "Svíčková")?.shown).toBe(true);
    expect(decisions.find((d) => d.name === "Sůl")).toMatchObject({
      shown: false,
      reason: "recipe-ingredient",
    });
  });
});
