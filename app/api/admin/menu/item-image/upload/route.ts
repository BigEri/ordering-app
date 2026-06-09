/** Nahrání menu fotky — S3/R2 pokud je nastaveno v env, jinak lokálně `public/uploads/menu/`. */
import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../../lib/server/adminGuard";
import { nowIso } from "../../../../../../lib/server/db";
import { canEditMenuForRestaurant } from "../../../../../../lib/server/menuEditorAuth";
import { resolveImageMime } from "../../../../../../lib/server/imageMime";
import { tryDeleteStoredMenuImage, writeMenuImageUpload } from "../../../../../../lib/server/menuImageStorage";
import { invalidateMenuOverridesCache } from "../../../../../../lib/server/menuOverridesCached";
import { objectStorageMode } from "../../../../../../lib/server/objectStorage";
import { objectStorageErrorMessage } from "../../../../../../lib/server/objectStorageError";
import { prisma } from "../../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const cookieHeader = req.headers.get("cookie");

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 });
    }

    const restaurantId = String(formData.get("restaurantId") ?? "").trim();
    const menuItemId = String(formData.get("menuItemId") ?? "").trim();
    const file = formData.get("file");

    if (!restaurantId || !menuItemId) {
      return NextResponse.json({ ok: false, error: "Missing restaurantId/menuItemId" }, { status: 400 });
    }

    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
    }

    if (!(await canEditMenuForRestaurant(session, cookieHeader, restaurantId))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const exists = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!exists?.id) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = resolveImageMime(buf, file.type || "");

    let publicPath: string;
    try {
      const out = await writeMenuImageUpload(restaurantId, buf, mime);
      publicPath = out.publicPath;
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "UNSUPPORTED_MIME") {
        return NextResponse.json({ ok: false, error: "Nepodporovaný typ souboru (pouze JPEG, PNG, WebP, GIF)." }, { status: 400 });
      }
      if (code === "TOO_LARGE") {
        return NextResponse.json({ ok: false, error: "Soubor je příliš velký (max. 5 MB)." }, { status: 400 });
      }
      if (code === "INVALID_IMAGE" || code === "INVALID_ID") {
        return NextResponse.json({ ok: false, error: "Neplatný obrázek." }, { status: 400 });
      }
      const storage = objectStorageErrorMessage(e);
      if (storage) {
        return NextResponse.json({ ok: false, error: storage }, { status: 502 });
      }
      throw e;
    }

    const prev = await prisma.menuImage.findUnique({
      where: { restaurantId_menuItemId: { restaurantId, menuItemId } },
      select: { imageUrl: true },
    });
    const oldUrl = prev?.imageUrl ?? null;

    const ts = nowIso();
    try {
      await prisma.menuImage.upsert({
        where: { restaurantId_menuItemId: { restaurantId, menuItemId } },
        update: { imageUrl: publicPath, imagePublicId: null, updatedAtIso: ts, updatedByUserId: session.userId },
        create: {
          restaurantId,
          menuItemId,
          imageUrl: publicPath,
          imagePublicId: null,
          updatedAtIso: ts,
          updatedByUserId: session.userId,
        },
      });
    } catch (e) {
      await tryDeleteStoredMenuImage(publicPath);
      throw e;
    }

    await tryDeleteStoredMenuImage(oldUrl);

    invalidateMenuOverridesCache(restaurantId);
    return NextResponse.json({ ok: true, imageUrl: publicPath, storage: objectStorageMode() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const storage = objectStorageErrorMessage(e);
    if (storage) return NextResponse.json({ ok: false, error: storage }, { status: 502 });
    console.error("[menu item-image upload]", e);
    return NextResponse.json({ ok: false, error: "Nahrání selhalo (server)." }, { status: 500 });
  }
}
