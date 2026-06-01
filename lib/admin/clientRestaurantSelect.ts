/** POST aktivní provozovny — cookie `oa_rid` (stejné jako tlačítko na Přehledu). */
export async function postSelectActiveRestaurant(restaurantId: string): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch("/api/admin/restaurant/select", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ restaurantId }),
  });
  const j = (await r.json()) as { ok?: boolean; error?: string };
  if (!r.ok || !j.ok) {
    return { ok: false, error: j.error ?? "Nepodařilo se načíst vaši restauraci." };
  }
  return { ok: true };
}
