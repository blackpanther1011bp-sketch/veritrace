import { PostgrestClient } from "@supabase/postgrest-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Configuration Supabase manquante (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).");
}

// Pas de comptes utilisateurs dans le MVP : seul le client de base de données (léger) est utilisé,
// ce qui garde l'app rapide à charger. La sécurité repose sur les règles RLS de la base.
export const supabase = new PostgrestClient(`${SUPABASE_URL}/rest/v1`, {
  headers: { apikey: SUPABASE_KEY },
});
