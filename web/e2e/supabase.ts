import type { Page, Request } from "@playwright/test";

// Supabase simulé : fiches de démonstration et enregistrement des écritures envoyées par le site.

export const EAN = "2001000000012";
export const EAN_INCONNU = "3616820052587";

const BRAND = {
  id: "urbanline",
  name: "Urbanline",
  kind: "fast_fashion",
  country: "Espagne",
  social_checks: [
    { label: "Liste des usines publiée", status: "non" },
    { label: "Salaire vital", status: "non_communique" },
  ],
};

export const PRODUIT = {
  ean: EAN,
  name: "T-shirt col rond",
  category: "T-shirt",
  origin_country: "Bangladesh",
  composition: "60 % coton, 40 % polyester",
  transport: "Bateau",
  carbon_grade: "D",
  env_grade: "D",
  social_grade: "E",
  global_grade: "D",
  carbon_breakdown: [
    { label: "Matière première", level: "moyen", share: 22, detail: "Production des fibres : 22 %" },
    { label: "Fabrication", level: "fort", share: 38, detail: "Filature, tissage : 38 %" },
    { label: "Teinture et finitions", level: "moyen", share: 27, detail: "Teinture : 27 %" },
    { label: "Transport", level: "faible", share: 5, detail: "Transports : 5 %" },
    { label: "Utilisation et fin de vie", level: "faible", share: 8, detail: "Lavages : 8 %" },
  ],
  is_sample: false,
  data_source: "registre",
  confidence: null,
  source_ref: null,
  source_date: null,
  eco_cost: 1265.8,
  climate_kg: 7.34,
  eco_web_url: null,
  assumptions: [],
  methodology: null,
  scored_at: null,
  brand: BRAND,
};

export const ALTERNATIVE = {
  ...PRODUIT,
  ean: "2005000000010",
  name: "T-shirt col V",
  global_grade: "B",
  env_grade: "B",
  carbon_grade: "B",
  social_grade: "B",
  eco_cost: 612.4,
  brand: { ...BRAND, id: "pulse", name: "Pulse & Co", kind: "responsable" },
};

export interface Ecriture {
  table: string;
  body: Record<string, unknown>;
}

interface Options {
  /** Réponse de get_product : la fiche, null (introuvable) ou « panne » (erreur serveur). */
  produit?: Record<string, unknown> | null | "panne";
}

/** Intercepte tous les appels à Supabase ; renvoie la liste des écritures (insert) faites par la page. */
export async function simulerSupabase(page: Page, options: Options = {}): Promise<Ecriture[]> {
  const ecritures: Ecriture[] = [];
  const produit = options.produit === undefined ? PRODUIT : options.produit;
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };

  await page.route(/supabase\.co\//, async (route) => {
    const req: Request = route.request();
    const url = new URL(req.url());
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify(body) });

    if (url.pathname.endsWith("/rpc/get_product")) {
      if (produit === "panne") return json(500, { message: "panne simulée" });
      const ean = (req.postDataJSON() as { p_ean?: string })?.p_ean;
      if (ean === ALTERNATIVE.ean) return json(200, ALTERNATIVE);
      return json(200, produit);
    }
    if (url.pathname.endsWith("/rpc/get_alternatives_json")) return json(200, [ALTERNATIVE]);
    const table = url.pathname.match(/\/rest\/v1\/([a-z_]+)$/)?.[1];
    if (table && req.method() === "POST") {
      const body = req.postDataJSON();
      for (const row of Array.isArray(body) ? body : [body]) ecritures.push({ table, body: row });
      return route.fulfill({ status: 201, headers: cors, body: "" });
    }
    return json(404, { message: "non simulé" });
  });
  return ecritures;
}

/** Attend qu'une écriture dans `table` ait été envoyée et la renvoie. */
export async function ecritureDans(page: Page, ecritures: Ecriture[], table: string): Promise<Record<string, unknown>> {
  for (let i = 0; i < 50; i++) {
    const e = ecritures.find((x) => x.table === table);
    if (e) return e.body;
    await page.waitForTimeout(100);
  }
  throw new Error(`Aucune écriture dans « ${table} » (reçues : ${ecritures.map((e) => e.table).join(", ") || "aucune"})`);
}

/** Vêtement du registre dont la marque a une note sociale sourcée (méthode v1 : 4 points sur 5 → B). */
export const PRODUIT_SOCIAL_SOURCE = {
  ...PRODUIT,
  ean: "4255623498406",
  name: "Chaussettes",
  env_grade: "C",
  carbon_grade: "C",
  social_grade: "B",
  global_grade: "B",
  brand: {
    id: "registre-4",
    name: "ARMEDANGELS",
    kind: "non_classee",
    country: "",
    social_checks: [
      {
        label: "Liste des usines publiée",
        status: "oui",
        detail: "Fournisseurs couvrant 100 % des achats publiés sur le site de Fair Wear.",
        source_url: "https://api.fairwear.org/wp-content/uploads/2022/10/BPC-Social-Fashion-Company-GmbH-ARMEDANGELS-2022.pdf",
        source_title: "Fair Wear – Brand Performance Check ARMEDANGELS 2022",
        source_period: "2022-08",
        checked_at: "2026-11-05",
      },
      {
        label: "Contrôle indépendant des usines (Fair Wear, Fair Labor Association)",
        status: "oui",
        detail: "Membre de Fair Wear ; dernière évaluation publiée en 2026.",
        source_url: "https://www.fairwear.org/brands/armedangels/",
        source_title: "Fair Wear – fiche de la marque ARMEDANGELS",
        source_period: "2026-09",
        checked_at: "2026-11-05",
      },
      {
        label: "Certification sociale de l'entreprise (B Corp)",
        status: "non_demontre",
        detail: "Aucune certification B Corp trouvée dans l'annuaire de B Lab.",
        source_url: "https://www.bcorporation.net/en-us/find-a-b-corp/",
        source_title: "B Lab – annuaire des B Corp",
        source_period: null,
        checked_at: "2026-11-05",
      },
    ],
  },
};

/** Vêtement du registre dont la marque n'a aucune preuve sociale : note sociale non évaluée. */
export const PRODUIT_SOCIAL_NON_EVALUE = {
  ...PRODUIT,
  ean: "3616820052587",
  social_grade: null,
  global_grade: "D",
  brand: { id: "registre-71", name: "KIABI", kind: "non_classee", country: "", social_checks: [] },
};
