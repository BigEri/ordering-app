import { afterEach, describe, expect, it, vi } from "vitest";

const { findFirst, deleteMany, create, executeRaw } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  deleteMany: vi.fn(),
  create: vi.fn(),
  executeRaw: vi.fn(),
}));

vi.mock("./prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        $executeRaw: executeRaw,
        devicePairingCode: { findFirst, deleteMany, create },
      }),
    ),
  },
}));

import { pairingAdvisoryLockKey, upsertDevicePairingCodeAsync } from "./devicePairingCodes";

describe("upsertDevicePairingCodeAsync", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reuses a still-valid unused code instead of deleting it", async () => {
    const expiresAtIso = new Date(Date.now() + 50 * 60 * 1000).toISOString();
    findFirst.mockResolvedValue({ code: "ABC234", expiresAtIso });

    const out = await upsertDevicePairingCodeAsync("tablet-1");

    expect(out).toEqual({ code: "ABC234", expiresAtIso });
    expect(deleteMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(executeRaw).toHaveBeenCalled();
  });

  it("allocates a new code when none exists", async () => {
    findFirst.mockResolvedValue(null);
    deleteMany.mockResolvedValue({ count: 0 });
    create.mockImplementation(async ({ data }: { data: { code: string; expiresAtIso: string } }) => data);

    const out = await upsertDevicePairingCodeAsync("tablet-1");

    expect(out.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(deleteMany).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
  });

  it("rotates even when a valid code exists", async () => {
    const expiresAtIso = new Date(Date.now() + 50 * 60 * 1000).toISOString();
    findFirst.mockResolvedValue({ code: "OLD234", expiresAtIso });
    deleteMany.mockResolvedValue({ count: 1 });
    create.mockImplementation(async ({ data }: { data: { code: string; expiresAtIso: string } }) => data);

    const out = await upsertDevicePairingCodeAsync("tablet-1", { rotate: true });

    expect(out.code).not.toBe("OLD234");
    expect(findFirst).not.toHaveBeenCalled();
    expect(deleteMany).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
  });

  it("issues a new code when the existing one is near expiry", async () => {
    const expiresAtIso = new Date(Date.now() + 60 * 1000).toISOString();
    findFirst.mockResolvedValue({ code: "OLD234", expiresAtIso });
    deleteMany.mockResolvedValue({ count: 1 });
    create.mockImplementation(async ({ data }: { data: { code: string; expiresAtIso: string } }) => data);

    const out = await upsertDevicePairingCodeAsync("tablet-1");

    expect(out.code).not.toBe("OLD234");
    expect(deleteMany).toHaveBeenCalledOnce();
  });

  it("pairingAdvisoryLockKey is stable for the same deviceId", () => {
    expect(pairingAdvisoryLockKey("abc")).toBe(pairingAdvisoryLockKey("abc"));
    expect(pairingAdvisoryLockKey("abc")).not.toBe(pairingAdvisoryLockKey("abd"));
  });
});
