import crypto from "crypto";

import { secureCompareStrings } from "./secureCompare";

export const DEVICE_SECRET_HEADER = "x-device-secret";

export function generateDeviceSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function verifyDeviceSecret(provided: string | null | undefined, expected: string | null | undefined): boolean {
  const exp = expected?.trim() ?? "";
  if (!exp) return true;
  const got = provided?.trim() ?? "";
  if (!got) return false;
  return secureCompareStrings(got, exp);
}
