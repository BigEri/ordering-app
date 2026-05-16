const fs = require("fs");
try {
  fs.rmSync(".next", { recursive: true, force: true });
} catch {
  /* složka neexistuje */
}
