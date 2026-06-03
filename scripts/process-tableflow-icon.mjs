import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "public", "branding", "tableflow-logo-source.png");
const masterOut = path.join(root, "public", "branding", "tableflow-icon.png");
const appIcon = path.join(root, "app", "icon.png");
const appApple = path.join(root, "app", "apple-icon.png");

function alphaFromRgb(r, g, b) {
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (lum < 18) return 0;
  if (lum < 42) return Math.round(((lum - 18) / 24) * 255);
  return 255;
}

/** Najde spodní hranici symbolu „t“ (nad řádkem TABLEFLOW). */
function findIconBottomY(data, width, height, channels) {
  const rowCounts = new Array(height).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (data[i + 3] > 12) rowCounts[y]++;
    }
  }

  const maxCount = Math.max(...rowCounts);
  const denseThreshold = maxCount * 0.22;
  const sparseThreshold = maxCount * 0.08;

  let inText = false;
  let textStartY = height;
  for (let y = height - 1; y >= 0; y--) {
    if (rowCounts[y] >= denseThreshold) {
      inText = true;
      textStartY = y;
    } else if (inText && rowCounts[y] <= sparseThreshold) {
      return y;
    }
  }

  const fallback = Math.floor(height * 0.68);
  return Math.min(fallback, height - 1);
}

async function loadWithAlpha() {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      data[i + 3] = alphaFromRgb(data[i], data[i + 1], data[i + 2]);
    }
  }
  return { data, width, height, channels };
}

function boundsInRegion(data, width, channels, y0, y1) {
  let minX = width;
  let minY = y1;
  let maxX = 0;
  let maxY = y0;
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (data[i + 3] > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

async function main() {
  const { data, width, height, channels } = await loadWithAlpha();
  const iconBottomY = findIconBottomY(data, width, height, channels);
  const { minX, minY, maxX, maxY } = boundsInRegion(data, width, channels, 0, iconBottomY);

  const pad = 10;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const right = Math.min(width - 1, maxX + pad);
  const bottom = Math.min(height - 1, maxY + pad);
  const cropW = right - left + 1;
  const cropH = bottom - top + 1;
  const side = Math.max(cropW, cropH);
  const canvas = Buffer.alloc(side * side * channels, 0);
  const offsetX = Math.floor((side - cropW) / 2);
  const offsetY = Math.floor((side - cropH) / 2);

  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const srcI = ((top + y) * width + (left + x)) * channels;
      const dstI = ((offsetY + y) * side + (offsetX + x)) * channels;
      canvas[dstI] = data[srcI];
      canvas[dstI + 1] = data[srcI + 1];
      canvas[dstI + 2] = data[srcI + 2];
      canvas[dstI + 3] = data[srcI + 3];
    }
  }

  const square = sharp(canvas, { raw: { width: side, height: side, channels } }).png();

  await square.clone().png({ compressionLevel: 9 }).toFile(masterOut);
  await square.clone().resize(32, 32).png().toFile(appIcon);
  await square.clone().resize(180, 180).png().toFile(appApple);

  console.log(`Icon crop ${cropW}x${cropH} → square ${side}px`);
  console.log(`Wrote ${masterOut}, ${appIcon}, ${appApple}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
