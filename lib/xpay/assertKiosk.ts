import { DEVICE_SECRET_HEADER, verifyDeviceSecret } from "../server/deviceSecret";
import { getKioskDeviceBinding } from "../server/kioskDeviceBindings";
import { checkRateLimit } from "../server/rateLimit";
import { resolvePosTrustFromPayload } from "../pos/resolvePosTrustFromPayload";
import { sanitizePosPayloadForServer } from "../pos/forwardPos";

export async function assertKioskPosRequest(
  req: Request,
  body: unknown,
): Promise<
  | { ok: true; restaurantId: string; deviceId: string; sanitized: Record<string, unknown> }
  | { ok: false; status: number; error: string }
> {
  const sanitizedRaw = sanitizePosPayloadForServer(body);
  if (!sanitizedRaw || typeof sanitizedRaw !== "object" || Array.isArray(sanitizedRaw)) {
    return { ok: false, status: 400, error: "Invalid payload" };
  }
  const sanitized = sanitizedRaw as Record<string, unknown>;
  const deviceId = typeof sanitized.deviceId === "string" ? sanitized.deviceId.trim() : "";
  if (!deviceId) return { ok: false, status: 400, error: "Missing deviceId" };

  const rl = checkRateLimit(`xpay:${deviceId}`, 40, 60 * 1000);
  if (!rl.ok) {
    return { ok: false, status: 429, error: "Too many requests" };
  }

  const binding = await getKioskDeviceBinding(deviceId);
  if (binding && !verifyDeviceSecret(req.headers.get(DEVICE_SECRET_HEADER), binding.deviceSecret)) {
    return { ok: false, status: 403, error: "Invalid device credentials" };
  }

  const posTrust = await resolvePosTrustFromPayload(sanitized);
  if (!posTrust.ok) return { ok: false, status: posTrust.status, error: posTrust.error };

  return {
    ok: true,
    restaurantId: posTrust.restaurantId,
    deviceId,
    sanitized: { ...sanitized, restaurantId: posTrust.restaurantId },
  };
}
