/**
 * `prisma migrate deploy` na Vercelu padá na P1002, když:
 * - souběžný deploy drží advisory lock, nebo
 * - DATABASE_URL je Neon **pooler** (pg_advisory_lock tam často timeoutne).
 * Migrace proto používá DIRECT_URL / unpooled host.
 */
const { spawn } = require("child_process");

const ATTEMPTS = 6;
const WAIT_MS = 12_000;

function databaseUrlForMigrate(raw, env = process.env) {
  const direct = (env.DIRECT_URL || env.DATABASE_URL_UNPOOLED || "").trim();
  if (direct) return direct;
  const url = (raw || "").trim();
  if (!url) return url;
  return url.replace("-pooler.", ".");
}

function migrateEnv() {
  const env = { ...process.env };
  const next = databaseUrlForMigrate(process.env.DATABASE_URL, process.env);
  if (next) env.DATABASE_URL = next;
  return env;
}

function migrateDeploy() {
  return new Promise((resolve) => {
    const child = spawn("npx", ["prisma", "migrate", "deploy"], {
      stdio: "inherit",
      shell: true,
      env: migrateEnv(),
    });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

exports.databaseUrlForMigrate = databaseUrlForMigrate;

(async () => {
  if (require.main !== module) return;
  const usingUnpooled =
    Boolean((process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || "").trim()) ||
    (process.env.DATABASE_URL || "").includes("-pooler.");
  if (usingUnpooled) {
    console.warn("[migrate] Prisma migrate přes přímé (unpooled) připojení — Neon pooler nedrží advisory lock.");
  }
  for (let i = 1; i <= ATTEMPTS; i += 1) {
    const code = await migrateDeploy();
    if (code === 0) process.exit(0);
    if (i === ATTEMPTS) process.exit(code);
    console.warn(`[migrate] pokus ${i}/${ATTEMPTS} selhal (často P1002 lock) — čekám ${WAIT_MS / 1000}s`);
    await sleep(WAIT_MS);
  }
})();
