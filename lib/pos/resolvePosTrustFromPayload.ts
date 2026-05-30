import { getEffectiveTable } from "../server/deviceRegistry";
import { getDefaultPublicMenuRestaurantId } from "../server/publicRestaurantName";
import { prisma } from "../server/prisma";
import { resolvePosRestaurantForOrder } from "./resolvePosRestaurantTrust";

/**
 * Stejná logika jako u forwardPos: provozovna pro Dotykačku / POS podle vazby zařízení,
 * ne podle nedůvěryhodného `restaurantId` z klienta.
 */
export async function resolvePosTrustFromPayload(
  sanitized: unknown,
): Promise<
  | { ok: true; restaurantId: string }
  | { ok: false; status: number; error: string }
> {
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
    return { ok: false, status: 400, error: "Invalid payload" };
  }
  const o = sanitized as Record<string, unknown>;
  const deviceId = typeof o.deviceId === "string" ? o.deviceId.trim() : "";
  const clientRid = typeof o.restaurantId === "string" ? o.restaurantId.trim() : "";

  const eff = deviceId ? await getEffectiveTable(deviceId) : null;
  const effRid = eff?.restaurantId?.trim() ? eff.restaurantId.trim() : null;

  const cnt = await prisma.restaurant.count();

  return resolvePosRestaurantForOrder({
    deviceId,
    clientRestaurantId: clientRid,
    effectiveRestaurantId: effRid,
    restaurantRowCount: cnt,
    defaultRestaurantId: await getDefaultPublicMenuRestaurantId(),
  });
}
