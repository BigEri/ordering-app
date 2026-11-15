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
});
