import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const android = join(dirname(fileURLToPath(import.meta.url)), "..", "android");
const win = process.platform === "win32";
const command = win ? "gradlew.bat" : "./gradlew";
const result = spawnSync(command, ["assembleDebug"], {
  cwd: android,
  stdio: "inherit",
  shell: win,
});
process.exit(result.status ?? 1);
