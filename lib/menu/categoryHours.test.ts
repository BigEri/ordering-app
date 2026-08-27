import { describe, expect, it } from "vitest";

import {
  anyTimedCategoryActive,
  formatCategoryHoursLabel,
  isAlwaysScheduleTimes,
  isCategoryVisibleAtHhmm,
  isCategoryVisibleWithExclusiveSchedule,
  isHhmmInHalfOpenWindow,
  normalizeHhmm,
} from "./categoryHours";

describe("normalizeHhmm", () => {
  it("doplní nulu a ořízne sekundy", () => {
    expect(normalizeHhmm("9:05")).toBe("09:05");
    expect(normalizeHhmm("12:00:00")).toBe("12:00");
    expect(normalizeHhmm(" 14:00 ")).toBe("14:00");
    expect(normalizeHhmm("24:00")).toBeNull();
    expect(normalizeHhmm("")).toBeNull();
  });
});

describe("isHhmmInHalfOpenWindow", () => {
  it("polední 12:00–14:00 je half-open", () => {
    expect(isHhmmInHalfOpenWindow("12:00", "12:00", "14:00")).toBe(true);
    expect(isHhmmInHalfOpenWindow("13:59", "12:00", "14:00")).toBe(true);
    expect(isHhmmInHalfOpenWindow("14:00", "12:00", "14:00")).toBe(false);
    expect(isHhmmInHalfOpenWindow("11:59", "12:00", "14:00")).toBe(false);
  });

  it("přes půlnoc 21:30–12:00", () => {
    expect(isHhmmInHalfOpenWindow("21:30", "21:30", "12:00")).toBe(true);
    expect(isHhmmInHalfOpenWindow("23:00", "21:30", "12:00")).toBe(true);
    expect(isHhmmInHalfOpenWindow("00:00", "21:30", "12:00")).toBe(true);
    expect(isHhmmInHalfOpenWindow("11:59", "21:30", "12:00")).toBe(true);
    expect(isHhmmInHalfOpenWindow("12:00", "21:30", "12:00")).toBe(false);
    expect(isHhmmInHalfOpenWindow("15:00", "21:30", "12:00")).toBe(false);
  });

  it("stejný from i until je prázdné okno", () => {
    expect(isHhmmInHalfOpenWindow("12:00", "12:00", "12:00")).toBe(false);
  });
});

describe("isCategoryVisibleAtHhmm", () => {
  it("bez hodin je vždy vidět", () => {
    expect(isCategoryVisibleAtHhmm(undefined, "15:00")).toBe(true);
    expect(isCategoryVisibleAtHhmm(null, "15:00")).toBe(true);
  });

  it("respektuje okno", () => {
    const lunch = { visibleFrom: "12:00", visibleUntil: "14:00" };
    expect(isCategoryVisibleAtHhmm(lunch, "12:30")).toBe(true);
    expect(isCategoryVisibleAtHhmm(lunch, "14:00")).toBe(false);
  });
});

describe("formatCategoryHoursLabel", () => {
  it("spojuje časy en dash", () => {
    expect(formatCategoryHoursLabel({ visibleFrom: "12:00", visibleUntil: "14:00" })).toBe("12:00–14:00");
  });
});

describe("isCategoryVisibleWithExclusiveSchedule", () => {
  const lunch = { visibleFrom: "12:00", visibleUntil: "14:00" };
  const hoursMap = { lunch };

  it("Pořád je vidět i během poledního okna", () => {
    const always = new Set(["drinks"]);
    expect(isCategoryVisibleWithExclusiveSchedule("drinks", hoursMap, always, "12:30")).toBe(true);
    expect(isCategoryVisibleWithExclusiveSchedule("drinks", hoursMap, always, "10:00")).toBe(true);
  });

  it("základní nabídka se schová, když běží časové menu", () => {
    const always = new Set(["drinks"]);
    expect(isCategoryVisibleWithExclusiveSchedule("mains", hoursMap, always, "12:30")).toBe(false);
    expect(isCategoryVisibleWithExclusiveSchedule("lunch", hoursMap, always, "12:30")).toBe(true);
    expect(isCategoryVisibleWithExclusiveSchedule("mains", hoursMap, always, "14:00")).toBe(true);
    expect(isCategoryVisibleWithExclusiveSchedule("lunch", hoursMap, always, "14:00")).toBe(false);
  });

  it("bez časových oken je základní nabídka vidět", () => {
    expect(isCategoryVisibleWithExclusiveSchedule("mains", {}, new Set(), "12:30")).toBe(true);
    expect(anyTimedCategoryActive({}, "12:30")).toBe(false);
  });
});

describe("isAlwaysScheduleTimes", () => {
  it("pozná sentinel ALWAYS", () => {
    expect(isAlwaysScheduleTimes("ALWAYS", "ALWAYS")).toBe(true);
    expect(isAlwaysScheduleTimes("always", "Always")).toBe(true);
    expect(isAlwaysScheduleTimes("12:00", "14:00")).toBe(false);
  });
});
