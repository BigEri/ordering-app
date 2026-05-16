import crypto from "crypto";

type Key = Buffer;

function readKeyFromEnv(): Key | null {
  const raw = process.env.DOTYKACKA_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) return null;

  // 64 hex chars -> 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  // base64 -> 32 bytes (or more; hash down)
  try {
    const b = Buffer.from(raw, "base64");
    if (b.length === 32) return b;
    if (b.length > 0) return crypto.createHash("sha256").update(b).digest();
  } catch {
    /* ignore */
  }

  // fallback: hash utf8 string into 32 bytes
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(s: string): Buffer {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return Buffer.from(b64 + pad, "base64");
}

/**
 * Encrypt small secret with AES-256-GCM.
 * Output: enc:v1:<iv_b64url>.<ct_b64url>.<tag_b64url>
 */
export function encryptDotykackaSecret(plaintext: string): string {
  const key = readKeyFromEnv();
  if (!key) {
    throw new Error("Missing DOTYKACKA_TOKEN_ENCRYPTION_KEY");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${b64url(iv)}.${b64url(ct)}.${b64url(tag)}`;
}

export function isEncryptedDotykackaSecret(value: string): boolean {
  return value.trim().startsWith("enc:v1:");
}

export function decryptDotykackaSecret(value: string): string {
  const key = readKeyFromEnv();
  if (!key) {
    throw new Error("Missing DOTYKACKA_TOKEN_ENCRYPTION_KEY");
  }
  const v = value.trim();
  if (!v.startsWith("enc:v1:")) return v;
  const rest = v.slice("enc:v1:".length);
  const parts = rest.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format");
  }
  const iv = fromB64url(parts[0]!);
  const ct = fromB64url(parts[1]!);
  const tag = fromB64url(parts[2]!);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

