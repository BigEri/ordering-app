const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function pickNodeExe() {
  const override = process.env.ORDERING_APP_NATIVE_NODE;
  if (override && exists(override)) return override;

  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files\\nodejs\\node.exe",
      "C:\\Program Files (x86)\\nodejs\\node.exe",
    ];
    for (const c of candidates) {
      if (exists(c)) return c;
    }
  }

  return process.execPath;
}

function rebuildWithNode(nodeExe) {
  const nodeDir = path.dirname(nodeExe);
  const npmCli = path.join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js");

  const env = { ...process.env };
  env.PATH = `${nodeDir};${env.PATH}`;

  if (exists(npmCli)) {
    return spawnSync(nodeExe, [npmCli, "rebuild", "better-sqlite3"], {
      cwd: root,
      stdio: "inherit",
      env,
    });
  }

  const npmCmd = path.join(nodeDir, process.platform === "win32" ? "npm.cmd" : "npm");
  if (exists(npmCmd)) {
    return spawnSync(npmCmd, ["rebuild", "better-sqlite3"], {
      cwd: root,
      stdio: "inherit",
      env,
      shell: process.platform === "win32",
    });
  }

  return spawnSync("npm", ["rebuild", "better-sqlite3"], {
    cwd: root,
    stdio: "inherit",
    env,
    shell: true,
  });
}

const nodeExe = pickNodeExe();
if (process.platform === "win32" && nodeExe !== process.execPath) {
  // Důvod: Cursor často dává do PATH vlastní Node (jiné ABI) dřív než systémový,
  // zatímco `next dev` typicky běží na Node z `C:\Program Files\nodejs\`.
  console.log(`rebuild-better-sqlite3: using ${nodeExe}`);
}

const result = rebuildWithNode(nodeExe);
if (result.error) throw result.error;
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
