// Fonction « ecobalyse-score » : calcule les notes des fiches en attente (table product_drafts)
// avec l'API Ecobalyse, puis publie les produits dans la table products.
//
// Elle ne fait que le travail demandé par la base : appelée sans fiche « a_calculer », elle ne fait rien.
// Secret requis : ECOBALYSE_TOKEN (jeton d'API Ecobalyse, à créer sur ecobalyse.beta.gouv.fr).

import postgres from "npm:postgres@3.4.5";
import {
  buildQuery,
  DraftError,
  type DraftInput,
  ECO_PRODUCTS,
  type EcoProduct,
  referenceQueries,
  SCORING_VERSION,
  thresholdsFrom,
  type Thresholds,
  toProductRow,
} from "./core.ts";

// ECOBALYSE_API_URL ne sert qu'aux tests locaux (faux serveur Ecobalyse).
const API = Deno.env.get("ECOBALYSE_API_URL") ?? "https://ecobalyse.beta.gouv.fr/api";
const BATCH = 3;
const TIME_BUDGET_MS = 100_000;

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, idle_timeout: 20 });

class TokenError extends Error {}
class RetryLater extends Error {}

async function ecobalyse(path: string, body: unknown, token: string): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw new RetryLater(`Ecobalyse injoignable (${e instanceof Error ? e.message : e})`);
  }
  const text = await res.text();
  if (res.status === 401 || res.status === 403) {
    throw new TokenError("Jeton Ecobalyse refusé : vérifiez le secret ECOBALYSE_TOKEN, puis repassez la ligne en a_calculer");
  }
  if (res.status === 400) throw new DraftError(`Paramètres refusés par Ecobalyse : ${text.slice(0, 400)}`);
  if (!res.ok) throw new RetryLater(`Ecobalyse indisponible (HTTP ${res.status})`);
  try {
    return JSON.parse(text);
  } catch {
    throw new RetryLater("Réponse Ecobalyse illisible");
  }
}

/**
 * Valeur d'un impact (ecs, cch) ; sinon erreur avec un extrait de la réponse, pour comprendre.
 * Attention : l'API textile accepte n'importe quel jeton, mais un jeton non reconnu ne donne accès
 * qu'aux données publiques, et les impacts reviennent vides (0). D'où le message dédié.
 */
function impactOf(response: Record<string, unknown>, metric: "ecs" | "cch"): number {
  const v = (response.impacts as Record<string, unknown> | undefined)?.[metric];
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (v === 0 || v === null) {
    throw new TokenError(
      "Jeton Ecobalyse non reconnu (impacts vides) : recopiez exactement le jeton de votre compte Ecobalyse " +
        "dans le secret ECOBALYSE_TOKEN, sans espace ni guillemets, puis repassez la ligne en a_calculer",
    );
  }
  const keys = Object.keys(response).join(", ");
  const impacts = JSON.stringify(response.impacts ?? null).slice(0, 300);
  throw new Error(`Réponse Ecobalyse sans « ${metric} » exploitable (clés : ${keys} ; impacts : ${impacts})`);
}

async function apiVersion(): Promise<string | null> {
  try {
    const res = await fetch(API, { signal: AbortSignal.timeout(10_000) });
    const doc = await res.json();
    return typeof doc?.info?.version === "string" ? doc.info.version : null;
  } catch {
    return null;
  }
}

/** Seuils A–E du type de vêtement ; calibrés avec deux références Ecobalyse s'ils manquent. */
async function thresholdsFor(product: EcoProduct, token: string): Promise<{ ecs: Thresholds; cch: Thresholds }> {
  const read = async () => {
    const rows = await sql`select metric, a_max, b_max, c_max, d_max from public.grade_thresholds where eco_product = ${product}`;
    const pick = (metric: string) => {
      const r = rows.find((x) => x.metric === metric);
      return r ? { a_max: Number(r.a_max), b_max: Number(r.b_max), c_max: Number(r.c_max), d_max: Number(r.d_max) } : null;
    };
    const ecs = pick("ecs");
    const cch = pick("cch");
    return ecs && cch ? { ecs, cch } : null;
  };

  const existing = await read();
  if (existing) return existing;

  const refs = referenceQueries(product);
  const best = await ecobalyse("/textile/simulator", refs.best, token);
  const worst = await ecobalyse("/textile/simulator", refs.worst, token);
  const method = `${SCORING_VERSION} : 5 classes égales entre la référence vertueuse et le majorant par défaut Ecobalyse`;
  for (const metric of ["ecs", "cch"] as const) {
    const b = impactOf(best, metric);
    const w = impactOf(worst, metric);
    const t = thresholdsFrom(b, w);
    await sql`
      insert into public.grade_thresholds (eco_product, metric, best_ref, worst_ref, a_max, b_max, c_max, d_max, method)
      values (${product}, ${metric}, ${b}, ${w}, ${t.a_max}, ${t.b_max}, ${t.c_max}, ${t.d_max}, ${method})
      on conflict (eco_product, metric) do nothing`;
  }
  const calibrated = await read();
  if (!calibrated) throw new Error("Calibrage des notes impossible");
  return calibrated;
}

async function failAllPending(message: string): Promise<number> {
  const rows = await sql`
    update public.product_drafts
       set status = 'erreur', error = ${message}, claimed_at = null, processed_at = now()
     where status in ('a_calculer', 'en_cours')
    returning ean`;
  return rows.length;
}

