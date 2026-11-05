// Fonction « outils » : services appelés directement par les apps (web et Flutter).
//
//  - lire_etiquette : photo et/ou texte de l'étiquette cousue d'un vêtement → composition, pays → note
//    Ecobalyse. Le texte lu sur le téléphone est essayé d'abord (gratuit) ; l'IA de vision prend le relais.
//    Avec un code-barres, le résultat est gardé en attente de vérification (publication automatique
//    désactivée par défaut, réglage etiquette_publication_auto).
//  - creer_passeport : formulaire d'un fabricant → coût environnemental officiel → passeport numérique public.
//
// Secrets : ECOBALYSE_TOKEN (déjà utilisé par ecobalyse-score) ; ANTHROPIC_API_KEY facultatif (sans elle, seule la
// lecture de texte faite sur l'appareil est utilisée : gratuite, c'est le fonctionnement par défaut).
// Réglages (table app_settings) : quotas journaliers, publication automatique des étiquettes.
// Appelée sans compte utilisateur (verify_jwt désactivé) : quotas par jour et par connexion contre les abus.

import postgres from "npm:postgres@3.4.5";
import { buildQuery, type BuiltQuery, scoreResponse, SCORING_VERSION, type Thresholds } from "./core.ts";
import {
  AI_PROMPT,
  AI_TOOL,
  type AiReading,
  checkComposition,
  ecoProductOfCategory,
  fromAiReading,
  type LabelReading,
  LabelError,
  readLabelText,
} from "./label.ts";
import { isValidGtin, passportId, passportQuery, stagesFromLifeCycle, validatePassport } from "./passport.ts";
import { clientIp } from "./reseau.ts";

// Adresses modifiables pour les tests locaux uniquement (faux serveurs)
const ECOBALYSE = Deno.env.get("ECOBALYSE_API_URL") ?? "https://ecobalyse.beta.gouv.fr/api";
const AI_URL = Deno.env.get("ANTHROPIC_API_URL") ?? "https://api.anthropic.com";
const AI_MODEL = Deno.env.get("LABEL_AI_MODEL") ?? "claude-haiku-5-5";
const MAX_IMAGE_B64 = 4_000_000;

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 3, idle_timeout: 20 });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

// ---------------------------------------------------------------------------------------------
// Réglages, quotas

