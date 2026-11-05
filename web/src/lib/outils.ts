import { rememberProduct } from "./api";
import { normalizeGtin, isValidGtin } from "./barcode";
import { serverMessage, t } from "./i18n";
import { supabase, SUPABASE_KEY, SUPABASE_URL } from "./supabase";
import type { Passport, Product } from "./types";

/** Erreur expliquée par le serveur (message en français, prêt à afficher). */
export class ServiceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function callOutils<T>(body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/outils`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ServiceError("reseau", t("server.reseau"));
  }
  let data: { ok?: boolean; error?: string; message?: string } & Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    throw new ServiceError("serveur", t("server.serveur"));
  }
  if (!res.ok || !data.ok) {
    const code = data.error ?? "serveur";
    // en arabe, message traduit d'après le code ; en français, message du serveur (plus précis)
    throw new ServiceError(code, serverMessage(code, data.message ?? t("common.unexpected")));
  }
  return data as T;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export interface LabelResult {
  product: Product;
  code: string;
  method: "texte" | "ia";
  published: boolean;
}

/**
 * Envoie le texte lu sur la photo (et la photo, gardée pour la vérification) : le serveur en tire la
 * composition et le pays, calcule la note avec Ecobalyse et renvoie la fiche prête à afficher.
 */
export async function readLabel(input: { photo: Blob; text: string; category: string; ean: string | null; brand: string }): Promise<LabelResult> {
  const result = await callOutils<LabelResult>({
    action: "lire_etiquette",
    text: input.text.slice(0, 4000),
    image: await blobToDataUrl(input.photo),
    category: input.category,
    ean: input.ean,
    brand: input.brand.trim() || null,
    client: "web",
  });
  rememberProduct(result.product);
  return result;
}

export interface PassportForm {
  company: string;
  city: string;
  product_name: string;
  reference: string;
  gtin: string;
  category: string;
  composition: string;
  mass_g: string;
  country_spinning: string;
  country_fabric: string;
  country_dyeing: string;
  country_making: string;
  air_transport_pct: string;
}

export async function createPassport(form: PassportForm): Promise<Passport> {
  const r = await callOutils<{ passport: Passport }>({ action: "creer_passeport", ...form });
  return r.passport;
}

export async function fetchPassport(id: string): Promise<Passport | null> {
  const { data, error } = await supabase.from("passports").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Passport | null) ?? null;
}

// ---------------------------------------------------------------------------------------------
// QR codes : GS1 Digital Link et passeports VeriTrace

export type ScannedCode = { kind: "gtin"; gtin: string } | { kind: "passport"; id: string };

/**
 * Interprète un code scanné : code-barres classique, QR code GS1 Digital Link (…/01/<GTIN>…, format des
 * futurs passeports numériques européens) ou QR code d'un passeport VeriTrace. null si inconnu.
 */
export function parseScannedCode(raw: string): ScannedCode | null {
  const value = raw.trim();
  if (/^\d{8,14}$/.test(value)) {
    const gtin = normalizeGtin(value.length === 14 && value.startsWith("0") ? value.slice(1) : value);
    return isValidGtin(gtin) ? { kind: "gtin", gtin } : null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const passport =
    url.searchParams.get("passeport") ??
    url.hash.match(/#\/passeport\/([0-9a-f]{12})/)?.[1] ??
    url.pathname.match(/^\/passeport\/([0-9a-f]{12})\/?$/)?.[1] ??
    null;
  if (passport && /^[0-9a-f]{12}$/.test(passport)) return { kind: "passport", id: passport };
  const dl = url.pathname.match(/(?:^|\/)01\/(\d{8,14})(?:\/|$)/);
  if (dl) {
    const digits = dl[1].length === 14 && dl[1].startsWith("0") ? dl[1].slice(1) : dl[1];
    const gtin = normalizeGtin(digits);
    if (isValidGtin(gtin)) return { kind: "gtin", gtin };
  }
  return null;
}

/**
 * Adresse encodée dans le QR code du passeport : GS1 Digital Link quand le produit a un code-barres (format des
 * futurs passeports européens ; le site sert aussi l'aperçu de partage sur cette adresse), sinon l'adresse propre.
 */
export function passportLink(p: Pick<Passport, "id" | "gtin">, origin = window.location.origin): string {
  if (p.gtin) return `${origin}/01/${p.gtin.padStart(14, "0")}?passeport=${p.id}`;
  return passportShareLink(p, origin);
}

/** Adresse à partager (WhatsApp, e-mail…) : le site y sert un aperçu (titre, coût, image) puis la page du passeport. */
export function passportShareLink(p: Pick<Passport, "id">, origin = window.location.origin): string {
  return `${origin}/passeport/${p.id}`;
}

/** Données du passeport, structurées comme les champs attendus du passeport numérique européen. */
export function passportJson(p: Passport, link: string) {
  return {
    format: "VeriTrace — aperçu de passeport numérique produit (format provisoire, le format européen officiel n'est pas encore publié)",
    id: p.id,
    url: link,
    product: {
      gtin: p.gtin,
      name: p.product_name,
      reference: p.reference,
      category: p.category,
      fibre_composition: p.composition,
      mass_kg: p.mass_kg,
    },
    manufacturer: { name: p.company, city: p.city, country: p.country },
    supply_chain: {
      spinning: p.country_spinning,
      weaving_knitting: p.country_fabric,
      dyeing_finishing: p.country_dyeing,
      making: p.country_making,
      air_transport_share: p.air_transport_ratio,
    },
    environmental_footprint: {
      method: "Ecobalyse — méthode officielle française de l'affichage environnemental des vêtements",
      methodology: p.methodology,
      environmental_cost_points: p.eco_cost,
      climate_change_kg_co2e: p.climate_kg,
      grade_veritrace: p.env_grade,
      life_cycle_stages: p.stages,
      calculation_url: p.eco_web_url,
      assumptions: p.assumptions,
      data_confidence: p.confidence,
    },
    declared_by_manufacturer: true,
    verified_by_veritrace: p.verified,
    issued_at: p.created_at,
  };
}
