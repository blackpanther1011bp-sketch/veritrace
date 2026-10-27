// Tests du cœur de calcul : node --experimental-strip-types --test supabase/functions/ecobalyse-score/core.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  breakdownFromLifeCycle,
  buildQuery,
  combineGlobal,
  DEFAULT_MASS_KG,
  DraftError,
  type DraftInput,
  ecoProductFor,
  gradeFor,
  mapCountry,
  MATERIAL_IDS,
  parseComposition,
  referenceQueries,
  thresholdsFrom,
  toProductRow,
} from "./core.ts";

const draft = (over: Partial<DraftInput> = {}): DraftInput => ({
  ean: "6111234567890",
  brand_id: "atelier-oued",
  name: "T-shirt coton",
  category: "T-shirt",
  composition: "60 % coton, 40 % polyester",
  social_grade: "B",
  data_source: "etiquette",
  ...over,
});

test("composition : pourcentages, accents, ordre libre", () => {
  assert.deepEqual(parseComposition("60 % coton, 40 % polyester").materials, [
    { id: MATERIAL_IDS.coton, share: 0.6 },
    { id: MATERIAL_IDS.polyester, share: 0.4 },
  ]);
  assert.deepEqual(parseComposition("98% Coton ; 2% Élasthanne").materials, [
    { id: MATERIAL_IDS.coton, share: 0.98 },
    { id: MATERIAL_IDS.elasthanne, share: 0.02 },
  ]);
  assert.deepEqual(parseComposition("Coton 70%, Polyester recyclé 30%").materials, [
    { id: MATERIAL_IDS.coton, share: 0.7 },
    { id: MATERIAL_IDS.polyesterRecycle, share: 0.3 },
  ]);
  assert.deepEqual(parseComposition("100 % coton bio").materials, [{ id: MATERIAL_IDS.cotonBio, share: 1 }]);
  assert.deepEqual(parseComposition("100 % lin").materials, [{ id: MATERIAL_IDS.lin, share: 1 }]);
  assert.deepEqual(parseComposition("95% COTON BIOLOGIQUE 5% ELASTHANNE").materials, [
    { id: MATERIAL_IDS.cotonBio, share: 0.95 },
    { id: MATERIAL_IDS.elasthanne, share: 0.05 },
  ]);
  assert.deepEqual(parseComposition("coton 60, polyester 40").materials.map((m) => m.share), [0.6, 0.4]);
});

test("composition : matières identiques regroupées, somme exacte à 1", () => {
  const { materials } = parseComposition("33,3 % coton, 33,3 % polyester, 33,4 % coton");
  assert.equal(materials.reduce((s, m) => s + Math.round(m.share * 100), 0), 100);
  assert.equal(materials.length, 2);
  assert.equal(materials[0].id, MATERIAL_IDS.coton);
});

test("composition : approximations signalées", () => {
  const r = parseComposition("100 % laine recyclée");
  assert.equal(r.materials[0].id, MATERIAL_IDS.laine);
  assert.match(r.notes[0], /laine recyclée/);
  assert.match(parseComposition("50 % modal, 50 % coton").notes[0], /viscose/);
});

test("composition : refus explicites", () => {
  assert.throws(() => parseComposition("100 % soie"), /Matière non prise en charge.*soie/);
  assert.throws(() => parseComposition("60 % coton, 30 % polyester"), /90 %/);
  assert.throws(() => parseComposition("coton, polyester"), /Pourcentage manquant/);
  assert.throws(() => parseComposition("  "), DraftError);
});

test("pays : noms, codes, régions, vide", () => {
  assert.deepEqual(mapCountry("Maroc"), { code: "MA", label: "Maroc", region: false });
  assert.deepEqual(mapCountry("bangladesh"), { code: "BD", label: "Bangladesh", region: false });
  assert.deepEqual(mapCountry("CN"), { code: "CN", label: "Chine", region: false });
  assert.deepEqual(mapCountry("Turquie"), { code: "TR", label: "Turquie", region: false });
  assert.deepEqual(mapCountry("Portugal"), { code: "REO", label: "Portugal", region: true });
  assert.deepEqual(mapCountry("Égypte"), { code: "RAF", label: "Égypte", region: true });
  assert.equal(mapCountry(""), null);
  assert.equal(mapCountry(null), null);
  assert.throws(() => mapCountry("Atlantide"), /Pays non reconnu/);
});

test("catégories VeriTrace → produits Ecobalyse", () => {
  assert.equal(ecoProductFor("T-shirt"), "tshirt");
  assert.equal(ecoProductFor("Sweat"), "pull");
  assert.equal(ecoProductFor("Robe"), "jupe");
  assert.equal(ecoProductFor("Veste"), "manteau");
  assert.equal(ecoProductFor("Jean"), "jean");
  assert.equal(ecoProductFor("Pantalon"), "pantalon");
  assert.equal(ecoProductFor("Chemise"), "chemise");
  assert.equal(ecoProductFor("Maillot de bain"), "maillot-de-bain");
  assert.equal(ecoProductFor("Accessoire", "jupe"), "jupe");
  assert.throws(() => ecoProductFor("Écharpe"), /eco_product/);
});

