import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  storyousPostJson: vi.fn(),
  fetchStoryousDeskChecks: vi.fn(),
  fetchStoryousMenuTree: vi.fn(),
}));

vi.mock("./client", () => client);
vi.mock("../server/publicAppUrl", () => ({ getPublicAppBaseUrl: () => "" }));

import type { StoryousRestaurantConfig } from "./config";
import { syncBillRequestToStoryous, syncOrderConfirmedToStoryous, syncStaffCallToStoryous } from "./syncOrder";

const cfg = {
  clientId: "c",
  clientSecret: "s",
  apiBase: "https://api.test",
  authUrl: "https://login.test",
  merchantId: "m",
  placeId: "p",
} as unknown as StoryousRestaurantConfig;

const SIGNAL_MENU = {
  items: [
    {
      categoryId: "c:x",
      name: "X",
      items: [
        {
          productId: "p:dummy",
          name: "Variabilní položka 0%",
          isPriceVariable: true,
          placeValues: { priceLevels: { default: { price: 0 } }, showInPos: true },
        },
      ],
    },
  ],
};

const ORDER = {
  tableId: "132",
  tableLabel: "Stůl 1",
  clientRequestId: "req-1",
  lines: [{ menuItemId: "p:beer", name: "Pivo", qty: 2, unitPriceCzk: 55 }],
};

function openChecks(...checks: { checkId: string; sessionCreated?: string }[]) {
  return {
    ok: true,
    json: { data: checks.map((c) => ({ ...c, deskId: "132", items: [{ name: "Pivo", amount: 1, price: 55 }] })) },
  };
}

function postedBodies(): Record<string, unknown>[] {
  return client.storyousPostJson.mock.calls.map((call) => call[2] as Record<string, unknown>);
}

beforeEach(() => {
  client.storyousPostJson.mockReset();
  client.fetchStoryousDeskChecks.mockReset();
  client.fetchStoryousMenuTree.mockReset();
  client.fetchStoryousMenuTree.mockResolvedValue(SIGNAL_MENU);
  client.storyousPostJson.mockResolvedValue({ ok: true, status: 200, json: { orderId: "ord-1" } });
});

describe("syncOrderConfirmedToStoryous", () => {
  it("adds the order to the oldest open check of the table", async () => {
    client.fetchStoryousDeskChecks.mockResolvedValue(
      openChecks(
        { checkId: "newer", sessionCreated: "2026-11-22T13:00:00Z" },
        { checkId: "older", sessionCreated: "2026-11-22T12:00:00Z" },
      ),
    );
    const r = await syncOrderConfirmedToStoryous(ORDER, cfg);
    expect(r).toMatchObject({ ok: true, meta: { deliveryType: "orderToCheck", checkId: "older", orderId: "ord-1" } });
    expect(postedBodies()).toHaveLength(1);
    expect(postedBodies()[0]).toMatchObject({ deliveryType: "orderToCheck", checkId: "older", externalId: "req-1" });
    expect(postedBodies()[0]).not.toHaveProperty("deskId");
  });

  it("opens the table account when the table has no open check", async () => {
    client.fetchStoryousDeskChecks.mockResolvedValue({ ok: true, json: { data: [], ok: 1 } });
    const r = await syncOrderConfirmedToStoryous(ORDER, cfg);
    expect(r).toMatchObject({ ok: true, meta: { deliveryType: "orderToTable" } });
    expect(postedBodies()[0]).toMatchObject({ deliveryType: "orderToTable", deskId: "132" });
    expect(postedBodies()[0]).not.toHaveProperty("checkId");
  });

  it("falls back to the table with the same externalId when the check is refused", async () => {
    client.fetchStoryousDeskChecks.mockResolvedValue(openChecks({ checkId: "chk" }));
    client.storyousPostJson
      .mockResolvedValueOnce({ ok: false, status: 400, text: "checkId not found" })
      .mockResolvedValueOnce({ ok: true, status: 200, json: { orderId: "ord-2" } });
    const r = await syncOrderConfirmedToStoryous(ORDER, cfg);
    expect(r).toMatchObject({
      ok: true,
      meta: { deliveryType: "orderToTable", orderId: "ord-2", checkFallbackError: expect.stringContaining("400") },
    });
    expect(postedBodies().map((b) => [b.deliveryType, b.externalId])).toEqual([
      ["orderToCheck", "req-1"],
      ["orderToTable", "req-1"],
    ]);
  });

  it("keeps the previous behaviour when /checks cannot be read", async () => {
    client.fetchStoryousDeskChecks.mockResolvedValue({ ok: false, error: "Storyous 404" });
    const r = await syncOrderConfirmedToStoryous(ORDER, cfg);
    expect(r).toMatchObject({ ok: true, meta: { deliveryType: "orderToTable", checksUnavailable: "Storyous 404" } });
  });

  it("treats a duplicate externalId (409) as already sent", async () => {
    client.fetchStoryousDeskChecks.mockResolvedValue({ ok: true, json: { data: [] } });
    client.storyousPostJson.mockResolvedValue({ ok: false, status: 409, text: '{"orderId":"ord-9"}' });
    const r = await syncOrderConfirmedToStoryous(ORDER, cfg);
    expect(r).toMatchObject({ ok: true, meta: { action: "delivery_order_exists", orderId: "ord-9" } });
  });
});

describe("syncBillRequestToStoryous", () => {
  const BILL = { tableId: "132", tableLabel: "Stůl 1", clientRequestId: "bill-1", paymentMethod: "card" };

  it("answers BILL_EMPTY without writing to the till when the table has no open check", async () => {
    client.fetchStoryousDeskChecks.mockResolvedValue({ ok: true, json: { data: [], ok: 1 } });
    const r = await syncBillRequestToStoryous(BILL, cfg);
    expect(r).toMatchObject({ ok: false, code: "BILL_EMPTY" });
    expect(client.storyousPostJson).not.toHaveBeenCalled();
  });

  it("puts the bill request on the open check", async () => {
    client.fetchStoryousDeskChecks.mockResolvedValue(openChecks({ checkId: "chk" }));
    const r = await syncBillRequestToStoryous(BILL, cfg);
    expect(r).toMatchObject({ ok: true, meta: { deliveryType: "orderToCheck", checkId: "chk" } });
    const body = postedBodies()[0]!;
    expect(body.items).toEqual([expect.objectContaining({ itemId: "p:dummy", unitPriceWithVat: 0 })]);
  });

  it("still sends the request when /checks cannot be read", async () => {
    client.fetchStoryousDeskChecks.mockResolvedValue({ ok: false, error: "down" });
    const r = await syncBillRequestToStoryous(BILL, cfg);
    expect(r.ok).toBe(true);
    expect(postedBodies()[0]).toMatchObject({ deliveryType: "orderToTable" });
  });
});

describe("syncStaffCallToStoryous", () => {
  it("calls staff even on an empty table", async () => {
    client.fetchStoryousDeskChecks.mockResolvedValue({ ok: true, json: { data: [] } });
    const r = await syncStaffCallToStoryous({ tableId: "132", clientRequestId: "staff-1" }, cfg);
    expect(r).toMatchObject({ ok: true, meta: { deliveryType: "orderToTable" } });
    expect(postedBodies()[0]?.note).toBe("Přivolání obsluhy · Stůl 132");
  });
});
