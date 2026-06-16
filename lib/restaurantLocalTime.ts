/** Časová zóna provozu (poznámky v Dotyce, POS log). */
export const RESTAURANT_TIME_ZONE = "Europe/Prague";

/** HH:mm v českém čase (nezávisle na UTC serveru na Vercelu). */
export function formatRestaurantLocalHhmm(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: RESTAURANT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh}:${mm}`;
}
