export type Grade = "A" | "B" | "C" | "D" | "E";
export type Level = "faible" | "moyen" | "fort";
export type CheckStatus = "oui" | "partiel" | "non" | "non_communique";
/** non_classee : marque du registre officiel, pas encore évaluée par VeriTrace */
export type BrandKind = "fast_fashion" | "responsable" | "seconde_main" | "non_classee";

export interface BreakdownItem {
  label: string;
  level: Level;
  detail: string;
  share: number;
}

export interface SocialCheck {
  label: string;
  status: CheckStatus;
}

export interface Brand {
  id: string;
  name: string;
  kind: BrandKind;
  country: string;
  social_checks: SocialCheck[];
}

/**
 * demo : fictif ; marque : données transmises par la marque ; etiquette : relevé sur l'étiquette ;
 * estimation : valeurs par défaut ; registre : coût déclaré par la marque au registre officiel
 */
export type DataSource = "demo" | "marque" | "etiquette" | "estimation" | "registre";
export type Confidence = "haute" | "moyenne" | "faible";

export interface Product {
  ean: string;
  name: string;
  category: string;
  origin_country: string;
  composition: string;
  transport: string;
  carbon_grade: Grade;
  /** null : note sociale pas encore évaluée (produits du registre officiel) */
  social_grade: Grade | null;
  global_grade: Grade;
  carbon_breakdown: BreakdownItem[];
  is_sample: boolean;
  brand: Brand;
  // Provenance et calcul Ecobalyse (absents des produits de démonstration)
  data_source: DataSource;
  confidence: Confidence | null;
  source_ref: string | null;
  source_date: string | null;
  env_grade: Grade | null;
  eco_cost: number | null;
  climate_kg: number | null;
  eco_web_url: string | null;
  assumptions: string[];
  methodology: string | null;
  scored_at: string | null;
  /** référence interne de la marque (produits du registre officiel) */
  reference?: string | null;
  /** étiquette lue : code public (L…) */
  label_code?: string;
  /** passeport numérique du fabricant */
  passport_id?: string;
}

export interface Passport {
  id: string;
  gtin: string | null;
  company: string;
  city: string | null;
  country: string;
  product_name: string;
  reference: string | null;
  category: string;
  eco_product: string;
  composition: string;
  mass_kg: number;
  country_spinning: string | null;
  country_fabric: string | null;
  country_dyeing: string | null;
  country_making: string;
  air_transport_ratio: number | null;
  eco_cost: number;
  climate_kg: number;
  env_grade: Grade;
  carbon_grade: Grade;
  carbon_breakdown: BreakdownItem[];
  stages: { label: string; ecs: number; cch: number }[];
  eco_web_url: string | null;
  assumptions: string[];
  confidence: Confidence;
  methodology: string;
  verified: boolean;
  created_at: string;
}
