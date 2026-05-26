import fs from "node:fs/promises";
import path from "node:path";

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

/** Veřejná cesta sloužící jako imageUrl v DB (lokální režim). */
export const MENU_UPLOAD_PUBLIC_PREFIX = "/uploads/menu";

const MAX_BYTES = 5 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export function isAllowedStoredImageUrl(imageUrl: string, restaurantId: string, maxLen: number): boolean {
  if (imageUrl.length > maxLen) return false;
  if (isManagedObjectStorageUrl(imageUrl)) {
    return imageUrl.includes(`/menu/${restaurantId}/`);
  }
  if (/^https?:\/\//i.test(imageUrl)) return true;
  const prefix = `${MENU_UPLOAD_PUBLIC_PREFIX}/${restaurantId}/`;
  return imageUrl.startsWith(prefix);
}

function validateMagicBytes(buf: Buffer, mime: string): boolean {
  if (buf.length < 12) return false;
  if (mime === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8;
  if (mime === "image/png") return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (mime === "image/gif") return buf.slice(0, 3).toString("ascii") === "GIF";
  if (mime === "image/webp") {
    return buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

/** Nahrání menu fotky — S3/R2 v produkci, jinak `public/uploads/menu/`. */
export async function writeMenuImageUpload(
  restaurantId: string,
  buffer: Buffer,
  mimeDeclared: string,
): Promise<{ publicPath: string }> {
  const mime = resolveImageMime(buffer, mimeDeclared);
  const ext = MIME_TO_EXT[mime];
  if (!ext) throw new Error("UNSUPPORTED_MIME");
  if (buffer.length > MAX_BYTES) throw new Error("TOO_LARGE");
  if (!validateMagicBytes(buffer, mime)) throw new Error("INVALID_IMAGE");

  if (restaurantId.includes("..") || restaurantId.includes("/") || restaurantId.includes("\\")) {
    throw new Error("INVALID_ID");
  }

  const name = `${randomUuid()}${ext}`;

  if (isObjectStorageEnabled()) {
    const { publicUrl } = await putObjectStorageFile({
      key: `menu/${restaurantId}/${name}`,
      body: buffer,
      contentType: mime,
    });
    return { publicPath: publicUrl };
  }

  if (isServerlessReadOnlyFs()) {
    throw new Error("STORAGE_NOT_CONFIGURED");
  }

  const local = await writeLocalPublicFile({
    segments: ["uploads", "menu", restaurantId],
    fileName: name,
    body: buffer,
  });
  return { publicPath: local.publicPath };
}

export function filesystemPathFromPublicMenuUrl(imageUrl: string): string | null {
  if (!imageUrl.startsWith(`${MENU_UPLOAD_PUBLIC_PREFIX}/`)) return null;
  const rel = imageUrl.replace(/^\//, "");
  const full = path.join(process.cwd(), "public", ...rel.split("/"));
  const resolved = path.resolve(full);
  const pubRoot = path.resolve(path.join(process.cwd(), "public", "uploads", "menu"));
  if (!resolved.startsWith(pubRoot + path.sep)) return null;
  return resolved;
}

export async function tryDeleteStoredMenuImage(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl?.trim()) return;
  if (isManagedObjectStorageUrl(imageUrl)) {
    await deleteObjectStorageFileByUrl(imageUrl);
    return;
  }
  if (!imageUrl.startsWith(MENU_UPLOAD_PUBLIC_PREFIX)) return;
  const fsPath = filesystemPathFromPublicMenuUrl(imageUrl);
  if (!fsPath) return;
  try {
    await fs.unlink(fsPath);
  } catch {
    /* ignore */
  }
}

/** @deprecated použijte tryDeleteStoredMenuImage */
export async function tryDeleteLocalMenuImageFile(imageUrl: string | null | undefined): Promise<void> {
  return tryDeleteStoredMenuImage(imageUrl);
}
