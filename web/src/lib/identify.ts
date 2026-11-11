// Reconnaître un vêtement absent du registre officiel : marque, nom et type, tirés de la base ouverte de
// codes-barres de Nudger (open4goods, CC BY 4.0). Elle ne dit rien de l'impact : elle sert à afficher le nom du
// vêtement et à préremplir la lecture de l'étiquette.
// Les données sont rangées en 4 096 petits fichiers (un par reste de la division du code-barres par 4 096), publiés
// dans la branche donnees-identification et servis sous /identification/ (voir vercel.json).

import { CATEGORIES } from "./contribute";

export interface Identified {
  brand: string;
  name: string;
  /** Type de vêtement proposé (un des choix de VeriTrace), ou null. */
  category: string | null;
}

const SHARDS = 4096;
const cache = new Map<string, Promise<Identified | null>>();

/** Reste de la division d'un code-barres par 4 096 (calcul chiffre à chiffre : un code dépasse 2^32). */
function shardOf(code: string): number {
  let r = 0;
  for (const ch of code) r = (r * 10 + Number(ch)) % SHARDS;
  return r;
}

async function lookup(ean: string): Promise<Identified | null> {
  const code = ean.replace(/^0+/, "").padStart(13, "0");
  if (!/^\d{13}$/.test(code)) return null;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 5000);
  try {
    const res = await fetch(`/identification/${String(shardOf(code)).padStart(4, "0")}.json`, { signal: abort.signal });
    if (!res.ok) return null;
    const entry = ((await res.json()) as Record<string, unknown>)[code];
    if (!Array.isArray(entry) || typeof entry[0] !== "string" || typeof entry[1] !== "string") return null;
    const category = (CATEGORIES as readonly string[]).includes(entry[2] as string) ? (entry[2] as string) : null;
    return { brand: entry[0], name: entry[1], category };
  } catch {
    // hors ligne, fichier absent ou illisible : le vêtement reste simplement « non répertorié »
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Marque, nom et type d'un vêtement inconnu du registre, ou null. Une seule requête par code-barres. */
export function identify(ean: string): Promise<Identified | null> {
  let found = cache.get(ean);
  if (!found) {
    found = lookup(ean);
    cache.set(ean, found);
  }
  return found;
}