async function settings(): Promise<Record<string, unknown>> {
  const rows = await sql`select key, value from public.app_settings`;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

const limit = (s: Record<string, unknown>, key: string, fallback: number) => {
  const v = Number(s[key]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
};

async function takeQuota(bucket: string, max: number): Promise<boolean> {
  const [r] = await sql`select public.take_quota(${bucket}, ${max}) as ok`;
  return r.ok === true;
}

// Clé secrète de l'empreinte : sans elle, on ne peut pas retrouver une adresse en essayant toutes les adresses IP
let pepperKey: Promise<CryptoKey> | null = null;
const pepper = () =>
  pepperKey ??= crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(Deno.env.get("QUOTA_PEPPER") ?? Deno.env.get("SUPABASE_DB_URL") ?? ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

/** Empreinte de la connexion (HMAC secret), renouvelée chaque jour : aucune adresse IP n'est stockée. */
async function clientBucket(req: Request, kind: string): Promise<string> {
  const ip = clientIp(req.headers);
  const data = new TextEncoder().encode(`${ip}|${new Date().toISOString().slice(0, 10)}`);
  const hash = new Uint8Array(await crypto.subtle.sign("HMAC", await pepper(), data));
  return `${kind}:${[...hash.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

// ---------------------------------------------------------------------------------------------
// Ecobalyse

let apiVersion: string | null | undefined;
async function ecobalyseVersion(): Promise<string | null> {
  if (apiVersion !== undefined) return apiVersion;
  try {
    const doc = await (await fetch(ECOBALYSE, { signal: AbortSignal.timeout(8_000) })).json();
    apiVersion = typeof doc?.info?.version === "string" ? doc.info.version : null;
  } catch {
    apiVersion = null;
  }
  return apiVersion ?? null;
}

async function thresholds(product: string): Promise<{ ecs: Thresholds; cch: Thresholds }> {
  const rows = await sql`select metric, a_max, b_max, c_max, d_max from public.grade_thresholds where eco_product = ${product}`;
  const pick = (metric: string) => {
    const r = rows.find((x) => x.metric === metric);
    return r ? { a_max: Number(r.a_max), b_max: Number(r.b_max), c_max: Number(r.c_max), d_max: Number(r.d_max) } : null;
  };
  const ecs = pick("ecs");
  const cch = pick("cch");
  if (!ecs || !cch) throw new LabelError("categorie", "Ce type de vêtement n'est pas encore calibré : choisissez-en un autre.");
  return { ecs, cch };
}

const UNAVAILABLE = "Le calcul officiel (Ecobalyse) ne répond pas pour le moment : réessayez dans un instant.";

async function ecobalyseDetailed(query: Record<string, unknown>): Promise<Record<string, unknown>> {
  const token = Deno.env.get("ECOBALYSE_TOKEN")?.trim();
  if (!token) {
    console.error("Secret ECOBALYSE_TOKEN manquant");
    throw new LabelError("ecobalyse_indisponible", UNAVAILABLE);
  }
  let res: Response;
  try {
    res = await fetch(`${ECOBALYSE}/textile/simulator/detailed`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(query),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    console.error("Ecobalyse injoignable :", e);
    throw new LabelError("ecobalyse_indisponible", UNAVAILABLE);
  }
  const text = await res.text();
  if (!res.ok) {
    console.error(`Ecobalyse HTTP ${res.status} :`, text.slice(0, 400));
    throw new LabelError("ecobalyse_indisponible", UNAVAILABLE);
  }
  const body = JSON.parse(text) as Record<string, unknown>;
  const ecs = (body.impacts as Record<string, unknown> | undefined)?.ecs;
  if (typeof ecs !== "number" || !(ecs > 0)) {
    console.error("Ecobalyse : impacts vides (jeton ECOBALYSE_TOKEN non reconnu ?)");
    throw new LabelError("ecobalyse_indisponible", UNAVAILABLE);
  }
  return body;
}

// ---------------------------------------------------------------------------------------------
// IA de vision

async function aiRead(image: string, mediaType: string): Promise<AiReading> {
  const key = Deno.env.get("ANTHROPIC_API_KEY")?.trim();
  if (!key) {
    // Sans clé IA (cas par défaut), seule la lecture de texte sur l'appareil est disponible
    throw new LabelError("illisible", "Aucun texte lisible sur la photo : reprenez-la de plus près, bien à plat et sans reflet.");
  }
  let res: Response;
  try {
    res = await fetch(`${AI_URL}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 1024,
        tools: [AI_TOOL],
        tool_choice: { type: "tool", name: AI_TOOL.name },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
              { type: "text", text: AI_PROMPT },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (e) {
    console.error("IA injoignable :", e);
    throw new LabelError("ia_indisponible", "La lecture automatique ne répond pas : réessayez dans un instant.");
  }
  const text = await res.text();
  if (!res.ok) {
    console.error(`IA HTTP ${res.status} :`, text.slice(0, 400));
    if (res.status === 401 || res.status === 403) console.error("Clé ANTHROPIC_API_KEY refusée ou sans crédit");
    throw new LabelError("ia_indisponible", "La lecture automatique est indisponible pour le moment : réessayez plus tard.");
  }
  const data = JSON.parse(text) as { content?: { type: string; name?: string; input?: unknown }[] };
  const block = data.content?.find((b) => b.type === "tool_use" && b.name === AI_TOOL.name);
  if (!block || typeof block.input !== "object" || block.input === null) {
    throw new LabelError("illisible", "Étiquette illisible : reprenez la photo de plus près, bien à plat et sans reflet.");
  }
  return block.input as AiReading;
}

// ---------------------------------------------------------------------------------------------
// Lecture d'étiquette

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

function decodeImage(raw: unknown): { b64: string; type: string } | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const m = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,(.*)$/s);
  const b64 = (m ? m[2] : raw).replace(/\s/g, "");
  const type = m ? m[1] : "image/jpeg";
  if (b64.length > MAX_IMAGE_B64) throw new LabelError("image", "Photo trop lourde : réessayez (l'app la réduit automatiquement).");
  if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) throw new LabelError("image", "Photo illisible : réessayez.");
  return { b64, type };
}

