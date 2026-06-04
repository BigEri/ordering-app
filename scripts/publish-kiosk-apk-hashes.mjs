import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apk = path.join(__dirname, "..", "public", "releases", "tableflow-kiosk.apk");

if (!fs.existsSync(apk)) {
  console.error("Missing:", apk);
  console.error("Copy signed release APK there, then set KIOSK_APK_* on Vercel.");
  process.exit(1);
}

const buf = fs.readFileSync(apk);
const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
console.log("KIOSK_APK_SHA256=" + sha256);
console.log("size_bytes=" + buf.length);
