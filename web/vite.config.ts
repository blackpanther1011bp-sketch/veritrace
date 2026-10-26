import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    // le décodeur de codes-barres (WebAssembly) est servi depuis notre propre domaine
    assetsInlineLimit: 0,
  },
});
