// Copie le moteur de lecture de texte (Tesseract) et le modèle de langue dans le site publié :
// la lecture des étiquettes ne dépend ainsi d'aucun service extérieur (CDN).
import { copyFileSync, mkdirSync } from "node:fs";

const out = "dist/ocr";
mkdirSync(`${out}/core`, { recursive: true });
mkdirSync(`${out}/lang`, { recursive: true });
copyFileSync("node_modules/tesseract.js/dist/worker.min.js", `${out}/worker.min.js`);
for (const variant of ["lstm", "simd-lstm", "relaxedsimd-lstm"]) {
  copyFileSync(`node_modules/tesseract.js-core/tesseract-core-${variant}.wasm.js`, `${out}/core/tesseract-core-${variant}.wasm.js`);
}
copyFileSync("node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", `${out}/lang/eng.traineddata.gz`);
console.log("Moteur de lecture d'étiquettes copié dans dist/ocr");
