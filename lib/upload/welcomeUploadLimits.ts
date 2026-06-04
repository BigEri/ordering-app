/** Sdílený limit pro welcome upload (klient + server). */
export const WELCOME_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export const WELCOME_UPLOAD_MAX_LABEL = "10 MB";

export function formatUploadSizeMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 10) return `${mb.toFixed(0)} MB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function isWelcomeUploadTooLarge(fileSize: number): boolean {
  return fileSize > WELCOME_UPLOAD_MAX_BYTES;
}

export function welcomeFileTooLargeMessage(fileSize?: number): string {
  const base = `Soubor je příliš velký (max. ${WELCOME_UPLOAD_MAX_LABEL}).`;
  if (fileSize != null && fileSize > WELCOME_UPLOAD_MAX_BYTES) {
    return `${base} Váš soubor má ${formatUploadSizeMb(fileSize)}.`;
  }
  return base;
}

/** Zpráva z neúspěšné upload odpovědi (tělo už musí být přečtené jako text). */
export function messageFromWelcomeUploadFailure(
  res: Response,
  bodyText: string,
  fileSize?: number,
): string {
  if (res.status === 413 || (fileSize != null && isWelcomeUploadTooLarge(fileSize))) {
    return welcomeFileTooLargeMessage(fileSize);
  }

  const trimmed = bodyText.trim();
  if (trimmed) {
    try {
      const j = JSON.parse(trimmed) as { error?: string };
      if (typeof j.error === "string" && j.error.trim()) return j.error.trim();
    } catch {
      const lower = trimmed.toLowerCase();
      if (
        lower.includes("too large") ||
        lower.includes("entity too large") ||
        lower.includes("payload too large") ||
        lower.includes("request body exceeded")
      ) {
        return welcomeFileTooLargeMessage(fileSize);
      }
    }
  }

  if (res.status === 400) return "Neplatný soubor nebo požadavek.";
  if (res.status === 401) return "Nejste přihlášeni.";
  if (res.status === 403) return "Nemáte oprávnění nahrávat obrázky.";
  if (res.status >= 500) return "Chyba serveru při nahrávání. Zkuste menší soubor nebo to později.";
  if (res.status >= 400) return `Nahrání selhalo (HTTP ${res.status}).`;
  return "Nahrání selhalo.";
}
