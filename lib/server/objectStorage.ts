import fs from "node:fs/promises";
import path from "node:path";

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";

import { objectStorageErrorMessage } from "./objectStorageError";

export type ObjectStorageConfig = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  /** Veřejná CDN / custom doména, např. https://pub-xxx.r2.dev */
  publicUrlBase: string;
  forcePathStyle: boolean;
};

let cachedClient: S3Client | null = null;
let cachedConfig: ObjectStorageConfig | null | undefined;

/** Pouze pro unit testy — invalidace cache po změně env. */
export function resetObjectStorageCacheForTests(): void {
  cachedConfig = undefined;
  cachedClient = null;
}

function isR2Endpoint(endpoint: string | undefined): boolean {
  return Boolean(endpoint?.includes(".r2.cloudflarestorage.com"));
}

function isR2PublicBase(publicUrlBase: string): boolean {
  return /\.r2\.dev/i.test(publicUrlBase);
}

export function getObjectStorageConfig(): ObjectStorageConfig | null {
  if (cachedConfig !== undefined) return cachedConfig;

  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const publicUrlBaseRaw = process.env.S3_PUBLIC_URL_BASE?.trim().replace(/\/$/, "");
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;

  if (!bucket || !accessKeyId || !secretAccessKey || !publicUrlBaseRaw) {
    cachedConfig = null;
    return null;
  }

  const publicUrlBase = publicUrlBaseRaw;
  if (isR2PublicBase(publicUrlBase) && !endpoint) {
    cachedConfig = null;
    return null;
  }
  if (endpoint && /pub-.*\.r2\.dev/i.test(endpoint)) {
    cachedConfig = null;
    return null;
  }

  const r2 = isR2Endpoint(endpoint);
  const forceEnv = process.env.S3_FORCE_PATH_STYLE?.trim();
  const forcePathStyle =
    forceEnv === "1" ? true : forceEnv === "0" ? false : r2;

  cachedConfig = {
    bucket,
    accessKeyId,
    secretAccessKey,
    region: process.env.S3_REGION?.trim() || "auto",
    endpoint,
    publicUrlBase,
    forcePathStyle,
  };
  return cachedConfig;
}

/** Pro /api/health — proč upload na Vercel nemusí fungovat. */
export function getObjectStorageConfigHint(): string | null {
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const publicUrlBase = process.env.S3_PUBLIC_URL_BASE?.trim();
  const endpoint = process.env.S3_ENDPOINT?.trim();

  if (!bucket || !accessKeyId || !secretAccessKey || !publicUrlBase) {
    return "missing_env";
  }
  try {
    if (publicUrlBase && /\.r2\.dev/i.test(publicUrlBase) && !endpoint) {
      return "r2_missing_endpoint";
    }
  } catch {
    return "invalid_public_url_base";
  }
  if (publicUrlBase.includes("r2.cloudflarestorage.com")) {
    return "endpoint_should_be_api_not_public";
  }
  return null;
}

export function isObjectStorageEnabled(): boolean {
  return getObjectStorageConfig() !== null;
}

export function objectStorageMode(): "s3" | "local" {
  return isObjectStorageEnabled() ? "s3" : "local";
}

function s3Client(cfg: ObjectStorageConfig): S3Client {
  if (cachedClient) return cachedClient;
  const opts: S3ClientConfig = {
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    forcePathStyle: cfg.forcePathStyle,
  };
  if (cfg.endpoint) opts.endpoint = cfg.endpoint;
  cachedClient = new S3Client(opts);
  return cachedClient;
}

export function publicUrlForObjectKey(key: string): string {
  const cfg = getObjectStorageConfig();
  if (!cfg) throw new Error("Object storage not configured");
  const k = key.replace(/^\/+/, "");
  return `${cfg.publicUrlBase}/${k}`;
}

/** Ověří, že URL patří našemu bucketu/CDN (ne libovolné https). */
export function isManagedObjectStorageUrl(imageUrl: string): boolean {
  const cfg = getObjectStorageConfig();
  if (!cfg) return false;
  const u = imageUrl.trim();
  if (!u.startsWith(`${cfg.publicUrlBase}/`)) return false;
  try {
    const parsed = new URL(u);
    const base = new URL(cfg.publicUrlBase);
    return parsed.origin === base.origin;
  } catch {
    return false;
  }
}

export function objectKeyFromPublicUrl(imageUrl: string): string | null {
  const cfg = getObjectStorageConfig();
  if (!cfg) return null;
  const u = imageUrl.trim();
  const prefix = `${cfg.publicUrlBase}/`;
  if (!u.startsWith(prefix)) return null;
  const key = u.slice(prefix.length).split("?")[0] ?? "";
  if (!key || key.includes("..")) return null;
  return key;
}

export async function putObjectStorageFile(input: {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<{ publicUrl: string; key: string }> {
  const cfg = getObjectStorageConfig();
  if (!cfg) throw new Error("STORAGE_NOT_CONFIGURED");

  const key = input.key.replace(/^\/+/, "");
  if (!key || key.includes("..")) throw new Error("INVALID_KEY");

  try {
    await s3Client(cfg).send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: input.cacheControl ?? "public, max-age=31536000, immutable",
      }),
    );
  } catch (err) {
    const friendly = objectStorageErrorMessage(err);
    if (friendly) throw new Error(`STORAGE_UPLOAD_FAILED:${friendly}`);
    throw err;
  }

  return { publicUrl: publicUrlForObjectKey(key), key };
}

export function isServerlessReadOnlyFs(): boolean {
  return Boolean(process.env.VERCEL);
}

export async function deleteObjectStorageFileByUrl(imageUrl: string | null | undefined): Promise<void> {
  const key = imageUrl ? objectKeyFromPublicUrl(imageUrl) : null;
  if (!key) return;

  const cfg = getObjectStorageConfig();
  if (!cfg) return;

  try {
    await s3Client(cfg).send(
      new DeleteObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
      }),
    );
  } catch {
    /* soubor už nemusí existovat */
  }
}

/** Pro health check: relativní /uploads/… → absolutní HTTPS. */
export function absolutePublicImageUrl(imageUrl: string): string | null {
  const u = imageUrl.trim();
  if (!u) return null;
  if (/^https:\/\//i.test(u)) return u;
  if (!u.startsWith("/")) return null;
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  return `${base}${u}`;
}

export async function writeLocalPublicFile(input: {
  segments: string[];
  fileName: string;
  body: Buffer;
}): Promise<{ publicPath: string }> {
  const safeSegments = input.segments.filter((s) => s && !s.includes("..") && !s.includes("/") && !s.includes("\\"));
  const dir = path.join(process.cwd(), "public", ...safeSegments);
  const pubRoot = path.resolve(dir);
  const fsPath = path.join(pubRoot, input.fileName);
  if (!fsPath.startsWith(pubRoot + path.sep) && fsPath !== pubRoot) {
    throw new Error("INVALID_PATH");
  }
  await fs.mkdir(pubRoot, { recursive: true });
  await fs.writeFile(fsPath, input.body);
  const publicPath = `/${safeSegments.join("/")}/${input.fileName}`;
  return { publicPath };
}
