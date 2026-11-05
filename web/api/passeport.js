// Fonction Vercel : page de partage d'un passeport numérique (`/passeport/<id>`, voir les « rewrites » de
// vercel.json). Les robots d'aperçu (WhatsApp, Facebook, LinkedIn, iMessage) y lisent les balises Open Graph du
// passeport ; un visiteur reçoit la même page, qui démarre l'app normalement.
//
// D'où vient le HTML de l'app : celui du déploiement en cours (index.html du build, avec ses fichiers aux noms
// hachés), récupéré d'abord sur l'adresse que le visiteur a ouverte (domaine public : jamais protégé par
// mot de passe), sinon sur l'adresse propre au déploiement (VERCEL_URL), puis gardé en mémoire. On ne l'inclut pas dans
// le paquet de la fonction (includeFiles) : la doc Vercel ne garantit pas que la sortie du build (dist/) existe au
// moment où les fonctions sont empaquetées. Si cette récupération échoue (déploiement protégé par mot de passe…),
// une page de secours garde les balises d'aperçu et renvoie vers l'app (/#/passeport/<id>).

import { renderPassportPage } from "../server/partage.js";

// Projet Supabase et clé « publishable » : publiques par conception (déjà dans l'app), la base est protégée par RLS.
// Mêmes valeurs que web/.env (vérifié par server/partage.test.ts).
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "https://vqegfoncyrqivtrbvorg.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_8qXYZf-_89RyBG8poHxY3Q_bVWAVbnZ";

let template = null;

async function loadTemplate(origins) {
  if (template) return template;
  for (const origin of origins) {
    try {
      const res = await fetch(`${origin}/index.html`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) continue;
      const html = await res.text();
      if (!html.includes('id="root"')) continue;
      template = html;
      return template;
    } catch {
      // adresse injoignable : on essaie la suivante
    }
  }
  return null;
}

async function fetchPassport(id) {
  const fields = "id,product_name,company,city,eco_cost,env_grade";
  const res = await fetch(`${SUPABASE_URL}/rest/v1/passports?select=${fields}&id=eq.${id}`, {
    headers: { apikey: SUPABASE_KEY, Accept: "application/json" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Supabase HTTP ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

/** Adresse publique du site (domaine de production), pour les liens absolus des balises d'aperçu. */
function siteOrigin(request) {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod && /^[a-z0-9.-]+$/i.test(prod)) return `https://${prod}`;
  return new URL(request.url).origin;
}

export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const origins = [url.origin, process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null].filter(Boolean);
  const page = await renderPassportPage({ id, origin: siteOrigin(request), fetchPassport, loadTemplate: () => loadTemplate(origins) });
  return new Response(page.body, { status: page.status, headers: page.headers });
}
