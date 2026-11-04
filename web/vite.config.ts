import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copieMoteurOcr } from "./scripts/copy-ocr.mjs";

export default defineConfig({
  // copieMoteurOcr : moteur de lecture d'étiquettes servi par le site lui-même (dist/ocr)
  plugins: [react(), copieMoteurOcr()],
  build: {
    target: "es2020",
    // le décodeur de codes-barres (WebAssembly) est servi depuis notre propre domaine
    assetsInlineLimit: 0,
  },
});
