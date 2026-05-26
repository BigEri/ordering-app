/** Srozumitelné chyby z AWS SDK / R2 pro admin upload. */

export function objectStorageErrorMessage(err: unknown): string | null {
  if (err instanceof Error) {
    if (err.message === "STORAGE_NOT_CONFIGURED") {
      return "Na serveru není nakonfigurováno úložiště obrázků (doplňte S3/R2 proměnné na Vercel a redeploy).";
    }
    if (err.message.startsWith("STORAGE_UPLOAD_FAILED:")) {
      return err.message.slice("STORAGE_UPLOAD_FAILED:".length);
    }
  }

  if (!err || typeof err !== "object") return null;
  const e = err as { name?: string; Code?: string; message?: string };
  const code = (e.name || e.Code || "").trim();
  const msg = (e.message || "").trim();

  if (code === "AccessDenied" || /access denied/i.test(msg)) {
    return "Úložiště odmítlo zápis (zkontrolujte R2 token: Object Read & Write pro správný bucket).";
  }
  if (code === "InvalidAccessKeyId" || code === "SignatureDoesNotMatch") {
    return "Neplatné R2/S3 klíče (S3_ACCESS_KEY_ID a S3_SECRET_ACCESS_KEY).";
  }
  if (code === "NoSuchBucket") {
    return "Bucket neexistuje (zkontrolujte S3_BUCKET).";
  }
  if (/ENOTFOUND|getaddrinfo|ECONNREFUSED/i.test(msg)) {
    return "Nelze se připojit k S3_ENDPOINT (zkontrolujte URL R2 API, ne veřejnou pub-….r2.dev adresu).";
  }
  if (code === "InvalidRequest" && /region/i.test(msg)) {
    return "Neplatná S3_REGION (pro Cloudflare R2 použijte auto).";
  }
  if (msg) return `Úložiště obrázků: ${msg.slice(0, 240)}`;
  return null;
}
