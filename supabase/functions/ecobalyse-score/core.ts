// Cœur du calcul VeriTrace × Ecobalyse.
// Aucune dépendance ni API propre à Deno : ce fichier est testé tel quel avec Node (core.test.ts).
//
// Les identifiants de matières, les codes pays et les masses par défaut viennent des données
// publiques d'Ecobalyse (dépôt MTES-MCT/ecobalyse, public/data/textile/*.json, version 8.5.0).

export type Grade = "A" | "B" | "C" | "D" | "E";
export const GRADES: Grade[] = ["A", "B", "C", "D", "E"];

export const ECO_PRODUCTS = [
  "calecon",
  "chaussettes",
  "chemise",
  "jean",
  "jupe",
  "maillot-de-bain",
  "manteau",
  "pantalon",
  "pull",
  "slip",
  "tshirt",
] as const;
export type EcoProduct = (typeof ECO_PRODUCTS)[number];

/** Version de la méthode de notation VeriTrace (seuils, regroupements, arrondis). */
export const SCORING_VERSION = "VeriTrace notes v1";

export class DraftError extends Error {}

// ---------------------------------------------------------------------------------------------
// Types de vêtement

/** Masse par défaut : celle des exemples « majorant par défaut » d'Ecobalyse. */
export const DEFAULT_MASS_KG: Record<EcoProduct, number> = {
  tshirt: 0.15,
  chemise: 0.25,
  jupe: 0.3,
  jean: 0.45,
  pantalon: 0.45,
  manteau: 0.95,
  pull: 0.55,
  chaussettes: 0.04,
  calecon: 0.04,
  slip: 0.03,
  "maillot-de-bain": 0.1,
};

/** Prix des exemples « majorant par défaut » d'Ecobalyse (en euros). */
const DEFAULT_PRICE_EUR: Record<EcoProduct, number> = {
  tshirt: 10,
  chemise: 15,
  jupe: 15,
  jean: 20,
  pantalon: 20,
  manteau: 40,
  pull: 15,
  chaussettes: 4,
  calecon: 4,
  slip: 4,
  "maillot-de-bain": 15,
};

const CATEGORY_RULES: [RegExp, EcoProduct][] = [
  [/maillot/, "maillot-de-bain"],
  [/chaussette/, "chaussettes"],
  [/calecon/, "calecon"],
  [/slip|boxer|culotte/, "slip"],
  [/jean/, "jean"],
  [/t-?shirt|polo|debardeur|\btop\b/, "tshirt"],
  [/chemise|blouse/, "chemise"],
  [/robe|jupe/, "jupe"],
  [/pantalon|short|chino|jogging|legging/, "pantalon"],
  [/manteau|veste|blouson|parka|doudoune|trench|blazer/, "manteau"],
  [/pull|sweat|gilet|cardigan|hoodie/, "pull"],
];

