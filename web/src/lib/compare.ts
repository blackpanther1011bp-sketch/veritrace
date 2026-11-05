// Comparateur en rayon : classement des vêtements scannés pendant la visite, du mieux au moins bien noté.
// Aucune dépendance au navigateur : testé avec Node (compare.test.ts).

import type { Grade, Product } from "./types";

const ORDER: Grade[] = ["A", "B", "C", "D", "E"];

export interface Comparison {
  ranked: Product[];
  best: Product;
  worst: Product;
  /** phrase courte sous « Le meilleur ici », ex. « 2,3 fois moins d'impact que le moins bon » (français) */
  summary: string;
  /** même phrase, sous forme de clé de traduction et de valeurs (affichage dans la langue choisie) */
  note: { key: "compare.ratio" | "compare.same" | "compare.diff"; vars: Record<string, string> };
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/** Classe les vêtements (note, puis coût environnemental) ; null s'il y en a moins de deux. */
export function compareProducts(products: ReadonlyArray<Product>): Comparison | null {
  const unique = [...new Map(products.map((p) => [p.ean, p])).values()];
  if (unique.length < 2) return null;
  const cost = (p: Product) => (typeof p.eco_cost === "number" && p.eco_cost > 0 ? p.eco_cost : Number.POSITIVE_INFINITY);
  const ranked = [...unique].sort(
    (a, b) => ORDER.indexOf(a.global_grade) - ORDER.indexOf(b.global_grade) || cost(a) - cost(b) || a.name.localeCompare(b.name, "fr"),
  );
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const sameType = norm(best.category) === norm(worst.category);
  const muchLess = Number.isFinite(cost(best)) && Number.isFinite(cost(worst)) && cost(worst) > cost(best) * 1.15;
  let summary: string;
  let note: Comparison["note"];
  if (sameType && muchLess) {
    const ratio = (cost(worst) / cost(best)).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
    summary = `${ratio} fois moins d'impact que le moins bon (${worst.global_grade})`;
    note = { key: "compare.ratio", vars: { ratio, grade: worst.global_grade } };
  } else if (best.global_grade === worst.global_grade) {
    summary = `Notes proches : tous notés ${best.global_grade}`;
    note = { key: "compare.same", vars: { grade: best.global_grade } };
  } else {
    summary = `Note ${best.global_grade}, contre ${worst.global_grade} pour le moins bon`;
    note = { key: "compare.diff", vars: { best: best.global_grade, worst: worst.global_grade } };
  }
  return { ranked, best, worst, summary, note };
}
