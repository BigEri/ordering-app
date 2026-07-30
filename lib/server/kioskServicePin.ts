import crypto from "crypto";

/** Stejný algoritmus jako Android KioskServicePin: SHA-256(pin + salt) hex lowercase. */
export function hashKioskServicePin(pin: string, salt: string): string {
  return crypto.createHash("sha256").update(`${pin}${salt}`, "utf8").digest("hex");
}

export function createKioskServicePinSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function normalizeKioskServicePin(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const pin = raw.trim();
  if (!/^\d{4,12}$/.test(pin)) return null;
  return pin;
}

export function buildKioskServicePinCredentials(pin: string): {
  kioskServicePinSalt: string;
  kioskServicePinHash: string;
} {
  const kioskServicePinSalt = createKioskServicePinSalt();
  const kioskServicePinHash = hashKioskServicePin(pin, kioskServicePinSalt);
  return { kioskServicePinSalt, kioskServicePinHash };
}