/** Minuscules, sans accents ni espaces superflus. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function ecoProductFor(category: string, override?: string | null): EcoProduct {
  if (override) {
    if ((ECO_PRODUCTS as readonly string[]).includes(override)) return override as EcoProduct;
    throw new DraftError(`Type Ecobalyse inconnu : « ${override} »`);
  }
  const c = normalize(category);
  for (const [re, product] of CATEGORY_RULES) if (re.test(c)) return product;
  throw new DraftError(
    `Catégorie « ${category} » non reconnue : renseignez eco_product (${ECO_PRODUCTS.join(", ")})`,
  );
}

// ---------------------------------------------------------------------------------------------
// Matières

export const MATERIAL_IDS = {
  coton: "62a4d6fb-3276-4ba5-93a3-889ecd3bff84",
  cotonBio: "a1c1c2ec-33b1-49d6-bf8e-139e2eb7f097",
  cotonRecycleProduction: "d3d20384-88fb-4c75-ac12-c647365ac6c5",
  cotonRecyclePostConso: "457e9b0d-9eda-4dca-b199-deeb0a154fa9",
  polyester: "9dba0e95-0c35-4f8b-9267-62ddf47d4984",
  polyesterRecycle: "8f44c680-1263-4588-b79b-a9e4dc3d8de4",
  elasthanne: "9973088b-c929-4cc5-894a-1e4d28c161d4",
  viscose: "c087d394-5901-4b03-ba7a-7d4b0db0490c",
  lin: "a52e486c-b67e-40af-8337-e8143cbf9076",
  laine: "1fc3e17d-5661-429d-a150-7986eae16d9d",
  acrylique: "49a0bec0-f9f3-42db-a514-a9dcf06a8969",
  nylon: "c84280ff-e921-4d5c-92d6-51030bf4f74e",
  chanvre: "0c1a4654-b030-4fe1-86b7-d96ce0b85bb8",
  jute: "a09b2677-2900-4417-a202-e5f9a1abcce1",
  polypropylene: "73ef624d-250e-4a9a-af5d-43505b21b527",
} as const;

type MaterialRule = { re: RegExp; id: string; name: string; approx?: string };

// L'ordre compte : les mentions précises (bio, recyclé) avant la matière générique.
const MATERIAL_RULES: MaterialRule[] = [
  { re: /coton.*(biologique|\bbio\b|organique)|organic cotton/, id: MATERIAL_IDS.cotonBio, name: "coton biologique" },
  { re: /coton.*recycl.*post|coton.*post.?conso/, id: MATERIAL_IDS.cotonRecyclePostConso, name: "coton recyclé (post-consommation)" },
  { re: /coton.*recycl|recycled cotton/, id: MATERIAL_IDS.cotonRecycleProduction, name: "coton recyclé (déchets de production)" },
  { re: /\bcoton\b|\bcotton\b/, id: MATERIAL_IDS.coton, name: "coton" },
  { re: /polyester.*recycl|recycled polyester/, id: MATERIAL_IDS.polyesterRecycle, name: "polyester recyclé" },
  { re: /polyester/, id: MATERIAL_IDS.polyester, name: "polyester" },
  { re: /elasth?ann?e|lycra|spandex/, id: MATERIAL_IDS.elasthanne, name: "élasthanne" },
  { re: /viscose|rayonne/, id: MATERIAL_IDS.viscose, name: "viscose" },
  { re: /modal|lyocell|tencel/, id: MATERIAL_IDS.viscose, name: "viscose", approx: "modal / lyocell assimilés à la viscose" },
  { re: /\blin\b|\blinen\b/, id: MATERIAL_IDS.lin, name: "lin" },
  { re: /laine.*recycl/, id: MATERIAL_IDS.laine, name: "laine", approx: "laine recyclée comptée comme laine neuve (absente d'Ecobalyse)" },
  { re: /laine|\bwool\b|merinos/, id: MATERIAL_IDS.laine, name: "laine" },
  { re: /acrylique|acrylic/, id: MATERIAL_IDS.acrylique, name: "acrylique" },
  { re: /(polyamide|nylon).*recycl/, id: MATERIAL_IDS.nylon, name: "polyamide", approx: "polyamide recyclé compté comme polyamide neuf" },
  { re: /polyamide|nylon/, id: MATERIAL_IDS.nylon, name: "polyamide" },
  { re: /chanvre|\bhemp\b/, id: MATERIAL_IDS.chanvre, name: "chanvre" },
  { re: /\bjute\b/, id: MATERIAL_IDS.jute, name: "jute" },
  { re: /polypropylene/, id: MATERIAL_IDS.polypropylene, name: "polypropylène" },
];

export interface MaterialShare {
  id: string;
  share: number;
}

export interface ParsedComposition {
  materials: MaterialShare[];
  notes: string[];
}

/**
 * Lit une composition d'étiquette (« 60 % coton, 40 % polyester recyclé ») et la traduit en
 * matières Ecobalyse. Refuse ce qu'elle ne sait pas lire plutôt que de deviner.
 */
