import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { canEditMenuForRestaurant } from "../../../../../lib/server/menuEditorAuth";
import { prisma } from "../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

function looksLikePrivateHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "127.0.0.1" || h === "::1") return true;

  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

async function headCheckImage(url: string, timeoutMs = 7000): Promise<{ ok: boolean; status?: number; reason?: string }> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (u.protocol !== "https:") return { ok: false, reason: "not_https" };
  if (looksLikePrivateHost(u.hostname)) return { ok: false, reason: "private_host" };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Some CDNs return missing/incorrect headers for HEAD even though GET works.
    // Use a tiny ranged GET to reliably receive content-type without downloading the whole image.
    const r = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0", Accept: "image/*,*/*;q=0.8" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    const ct = r.headers.get("content-type") ?? "";
    if (!r.ok) return { ok: false, status: r.status, reason: "http_status" };
    if (!ct.toLowerCase().startsWith("image/")) return { ok: false, status: r.status, reason: "not_image" };
    return { ok: true, status: r.status };
  } catch {
    return { ok: false, reason: "network" };
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const session = requireAdminSession(req.headers.get("cookie"));
    const cookieHeader = req.headers.get("cookie");
    const { searchParams } = new URL(req.url);
    const restaurantId = (searchParams.get("restaurantId") ?? "").trim();
    if (!restaurantId) return NextResponse.json({ ok: false, error: "Missing restaurantId" }, { status: 400 });

    if (!(await canEditMenuForRestaurant(session, cookieHeader, restaurantId))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const exists = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!exists?.id) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const rows = await prisma.menuImage.findMany({
      where: { restaurantId },
      select: { imageUrl: true },
    });
    const urls = rows
      .map((r) => String(r.imageUrl ?? "").trim())
      .filter((u) => u.toLowerCase().startsWith("https://"));

    const checks = await Promise.all(
      urls.map(async (url) => {
        const out = await headCheckImage(url);
        return { url, ...out };
      }),
    );
    const broken = checks.filter((x) => !x.ok);
    return NextResponse.json({ ok: true, broken, checkedCount: checks.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

