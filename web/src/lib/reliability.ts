import { localized } from "./grades";
import { dateLocale } from "./i18n";
import type { Confidence, DataSource } from "./types";

export const SOURCE_LABEL: Record<DataSource, string> = localized({
  demo: "source.demo",
  marque: "source.marque",
  etiquette: "source.etiquette",
  estimation: "source.estimation",
  registre: "source.registre",
});

export const CONFIDENCE_LABEL: Record<Confidence, string> = localized({
  haute: "confidence.haute",
  moyenne: "confidence.moyenne",
  faible: "confidence.faible",
});

export const CONFIDENCE_STYLE: Record<Confidence, { color: string; background: string }> = {
  haute: { color: "#1F6B4A", background: "#DDF2E5" },
  moyenne: { color: "#7A5B00", background: "#FCF1CF" },
  faible: { color: "#A3361F", background: "#FCE6E1" },
};

export const CONFIDENCE_HELP: Record<Confidence, string> = localized({
  haute: "confidenceHelp.haute",
  moyenne: "confidenceHelp.moyenne",
  faible: "confidenceHelp.faible",
});

/** « 26 oct. 2026 » ; null si la date est absente ou illisible. */
export function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(dateLocale(), { day: "numeric", month: "short", year: "numeric" });
}

export function formatNumber(value: number | null, digits = 1): string | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(value).toLocaleString("fr-FR", { maximumFractionDigits: digits });
}

/** Lien cliquable uniquement pour les adresses web. */
export function isWebLink(value: string | null): value is string {
  return !!value && /^https?:\/\//i.test(value.trim());
}
