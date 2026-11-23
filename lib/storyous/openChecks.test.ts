import { describe, expect, it } from "vitest";

import { parseStoryousOpenChecks, pickStoryousTargetCheck, storyousDeskBillFromChecks } from "./openChecks";

describe("parseStoryousOpenChecks", () => {
  it("treats an empty data array as readable with no open check", () => {
    expect(parseStoryousOpenChecks({ data: [], ok: 1 })).toEqual({ readable: true, checks: [] });
  });

  it("is unreadable when the body has no list", () => {
    expect(parseStoryousOpenChecks({ ok: 0, error: "x" }).readable).toBe(false);
    expect(parseStoryousOpenChecks(null).readable).toBe(false);
  });

  it("reads the live /checks response from Storyous POS", () => {
    const parsed = parseStoryousOpenChecks(
      {
        data: [
          {
            checkId: "04d1652cdd1fef56",
            name: null,
            deskId: "132",
            items: [
              {
                checkItemId: "9043687a65ce6426",
                productId: "p:5cmo2cXNn",
                title: "Rajčatová",
                marketingTitle: "",
                vatId: 100,
                vatRate: 0.12,
                priceWithVat: 56,
                priceWithVatWithoutAdditions: 56,
                amount: 2,
                state: "ordered",
                note: null,
                measure: "pcs",
                additions: [],
              },
              {
                checkItemId: "7ec2f23f40bb9294",
                productId: "p:6cjcxMXJs",
                title: "Hovězí tatarák",
                priceWithVat: 123,
                priceWithVatWithoutAdditions: 123,
                amount: 1,
                state: "ordered",
                note: null,
                additions: [],
              },
            ],
            reservation: null,
          },
        ],
        ok: 1,
      },
      { deskId: "132" },
    );
    expect(parsed).toEqual({
      readable: true,
      checks: [
        {
          checkId: "04d1652cdd1fef56",
          deskId: "132",
          createdAtMs: 0,
          lines: [
            { name: "Rajčatová", qty: 2, unitPriceCzk: 56 },
            { name: "Hovězí tatarák", qty: 1, unitPriceCzk: 123 },
          ],
          totalCzk: 235,
        },
      ],
    });
  });

  it("does not count additions twice when priceWithVat already includes them", () => {
    const parsed = parseStoryousOpenChecks({
      data: [
        {
          checkId: "c",
          items: [
            {
              title: "Burger",
              priceWithVat: 230,
              priceWithVatWithoutAdditions: 200,
              amount: 1,
              additions: [{ title: "Slanina", priceWithVat: 30, amount: 1 }],
            },
          ],
        },
      ],
    });
    expect(parsed.checks[0]?.lines).toEqual([{ name: "Burger", detail: "Slanina", qty: 1, unitPriceCzk: 230 }]);
  });

  it("reads items in the Bills API shape (price per unit, amount)", () => {
    const parsed = parseStoryousOpenChecks(
      {
        data: [
          {
            checkId: "chk-1",
            deskId: "132",
            sessionCreated: "2026-11-22T12:00:00+01:00",
            finalPrice: "405",
            items: [
              { name: "R Gin & Tonic", amount: 2, price: 180, productId: "p:gin" },
              { name: "Hranolky", amount: 1, price: 45, productId: "p:fries" },
            ],
          },
        ],
      },
      { deskId: "132" },
    );
    expect(parsed.readable).toBe(true);
    expect(parsed.checks).toEqual([
      {
        checkId: "chk-1",
        deskId: "132",
        createdAtMs: Date.parse("2026-11-22T12:00:00+01:00"),
        lines: [
          { name: "R Gin & Tonic", qty: 2, unitPriceCzk: 180 },
          { name: "Hranolky", qty: 1, unitPriceCzk: 45 },
        ],
        totalCzk: 405,
      },
    ]);
  });

  it("reads loyalty-style items (product.name, totalPriceWithVat) and a paymentSessionCode id", () => {
    const parsed = parseStoryousOpenChecks({
      data: [
        {
          paymentSessionCode: "PS-9",
          deskId: "7",
          itemsToPay: [{ checkItemId: "37", product: { productId: "86", name: "Steak" }, amount: 2, totalPriceWithVat: 500 }],
        },
      ],
    });
    expect(parsed.checks[0]).toMatchObject({
      checkId: "PS-9",
      lines: [{ name: "Steak", qty: 2, unitPriceCzk: 250 }],
      totalCzk: 500,
    });
  });

  it("skips closed checks, removed items and checks of another desk", () => {
    const parsed = parseStoryousOpenChecks(
      {
        data: [
          { checkId: "paid", deskId: "1", paidAt: "2026-11-22T12:00:00Z", items: [{ name: "A", amount: 1, price: 10 }] },
          { checkId: "other", deskId: "2", items: [{ name: "B", amount: 1, price: 10 }] },
          {
            checkId: "open",
            deskId: "1",
            items: [
              { name: "C", amount: 1, price: 20 },
              { name: "Storno", amount: 1, price: 30, deleted: true },
            ],
          },
        ],
      },
      { deskId: "1" },
    );
    expect(parsed.checks.map((c) => c.checkId)).toEqual(["open"]);
    expect(parsed.checks[0]?.lines).toEqual([{ name: "C", qty: 1, unitPriceCzk: 20 }]);
  });

  it("hides the 0 Kč staff-call / bill-request signal lines", () => {
    const parsed = parseStoryousOpenChecks(
      {
        data: [
          {
            checkId: "c",
            deskId: "1",
            items: [
              { name: "Pivo", amount: 1, price: 55 },
              { name: "Variabilní položka", note: "Přivolání obsluhy · Stůl 1", amount: 1, price: 0 },
              { name: "Variabilní položka", note: "CHCE ZAPLATIT: 18:30 · STŮL - 1", amount: 1, price: 0 },
              { name: "Dummy", productId: "p:sig", amount: 1, price: 0 },
              { name: "Voda z kohoutku", amount: 1, price: 0 },
            ],
          },
        ],
      },
      { signalProductId: "p:sig" },
    );
    expect(parsed.checks[0]?.lines.map((l) => l.name)).toEqual(["Pivo", "Voda z kohoutku"]);
  });

  it("folds Bills-style addition rows into the parent line", () => {
    const parsed = parseStoryousOpenChecks({
      data: [
        {
          checkId: "c",
          items: [
            { name: "Pizza", amount: 1, price: 55, hasAdditionsWithCode: "add-1" },
            { name: "Extra sýr", amount: 1, price: 15, additionsCode: "add-1" },
          ],
        },
      ],
    });
    expect(parsed.checks[0]?.lines).toEqual([{ name: "Pizza", detail: "Extra sýr", qty: 1, unitPriceCzk: 70 }]);
  });

  it("adds nested additions to the unit price and detail", () => {
    const parsed = parseStoryousOpenChecks({
      data: [
        {
          checkId: "c",
          items: [
            {
              name: "Steak",
              amount: 2,
              unitPriceWithVat: 195,
              additions: [{ name: "Pepřová", countPerMainItem: 1, unitPriceWithVat: 15 }],
            },
          ],
        },
      ],
    });
    expect(parsed.checks[0]?.lines).toEqual([{ name: "Steak", detail: "Pepřová", qty: 2, unitPriceCzk: 210 }]);
  });

  it("leaves paid items out of a partially paid check and recomputes the total", () => {
    const parsed = parseStoryousOpenChecks({
      data: [
        {
          checkId: "c",
          finalPrice: 300,
          items: [
            { name: "Pivo", amount: 1, price: 100, paid: true },
            { name: "Burger", amount: 1, price: 200 },
          ],
        },
      ],
    });
    expect(parsed.checks[0]).toMatchObject({ lines: [{ name: "Burger", qty: 1, unitPriceCzk: 200 }], totalCzk: 200 });
  });
});

