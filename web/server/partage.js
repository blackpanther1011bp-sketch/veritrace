// Page de partage d'un passeport numérique : `/passeport/<id>` renvoie la page de l'app (le HTML du build) avec
// des balises Open Graph et Twitter propres au passeport, pour que WhatsApp, Facebook, LinkedIn ou iMessage
// affichent un aperçu (titre, coût environnemental, image). Logique pure, sans dépendance : utilisée par la
// fonction Vercel api/passeport.js et testée avec Node (partage.test.ts).

/** Identifiant public d'un passeport : 12 caractères hexadécimaux. */
export const PASSPORT_ID = /^[0-9a-f]{12}$/;

const SITE_NAME = "VeriTrace";
const GENERIC = {
  title: "Passeport numérique · VeriTrace",
  description:
    "Passeport numérique d'un vêtement : coût environnemental calculé avec Ecobalyse à partir des données du fabricant, chaîne de fabrication et QR code.",
};

/** Échappe un texte pour un attribut ou un contenu HTML. */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Nombre au format français, espace fine insécable pour les milliers (« 1 266 »). */
export function formatPoints(value) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(Number(value)));
}

const clip = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

/**
 * Balises d'aperçu d'un passeport (null = passeport inconnu : balises génériques).
 * La note VeriTrace est présentée comme indicative : jamais comme un label.
 * @param {{ id: string, product_name?: string, company?: string, city?: string | null, eco_cost?: number, env_grade?: string } | null} passport
 * @param {string} origin ex. « https://veritrace-wine.vercel.app »
 */
export function passportMeta(passport, origin) {
  const image = { url: `${origin}/partage-passeport.jpg`, width: 1200, height: 630, alt: "VeriTrace, passeport numérique d'un vêtement" };
  if (!passport) return { ...GENERIC, url: `${origin}/`, image };
  const who = [passport.company, passport.city].filter(Boolean).join(", ");
  const title = clip(`${passport.product_name ?? "Vêtement"}${passport.company ? ` · ${passport.company}` : ""} · Passeport numérique`, 110);
  const cost = Number.isFinite(Number(passport.eco_cost)) ? `Coût environnemental : ${formatPoints(passport.eco_cost)} points (Ecobalyse, données du fabricant)` : null;
  const grade = passport.env_grade ? `note VeriTrace ${passport.env_grade}, indicative (ni label ni certification)` : null;
  const description = clip([cost && grade ? `${cost} · ${grade}.` : cost ? `${cost}.` : null, who ? `Fabricant : ${who}.` : null].filter(Boolean).join(" "), 300);
  return { title, description: description || GENERIC.description, url: `${origin}/passeport/${passport.id}`, image };
}

/** Balises <head> d'aperçu, échappées. */
export function metaTags(meta) {
  const e = escapeHtml;
  return [
    `<title>${e(meta.title)}</title>`,
    `<meta name="description" content="${e(meta.description)}" />`,
    `<link rel="canonical" href="${e(meta.url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:title" content="${e(meta.title)}" />`,
    `<meta property="og:description" content="${e(meta.description)}" />`,
    `<meta property="og:url" content="${e(meta.url)}" />`,
    `<meta property="og:image" content="${e(meta.image.url)}" />`,
    `<meta property="og:image:type" content="image/jpeg" />`,
    `<meta property="og:image:width" content="${meta.image.width}" />`,
    `<meta property="og:image:height" content="${meta.image.height}" />`,
    `<meta property="og:image:alt" content="${e(meta.image.alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${e(meta.title)}" />`,
    `<meta name="twitter:description" content="${e(meta.description)}" />`,
    `<meta name="twitter:image" content="${e(meta.image.url)}" />`,
  ].join("\n    ");
}

/**
 * Remplace, dans le HTML du build, le titre et les balises d'aperçu par celles du passeport (une seule fois
 * chacune). Le reste du document (scripts et feuilles de style aux noms hachés) est gardé tel quel.
 */
export function injectMeta(template, meta) {
  const cleaned = template
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/<meta\s+(?:property|name)="(?:og:[^"]*|twitter:[^"]*|description)"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "");
  const tags = metaTags(meta);
  return /<\/head>/i.test(cleaned) ? cleaned.replace(/<\/head>/i, `    ${tags}\n  </head>`) : `${tags}\n${cleaned}`;
}

/**
 * Page de secours si le HTML du build est introuvable : les balises d'aperçu, puis renvoi vers la page de l'app
 * (sans script : la politique de sécurité du site interdit les scripts en ligne).
 */
export function fallbackPage(meta, appPath) {
  const e = escapeHtml;
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0; url=${e(appPath)}" />
    ${metaTags(meta)}
  </head>
  <body>
    <p><a href="${e(appPath)}">Ouvrir le passeport numérique sur VeriTrace</a></p>
  </body>
</html>
`;
}

/**
 * Réponse de `/passeport/<id>`.
 * @param {{ id: string | null, origin: string, fetchPassport: (id: string) => Promise<object | null>, loadTemplate: () => Promise<string | null> }} deps
 * @returns {Promise<{ status: number, headers: Record<string, string>, body: string }>}
 */
export async function renderPassportPage({ id, origin, fetchPassport, loadTemplate }) {
  const valid = typeof id === "string" && PASSPORT_ID.test(id);
  let passport = null;
  let failed = false;
  if (valid) {
    try {
      passport = await fetchPassport(id);
    } catch {
      failed = true;
    }
  }
  const meta = passportMeta(passport, origin);
  let template = null;
  try {
    template = await loadTemplate();
  } catch {
    template = null;
  }
  const appPath = valid ? `/#/passeport/${id}` : "/";
  const body = template ? injectMeta(template, meta) : fallbackPage(meta, appPath);
  // Passeport trouvé : en cache 5 min sur le CDN ; inconnu : 404 (l'app affiche « Passeport introuvable ») ;
  // base injoignable : 200 sans cache, l'app réessaiera elle-même.
  const status = failed ? 200 : passport ? 200 : 404;
  const cache = failed ? "no-store" : passport ? "public, max-age=0, s-maxage=300, stale-while-revalidate=86400" : "public, max-age=0, s-maxage=60";
  return { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": cache }, body };
}
