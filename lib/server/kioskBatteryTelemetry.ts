/** Telemetrie baterie z kiosk APK (`GET /api/devices/config`). */

export type KioskBatteryTelemetry = {
  percent: number;
  charging: boolean;
};

export function parseKioskBatteryQuery(params: {
  batteryPercent?: string | null;
  batteryCharging?: string | null;
}): KioskBatteryTelemetry | null {
  const rawPct = (params.batteryPercent ?? "").trim();
  if (!rawPct) return null;
  const percent = Number.parseInt(rawPct, 10);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  const rawCh = (params.batteryCharging ?? "").trim().toLowerCase();
  const charging = rawCh === "1" || rawCh === "true" || rawCh === "yes";
  return { percent: Math.trunc(percent), charging };
}