describe("storyousDeskBillFromChecks", () => {
  it("merges all open checks of the desk", () => {
    const bill = storyousDeskBillFromChecks([
      { checkId: "a", deskId: "1", createdAtMs: 1, lines: [{ name: "A", qty: 1, unitPriceCzk: 10 }], totalCzk: 10 },
      { checkId: "b", deskId: "1", createdAtMs: 2, lines: [{ name: "B", qty: 2, unitPriceCzk: 5 }], totalCzk: 10 },
    ]);
    expect(bill).toEqual({
      open: true,
      lines: [
        { name: "A", qty: 1, unitPriceCzk: 10 },
        { name: "B", qty: 2, unitPriceCzk: 5 },
      ],
      totalCzk: 20,
      checkIds: ["a", "b"],
    });
  });

  it("is closed without checks", () => {
    expect(storyousDeskBillFromChecks([]).open).toBe(false);
  });
});

describe("pickStoryousTargetCheck", () => {
  it("picks the oldest open check", () => {
    const pick = pickStoryousTargetCheck([
      { checkId: "newer", deskId: "1", createdAtMs: 200, lines: [], totalCzk: 0 },
      { checkId: "older", deskId: "1", createdAtMs: 100, lines: [], totalCzk: 0 },
    ]);
    expect(pick?.checkId).toBe("older");
  });

  it("keeps the first check when times are unknown", () => {
    const pick = pickStoryousTargetCheck([
      { checkId: "first", deskId: "1", createdAtMs: 0, lines: [], totalCzk: 0 },
      { checkId: "second", deskId: "1", createdAtMs: 0, lines: [], totalCzk: 0 },
    ]);
    expect(pick?.checkId).toBe("first");
  });

  it("returns null without checks", () => {
    expect(pickStoryousTargetCheck([])).toBeNull();
  });
});
