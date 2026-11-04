// Lecture de l'étiquette en direct dans la caméra : contrôles faits sur le téléphone, image après image.
//  - compositionInText : la composition est-elle complète (un bloc de 100 %) ? Tant que ce n'est pas le cas,
//    on n'appelle pas le serveur (pas de calcul ni de quota consommé pour une image floue).
//  - labelLines : où se trouve l'étiquette dans l'image (lignes avec pourcentages ou matières), pour y
//    accrocher la note.
// Le serveur (fonction « outils ») refait la lecture complète et calcule la note avec Ecobalyse.
// Aucune dépendance au navigateur : testé avec Node (labelLive.test.ts).

/** Mots de matières courants sur les étiquettes (texte en minuscules, sans accents). */
const MATERIAL =
  /\b(cot+on|coton|algodon|cotone|baumwolle|katoen|algodao|pamuk|bawelna|polyest\w*|poliest\w*|elast\w*|spandex|lycra|viscos\w*|viskos\w*|viskoz|rayon\w*|modal|lyocell|tencel|linen|lin|lino|leinen|linho|keten|wool|laine|lana|wolle|yun|merino\w*|acryl\w*|acril\w*|akrilik|polyamid\w*|poliamid\w*|poliammid\w*|nylon|naylon|hemp|chanvre|jute|polypropyl\w*|silk|soie|seda|seta|seide|cashmere|cachemire|leather|cuir)\b/;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Mêmes corrections que le serveur pour les erreurs de lecture des pourcentages. */
export function fixOcr(text: string): string {
  return text
    .replace(/(?<!\d\s?)%\s?(\d{1,3}(?:[.,]\d{1,2})?)/g, "$1%")
    .replace(/(\d)[oO](?=\s*%|\d)/g, "$10")
    .replace(/\b[oO](?=\d)/g, "0")
    .replace(/\b(100|[1-9]?\d)\s?96\b(?=\s*[a-z])/gi, "$1%")
    .replace(/\b(100|[1-9]?\d)\s?(?:o\/o|°\/o|0\/0)/gi, "$1%");
}

interface Pair {
  pct: number;
  name: string;
  at: number;
}

// Étiquettes à plusieurs parties : seule la note du tissu principal compte, pas celle de la doublure
const LINING = /\b(lining|doublure|forro|fodera|futter|voering|astar)\b/g;
const MAIN = /\b(shell|outer|main fabric|exterior|exterieur|tissu principal|dessus|body|corps|cuerpo|corpo|tejido principal)\b/g;

function blocksOf(pairs: Pair[]): Pair[][] {
  const blocks: Pair[][] = [];
  let cur: Pair[] = [];
  let sum = 0;
  for (const p of pairs) {
    if (p.pct <= 0 || p.pct > 100) continue;
    cur.push(p);
    sum += p.pct;
    if (sum > 101) {
      cur = [p];
      sum = p.pct;
    }
    if (sum >= 99 && sum <= 101) {
      blocks.push(cur);
      cur = [];
      sum = 0;
    }
  }
  return blocks;
}

export interface LiveComposition {
  /** au moins un pourcentage et une matière lus */
  seen: boolean;
  /** un bloc complet (100 %) a été lu : on peut demander la note au serveur */
  complete: boolean;
  /** aperçu lisible, ex. « 60 % cotton, 40 % polyester » */
  preview: string | null;
}

/** La composition lue dans le texte de l'image est-elle complète ? */
export function compositionInText(raw: string): LiveComposition {
  const clean = normalize(fixOcr(raw)).replace(/[|]/g, " ");
  const collect = (re: RegExp, pctGroup: number, nameGroup: number): Pair[] => {
    const out: Pair[] = [];
    for (const m of clean.matchAll(re)) {
      const word = m[nameGroup].match(MATERIAL)?.[1];
      if (word) out.push({ pct: Number(m[pctGroup].replace(",", ".")), name: word, at: m.index ?? 0 });
    }
    return out;
  };
  const a = collect(/(\d{1,3}(?:[.,]\d{1,2})?)\s*%\s*([a-z][a-z -]{1,40})/g, 1, 2);
  const b = collect(/([a-z][a-z -]{1,30}?)\s*:?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%/g, 2, 1);
  const blocks = blocksOf(a).length > 0 ? blocksOf(a) : blocksOf(b);
  const linings = [...clean.matchAll(LINING)].map((m) => m.index ?? 0);
  const mains = [...clean.matchAll(MAIN)].map((m) => m.index ?? 0);
  const inLining = (at: number) => {
    const l = Math.max(-1, ...linings.filter((i) => i < at));
    const m = Math.max(-1, ...mains.filter((i) => i < at));
    return l >= 0 && l > m;
  };
  // tissu principal lu en entier ; une doublure lue seule ne suffit pas tant que le tissu principal
  // (pourcentages placés avant la mention « doublure ») reste incomplet
  const main = blocks.find((blk) => !inLining(blk[0].at));
  const pairs = a.length > 0 ? a : b;
  const mainPending = linings.length > 0 && pairs.some((p) => p.at < linings[0]);
  const first = main ?? (mainPending ? undefined : blocks[0]);
  return {
    seen: a.length > 0 || b.length > 0,
    complete: Boolean(first),
    preview: first ? first.map((p) => `${String(p.pct).replace(".", ",")} % ${p.name}`).join(", ") : null,
  };
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Lignes de l'étiquette utiles (pourcentage ou matière) et cadre qui les entoure ; null si aucune. */
export function labelLines(lines: ReadonlyArray<{ text: string; bbox: Rect }>): Rect | null {
  let box: Rect | null = null;
  for (const line of lines) {
    const t = normalize(fixOcr(line.text));
    if (!/\d\s*%/.test(t) && !MATERIAL.test(t) && !/made in|fabrique|hecho en|origin/.test(t)) continue;
    const b = line.bbox;
    box = box ? { x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0), x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1) } : { ...b };
  }
  return box;
}
