/** Konfigurace aktuálního kiosk APK pro tichý update tabletů (env na Vercelu). */

export type KioskAppRelease = {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  sha256: string | null;
};

function trimEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function getKioskAppRelease(): KioskAppRelease | null {
  const versionCodeRaw = trimEnv("KIOSK_APK_VERSION_CODE");
  const versionCode = Number.parseInt(versionCodeRaw, 10);
  if (!Number.isFinite(versionCode) || versionCode < 1) return null;

  let apkUrl = trimEnv("KIOSK_APK_URL");
  if (!apkUrl) {
    const base = trimEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
    if (base) apkUrl = `${base}/releases/tableflow-kiosk.apk`;
  }
  if (!apkUrl.startsWith("https://")) return null;

  const versionName = trimEnv("KIOSK_APK_VERSION_NAME") || String(versionCode);
  const sha256 = trimEnv("KIOSK_APK_SHA256") || null;

  return { versionCode, versionName, apkUrl, sha256 };
}
