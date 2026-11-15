import { describe, expect, it } from "vitest";

import { isPrismaMissingColumnError, isPrismaTransientConnectionError, prismaErrorCode } from "./prismaKnownError";

describe("prismaKnownError", () => {
  it("reads Prisma error.code", () => {
    expect(prismaErrorCode({ code: "P2022" })).toBe("P2022");
    expect(prismaErrorCode(new Error("nope"))).toBeNull();
    expect(prismaErrorCode(null)).toBeNull();
  });

  it("detects missing-column errors", () => {
    expect(isPrismaMissingColumnError({ code: "P2022", message: "column does not exist" })).toBe(true);
    expect(isPrismaMissingColumnError({ code: "P2025" })).toBe(false);
  });

  it("detects closed Neon / pool connection errors", () => {
    expect(isPrismaTransientConnectionError({ code: "P1017" })).toBe(true);
    expect(
      isPrismaTransientConnectionError({
        message: "Invalid `prisma.restaurantStoryous.updateMany()` invocation:\n\nServer has closed the connection.",
      }),
    ).toBe(true);
    expect(isPrismaTransientConnectionError({ code: "P2024" })).toBe(true);
    expect(isPrismaTransientConnectionError({ code: "P2022" })).toBe(false);
    expect(
      isPrismaTransientConnectionError({
        name: "PrismaClientInitializationError",
        message:
          "Invalid `prisma.restaurant.findUnique()` invocation:\n\n\nCan't reach database server at `example.neon.tech:5432`",
      }),
    ).toBe(true);
  });
});
