// Adresse du client, pour les quotas (aucune adresse n'est stockée : seule une empreinte du jour l'est).
// Sans dépendance à Deno : testé avec Node (outils.test.ts).

/** Adresse privée ou réservée (réseau interne d'un hébergeur) : ce n'est jamais celle d'un téléphone. */
export function isInternalIp(ip: string): boolean {
  const v = ip.trim().toLowerCase().replace(/^::ffff:/, "");
  const m = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 10 || a === 127 || a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127);
  }
  if (v.includes(":")) {
    return v === "::1" || v === "::" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
  }
  return true; // valeur illisible : on ne la prend pas pour une adresse de client
}

/**
 * Adresse de la connexion, telle que vue par l'infrastructure. La première valeur de X-Forwarded-For peut être
 * écrite par le client lui-même (quota contourné en la changeant à chaque appel) : on prend l'en-tête posé par
 * Cloudflare, sinon la valeur publique la plus à droite de X-Forwarded-For (ajoutée par le proxy de Supabase ;
 * les adresses internes ajoutées ensuite par l'hébergeur sont ignorées, sinon tous les clients partageraient
 * le même quota).
 */
export function clientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const chain = (headers.get("x-forwarded-for") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  for (let i = chain.length - 1; i >= 0; i--) {
    if (!isInternalIp(chain[i])) return chain[i];
  }
  return headers.get("x-real-ip")?.trim() || chain.at(-1) || "inconnue";
}

/** D'où vient l'adresse retenue (diagnostic, sans adresse). */
export function ipSource(headers: Headers): string {
  if (headers.get("cf-connecting-ip")?.trim()) return "cf-connecting-ip";
  const chain = (headers.get("x-forwarded-for") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  for (let i = chain.length - 1; i >= 0; i--) {
    if (!isInternalIp(chain[i])) return `x-forwarded-for (valeur ${i + 1} sur ${chain.length})`;
  }
  return headers.get("x-real-ip")?.trim() ? "x-real-ip" : chain.length ? "x-forwarded-for (interne seulement)" : "aucune";
}
