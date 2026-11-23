import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const fetchMenu = vi.fn();

vi.mock("./prisma", () => ({ prisma: { menuImage: { findMany: (...a: unknown[]) => findMany(...a) } } }));
vi.mock("../menu/fetchRestaurantMenu", () => ({ fetchRestaurantMenuCached: (...a: unknown[]) => fetchMenu(...a) }));

import { parseWelcomeMenuItemRef, welcomeMenuItemRef } from "../menu/welcomeMenuItemRef";
import { resolveWelcomeMenuItemPhotos } from "./welcomeMenuItemPhotos";

const caprese = { id: "p:caprese", name: "Insalata Caprese", priceCzk: 149, imageUrl: "https://admin.storyous.com/media/thumbs/c.jpeg" };
const pollo = { id: "p:pollo", name: "Pizza Pollo", priceCzk: 279, imageUrl: "https://admin.storyous.com/media/thumbs/p.jpeg" };
const bez = { id: "p:bez", name: "Rajčatová", priceCzk: 56 };

beforeEach(() => {
  findMany.mockReset();
  fetchMenu.mockReset();
  fetchMenu.mockResolvedValue({ ok: true, source: "storyous", sections: [{ categoryId: 1, name: "X", items: [caprese, pollo, bez] }] });
});

describe("welcomeMenuItemRef", () => {
  it("rozliší odkaz na jídlo od adresy fotky", () => {
    expect(parseWelcomeMenuItemRef(welcomeMenuItemRef("p:caprese"))).toBe("p:caprese");
    expect(parseWelcomeMenuItemRef("https://example.com/a.jpg")).toBeNull();
    expect(parseWelcomeMenuItemRef("menu-item:")).toBeNull();
    expect(parseWelcomeMenuItemRef("menu-item:../x")).toBeNull();
  });
});

describe("resolveWelcomeMenuItemPhotos", () => {
  it("vezme aktuální fotku z pokladny a vlastní fotka z TableFlow má přednost", async () => {
    findMany.mockResolvedValue([{ menuItemId: "p:pollo", imageUrl: "https://r2.example/menu/pollo.webp" }]);
    const out = await resolveWelcomeMenuItemPhotos("rid", [
      welcomeMenuItemRef("p:caprese"),
      welcomeMenuItemRef("p:pollo"),
      "https://example.com/static.jpg",
    ]);
    expect(out.get("p:caprese")).toEqual({ imageUrl: caprese.imageUrl, name: "Insalata Caprese" });
    expect(out.get("p:pollo")).toEqual({ imageUrl: "https://r2.example/menu/pollo.webp", name: "Pizza Pollo" });
    expect(out.size).toBe(2);
  });

  it("jídlo bez fotky vynechá", async () => {
    findMany.mockResolvedValue([]);
    const out = await resolveWelcomeMenuItemPhotos("rid", [welcomeMenuItemRef("p:bez")]);
    expect(out.size).toBe(0);
  });

  it("bez odkazů na jídla nesahá do databáze ani na pokladnu", async () => {
    const out = await resolveWelcomeMenuItemPhotos("rid", ["https://example.com/a.jpg"]);
    expect(out.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
    expect(fetchMenu).not.toHaveBeenCalled();
  });
});
