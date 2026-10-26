import { supabase } from "./supabase";
import type { Product } from "./types";

const PRODUCT_FIELDS =
  "ean,name,category,origin_country,composition,transport,carbon_grade,social_grade,global_grade,carbon_breakdown,is_sample," +
  "data_source,confidence,source_ref,source_date,env_grade,eco_cost,climate_kg,eco_web_url,assumptions,methodology,scored_at," +
  "brand:brands(id,name,kind,country,social_checks)";

// Petit cache en mémoire : fiche → détails → alternatives sans nouvel appel réseau.
const productCache = new Map<string, Product | null>();
const alternativesCache = new Map<string, Product[]>();

export function getCachedProduct(ean: string): Product | null | undefined {
  return productCache.get(ean);
}

export async function fetchProduct(ean: string): Promise<Product | null> {
  if (productCache.has(ean)) return productCache.get(ean)!;
  const { data, error } = await supabase.from("products").select(PRODUCT_FIELDS).eq("ean", ean).maybeSingle();
  if (error) throw error;
  const product = (data as unknown as Product | null) ?? null;
  productCache.set(ean, product);
  return product;
}

export async function fetchAlternatives(ean: string): Promise<Product[]> {
  if (alternativesCache.has(ean)) return alternativesCache.get(ean)!;
  const { data, error } = await supabase.rpc("get_alternatives", { p_ean: ean }).select(PRODUCT_FIELDS);
  if (error) throw error;
  const list = (data as unknown as Product[] | null) ?? [];
  alternativesCache.set(ean, list);
  for (const p of list) productCache.set(p.ean, p);
  return list;
}

/** Précharge les alternatives pendant que l'utilisateur lit la fiche. */
export function prefetchAlternatives(ean: string): void {
  fetchAlternatives(ean).catch(() => undefined);
}

export async function reportMissingProduct(ean: string, brand: string): Promise<void> {
  const cleanBrand = brand.trim().slice(0, 80);
  const { error } = await supabase
    .from("product_reports")
    .insert({ ean, brand: cleanBrand.length > 0 ? cleanBrand : null });
  if (error) throw error;
}
