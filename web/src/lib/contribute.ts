import { supabase, SUPABASE_KEY, SUPABASE_URL } from "./supabase";
import { newId, sessionId } from "./track";

/** Catégories proposées (reconnues par le calcul Ecobalyse). */
export const CATEGORIES = [
  "T-shirt",
  "Polo",
  "Chemise",
  "Blouse",
  "Robe",
  "Jupe",
  "Jean",
  "Pantalon",
  "Short",
  "Pull",
  "Sweat",
  "Gilet",
  "Veste",
  "Manteau",
  "Maillot de bain",
  "Chaussettes",
  "Boxer / Slip",
] as const;

/** Pays fréquents sur les étiquettes (suggestions, la saisie reste libre). */
export const COUNTRIES = [
  "Maroc",
  "Turquie",
  "Chine",
  "Bangladesh",
  "Inde",
  "Pakistan",
  "Vietnam",
  "Cambodge",
  "Tunisie",
  "Égypte",
  "Sri Lanka",
  "Indonésie",
  "Myanmar",
  "Portugal",
  "Espagne",
  "Italie",
  "France",
];

/**
 * Contrôle simple de la composition avant envoi : les pourcentages doivent faire 100 %.
 * Une seule matière sans pourcentage (« coton ») est acceptée.
 */
export function checkComposition(text: string): string | null {
  const value = text.trim();
  if (value.length < 3) return "Recopiez la composition écrite sur l'étiquette.";
  if (!/[a-zA-ZÀ-ÿ]/.test(value)) return "Indiquez aussi les matières (coton, polyester…).";
  const percents = [...value.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map((m) => Number(m[1].replace(",", ".")));
  if (percents.length === 0) {
    return /\d/.test(value) ? "Ajoutez le signe % après chaque pourcentage." : null;
  }
  const total = percents.reduce((s, n) => s + n, 0);
  if (total < 99 || total > 101) return `Les pourcentages font ${Math.round(total * 10) / 10} % au lieu de 100 %.`;
  return null;
}

/** Réduit la photo (1600 px max, JPEG) pour un envoi rapide en magasin. */
export async function compressPhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponible");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) throw new Error("Compression impossible");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Dépose la photo d'étiquette (lecture réservée à l'équipe) et renvoie son nom. */
export async function uploadLabelPhoto(photo: Blob): Promise<string> {
  const name = `${newId().toLowerCase()}.jpg`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/etiquettes/${name}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "image/jpeg", "x-upsert": "false" },
    body: photo,
  });
  if (!res.ok) throw new Error(`Photo non envoyée (${res.status})`);
  return name;
}

export interface Contribution {
  ean: string;
  brandName: string;
  name: string;
  category: string;
  composition: string;
  countryMaking: string;
  photoPath: string | null;
}

/** Enregistre la contribution « à vérifier » : rien n'est publié avant validation par l'équipe. */
export async function submitContribution(c: Contribution): Promise<void> {
  const { error } = await supabase.from("product_submissions").insert({
    ean: c.ean,
    brand_name: c.brandName.trim().slice(0, 80),
    name: c.name.trim().slice(0, 120),
    category: c.category,
    composition: c.composition.trim().slice(0, 300),
    country_making: c.countryMaking.trim().slice(0, 40) || null,
    photo_path: c.photoPath,
    session_id: sessionId(),
  });
  if (error) throw error;
}