export function parseComposition(text: string): ParsedComposition {
  const parts = normalize(text)
    // « 95 % coton 5 % élasthanne » (sans séparateur) : on coupe avant chaque « nombre % matière »
    .replace(/([a-z)])\s+(?=\d+(?:[.,]\d+)?\s*%\s*[a-z])/g, "$1, ")
    // virgule séparatrice, sauf entre deux chiffres (« 33,3 % »)
    .split(/(?<!\d),|,(?!\d)|[;+/]|\bet\b|\band\b/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) throw new DraftError("Composition vide");

  const raw: { rule: MaterialRule; pct: number }[] = [];
  for (const part of parts) {
    const m = part.match(/^(\d+(?:[.,]\d+)?)\s*%?\s*(?:de |d')?(.+)$/) ?? part.match(/^(.+?)\s*:?\s*(\d+(?:[.,]\d+)?)\s*%?$/);
    let pct: number;
    let label: string;
    if (m && /^\d/.test(m[1])) {
      pct = Number(m[1].replace(",", "."));
      label = m[2];
    } else if (m) {
      pct = Number(m[2].replace(",", "."));
      label = m[1];
    } else if (parts.length === 1) {
      pct = 100;
      label = part;
    } else {
      throw new DraftError(`Pourcentage manquant dans la composition : « ${part} »`);
    }
    const rule = MATERIAL_RULES.find((r) => r.re.test(label));
    if (!rule) throw new DraftError(`Matière non prise en charge par Ecobalyse : « ${label.trim()} »`);
    raw.push({ rule, pct });
  }

  const total = raw.reduce((s, r) => s + r.pct, 0);
  if (total < 99 || total > 101) {
    throw new DraftError(`La composition fait ${Math.round(total * 10) / 10} % au lieu de 100 %`);
  }

  // Regroupe les matières identiques, puis répartit en centièmes dont la somme vaut exactement 1.
  const byId = new Map<string, { pct: number; rule: MaterialRule }>();
  for (const r of raw) {
    const prev = byId.get(r.rule.id);
    byId.set(r.rule.id, { pct: (prev?.pct ?? 0) + r.pct, rule: r.rule });
  }
  const entries = [...byId.entries()].map(([id, v]) => ({
    id,
    hundredths: Math.max(1, Math.round((v.pct / total) * 100)),
    rule: v.rule,
  }));
  const diff = 100 - entries.reduce((s, e) => s + e.hundredths, 0);
  entries.sort((a, b) => b.hundredths - a.hundredths);
  entries[0].hundredths += diff;

  const notes = [...new Set(entries.map((e) => e.rule.approx).filter((a): a is string => Boolean(a)))];
  return { materials: entries.map((e) => ({ id: e.id, share: e.hundredths / 100 })), notes };
}

// ---------------------------------------------------------------------------------------------
// Pays

export interface Country {
  code: string;
  label: string;
  region: boolean;
}

const COUNTRIES: Record<string, { code: string; label: string }> = {
  maroc: { code: "MA", label: "Maroc" },
  morocco: { code: "MA", label: "Maroc" },
  france: { code: "FR", label: "France" },
  chine: { code: "CN", label: "Chine" },
  china: { code: "CN", label: "Chine" },
  inde: { code: "IN", label: "Inde" },
  india: { code: "IN", label: "Inde" },
  bangladesh: { code: "BD", label: "Bangladesh" },
  pakistan: { code: "PK", label: "Pakistan" },
  turquie: { code: "TR", label: "Turquie" },
  turkey: { code: "TR", label: "Turquie" },
  turkiye: { code: "TR", label: "Turquie" },
  tunisie: { code: "TN", label: "Tunisie" },
  tunisia: { code: "TN", label: "Tunisie" },
  vietnam: { code: "VN", label: "Vietnam" },
  "viet nam": { code: "VN", label: "Vietnam" },
  cambodge: { code: "KH", label: "Cambodge" },
  cambodia: { code: "KH", label: "Cambodge" },
  myanmar: { code: "MM", label: "Myanmar" },
  birmanie: { code: "MM", label: "Myanmar" },
};

const CODE_LABELS: Record<string, string> = {
  MA: "Maroc",
  FR: "France",
  CN: "Chine",
  IN: "Inde",
  BD: "Bangladesh",
  PK: "Pakistan",
  TR: "Turquie",
  TN: "Tunisie",
  VN: "Vietnam",
  KH: "Cambodge",
  MM: "Myanmar",
  REO: "Europe de l'Ouest",
  REE: "Europe de l'Est",
  RAS: "Asie",
  RAF: "Afrique",
  RME: "Moyen-Orient",
  RLA: "Amérique latine",
  RNA: "Amérique du Nord",
  ROC: "Océanie",
};

// Pays absents de la liste Ecobalyse : on utilise la région correspondante.
const REGIONS: Record<string, string[]> = {
  REO: ["portugal", "espagne", "spain", "italie", "italy", "allemagne", "germany", "belgique", "pays-bas", "pays bas", "royaume-uni", "royaume uni", "irlande", "grece", "suisse", "autriche", "luxembourg", "danemark", "suede", "norvege", "finlande", "pt", "es", "it", "de", "be", "nl", "gb", "uk", "ie", "gr", "ch", "at"],
  REE: ["pologne", "roumanie", "bulgarie", "hongrie", "tchequie", "republique tcheque", "slovaquie", "lituanie", "lettonie", "estonie", "ukraine", "serbie", "albanie", "macedoine du nord", "bosnie", "moldavie", "croatie", "slovenie", "pl", "ro", "bg", "hu", "cz", "sk", "lt", "ua", "rs", "al"],
  RAS: ["sri lanka", "indonesie", "thailande", "philippines", "laos", "nepal", "coree du sud", "japon", "taiwan", "ouzbekistan", "malaisie", "lk", "id", "th", "ph", "jp", "kr"],
  RAF: ["egypte", "ethiopie", "kenya", "madagascar", "maurice", "ile maurice", "algerie", "afrique du sud", "lesotho", "tanzanie", "eg", "et", "ke", "mg", "mu", "dz", "za"],
  RME: ["jordanie", "israel", "arabie saoudite", "emirats arabes unis", "iran", "jo", "il"],
  RLA: ["mexique", "bresil", "perou", "guatemala", "honduras", "salvador", "nicaragua", "haiti", "colombie", "argentine", "mx", "br", "pe"],
  RNA: ["etats-unis", "etats unis", "usa", "canada", "us", "ca"],
  ROC: ["australie", "nouvelle-zelande", "au", "nz"],
};

/** Traduit un pays saisi (nom français ou anglais, code ISO, code Ecobalyse) ; vide → null. */
export function mapCountry(input: string | null | undefined): Country | null {
  if (input == null || input.trim() === "") return null;
  const n = normalize(input);
  const direct = COUNTRIES[n];
  if (direct) return { ...direct, region: false };
  const upper = n.toUpperCase();
  if (CODE_LABELS[upper]) return { code: upper, label: CODE_LABELS[upper], region: upper.length === 3 };
  for (const [code, names] of Object.entries(REGIONS)) {
    if (names.includes(n)) {
      const label = input.trim().length <= 2 ? CODE_LABELS[code] : input.trim().charAt(0).toUpperCase() + input.trim().slice(1);
      return { code, label, region: true };
    }
  }
  throw new DraftError(`Pays non reconnu : « ${input.trim()} » (indiquez un pays ou laissez vide)`);
}

// ---------------------------------------------------------------------------------------------
// Requête Ecobalyse

export type DataSource = "marque" | "etiquette" | "estimation";
export type Confidence = "haute" | "moyenne" | "faible";

export interface DraftInput {
  ean: string;
  brand_id: string;
  name: string;
  category: string;
  composition: string;
  social_grade: Grade;
  data_source: DataSource;
  source_ref?: string | null;
  source_date?: string | null;
  mass_kg?: number | string | null;
  country_fabric?: string | null;
  country_dyeing?: string | null;
  country_making?: string | null;
  air_transport_ratio?: number | string | null;
  price_eur?: number | string | null;
  transport?: string | null;
  eco_product?: string | null;
}

export interface BrandEco {
  eco_business?: string | null;
  eco_references?: number | string | null;
}

export interface BuiltQuery {
  product: EcoProduct;
  query: Record<string, unknown>;
  notes: string[];
  making: Country | null;
  confidence: Confidence;
}

function num(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function buildQuery(d: DraftInput, brand: BrandEco = {}): BuiltQuery {
  const product = ecoProductFor(d.category, d.eco_product);
  const { materials, notes } = parseComposition(d.composition);
  const fabric = mapCountry(d.country_fabric);
  const dyeing = mapCountry(d.country_dyeing);
  const making = mapCountry(d.country_making);
  const mass = num(d.mass_kg);
  const air = num(d.air_transport_ratio);
  const price = num(d.price_eur);
  const references = num(brand.eco_references);

  const query: Record<string, unknown> = {
    mass: mass ?? DEFAULT_MASS_KG[product],
    product,
    materials,
  };
  if (fabric) query.countryFabric = fabric.code;
  if (dyeing) query.countryDyeing = dyeing.code;
  if (making) query.countryMaking = making.code;
  if (air != null) query.airTransportRatio = air;
  if (price != null) query.price = price;
  if (brand.eco_business) query.business = brand.eco_business;
  if (references != null) query.numberOfReferences = Math.round(references);

  const allNotes = [...notes];
  if (mass == null) allNotes.push(`poids inconnu : poids type Ecobalyse pour ce vêtement (${String(DEFAULT_MASS_KG[product]).replace(".", ",")} kg)`);
  for (const [label, c] of [["tissage/tricot", fabric], ["teinture", dyeing], ["confection", making]] as const) {
    if (!c) allNotes.push(`pays de ${label} inconnu : valeur par défaut Ecobalyse (pénalisante)`);
    else if (c.region) allNotes.push(`pays de ${label} remplacé par la région ${CODE_LABELS[c.code]}`);
  }
  if (air == null) allNotes.push("part de transport en avion inconnue : valeur par défaut Ecobalyse");

  return { product, query, notes: allNotes, making, confidence: confidenceFor(d.data_source, mass != null, [fabric, dyeing, making], notes.length > 0) };
}

/**
 * Fiabilité affichée à l'utilisateur :
 *  - haute   : données de la marque, poids et trois pays connus, aucune matière approchée ;
 *  - moyenne : au moins le pays de confection connu (cas typique d'une étiquette) ;
 *  - faible  : le reste (valeurs par défaut d'Ecobalyse).
 */
export function confidenceFor(source: DataSource, massKnown: boolean, countries: (Country | null)[], approximated: boolean): Confidence {
  const known = countries.filter((c) => c !== null).length;
  if (source === "marque" && massKnown && known === 3 && !approximated) return "haute";
  if (countries[2] !== null) return "moyenne";
  return "faible";
}

// ---------------------------------------------------------------------------------------------
// Calibrage des notes

/**
 * Deux références par type de vêtement, calculées par Ecobalyse :
 *  - « vertueuse » : coton biologique, tissage, teinture et confection en France, petite marque ;
 *  - « majorant par défaut » : l'exemple officiel d'Ecobalyse (coton, pays inconnus, grande marque).
 * Les accessoires (boutons, zips) sont laissés de côté, comme pour les produits notés.
 */
export function referenceQueries(product: EcoProduct): { best: Record<string, unknown>; worst: Record<string, unknown> } {
  const mass = DEFAULT_MASS_KG[product];
  const swimwear = product === "maillot-de-bain";
  return {
    best: {
      mass,
      product,
      materials: [{ id: swimwear ? MATERIAL_IDS.polyesterRecycle : MATERIAL_IDS.cotonBio, share: 1 }],
      countrySpinning: "TR",
      countryFabric: "FR",
      countryDyeing: "FR",
      countryMaking: "FR",
      business: "small-business",
      numberOfReferences: 200,
      price: DEFAULT_PRICE_EUR[product] * 3,
    },
    worst: {
      mass,
      product,
      materials: [{ id: swimwear ? MATERIAL_IDS.polyester : MATERIAL_IDS.coton, share: 1 }],
      countrySpinning: "CN",
      business: "large-business-without-services",
      numberOfReferences: 100000,
      price: DEFAULT_PRICE_EUR[product],
    },
  };
}

export interface Thresholds {
  a_max: number;
  b_max: number;
  c_max: number;
  d_max: number;
}

/** Cinq classes de même largeur entre la référence vertueuse et le majorant par défaut. */
export function thresholdsFrom(best: number, worst: number): Thresholds {
  if (!(Number.isFinite(best) && Number.isFinite(worst) && worst > best)) {
    throw new Error(`Références incohérentes (vertueuse ${best}, majorant ${worst})`);
  }
  const step = (worst - best) / 5;
  return { a_max: best + step, b_max: best + 2 * step, c_max: best + 3 * step, d_max: best + 4 * step };
}

export function gradeFor(value: number, t: Thresholds): Grade {
  if (value <= t.a_max) return "A";
  if (value <= t.b_max) return "B";
  if (value <= t.c_max) return "C";
  if (value <= t.d_max) return "D";
  return "E";
}

/** Note globale : moyenne des notes environnement et sociale, arrondie vers la meilleure en cas d'égalité. */
export function combineGlobal(env: Grade, social: Grade): Grade {
  const avg = (GRADES.indexOf(env) + GRADES.indexOf(social)) / 2;
  return GRADES[Math.ceil(avg - 0.5)];
}

// ---------------------------------------------------------------------------------------------
// Réponse Ecobalyse → fiche produit

export interface BreakdownItem {
  label: string;
  level: "faible" | "moyen" | "fort";
  detail: string;
  share: number;
}

const STAGE_KEYS: Record<string, string> = {
  "matieres premieres": "material",
  material: "material",
  filature: "spinning",
  spinning: "spinning",
  "tissage & tricotage": "fabric",
  fabric: "fabric",
  ennoblissement: "ennobling",
  ennobling: "ennobling",
  confection: "making",
  making: "making",
  distribution: "distribution",
  utilisation: "use",
  use: "use",
  "fin de vie": "eol",
  "end-of-life": "eol",
};

const GROUPS: { label: string; detail: string; stages: string[] }[] = [
  { label: "Matière première", detail: "Production des fibres", stages: ["material"] },
  { label: "Fabrication", detail: "Filature, tissage ou tricot, confection", stages: ["spinning", "fabric", "making"] },
  { label: "Teinture et finitions", detail: "Teinture, impression et apprêts", stages: ["ennobling"] },
  { label: "Transport", detail: "Transports entre les étapes et distribution", stages: ["distribution", "transport"] },
  { label: "Utilisation et fin de vie", detail: "Lavages, séchage, repassage, fin de vie", stages: ["use", "eol"] },
];

function cchOf(impacts: unknown): number {
  const v = (impacts as Record<string, unknown> | undefined)?.cch;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Part de chaque grande étape dans l'impact climat (kg CO2e), à partir du cycle de vie Ecobalyse. */
export function breakdownFromLifeCycle(lifeCycle: unknown): BreakdownItem[] {
  if (!Array.isArray(lifeCycle)) throw new Error("Réponse Ecobalyse sans cycle de vie détaillé");
  const sums = new Map<string, number>();
  const add = (key: string, v: number) => sums.set(key, (sums.get(key) ?? 0) + Math.max(0, v));
  for (const stage of lifeCycle as Record<string, unknown>[]) {
    const key = STAGE_KEYS[normalize(String(stage.label ?? ""))];
    if (!key) continue;
    add(key, cchOf(stage.impacts));
    add("transport", cchOf((stage.transport as Record<string, unknown> | undefined)?.impacts));
  }
  const groups = GROUPS.map((g) => ({ ...g, value: g.stages.reduce((s, k) => s + (sums.get(k) ?? 0), 0) }));
  const total = groups.reduce((s, g) => s + g.value, 0);
  if (!(total > 0)) throw new Error("Cycle de vie Ecobalyse sans impact climat");
  return groups
    .filter((g) => g.value / total >= 0.005)
    .map((g) => {
      const pct = Math.round((g.value / total) * 100);
      return {
        label: g.label,
        level: pct >= 35 ? "fort" : pct >= 15 ? "moyen" : "faible",
        detail: `${g.detail} : ${pct} % de l'impact climat`,
        share: Math.max(pct, 2),
      };
    });
}

export interface ProductRow {
  ean: string;
  brand_id: string;
  name: string;
  category: string;
  origin_country: string;
  composition: string;
  transport: string;
  carbon_grade: Grade;
  social_grade: Grade;
  global_grade: Grade;
  env_grade: Grade;
  carbon_breakdown: BreakdownItem[];
  is_sample: false;
  data_source: DataSource;
  confidence: Confidence;
  source_ref: string | null;
  source_date: string | null;
  eco_cost: number;
  climate_kg: number;
  eco_web_url: string | null;
  assumptions: string[];
  methodology: string;
}

function transportLabel(d: DraftInput): string {
  if (d.transport && d.transport.trim()) return d.transport.trim();
  const air = num(d.air_transport_ratio);
  if (air == null) return "Non communiqué";
  if (air === 0) return "Sans avion";
  if (air >= 1) return "Avion";
  return `Avion pour ${Math.round(air * 100)} %`;
}

/** Assemble la fiche publiée à partir de la saisie, de la réponse Ecobalyse et des seuils. */
export function toProductRow(
  d: DraftInput,
  built: BuiltQuery,
  response: Record<string, unknown>,
  thresholds: { ecs: Thresholds; cch: Thresholds },
  apiVersion: string | null,
): ProductRow {
  const impacts = (response.impacts ?? {}) as Record<string, unknown>;
  const ecs = impacts.ecs;
  const cch = impacts.cch;
  if (typeof ecs !== "number" || typeof cch !== "number") throw new Error("Réponse Ecobalyse incomplète (ecs ou cch manquant)");
  // Notes « à poids égal » : les seuils sont calibrés au poids type du vêtement ; un article plus lourd ou plus léger
  // est ramené à ce poids pour comparer la fabrication, pas la taille (même règle que le registre officiel).
  const mass = Number(built.query.mass);
  const k = mass > 0 ? DEFAULT_MASS_KG[built.product] / mass : 1;
  const envGrade = gradeFor(ecs * k, thresholds.ecs);
  const carbonGrade = gradeFor(cch * k, thresholds.cch);
  const webUrl = typeof response.webUrl === "string" && response.webUrl.startsWith("https://ecobalyse.beta.gouv.fr/") ? response.webUrl : null;
  return {
    ean: d.ean,
    brand_id: d.brand_id,
    name: d.name.trim(),
    category: d.category.trim(),
    origin_country: built.making?.label ?? "Non communiqué",
    composition: d.composition.trim(),
    transport: transportLabel(d),
    carbon_grade: carbonGrade,
    social_grade: d.social_grade,
    global_grade: combineGlobal(envGrade, d.social_grade),
    env_grade: envGrade,
    carbon_breakdown: breakdownFromLifeCycle(response.lifeCycle),
    is_sample: false,
    data_source: d.data_source,
    confidence: built.confidence,
    source_ref: d.source_ref?.trim() || null,
    source_date: d.source_date ?? null,
    eco_cost: Math.round(ecs * 10) / 10,
    climate_kg: Math.round(cch * 100) / 100,
    eco_web_url: webUrl,
    assumptions: built.notes,
    methodology: `Ecobalyse${apiVersion ? ` (API ${apiVersion})` : ""} · ${SCORING_VERSION}`,
  };
}
