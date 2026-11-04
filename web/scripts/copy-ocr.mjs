// Copie le moteur de lecture de texte (Tesseract) et le modèle de langue dans le site publié (dist/ocr) :
// la lecture des étiquettes ne dépend ainsi d'aucun service extérieur (CDN).
// Branché sur Vite (vite.config.ts) : la copie se fait à chaque compilation, que Vercel lance
// `vite build` ou `npm run build`.
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

/** Plugin Vite : copie les fichiers de Tesseract à la fin de la compilation. */
export function copieMoteurOcr() {
  let root = process.cwd();
  let outDir = resolve(root, "dist");
  return {
    name: "copie-moteur-ocr",
    apply: "build",
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const from = (path) => resolve(root, "node_modules", path);
      const out = resolve(outDir, "ocr");
      mkdirSync(resolve(out, "core"), { recursive: true });
      mkdirSync(resolve(out, "lang"), { recursive: true });
      copyFileSync(from("tesseract.js/dist/worker.min.js"), resolve(out, "worker.min.js"));
      for (const variant of ["lstm", "simd-lstm", "relaxedsimd-lstm"]) {
        copyFileSync(from(`tesseract.js-core/tesseract-core-${variant}.wasm.js`), resolve(out, "core", `tesseract-core-${variant}.wasm.js`));
      }
      copyFileSync(from("@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz"), resolve(out, "lang", "eng.traineddata.gz"));
      console.log("Moteur de lecture d'étiquettes copié dans dist/ocr");
    },
  };
}
