import { describe, expect, it, vi } from "vitest";

import { retryOnTransientConnection } from "./prismaTransient";

describe("retryOnTransientConnection", () => {
  it("returns the first result without reconnecting", async () => {
    const reconnect = vi.fn(async () => {});
    const run = vi.fn(async () => "ok");
    await expect(retryOnTransientConnection(run, reconnect)).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(1);
    expect(reconnect).not.toHaveBeenCalled();
  });

  it("does not retry a non-connection error", async () => {
    const reconnect = vi.fn(async () => {});
    const run = vi.fn(async () => {
      throw new Error("unique constraint");
    });
    await expect(retryOnTransientConnection(run, reconnect)).rejects.toThrow("unique constraint");
    expect(run).toHaveBeenCalledTimes(1);
    expect(reconnect).not.toHaveBeenCalled();
  });

  it("reconnects once when Neon cannot be reached", async () => {
    const reconnect = vi.fn(async () => {});
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("Can't reach database server at `example.neon.tech:5432`"))
      .mockResolvedValueOnce("ok");
    await expect(retryOnTransientConnection(run, reconnect)).resolves.toBe("ok");
    expect(reconnect).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("reconnects again when the Prisma engine is not connected yet", async () => {
    vi.useFakeTimers();
    try {
      const reconnect = vi.fn(async () => {});
      const run = vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error("Engine is not yet connected."))
        .mockRejectedValueOnce(new Error("Invalid `prisma.kioskDeviceBinding.findUnique()` invocation:\n\nEngine is not yet connected."))
        .mockResolvedValueOnce("ok");
      const pending = retryOnTransientConnection(run, reconnect);
      await vi.runAllTimersAsync();
      await expect(pending).resolves.toBe("ok");
      expect(reconnect).toHaveBeenCalledTimes(2);
      expect(run).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops after the engine still refuses the connection", async () => {
    vi.useFakeTimers();
    try {
      const reconnect = vi.fn(async () => {});
      const run = vi.fn(async () => {
        throw new Error("Engine is not yet connected.");
      });
      const pending = retryOnTransientConnection(run, reconnect);
      const assertion = expect(pending).rejects.toThrow(/not yet connected/);
      await vi.runAllTimersAsync();
      await assertion;
      expect(reconnect).toHaveBeenCalledTimes(4);
      expect(run).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
  });
});
