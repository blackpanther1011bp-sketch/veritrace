// Lecture du texte d'une photo d'étiquette, directement dans le navigateur (Tesseract, logiciel libre) :
// gratuit, aucune photo n'a besoin d'être analysée sur un serveur. Le moteur et le modèle de langue
// (~5 Mo, hébergés par le site) sont téléchargés au premier usage puis gardés en cache par le navigateur.

// Un texte d'étiquette exploitable contient au moins un pourcentage et une matière
const LOOKS_LIKE_LABEL =
  /(\d\s*%|%\s*\d)[\s\S]*?(cot+on|coton|algod|polyest|poliest|elast|viscos|lin\b|linen|wool|laine|lana|nylon|polyam|acryl|modal|lyocell|baumwoll|pamuk)|(cot+on|coton|algod|polyest|poliest|elast|viscos|linen|wool|laine|nylon|polyam|acryl|baumwoll|pamuk)[\s\S]*?\d\s*%/i;

export function looksLikeLabel(text: string): boolean {
  return LOOKS_LIKE_LABEL.test(text);
}

/** Moteur de lecture prêt à l'emploi (fichiers servis par le site lui-même, voir scripts/copy-ocr.mjs). */
export async function createOcrWorker() {
  const { createWorker } = await import("tesseract.js");
  const base = `${window.location.origin}/ocr`;
  return createWorker("eng", 1, { workerPath: `${base}/worker.min.js`, corePath: `${base}/core`, langPath: `${base}/lang` });
}

/**
 * Lit le texte de la photo. Si la photo est tournée (étiquette prise de travers), on réessaie à 90°, 270°
 * puis 180°, jusqu'à obtenir un texte d'étiquette. Renvoie le meilleur texte trouvé.
 */
export async function readTextFromPhoto(photo: Blob, onProgress?: (step: string) => void): Promise<string> {
  onProgress?.("Préparation de la lecture…");
  const worker = await createOcrWorker();
  try {
    let best = "";
    const angles = [0, Math.PI / 2, -Math.PI / 2, Math.PI];
    for (let i = 0; i < angles.length; i++) {
      onProgress?.(i === 0 ? "Lecture de l'étiquette…" : `Lecture de l'étiquette (photo tournée, essai ${i + 1}/4)…`);
      const options = i === 0 ? { rotateAuto: true } : { rotateRadians: angles[i] };
      const { data } = await worker.recognize(photo, options);
      const text = data.text ?? "";
      if (looksLikeLabel(text)) return text;
      if (text.trim().length > best.trim().length) best = text;
    }
    return best;
  } finally {
    await worker.terminate();
  }
}
