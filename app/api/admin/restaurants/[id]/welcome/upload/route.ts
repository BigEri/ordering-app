import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../../../lib/server/adminGuard";
import { userHasRestaurantAccess } from "../../../../../../../lib/server/auth";
import { writeWelcomeImageUpload } from "../../../../../../../lib/server/welcomeImageStorage";
import { prisma } from "../../../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

async function assertWelcomeWrite(session: ReturnType<typeof requireAdminSession>, restaurantId: string) {
  if (session.globalRole === "SUPER_ADMIN") return;
  const a = await userHasRestaurantAccess(session.userId, restaurantId);
  if (!a.ok || a.role !== "RESTAURANT_ADMIN") throw new Error("FORBIDDEN");
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = requireAdminSession(req.headers.get("cookie"));
    const { id } = await ctx.params;
    const restaurantId = id?.trim() ?? "";
    if (!restaurantId) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    await assertWelcomeWrite(session, restaurantId);

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
    }

    const exists = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!exists?.id) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const mime = (file.type || "").split(";")[0]!.trim().toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());

    let publicPath: string;
    try {
      const out = await writeWelcomeImageUpload(restaurantId, buf, mime);
      publicPath = out.publicPath;
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "UNSUPPORTED_MIME") {
        return NextResponse.json({ ok: false, error: "Nepodporovaný typ souboru (JPEG, PNG, WebP)." }, { status: 400 });
      }
      if (code === "TOO_LARGE") {
        return NextResponse.json({ ok: false, error: "Soubor je příliš velký (max. 10 MB)." }, { status: 400 });
      }
      if (code === "INVALID_IMAGE" || code === "INVALID_ID") {
        return NextResponse.json({ ok: false, error: "Neplatný obrázek." }, { status: 400 });
      }
      throw e;
    }

    return NextResponse.json({ ok: true, imageUrl: publicPath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
