/** Detekce MIME obrázku z hlavičky souboru (tablet často pošle prázdný file.type). */

const SUPPORTED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.slice(0, 3).toString("ascii") === "GIF") return "image/gif";
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

/** Preferuje deklarovaný typ z prohlížeče, jinak sniff z bajtů. */
export function resolveImageMime(buf: Buffer, declaredType: string): string {
  const declared = (declaredType || "").split(";")[0]!.trim().toLowerCase();
  if (declared && declared !== "application/octet-stream" && SUPPORTED.has(declared)) {
    return declared;
  }
  return sniffImageMime(buf) ?? declared;
}
