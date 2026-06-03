import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "public", "branding", "tableflow-logo-source.png");
const out = path.join(root, "public", "branding", "tableflow-logo.png");

/** Odstraní černé pozadí a ořízne na neprůhledný obsah. */
async function main() {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const alpha = lum < 18 ? 0 : lum < 42 ? Math.round(((lum - 18) / 24) * 255) : 255;
      data[i + 3] = alpha;
      if (alpha > 12) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  await sharp(data, { raw: { width, height, channels } })
    .extract({ left: minX, top: minY, width: cropW, height: cropH })
    .png({ compressionLevel: 9 })
    .toFile(out);

  console.log(`Wrote ${out} (${cropW}x${cropH})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
