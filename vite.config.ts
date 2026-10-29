import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { host: "0.0.0.0", port: 5173 },
  preview: { host: "0.0.0.0", port: 4173 },
  build: {
    target: "chrome90",
    cssTarget: "chrome90",
    outDir: "dist",
    assetsInlineLimit: 0,
  },
});
