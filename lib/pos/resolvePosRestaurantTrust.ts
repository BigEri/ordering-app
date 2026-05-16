/**
 * Určení provozovny pro POS / Dotykačku — nespoléhá na klientem poslané `restaurantId`,
 * pokud existuje vazba zařízení (kiosk_device_bindings / admin binding / presence + default).
 */
export function resolvePosRestaurantForOrder(params: {
  deviceId: string;
  clientRestaurantId: string;
  /** Z getEffectiveTable — jen neprázdné restaurantId. */
  effectiveRestaurantId: string | null;
  /** SELECT COUNT(*) FROM restaurants */
  restaurantRowCount: number;
  /** getDefaultPublicMenuRestaurantId() — jediná / PUBLIC_RESTAURANT_ID */
  defaultRestaurantId: string | null;
}):
  | { ok: true; restaurantId: string }
  | { ok: false; status: number; error: string } {
  const clientRid = params.clientRestaurantId.trim();
  const deviceId = params.deviceId.trim();
  const eff = params.effectiveRestaurantId?.trim() ?? "";

  if (deviceId && eff) {
    if (clientRid && clientRid !== eff) {
      return { ok: false, status: 403, error: "Restaurant does not match device binding" };
    }
    return { ok: true, restaurantId: eff };
  }

  if (params.restaurantRowCount <= 1 && params.defaultRestaurantId) {
    const only = params.defaultRestaurantId.trim();
    if (clientRid && clientRid !== only) {
      return { ok: false, status: 403, error: "Restaurant mismatch" };
    }
    return { ok: true, restaurantId: only };
  }

  if (deviceId) {
    return { ok: false, status: 403, error: "Unknown or unpaired device for this installation" };
  }

  return { ok: false, status: 403, error: "Missing device context for orders" };
}
