/**
 * `prisma migrate deploy` na Vercelu padá na P1002, když souběžný deploy drží advisory lock.
 * Opakovat s pauzou — žádná nová migrace se nespustí, jen se počká na zámek.
 */
const { spawn } = require("child_process");

const ATTEMPTS = 6;
const WAIT_MS = 12_000;

function migrateDeploy() {
  return new Promise((resolve) => {
    const child = spawn("npx", ["prisma", "migrate", "deploy"], {
      stdio: "inherit",
      shell: true,
      env: process.env,
    });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  for (let i = 1; i <= ATTEMPTS; i += 1) {
    const code = await migrateDeploy();
    if (code === 0) process.exit(0);
    if (i === ATTEMPTS) process.exit(code);
    console.warn(`[migrate] pokus ${i}/${ATTEMPTS} selhal (často P1002 lock) — čekám ${WAIT_MS / 1000}s`);
    await sleep(WAIT_MS);
  }
})();
