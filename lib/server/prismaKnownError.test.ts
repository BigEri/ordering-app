import { describe, expect, it } from "vitest";

import { isPrismaMissingColumnError, prismaErrorCode } from "./prismaKnownError";

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
});
