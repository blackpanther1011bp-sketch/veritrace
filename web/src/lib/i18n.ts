// Langue de l'interface : français (par défaut), arabe standard (lecture de droite à gauche), anglais, espagnol.
//
// - Le dictionnaire français (i18n-fr.ts) fait partie du site ; les autres langues (i18n-xx.ts) et la police arabe ne
//   sont chargées qu'à la demande, pour ne pas alourdir le premier chargement en français.
// - TypeScript vérifie que chaque clé existe dans toutes les langues (type Dict).
// - Ajouter une langue : un fichier i18n-xx.ts, une ligne dans LANGS et une dans LOADERS.
// - t() est une simple fonction : l'application est redessinée entièrement quand la langue change (main.tsx).
// - Les données venues de la base (matières, pays, étapes du calcul) restent en français.

import { useSyncExternalStore } from "react";
import { fr } from "./i18n-fr";

export type Lang = "fr" | "ar" | "en" | "es" | "de" | "pt" | "it";

/** Langues proposées, dans l'ordre du menu, avec leur nom dans la langue elle-même. */
export const LANGS: readonly { code: Lang; name: string; locale: string }[] = [
  { code: "fr", name: "Français", locale: "fr-FR" },
  { code: "ar", name: "العربية", locale: "ar-MA-u-nu-latn" },
  { code: "en", name: "English", locale: "en-GB" },
  { code: "es", name: "Español", locale: "es-ES" },
  { code: "de", name: "Deutsch", locale: "de-DE" },
  { code: "pt", name: "Português", locale: "pt-PT" },
  { code: "it", name: "Italiano", locale: "it-IT" },
];
const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.code === v);
export type Key = keyof typeof fr;
export type Dict = { readonly [K in Key]: string };
/** Clés au pluriel : « base_one » (1) et « base_other » (0, 2 et plus). */
export type PluralKey = { [K in Key]: K extends `${infer B}_one` ? (`${B}_other` extends Key ? B : never) : never }[Key];

const STORAGE_KEY = "vt_lang";

let current: Lang = "fr";
let dict: Dict = fr;
let values: Readonly<Record<string, string>> = {};
let serverMessages: Readonly<Record<string, string>> = {};
const listeners = new Set<() => void>();

type Vars = Record<string, string | number>;

function fill(text: string, vars?: Vars): string {
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

/** Texte de l'interface dans la langue choisie ; {nom} est remplacé par vars.nom. */
export function t(key: Key, vars?: Vars): string {
  return fill(dict[key] ?? fr[key], vars);
}

/** Texte au pluriel : base_one si n vaut 1, base_other sinon ; {n} est remplacé par le nombre. */
export function tn(base: PluralKey, n: number, vars?: Vars): string {
  return t(`${base}_${n === 1 ? "one" : "other"}` as Key, { n, ...vars });
}

/** Libellé d'une valeur de liste envoyée en français au serveur (type de vêtement, pays, sujet…). */
export function tv(value: string): string {
  return values[value] ?? value;
}

/** Message d'erreur du serveur (code stable) : traduit en arabe, tel quel en français (plus précis). */
export function serverMessage(code: string, message: string): string {
  return serverMessages[code] ?? message;
}

export function getLang(): Lang {
  return current;
}

export function isRtl(): boolean {
  return current === "ar";
}

/** Locale des dates : chiffres occidentaux (0-9) dans toutes les langues, comme d'usage au Maroc. */
export function dateLocale(): string {
  return LANGS.find((l) => l.code === current)?.locale ?? "fr-FR";
}

/** Noms des mois (janvier… / يناير…, appellations en usage au Maroc), pour formatPeriod (lib/social.ts). */
export function monthNames(): string[] {
  return t("time.months").split(",");
}

function applyToDocument(lang: Lang): void {
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === "ar" ? "rtl" : "ltr";
}

interface Loaded {
  dict: Dict;
  values: Readonly<Record<string, string>>;
  server: Readonly<Record<string, string>>;
}

const LOADERS: Record<Exclude<Lang, "fr">, () => Promise<Loaded>> = {
  ar: async () => {
    const [mod] = await Promise.all([
      import("./i18n-ar"),
      // police arabe auto-hébergée, chargée seulement en arabe
      import("@fontsource/noto-sans-arabic/arabic-400.css"),
      import("@fontsource/noto-sans-arabic/arabic-700.css"),
    ]);
    return { dict: mod.ar, values: mod.arValues, server: mod.arServer };
  },
  en: async () => {
    const mod = await import("./i18n-en");
    return { dict: mod.en, values: mod.enValues, server: mod.enServer };
  },
  es: async () => {
    const mod = await import("./i18n-es");
    return { dict: mod.es, values: mod.esValues, server: mod.esServer };
  },
  de: async () => {
    const mod = await import("./i18n-de");
    return { dict: mod.de, values: mod.deValues, server: mod.deServer };
  },
  pt: async () => {
    const mod = await import("./i18n-pt");
    return { dict: mod.pt, values: mod.ptValues, server: mod.ptServer };
  },
  it: async () => {
    const mod = await import("./i18n-it");
    return { dict: mod.it, values: mod.itValues, server: mod.itServer };
  },
};

async function load(lang: Lang): Promise<void> {
  if (lang === "fr") {
    dict = fr;
    values = {};
    serverMessages = {};
    return;
  }
  const loaded = await LOADERS[lang]();
  dict = loaded.dict;
  values = loaded.values;
  serverMessages = loaded.server;
}

function save(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // préférence non mémorisée (navigation privée) : sans conséquence
  }
}

/** Langue au premier lancement : celle choisie avant, sinon celle du navigateur. */
export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    // stockage indisponible
  }
  const langs = typeof navigator !== "undefined" ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
  // première langue du téléphone que le site propose ; sinon le français
  for (const l of langs) {
    const code = (l ?? "").slice(0, 2).toLowerCase();
    if (isLang(code)) return code;
  }
  return "fr";
}

/** À appeler avant le premier affichage. */
export async function initLang(): Promise<void> {
  const lang = initialLang();
  try {
    await load(lang);
    current = lang;
  } catch {
    // dictionnaire non chargé (hors connexion) : le site reste utilisable en français
    current = "fr";
    dict = fr;
    values = {};
    serverMessages = {};
  }
  applyToDocument(current);
}

export async function setLang(lang: Lang): Promise<void> {
  if (lang === current) return;
  await load(lang);
  current = lang;
  save(lang);
  applyToDocument(lang);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Langue courante ; le composant est redessiné quand elle change. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}