async function claim(): Promise<(DraftInput & { eco_business: string | null; eco_references: number | null; attempts: number })[]> {
  const rows = await sql`
    with picked as (
      select ean from public.product_drafts
       where status = 'a_calculer'
       order by created_at
       limit ${BATCH}
       for update skip locked
    )
    update public.product_drafts d
       set status = 'en_cours', claimed_at = now(), attempts = d.attempts + 1
      from picked
     where d.ean = picked.ean
    returning d.*`;
  if (rows.length === 0) return [];
  const brands = await sql`
    select id, eco_business, eco_references from public.brands where id in ${sql(rows.map((r) => r.brand_id))}`;
  return rows.map((r) => {
    const b = brands.find((x) => x.id === r.brand_id);
    return {
      ...(r as unknown as DraftInput),
      source_date: r.source_date ? new Date(r.source_date).toISOString().slice(0, 10) : null,
      eco_business: b?.eco_business ?? null,
      eco_references: b?.eco_references ?? null,
      attempts: r.attempts,
    };
  });
}

async function publish(draft: DraftInput, token: string, version: string | null): Promise<void> {
  const built = buildQuery(draft, (draft as unknown as { eco_business: string | null; eco_references: number | null }));
  await sql`update public.product_drafts set eco_query = ${sql.json(built.query as postgres.JSONValue)} where ean = ${draft.ean}`;
  const thresholds = await thresholdsFor(built.product, token);
  const response = await ecobalyse("/textile/simulator/detailed", built.query, token);
  impactOf(response, "ecs");
  impactOf(response, "cch");
  const row = toProductRow(draft, built, response, thresholds, version);

  await sql.begin(async (tx) => {
    await tx`
      insert into public.products (
        ean, brand_id, name, category, origin_country, composition, transport,
        carbon_grade, social_grade, global_grade, env_grade, carbon_breakdown, is_sample,
        data_source, confidence, source_ref, source_date, eco_cost, climate_kg, eco_web_url,
        assumptions, methodology, scored_at
      ) values (
        ${row.ean}, ${row.brand_id}, ${row.name}, ${row.category}, ${row.origin_country}, ${row.composition}, ${row.transport},
        ${row.carbon_grade}, ${row.social_grade}, ${row.global_grade}, ${row.env_grade},
        ${tx.json(row.carbon_breakdown as unknown as postgres.JSONValue)}, false,
        ${row.data_source}, ${row.confidence}, ${row.source_ref}, ${row.source_date}, ${row.eco_cost}, ${row.climate_kg},
        ${row.eco_web_url}, ${tx.json(row.assumptions)}, ${row.methodology}, now()
      )
      on conflict (ean) do update set
        brand_id = excluded.brand_id, name = excluded.name, category = excluded.category,
        origin_country = excluded.origin_country, composition = excluded.composition, transport = excluded.transport,
        carbon_grade = excluded.carbon_grade, social_grade = excluded.social_grade, global_grade = excluded.global_grade,
        env_grade = excluded.env_grade, carbon_breakdown = excluded.carbon_breakdown, is_sample = false,
        data_source = excluded.data_source, confidence = excluded.confidence, source_ref = excluded.source_ref,
        source_date = excluded.source_date, eco_cost = excluded.eco_cost, climate_kg = excluded.climate_kg,
        eco_web_url = excluded.eco_web_url, assumptions = excluded.assumptions, methodology = excluded.methodology,
        scored_at = excluded.scored_at`;
    await tx`
      update public.product_drafts
         set status = 'publie', error = null, notes = ${row.assumptions.join(" ; ") || null}, processed_at = now(), claimed_at = null
       where ean = ${draft.ean} and status = 'en_cours'`;
  });
}

Deno.serve(async () => {
  const token = Deno.env.get("ECOBALYSE_TOKEN")?.trim();
  if (!token) {
    const n = await failAllPending(
      "Jeton Ecobalyse manquant : ajoutez le secret ECOBALYSE_TOKEN (Edge Functions → Secrets), puis repassez la ligne en a_calculer",
    );
    return Response.json({ published: 0, errors: n, reason: "missing_token" });
  }

  const started = Date.now();
  const version = await apiVersion();
  let published = 0;
  let errors = 0;
  let retry = 0;

  // Seuils A–E de tous les types de vêtements (utiles aussi au registre officiel) : calibrés une fois.
  const calibrated: string[] = [];
  try {
    const have = await sql`select eco_product from public.grade_thresholds group by eco_product having count(*) = 2`;
    for (const product of ECO_PRODUCTS) {
      if (have.some((h) => h.eco_product === product) || Date.now() - started > 60_000) continue;
      await thresholdsFor(product, token);
      calibrated.push(product);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof TokenError) {
      errors += await failAllPending(message);
      return Response.json({ published, errors, calibrated, reason: "token_refused" });
    }
    console.error("Calibrage :", message);
  }

  while (Date.now() - started < TIME_BUDGET_MS) {
    const drafts = await claim();
    if (drafts.length === 0) break;
    for (const draft of drafts) {
      try {
        await publish(draft, token, version);
        published++;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (e instanceof TokenError) {
          errors += await failAllPending(message);
          return Response.json({ published, errors, reason: "token_refused" });
        }
        if (e instanceof RetryLater) {
          // Ecobalyse indisponible : on réessaiera (3 essais au total), inutile d'insister maintenant.
          await sql`
            update public.product_drafts
               set status = case when attempts >= 3 then 'erreur' else 'a_calculer' end,
                   error = ${message}, claimed_at = null
             where ean in ${sql(drafts.map((d) => d.ean))} and status = 'en_cours'`;
          retry++;
          return Response.json({ published, errors, retry, reason: "retry_later" });
        }
        errors++;
        console.error(`Fiche ${draft.ean} :`, message);
        await sql`
          update public.product_drafts
             set status = 'erreur', error = ${message.slice(0, 1000)}, processed_at = now(), claimed_at = null
           where ean = ${draft.ean}`;
      }
    }
  }

  return Response.json({ published, errors, retry, calibrated });
});