test("requête : valeurs fournies et valeurs par défaut", () => {
  const b = buildQuery(draft({ country_making: "Maroc", mass_kg: "0,18" }), { eco_business: "small-business", eco_references: 300 });
  assert.deepEqual(b.query, {
    mass: 0.18,
    product: "tshirt",
    materials: [
      { id: MATERIAL_IDS.coton, share: 0.6 },
      { id: MATERIAL_IDS.polyester, share: 0.4 },
    ],
    countryMaking: "MA",
    business: "small-business",
    numberOfReferences: 300,
  });
  assert.equal(b.confidence, "moyenne");
  assert.ok(b.notes.some((n) => n.includes("tissage/tricot inconnu")));

  const minimal = buildQuery(draft());
  assert.equal(minimal.query.mass, DEFAULT_MASS_KG.tshirt);
  assert.equal(minimal.confidence, "faible");
  assert.ok(minimal.notes.some((n) => n.includes("poids type")));
  assert.ok(minimal.notes.some((n) => n.includes("transport en avion inconnue")));
  assert.ok(!buildQuery(draft({ air_transport_ratio: 0 })).notes.some((n) => n.includes("avion")));
});

test("fiabilité haute : marque, poids et trois pays", () => {
  const b = buildQuery(draft({ data_source: "marque", mass_kg: 0.2, country_fabric: "Turquie", country_dyeing: "Turquie", country_making: "Maroc" }));
  assert.equal(b.confidence, "haute");
  const approx = buildQuery(draft({ data_source: "marque", composition: "100 % modal", mass_kg: 0.2, country_fabric: "TR", country_dyeing: "TR", country_making: "MA" }));
  assert.equal(approx.confidence, "moyenne");
});

test("références de calibrage : même type et même poids", () => {
  const { best, worst } = referenceQueries("jean");
  assert.equal(best.mass, 0.45);
  assert.equal(worst.mass, 0.45);
  assert.equal(best.countryMaking, "FR");
  assert.equal(worst.countryMaking, undefined);
});

test("seuils et notes", () => {
  const t = thresholdsFrom(100, 600);
  assert.deepEqual(t, { a_max: 200, b_max: 300, c_max: 400, d_max: 500 });
  assert.equal(gradeFor(80, t), "A");
  assert.equal(gradeFor(200, t), "A");
  assert.equal(gradeFor(201, t), "B");
  assert.equal(gradeFor(450, t), "D");
  assert.equal(gradeFor(900, t), "E");
  assert.throws(() => thresholdsFrom(600, 100));
});

test("note globale : comme les données de démonstration", () => {
  assert.equal(combineGlobal("D", "E"), "D");
  assert.equal(combineGlobal("B", "D"), "C");
  assert.equal(combineGlobal("C", "E"), "D");
  assert.equal(combineGlobal("A", "B"), "A");
  assert.equal(combineGlobal("E", "E"), "E");
});

// Réponse détaillée au format d'Ecobalyse (Simulator.encode / Stage.encode)
const stage = (label: string, cch: number, transport = 0) => ({ label, impacts: { cch, ecs: cch * 100 }, transport: { impacts: { cch: transport } } });
const detailed = {
  webUrl: "https://ecobalyse.beta.gouv.fr/#/textile/simulator/ecs/abc",
  impacts: { ecs: 1234.567, cch: 6.789 },
  lifeCycle: [
    stage("Matières premières", 2.0, 0.1),
    stage("Filature", 0.5, 0.05),
    stage("Tissage & Tricotage", 0.7, 0.05),
    stage("Ennoblissement", 1.2, 0.05),
    stage("Confection", 0.3, 0.3),
    stage("Distribution", 0.1),
    stage("Utilisation", 0.6),
    stage("Fin de vie", 0.05),
  ],
};

test("répartition du CO2 par grande étape", () => {
  const items = breakdownFromLifeCycle(detailed.lifeCycle);
  assert.deepEqual(
    items.map((i) => i.label),
    ["Matière première", "Fabrication", "Teinture et finitions", "Transport", "Utilisation et fin de vie"],
  );
  const total = 6.0;
  assert.equal(items[0].share, Math.round((2.0 / total) * 100));
  assert.equal(items[0].level, "moyen"); // 33 %
  assert.equal(items[1].share, Math.round((1.5 / total) * 100));
  assert.equal(items[3].share, Math.round((0.65 / total) * 100));
  assert.match(items[0].detail, /% de l'impact climat$/);
  assert.throws(() => breakdownFromLifeCycle(undefined), /cycle de vie/);
});

test("fiche publiée", () => {
  const d = draft({ country_making: "Maroc", air_transport_ratio: 0, source_ref: " https://exemple.ma/fiche " });
  const built = buildQuery(d);
  const row = toProductRow(d, built, detailed, { ecs: thresholdsFrom(500, 1500), cch: thresholdsFrom(3, 8) }, "2.3.0");
  assert.equal(row.env_grade, "D"); // 1234,6 entre 1100 et 1300
  assert.equal(row.carbon_grade, "D"); // 6,79 entre 6 et 7
  assert.equal(row.global_grade, "C"); // D et B
  assert.equal(row.origin_country, "Maroc");
  assert.equal(row.transport, "Sans avion");
  assert.equal(row.eco_cost, 1234.6);
  assert.equal(row.climate_kg, 6.79);
  assert.equal(row.source_ref, "https://exemple.ma/fiche");
  assert.equal(row.eco_web_url, detailed.webUrl);
  assert.equal(row.is_sample, false);
  assert.match(row.methodology, /API 2\.3\.0/);
  assert.deepEqual(row.assumptions, built.notes);

  const noUrl = toProductRow(d, built, { ...detailed, webUrl: "https://ailleurs.example/x" }, { ecs: thresholdsFrom(500, 1500), cch: thresholdsFrom(3, 8) }, null);
  assert.equal(noUrl.eco_web_url, null);
  assert.throws(() => toProductRow(d, built, { impacts: {} }, { ecs: thresholdsFrom(1, 2), cch: thresholdsFrom(1, 2) }, null), /incomplète/);
});
