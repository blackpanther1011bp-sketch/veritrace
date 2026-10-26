import type { CheckStatus, Grade, Level } from "./types";

export const GRADES: Grade[] = ["A", "B", "C", "D", "E"];

export const GRADE_COLOR: Record<Grade, string> = {
  A: "#4FB37A",
  B: "#A6CF5A",
  C: "#F2C94C",
  D: "#F09A4A",
  E: "#E0614B",
};

export const GRADE_TINT: Record<Grade, string> = {
  A: "#E3F4EA",
  B: "#EEF6DF",
  C: "#FDF6DC",
  D: "#FFF1E4",
  E: "#FCE6E1",
};

export const VERDICT: Record<Grade, { title: string; text: string }> = {
  A: { title: "Excellent choix", text: "Parmi les mieux notés pour ce type de vêtement." },
  B: { title: "Bon choix", text: "Impact maîtrisé, avec quelques points à améliorer." },
  C: { title: "Impact moyen", text: "Correct, mais des options mieux notées existent." },
  D: { title: "Impact élevé", text: "Des options nettement mieux notées existent pour ce vêtement." },
  E: { title: "Impact très élevé", text: "À éviter : de bien meilleures options existent." },
};

export const LEVEL_LABEL: Record<Level, string> = { faible: "Faible", moyen: "Moyen", fort: "Fort" };
export const LEVEL_COLOR: Record<Level, string> = { faible: "#4FB37A", moyen: "#F2C94C", fort: "#E0614B" };
export const LEVEL_TEXT: Record<Level, string> = { faible: "#1F6B4A", moyen: "#7A5B00", fort: "#A3361F" };

export const STATUS_LABEL: Record<CheckStatus, string> = {
  oui: "Oui",
  partiel: "Partielle",
  non: "Non",
  non_communique: "Non communiqué",
};
export const STATUS_STYLE: Record<CheckStatus, { color: string; background: string }> = {
  oui: { color: "#1F6B4A", background: "#DDF2E5" },
  partiel: { color: "#7A5B00", background: "#FCF1CF" },
  non: { color: "#A3361F", background: "#FCE6E1" },
  non_communique: { color: "#4A5A50", background: "#E3E8E4" },
};

export function isBadGrade(grade: Grade): boolean {
  return grade === "D" || grade === "E";
}

/** Résumé en une ligne de la note carbone : le poste le plus lourd. */
export function carbonSummary(breakdown: { level: Level; detail: string; share: number }[]): string {
  const top = [...breakdown].sort((a, b) => b.share - a.share)[0];
  return top ? top.detail : "";
}
