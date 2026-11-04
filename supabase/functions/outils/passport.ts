// Passeport numérique d'un vêtement, créé par son fabricant : contrôle de la saisie, requête Ecobalyse
// et détail des étapes du cycle de vie. Aucune dépendance ni API propre à Deno (testé avec Node).

import { buildQuery, type BuiltQuery, type Country, DraftError, type DraftInput, mapCountry, parseComposition } from "./core.ts";
import { ecoProductOfCategory, LabelError } from "./label.ts";

export interface PassportInput {
  company: string;
  city: string | null;
  product_name: string;
  reference: string | null;
  gtin: string | null;
  category: string;
  composition: string;
  mass_kg: number;
  country_spinning: Country | null;
  country_fabric: Country | null;
  country_dyeing: Country | null;
  country_making: Country;
  air_transport_ratio: number | null;
}

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t.length === 0 ? null : t.slice(0, max);
};

/** Clé de contrôle GS1 d'un GTIN (8, 12, 13 ou 14 chiffres). */
export function isValidGtin(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false;
  const d = code.split("").map(Number);
  const check = d.pop()!;
  const sum = d.reverse().reduce((s, v, i) => s + v * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

function country(v: unknown, label: string, required = false): Country | null {
  const t = text(v, 40);
  if (!t) {
    if (required) throw new LabelError("pays", `Indiquez le pays de ${label}.`);
    return null;
  }
  try {
    return mapCountry(t);
  } catch (e) {
    if (e instanceof DraftError) throw new LabelError("pays", `Pays de ${label} non reconnu : « ${t} ».`);
    throw e;
  }
}

/** Vérifie la saisie du formulaire fabricant ; message clair en cas d'erreur. */
export function validatePassport(body: Record<string, unknown>): PassportInput {
  const company = text(body.company, 120);
  if (!company || company.length < 2) throw new LabelError("entreprise", "Indiquez le nom de l'entreprise.");
  const product_name = text(body.product_name, 120);
  if (!product_name || product_name.length < 2) throw new LabelError("produit", "Indiquez le nom du produit.");
  const gtinRaw = text(body.gtin, 20)?.replace(/\D/g, "") ?? null;
  const gtin = gtinRaw ? (gtinRaw.length === 12 ? "0" + gtinRaw : gtinRaw) : null;
  if (gtin && !isValidGtin(gtin)) throw new LabelError("gtin", "Code-barres (GTIN) invalide : vérifiez les chiffres.");
  const category = text(body.category, 40) ?? "";
  ecoProductOfCategory(category);
  const composition = text(body.composition, 300);
  if (!composition) throw new LabelError("composition", "Indiquez la composition (ex. « 100 % coton »).");
  try {
    parseComposition(composition);
  } catch (e) {
    if (e instanceof DraftError) throw new LabelError("composition", e.message);
    throw e;
  }
  const massG = Number(String(body.mass_g ?? "").replace(",", "."));
  if (!Number.isFinite(massG) || massG < 10 || massG > 5000) {
    throw new LabelError("poids", "Indiquez le poids du vêtement en grammes (entre 10 et 5 000 g).");
  }
  let air: number | null = null;
  if (body.air_transport_pct !== null && body.air_transport_pct !== undefined && String(body.air_transport_pct).trim() !== "") {
    const pct = Number(String(body.air_transport_pct).replace(",", "."));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new LabelError("avion", "La part de transport en avion va de 0 à 100 %.");
    air = Math.round(pct) / 100;
  }
  return {
    company,
    city: text(body.city, 80),
    product_name,
    reference: text(body.reference, 80),
    gtin,
    category,
    composition,
    mass_kg: Math.round(massG) / 1000,
    country_spinning: country(body.country_spinning, "filature"),
    country_fabric: country(body.country_fabric, "tissage ou tricotage"),
    country_dyeing: country(body.country_dyeing, "teinture"),
    country_making: country(body.country_making, "confection", true)!,
    air_transport_ratio: air,
  };
}

/** Requête Ecobalyse du passeport (données du fabricant : fiabilité haute si tout est renseigné). */
export function passportQuery(p: PassportInput): BuiltQuery {
  const draft: DraftInput = {
    ean: p.gtin ?? "0000000000000",
    brand_id: "fabricant",
    name: p.product_name,
    category: p.category,
    composition: p.composition,
    social_grade: "C",
    data_source: "marque",
    mass_kg: p.mass_kg,
    country_fabric: p.country_fabric?.code ?? null,
    country_dyeing: p.country_dyeing?.code ?? null,
    country_making: p.country_making.code,
    air_transport_ratio: p.air_transport_ratio,
  };
  const built = buildQuery(draft);
  if (p.country_spinning) built.query.countrySpinning = p.country_spinning.code;
  else built.notes.push("pays de filature inconnu : valeur par défaut Ecobalyse");
  return built;
}

export interface Stage {
  label: string;
  ecs: number;
  cch: number;
}

const num = (v: unknown, k: "ecs" | "cch") => {
  const x = (v as Record<string, unknown> | undefined)?.[k];
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
};

/** Étapes du cycle de vie (coût environnemental et climat), transports regroupés à part. */
export function stagesFromLifeCycle(lifeCycle: unknown): Stage[] {
  if (!Array.isArray(lifeCycle)) throw new Error("Réponse Ecobalyse sans cycle de vie détaillé");
  const out: Stage[] = [];
  let tEcs = 0;
  let tCch = 0;
  for (const stage of lifeCycle as Record<string, unknown>[]) {
    const label = String(stage.label ?? "").trim();
    if (!label) continue;
    out.push({ label, ecs: Math.round(num(stage.impacts, "ecs") * 10) / 10, cch: Math.round(num(stage.impacts, "cch") * 1000) / 1000 });
    const t = (stage.transport as Record<string, unknown> | undefined)?.impacts;
    tEcs += num(t, "ecs");
    tCch += num(t, "cch");
  }
  if (tEcs > 0 || tCch > 0) out.push({ label: "Transports (toutes étapes)", ecs: Math.round(tEcs * 10) / 10, cch: Math.round(tCch * 1000) / 1000 });
  return out;
}

/** Identifiant public d'un passeport (12 caractères hexadécimaux). */
export function passportId(random: Uint8Array): string {
  return [...random.slice(0, 6)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

