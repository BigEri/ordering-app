const { spawnSync, spawn } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const build = spawnSync(npmCmd, ["run", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
if (build.status !== 0) process.exit(build.status ?? 1);

console.log("");
console.log("  >>> Otevři v prohlížeči (sám – neotevírá se automaticky):");
console.log("      http://localhost:3000");
console.log("      http://localhost:3000/virtual-pos");
console.log("");
console.log("  Nech tohle okno otevřené – běží server. Konec: Ctrl+C.");
console.log("");

spawn(npmCmd, ["run", "start"], { cwd: root, stdio: "inherit", shell: true });
