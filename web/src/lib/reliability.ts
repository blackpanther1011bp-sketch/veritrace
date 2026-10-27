import type { Confidence, DataSource } from "./types";

export const SOURCE_LABEL: Record<DataSource, string> = {
  demo: "Données fictives (démo)",
  marque: "Transmises par la marque",
  etiquette: "Relevées sur l'étiquette",
  estimation: "Estimation (valeurs par défaut)",
  registre: "Déclarées par la marque (registre officiel)",
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  haute: "Haute",
  moyenne: "Moyenne",
  faible: "Faible",
};

export const CONFIDENCE_STYLE: Record<Confidence, { color: string; background: string }> = {
  haute: { color: "#1F6B4A", background: "#DDF2E5" },
  moyenne: { color: "#7A5B00", background: "#FCF1CF" },
  faible: { color: "#A3361F", background: "#FCE6E1" },
};

export const CONFIDENCE_HELP: Record<Confidence, string> = {
  haute: "Composition, poids et pays de fabrication fournis par la marque.",
  moyenne: "Composition et pays de confection connus ; le reste suit les valeurs par défaut d'Ecobalyse.",
  faible: "Peu d'informations connues : le calcul utilise surtout les valeurs par défaut d'Ecobalyse, volontairement pénalisantes.",
};

/** « 26 oct. 2026 » ; null si la date est absente ou illisible. */
export function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function formatNumber(value: number | null, digits = 1): string | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(value).toLocaleString("fr-FR", { maximumFractionDigits: digits });
}

/** Lien cliquable uniquement pour les adresses web. */
export function isWebLink(value: string | null): value is string {
  return !!value && /^https?:\/\//i.test(value.trim());
}