async function storePhoto(id: string, image: { b64: string; type: string }): Promise<string | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  const path = `lectures/${id}.${image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg"}`;
  try {
    const bytes = Uint8Array.from(atob(image.b64), (c) => c.charCodeAt(0));
    const res = await fetch(`${url}/storage/v1/object/etiquettes/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": image.type, "x-upsert": "false" },
      body: bytes,
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok ? path : null;
  } catch {
    return null;
  }
}

async function readLabel(body: Record<string, unknown>, req: Request): Promise<Response> {
  const category = str(body.category, 40) ?? "";
  const ecoProduct = ecoProductOfCategory(category);
  const image = decodeImage(body.image);
  const text = str(body.text, 4000);
  if (!image && !text) throw new LabelError("image", "Ajoutez la photo de l'étiquette.");
  const eanRaw = str(body.ean, 20)?.replace(/\D/g, "") ?? null;
  const ean = eanRaw && isValidGtin(eanRaw) ? (eanRaw.length === 12 ? "0" + eanRaw : eanRaw) : null;
  let brand = str(body.brand, 80);

  const conf = await settings();
  if (!(await takeQuota(await clientBucket(req, "etiquette"), limit(conf, "etiquette_par_appareil_par_jour", 40)))) {
    throw new LabelError("quota", "Vous avez atteint le nombre de lectures du jour : réessayez demain.");
  }
  // Plafond global : protège le calcul Ecobalyse et la base même si le quota par appareil était contourné
  if (!(await takeQuota("etiquettes", limit(conf, "etiquettes_par_jour", 2000)))) {
    throw new LabelError("quota", "Le service a atteint sa limite de lectures pour aujourd'hui : réessayez demain.");
  }

  // 1. Texte lu sur l'appareil (gratuit : navigateur ou téléphone) ;
  // 2. IA de vision si le texte ne suffit pas, seulement si une clé IA est configurée (facultatif)
  let reading: LabelReading | null = null;
  let method: "texte" | "ia" = "texte";
  let rawText = text ?? "";
  let textError: unknown = null;
  if (text) {
    try {
      reading = readLabelText(text);
    } catch (e) {
      if (!(e instanceof LabelError)) throw e;
      textError = e;
    }
  }
  const aiConfigured = Boolean(Deno.env.get("ANTHROPIC_API_KEY")?.trim());
  if (!reading && image && (aiConfigured || !textError)) {
    if (!(await takeQuota("etiquette_ia", limit(conf, "etiquette_ia_par_jour", 300)))) {
      throw new LabelError("quota", "La lecture automatique a atteint sa limite du jour : réessayez demain.");
    }
    const ai = await aiRead(image.b64, image.type);
    const r = fromAiReading(ai);
    reading = r;
    brand = brand ?? r.brand;
    method = "ia";
    rawText = String(ai.raw_text ?? "");
  }
  if (!reading) throw textError ?? new LabelError("illisible", "Étiquette illisible : reprenez la photo.");
  checkComposition(reading.composition);

  const built: BuiltQuery = buildQuery({
    ean: ean ?? "0000000000000",
    brand_id: "etiquette",
    name: category,
    category,
    composition: reading.composition,
    social_grade: "C",
    data_source: "etiquette",
    country_making: reading.country?.code ?? null,
    eco_product: ecoProduct,
  });
  const response = await ecobalyseDetailed(built.query);
  const score = scoreResponse(built, response, await thresholds(built.product));
  const version = await ecobalyseVersion();
  const notes = [
    method === "ia" ? `composition lue par IA (${AI_MODEL}) sur la photo de l'étiquette` : "composition lue sur le téléphone (reconnaissance de texte)",
    ...reading.notes,
    ...built.notes,
  ];

  // Une lecture d'étiquette n'est rattachée au code-barres (visible par tous) que si la publication automatique
  // est explicitement activée ; sinon elle reste visible par son auteur seul (code L…) jusqu'à validation.
  const publish = conf.etiquette_publication_auto === true;
  const [row] = await sql`
    insert into public.label_readings (
      ean, brand_name, name, category, eco_product, composition, country_making, method, model, extracted,
      confidence, eco_cost, climate_kg, env_grade, carbon_grade, carbon_breakdown, eco_web_url, assumptions, methodology
    ) values (
      ${publish ? ean : null}, ${brand}, ${category}, ${category}, ${built.product}, ${reading.composition},
      ${reading.country?.label ?? null}, ${method}, ${method === "ia" ? AI_MODEL : null},
      ${sql.json({ raw_text: rawText.slice(0, 500), ean_saisi: ean, client: str(body.client, 20) })},
      ${built.confidence}, ${score.ecoCost}, ${score.climateKg}, ${score.envGrade}, ${score.carbonGrade},
      ${sql.json(score.breakdown as unknown as postgres.JSONValue)}, ${score.webUrl}, ${sql.json(notes)},
      ${`Ecobalyse${version ? ` (API ${version})` : ""} · ${SCORING_VERSION} · étiquette lue (${method})`}
    )
    returning id, code`;
  if (image) {
    const path = await storePhoto(row.id, image);
    if (path) await sql`update public.label_readings set photo_path = ${path} where id = ${row.id}`;
  }
  const [{ p }] = await sql`select public.label_product_json(${row.code}) as p`;
  return reply(200, { ok: true, code: row.code, method, published: Boolean(publish && ean), product: p });
}

