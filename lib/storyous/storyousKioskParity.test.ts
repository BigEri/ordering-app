import { describe, expect, it } from "vitest";

import { badgesFromStoryousLabels } from "./labels";
import { mapStoryousMenuTree } from "./mapMenu";
import { parseStoryousPaidBills, latestPaidBillForDesk } from "./paidBill";
import { applyStoryousRemainingAmounts, isStoryousTimeWindowActive, mapStoryousTimeBasedSections } from "./timeBasedMenu";
import { buildStoryousDeliveryItems, orderIdFromStoryousDeliveryResponse } from "./syncOrder";
import { storyousCategoryNumber } from "./mapMenu";

const priced = {
  placeValues: { priceLevels: { default: { price: 180 } }, showInPos: true, additionCategoryIds: ["ac:sauces"] },
};

describe("badgesFromStoryousLabels", () => {
  it("maps vegan / recommended / popular", () => {
    expect(badgesFromStoryousLabels(["Veganské", "Doporučujeme"])).toEqual(["vegan", "recommended"]);
    expect(badgesFromStoryousLabels([{ name: "Popular hit" }])).toEqual(["popular"]);
  });
});

describe("mapStoryousMenuTree additions", () => {
  it("attaches addition groups to products", () => {
    const sections = mapStoryousMenuTree({
      items: [
        {
          categoryId: "c:main",
          name: "Hlavní",
          items: [{ productId: "p:steak", name: "Steak", ...priced }],
        },
      ],
      additionCategories: [
        {
          additionCategoryId: "ac:sauces",
          title: "Omáčky",
          min: 1,
          max: 1,
          showInPOS: true,
          additions: [{ additionId: "a:pepper", title: "Pepřová", additionPrice: 15 }],
        },
      ],
    });
    const item = sections[0]?.items[0];
    expect(item?.badges).toBeUndefined();
    expect(item?.dotykackaCustomizationGroups).toEqual([
      {
        id: "ac:sauces",
        customizationId: storyousCategoryNumber("ac:sauces"),
        sectionLabel: "Omáčky",
        minPick: 1,
        maxPick: 1,
        defaultOptionIds: ["a:pepper"],
        options: [
          {
            id: "a:pepper",
            productId: storyousCategoryNumber("a:pepper"),
            label: "Pepřová",
            priceCzk: 15,
          },
        ],
      },
    ]);
  });

  it("maps labels onto badges", () => {
    const sections = mapStoryousMenuTree({
      items: [
        {
          categoryId: "c:x",
          name: "X",
          items: [
            {
              productId: "p:salad",
              name: "Salát",
              labels: ["vegan"],
              placeValues: { priceLevels: { default: { price: 90 } }, showInPos: true },
            },
          ],
        },
      ],
    });
    expect(sections[0]?.items[0]?.badges).toEqual(["vegan"]);
  });
});

describe("buildStoryousDeliveryItems additions", () => {
  it("forwards additions", () => {
    expect(
      buildStoryousDeliveryItems([
        {
          menuItemId: "p:steak",
          name: "Steak",
          qty: 1,
          unitPriceCzk: 195,
          storyousAdditions: [{ additionId: "a:pepper", countPerMainItem: 1, unitPriceWithVat: 15 }],
        },
      ]),
    ).toEqual([
      {
        itemId: "p:steak",
        count: 1,
        unitPriceWithVat: 195,
        note: "Steak",
        additions: [{ additionId: "a:pepper", countPerMainItem: 1, unitPriceWithVat: 15 }],
      },
    ]);
  });
});

describe("parseStoryousPaidBills", () => {
  it("picks latest paid bill for a desk", () => {
    const bills = parseStoryousPaidBills({
      data: [
        { billId: "old", deskId: "desk-1", status: "paid", totalAmount: 100, paidAt: "2026-09-20T08:00:00.000Z" },
        { billId: "new", deskId: "desk-1", status: "paid", totalAmount: 220, paidAt: "2026-09-20T12:00:00.000Z" },
        { billId: "other", deskId: "desk-2", status: "paid", totalAmount: 50, paidAt: "2026-09-20T13:00:00.000Z" },
      ],
    });
    expect(latestPaidBillForDesk(bills, "desk-1", Date.parse("2026-09-20T09:00:00.000Z"))?.billId).toBe("new");
    expect(latestPaidBillForDesk(bills, "desk-1", Date.parse("2026-09-20T12:30:00.000Z"))).toBeNull();
  });

  it("reads Storyous finalPrice string and sessionCreated", () => {
    const bills = parseStoryousPaidBills({
      data: [
        {
          billId: "BA2018000001",
          deskId: "desk-9",
          refunded: false,
          deleted: false,
          finalPrice: "150.4",
          paidAt: "2018-08-03T14:59:47+02:00",
          sessionCreated: "2018-08-03T14:59:46+02:00",
        },
      ],
    });
    expect(bills[0]).toMatchObject({ billId: "BA2018000001", deskId: "desk-9", totalCzk: 150.4 });
  });
});

describe("storyous time window and remaining", () => {
  it("treats ISO window as closed after till", () => {
    expect(
      isStoryousTimeWindowActive("2026-09-20T08:00:00.000Z", "2026-09-20T10:00:00.000Z", new Date("2026-09-20T11:00:00.000Z")),
    ).toBe(false);
  });

  it("hides sold-out remaining amounts", () => {
    const out = applyStoryousRemainingAmounts(
      [{ categoryId: 1, name: "Oběd", sortOrder: 0, items: [{ id: "p:soup", name: "Polévka", priceCzk: 50 }] }],
      { amounts: { "p:soup": 0 } },
    );
    expect(out).toEqual([]);
  });

  it("maps official timeBased product arrays into Denní menu", () => {
    const sections = mapStoryousTimeBasedSections(
      {
        data: [
          {
            since: "2020-12-02T23:00:00.000Z",
            till: "2020-12-03T23:00:00.000Z",
            timeBasedMenuType: "dailyMenu",
            items: [
              {
                productId: "p:soup",
                name: "Polévka",
                placeValues: { priceLevels: { default: { price: 50 } }, showInPos: true, quantity: 12 },
              },
              {
                productId: "p:gone",
                name: "Vyprodané",
                placeValues: { priceLevels: { default: { price: 80 } }, showInPos: true, quantity: 0 },
              },
            ],
          },
        ],
      },
      {},
      new Date("2020-12-03T12:00:00.000Z"),
    );
    expect(sections[0]?.name).toBe("Denní menu");
    expect(sections[0]?.items.map((i) => i.id)).toEqual(["p:soup"]);
  });
});

describe("orderIdFromStoryousDeliveryResponse", () => {
  it("reads orderId from create and 409 bodies", () => {
    expect(orderIdFromStoryousDeliveryResponse({ orderId: "ord-1", state: "NEW" })).toBe("ord-1");
    expect(orderIdFromStoryousDeliveryResponse({ code: 409, order: { orderId: "ord-2" } })).toBe("ord-2");
  });
});
