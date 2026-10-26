export type Grade = "A" | "B" | "C" | "D" | "E";
export type Level = "faible" | "moyen" | "fort";
export type CheckStatus = "oui" | "partiel" | "non" | "non_communique";
export type BrandKind = "fast_fashion" | "responsable" | "seconde_main";

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

export interface Product {
  ean: string;
  name: string;
  category: string;
  origin_country: string;
  composition: string;
  transport: string;
  carbon_grade: Grade;
  social_grade: Grade;
  global_grade: Grade;
  carbon_breakdown: BreakdownItem[];
  is_sample: boolean;
  brand: Brand;
}
