import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copieMoteurOcr } from "./scripts/copy-ocr.mjs";

// En-têtes de sécurité de production (vercel.json), appliqués aussi à `vite preview` pour les tester en local
const vercel = JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url), "utf8")) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const securityHeaders = Object.fromEntries(vercel.headers.flatMap((h) => h.headers.map((x) => [x.key, x.value])));

export default defineConfig({
  preview: { headers: securityHeaders },
  // copieMoteurOcr : moteur de lecture d'étiquettes servi par le site lui-même (dist/ocr)
  plugins: [react(), copieMoteurOcr()],
  build: {
    target: "es2020",
    // le décodeur de codes-barres (WebAssembly) est servi depuis notre propre domaine
    assetsInlineLimit: 0,
  },
});
