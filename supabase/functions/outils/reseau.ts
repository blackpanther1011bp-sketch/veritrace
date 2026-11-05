// Adresse du client, pour les quotas (aucune adresse n'est stockée : seule une empreinte du jour l'est).
// Sans dépendance à Deno : testé avec Node (outils.test.ts).

/**
 * Adresse de la connexion, telle que vue par l'infrastructure. La première valeur de X-Forwarded-For peut être
 * écrite par le client lui-même (quota contourné en la changeant à chaque appel) : on prend l'en-tête posé par
 * Cloudflare, sinon la DERNIÈRE valeur de X-Forwarded-For (ajoutée par le proxy de Supabase).
 */
export function clientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const chain = (headers.get("x-forwarded-for") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  return chain.at(-1) ?? headers.get("x-real-ip")?.trim() ?? "inconnue";
}
