import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { randomUuid } from "../randomUuid";
import { resolveImageMime } from "./imageMime";
import {
  deleteObjectStorageFileByUrl,
  isManagedObjectStorageUrl,
  isObjectStorageEnabled,
  isServerlessReadOnlyFs,
  putObjectStorageFile,
  writeLocalPublicFile,
} from "./objectStorage";

export const WELCOME_UPLOAD_PUBLIC_PREFIX = "/uploads/welcome";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION_PX = 2560;
const WEBP_QUALITY = 80;

const MIME_TO_EXT: Record<string, string> = {
  "image/webp": ".webp",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

function validateMagicBytes(buf: Buffer, mime: string): boolean {
  if (buf.length < 12) return false;
  if (mime === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8;
  if (mime === "image/png") return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (mime === "image/webp") {
    return buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

export function isAllowedWelcomeImageUrl(imageUrl: string, restaurantId: string, maxLen = 2000): boolean {
  if (!imageUrl || imageUrl.length > maxLen) return false;
  if (imageUrl.includes("..")) return false;
  if (isManagedObjectStorageUrl(imageUrl)) {
    return imageUrl.includes(`/welcome/${restaurantId}/`);
  }
  if (/^https?:\/\//i.test(imageUrl)) return true;
  if (imageUrl.startsWith("/images/")) return true;
  const welcomePrefix = `${WELCOME_UPLOAD_PUBLIC_PREFIX}/${restaurantId}/`;
  const menuPrefix = `/uploads/menu/${restaurantId}/`;
  return imageUrl.startsWith(welcomePrefix) || imageUrl.startsWith(menuPrefix);
}

export async function writeWelcomeImageUpload(
  restaurantId: string,
  buffer: Buffer,
  mimeDeclared: string,
): Promise<{ publicPath: string }> {
  const mime = resolveImageMime(buffer, mimeDeclared);
  if (!MIME_TO_EXT[mime]) throw new Error("UNSUPPORTED_MIME");
  if (buffer.length > MAX_BYTES) throw new Error("TOO_LARGE");
  if (!validateMagicBytes(buffer, mime)) throw new Error("INVALID_IMAGE");

  if (restaurantId.includes("..") || restaurantId.includes("/") || restaurantId.includes("\\")) {
    throw new Error("INVALID_ID");
  }

  let outBuf: Buffer;
  try {
    outBuf = await sharp(buffer, { failOn: "error" })
      .rotate()
      .resize({
        width: MAX_DIMENSION_PX,
        height: MAX_DIMENSION_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch {
    throw new Error("INVALID_IMAGE");
  }

  const name = `${randomUuid()}.webp`;

  if (isObjectStorageEnabled()) {
    const { publicUrl } = await putObjectStorageFile({
      key: `welcome/${restaurantId}/${name}`,
      body: outBuf,
      contentType: "image/webp",
    });
    return { publicPath: publicUrl };
  }

  if (isServerlessReadOnlyFs()) {
    throw new Error("STORAGE_NOT_CONFIGURED");
  }

  const local = await writeLocalPublicFile({
    segments: ["uploads", "welcome", restaurantId],
    fileName: name,
    body: outBuf,
  });
  return { publicPath: local.publicPath };
}

function filesystemPathFromPublicWelcomeUrl(imageUrl: string): string | null {
  if (!imageUrl.startsWith(`${WELCOME_UPLOAD_PUBLIC_PREFIX}/`)) return null;
  const rel = imageUrl.replace(/^\//, "");
  const full = path.join(process.cwd(), "public", ...rel.split("/"));
  const resolved = path.resolve(full);
  const pubRoot = path.resolve(path.join(process.cwd(), "public", "uploads", "welcome"));
  if (!resolved.startsWith(pubRoot + path.sep)) return null;
  return resolved;
}

export async function tryDeleteStoredWelcomeImage(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl?.trim()) return;
  if (isManagedObjectStorageUrl(imageUrl)) {
    await deleteObjectStorageFileByUrl(imageUrl);
    return;
  }
  if (!imageUrl.startsWith(WELCOME_UPLOAD_PUBLIC_PREFIX)) return;
  const fsPath = filesystemPathFromPublicWelcomeUrl(imageUrl);
  if (!fsPath) return;
  try {
    await fs.unlink(fsPath);
  } catch {
    /* ignore */
  }
}
