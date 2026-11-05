// Note sociale sourcée (méthode v1, docs/methode-note-sociale.md) : même barème que la fonction SQL registry_social,
// pour expliquer la note à l'écran (« 4 points sur 5 »). Aucune dépendance au navigateur : testé avec Node.

import type { Grade, SocialCheck } from "./types";

export const SOCIAL_MAX_POINTS = 5;

/** Points d'un critère : usines et contrôle (oui 2, partiel 1), certification de l'entreprise (oui 1). */
export function socialPoints(check: SocialCheck, index: number): number {
  const heavy = index < 2; // ordre fixe renvoyé par la base : usines, contrôle, entreprise
  if (check.status === "oui") return heavy ? 2 : 1;
  if (check.status === "partiel") return heavy ? 1 : 0;
  return 0;
}

/** Critères sourcés : ceux qui portent une source (les données de démonstration n'en ont pas). */
export function isSourced(checks: SocialCheck[]): boolean {
  return checks.length > 0 && checks.every((c) => typeof c.source_url === "string" && c.source_url.startsWith("https://"));
}

/** Total et note d'après le barème ; null si les trois critères n'ont pas tous été vérifiés. */
export function socialScore(checks: SocialCheck[]): { points: number; grade: Grade } | null {
  if (checks.length !== 3 || !isSourced(checks)) return null;
  const points = checks.reduce((sum, c, i) => sum + socialPoints(c, i), 0);
  const grade: Grade = points >= 5 ? "A" : points === 4 ? "B" : points === 3 ? "C" : points === 2 ? "D" : "E";
  return { points, grade };
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « 2022-08 » → « août 2022 » ; « 2025-11-05 » → « 5 novembre 2025 » ; « 2019 » → « 2019 ». */
export function formatPeriod(period: string | null | undefined): string | null {
  if (!period) return null;
  const m = period.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
  if (!m) return null;
  const [, year, month, day] = m;
  if (!month) return year;
  const name = MONTHS[Number(month) - 1];
  if (!name) return year;
  return day ? `${Number(day)} ${name} ${year}` : `${name} ${year}`;
}
