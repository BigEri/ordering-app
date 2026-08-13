import { afterEach, describe, expect, it } from "vitest";

import {
  DOTYKACKA_SIGNAL_TABLE_MAP_KEY,
  buildSignalSessionExternalId,
  resolveSignalTableId,
} from "./staffSignalTable";

describe("staffSignalTable", () => {
  afterEach(() => {
    delete process.env.DOTYKACKA_SIGNAL_TABLE_ID;
  });

  it("resolves table id from product map", () => {
    expect(resolveSignalTableId({ [DOTYKACKA_SIGNAL_TABLE_MAP_KEY]: 99 })).toBe(99);
  });

  it("falls back to DOTYKACKA_SIGNAL_TABLE_ID", () => {
    process.env.DOTYKACKA_SIGNAL_TABLE_ID = "42";
    expect(resolveSignalTableId({})).toBe(42);
  });

  it("prefers map over env", () => {
    process.env.DOTYKACKA_SIGNAL_TABLE_ID = "1";
    expect(resolveSignalTableId({ [DOTYKACKA_SIGNAL_TABLE_MAP_KEY]: 2 })).toBe(2);
  });

  it("returns undefined when unset", () => {
    expect(resolveSignalTableId({})).toBeUndefined();
  });

  it("builds a stable session id per cloud/branch", () => {
    expect(buildSignalSessionExternalId({ cloudId: 1, branchId: 2 })).toBe("ordering-app-1-2-oa-signals");
  });
});
