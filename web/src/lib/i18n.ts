// Langue de l'interface : français (par défaut) ou arabe standard (lecture de droite à gauche).
//
// - Le dictionnaire français (i18n-fr.ts) fait partie du site ; l'arabe (i18n-ar.ts) et sa police ne sont chargés
//   qu'à la demande, pour ne pas alourdir le premier chargement en français.
// - TypeScript vérifie que chaque clé existe dans les deux langues (type Dict).
// - t() est une simple fonction : l'application est redessinée entièrement quand la langue change (main.tsx).
// - Les données venues de la base (matières, pays, étapes du calcul) restent en français.

import { useSyncExternalStore } from "react";
import { fr } from "./i18n-fr";

export type Lang = "fr" | "ar";
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

/** Locale des dates : chiffres occidentaux (0-9) dans les deux langues, comme d'usage au Maroc. */
export function dateLocale(): string {
  return current === "ar" ? "ar-MA-u-nu-latn" : "fr-FR";
}

function applyToDocument(lang: Lang): void {
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === "ar" ? "rtl" : "ltr";
}

async function loadArabic(): Promise<void> {
  const [mod] = await Promise.all([
    import("./i18n-ar"),
    // police arabe auto-hébergée, chargée seulement en arabe
    import("@fontsource/noto-sans-arabic/arabic-400.css"),
    import("@fontsource/noto-sans-arabic/arabic-700.css"),
  ]);
  dict = mod.ar;
  values = mod.arValues;
  serverMessages = mod.arServer;
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
    if (saved === "fr" || saved === "ar") return saved;
  } catch {
    // stockage indisponible
  }
  const langs = typeof navigator !== "undefined" ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
  return langs.some((l) => /^ar\b/i.test(l ?? "")) ? "ar" : "fr";
}

/** À appeler avant le premier affichage. */
export async function initLang(): Promise<void> {
  const lang = initialLang();
  if (lang === "ar") {
    try {
      await loadArabic();
      current = "ar";
    } catch {
      current = "fr";
      dict = fr;
      values = {};
      serverMessages = {};
    }
  }
  applyToDocument(current);
}

export async function setLang(lang: Lang): Promise<void> {
  if (lang === current) return;
  if (lang === "ar") {
    await loadArabic();
  } else {
    dict = fr;
    values = {};
    serverMessages = {};
  }
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