// ---------------------------------------------------------------------------------------------
// Passeport numérique

async function createPassport(body: Record<string, unknown>, req: Request): Promise<Response> {
  const input = validatePassport(body);
  const conf = await settings();
  if (!(await takeQuota(await clientBucket(req, "passeport"), limit(conf, "passeports_par_appareil_par_jour", 10))) || !(await takeQuota("passeports", limit(conf, "passeports_par_jour", 200)))) {
    throw new LabelError("quota", "Nombre maximal de passeports atteint pour aujourd'hui : réessayez demain.");
  }
  const built = passportQuery(input);
  const response = await ecobalyseDetailed(built.query);
  const score = scoreResponse(built, response, await thresholds(built.product));
  const stages = stagesFromLifeCycle(response.lifeCycle);
  const version = await ecobalyseVersion();
  const id = passportId(crypto.getRandomValues(new Uint8Array(6)));
  const [row] = await sql`
    insert into public.passports (
      id, gtin, company, city, product_name, reference, category, eco_product, composition, mass_kg,
      country_spinning, country_fabric, country_dyeing, country_making, air_transport_ratio,
      eco_query, eco_cost, climate_kg, env_grade, carbon_grade, carbon_breakdown, stages, eco_web_url,
      assumptions, confidence, methodology
    ) values (
      ${id}, ${input.gtin}, ${input.company}, ${input.city}, ${input.product_name}, ${input.reference}, ${input.category},
      ${built.product}, ${input.composition}, ${input.mass_kg},
      ${input.country_spinning?.label ?? null}, ${input.country_fabric?.label ?? null}, ${input.country_dyeing?.label ?? null},
      ${input.country_making.label}, ${input.air_transport_ratio},
      ${sql.json(built.query as postgres.JSONValue)}, ${score.ecoCost}, ${score.climateKg}, ${score.envGrade}, ${score.carbonGrade},
      ${sql.json(score.breakdown as unknown as postgres.JSONValue)}, ${sql.json(stages as unknown as postgres.JSONValue)}, ${score.webUrl},
      ${sql.json(built.notes)}, ${built.confidence}, ${`Ecobalyse${version ? ` (API ${version})` : ""} · ${SCORING_VERSION}`}
    )
    returning *`;
  return reply(200, { ok: true, id, passport: row });
}

// ---------------------------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return reply(405, { ok: false, error: "methode", message: "Méthode non autorisée." });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { ok: false, error: "requete", message: "Requête illisible." });
  }
  try {
    switch (body?.action) {
      case "lire_etiquette":
        return await readLabel(body, req);
      case "creer_passeport":
        return await createPassport(body, req);
      case "etat":
        // Vérification de l'en-tête utilisé pour les quotas (aucune adresse renvoyée)
        return reply(200, {
          ok: true,
          ip_source: req.headers.get("cf-connecting-ip") ? "cf-connecting-ip" : req.headers.get("x-forwarded-for") ? "x-forwarded-for (dernière valeur)" : "aucune",
          xff_valeurs: (req.headers.get("x-forwarded-for") ?? "").split(",").filter((v) => v.trim()).length,
        });
      default:
        return reply(400, { ok: false, error: "action", message: "Action inconnue." });
    }
  } catch (e) {
    if (e instanceof LabelError) {
      const status = e.code === "quota" ? 429 : e.code.endsWith("indisponible") ? 503 : 422;
      return reply(status, { ok: false, error: e.code, message: e.message });
    }
    console.error("Erreur inattendue :", e);
    return reply(500, { ok: false, error: "erreur", message: "Erreur inattendue : réessayez dans un instant." });
  }
});
