// Fonction « menage-photos » : supprime les photos d'étiquettes de plus de 12 mois (durée annoncée dans la
// politique de confidentialité), puis efface leur référence dans les lectures et les contributions.
//
// Appelée chaque nuit par la tâche planifiée « veritrace-menage-photos » (pg_cron + pg_net, migration 016).
// La suppression passe par l'API Storage : Supabase interdit d'effacer directement les lignes de storage.objects
// (le fichier resterait stocké). Sans compte utilisateur (verify_jwt désactivé) : l'appel ne peut supprimer que ce
// qui a dépassé la durée de conservation, et il est limité à 4 passages par jour.

import postgres from "npm:postgres@3.4.5";
import { reportError, reportWarning } from "./suivi.ts";

const BUCKET = "etiquettes";
const RETENTION = "12 months";
const BATCH = 100;
const MAX_PER_RUN = 2000;

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, idle_timeout: 20 });

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, { ok: false, error: "methode" });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absent de l'environnement");
    return reply(500, { ok: false, error: "configuration" });
  }
  try {
    const [q] = await sql`select public.take_quota('menage_photos', 4) as ok`;
    if (q.ok !== true) return reply(429, { ok: false, error: "quota", message: "Ménage déjà fait aujourd'hui." });

    const rows = await sql`
      select name from storage.objects
       where bucket_id = ${BUCKET} and created_at < now() - ${RETENTION}::interval
       order by created_at
       limit ${MAX_PER_RUN}`;
    const names = rows.map((r) => r.name as string);

    const deleted: string[] = [];
    for (let i = 0; i < names.length; i += BATCH) {
      const res = await fetch(`${url}/storage/v1/object/${BUCKET}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: names.slice(i, i + BATCH) }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        console.error(`Storage HTTP ${res.status} :`, (await res.text()).slice(0, 300));
        await reportWarning(`Suppression des photos refusée par Storage (HTTP ${res.status})`, "menage-photos");
        break;
      }
      const out = (await res.json()) as { name?: string }[];
      for (const o of out) if (typeof o.name === "string") deleted.push(o.name);
    }

    if (deleted.length > 0) {
      await sql`update public.label_readings set photo_path = null where photo_path = any(${deleted})`;
      await sql`update public.product_submissions set photo_path = null where photo_path = any(${deleted})`;
    }
    console.log(`Photos de plus de ${RETENTION} : ${names.length} trouvées, ${deleted.length} supprimées`);
    return reply(200, { ok: true, trouvees: names.length, supprimees: deleted.length, encore: names.length === MAX_PER_RUN });
  } catch (e) {
    console.error("Ménage des photos :", e);
    await reportError(e, "menage-photos");
    return reply(500, { ok: false, error: "erreur" });
  }
});
