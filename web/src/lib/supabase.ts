import { PostgrestClient } from "@supabase/postgrest-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Configuration Supabase manquante (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).");
}

// Pas de comptes utilisateurs dans le MVP : seul le client de base de données (léger) est utilisé,
// ce qui garde l'app rapide à charger. La sécurité repose sur les règles RLS de la base.
/** Délai maximal d'un appel à la base : sur un réseau de magasin faible, l'écran « Réessayer » plutôt qu'une attente sans fin. */
export const REQUEST_TIMEOUT_MS = 12_000;

export const timedFetch: typeof fetch = (input, init = {}) => {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = init.signal && "any" in AbortSignal ? AbortSignal.any([init.signal, timeout]) : (init.signal ?? timeout);
  return fetch(input, { ...init, signal });
};

export const supabase = new PostgrestClient(`${SUPABASE_URL}/rest/v1`, {
  headers: { apikey: SUPABASE_KEY },
  fetch: timedFetch,
});
