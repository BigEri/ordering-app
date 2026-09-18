import { DEVICE_SECRET_HEADER } from "../server/deviceSecret";
import { getKioskDeviceSecretForPos } from "./kioskDeviceSecretStore";

/**
 * Klient volající naše /api/pos/* route handlery.
 * Kontroluje HTTP stav, JSON `{ ok: false }` a `forwardedStatus` z virtuálního POS.
 */
export type PostPosJsonResult =
  | { ok: true }
  | { ok: false; kind: "network" | "http"; status?: number; detail?: string; body?: unknown };

function nestedPosError(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const err = (value as { error?: unknown }).error;
  return typeof err === "string" && err.trim() ? err.trim() : undefined;
}

export function extractPosErrorDetail(data: unknown): string | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const d = data as Record<string, unknown>;
  for (const key of ["storyous", "dotykacka", "till"] as const) {
    const nested = nestedPosError(d[key]);
    if (nested) return nested;
  }
  const top = d.error;
  if (typeof top === "string" && top.trim()) return top.trim();
  return undefined;
}

export async function postPosJson(url: string, body: unknown): Promise<PostPosJsonResult> {
  const r = await postPosJsonData<Record<string, unknown>>(url, body);
  if (!r.ok) return r;
  return { ok: true };
}

export async function postPosJsonData<T = Record<string, unknown>>(
  url: string,
  body: unknown,
): Promise<
  { ok: true; data: T } | { ok: false; kind: "network" | "http"; status?: number; detail?: string; body?: unknown }
> {
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    const secret = getKioskDeviceSecretForPos();
    if (secret) headers[DEVICE_SECRET_HEADER] = secret;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* tělo nemusí být JSON */
    }

    const detail = extractPosErrorDetail(data);

    if (!res.ok) {
      return { ok: false, kind: "http", status: res.status, detail, body: data };
    }

    if (data && typeof data === "object" && "ok" in data && (data as { ok: unknown }).ok === false) {
      return { ok: false, kind: "http", status: res.status, detail, body: data };
    }

    const forwardedStatus =
      data && typeof data === "object" && "forwardedStatus" in data
        ? (data as { forwardedStatus?: number }).forwardedStatus
        : undefined;
    if (typeof forwardedStatus === "number" && forwardedStatus >= 400) {
      return { ok: false, kind: "http", status: forwardedStatus, detail };
    }

    return { ok: true, data: (data ?? {}) as T };
  } catch {
    return { ok: false, kind: "network" };
  }
}
