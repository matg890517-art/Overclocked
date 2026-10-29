import { copyFileSync, mkdirSync, statSync } from "node:fs";

const src = "android/app/build/outputs/apk/debug/app-debug.apk";
const dest = "releases/overclocked-debug.apk";
mkdirSync("releases", { recursive: true });
copyFileSync(src, dest);
const mb = statSync(dest).size / 1_000_000;
console.log(`${dest}  ${mb.toFixed(2)} MB`);
if (mb > 100) {
  console.error("APK exceeds 100 MB; do not commit it.");
  process.exit(2);
}
