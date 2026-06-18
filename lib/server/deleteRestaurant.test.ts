import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./prisma", () => ({
  prisma: {
    restaurant: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    restaurantWelcome: { findUnique: vi.fn() },
    menuImage: { findMany: vi.fn() },
  },
}));

vi.mock("./welcomeShowcaseCached", () => ({
  invalidateWelcomeShowcaseCache: vi.fn(),
}));

vi.mock("./welcomeImageStorage", () => ({
  tryDeleteStoredWelcomeImage: vi.fn(),
}));

vi.mock("./menuImageStorage", () => ({
  tryDeleteStoredMenuImage: vi.fn(),
}));

import { deleteRestaurantBySuperAdmin } from "./deleteRestaurant";
import { prisma } from "./prisma";

describe("deleteRestaurantBySuperAdmin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("blocks delete when restaurant is PUBLIC_RESTAURANT_ID", async () => {
    vi.stubEnv("PUBLIC_RESTAURANT_ID", "demo-rid-123");
    const result = await deleteRestaurantBySuperAdmin("demo-rid-123");
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("PUBLIC_RESTAURANT_ID"),
      status: 409,
    });
    expect(prisma.restaurant.delete).not.toHaveBeenCalled();
  });
});
