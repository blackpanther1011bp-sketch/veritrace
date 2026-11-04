// Tests de la lecture d'étiquette et du passeport (node --experimental-strip-types --test)
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseComposition } from "./core.ts";
import { countryFromName, fixOcr, fromAiReading, LabelError, readLabelText } from "./label.ts";
import { isValidGtin, passportQuery, stagesFromLifeCycle, validatePassport } from "./passport.ts";

const err = (fn: () => unknown, code: string) =>
  assert.throws(fn, (e: unknown) => e instanceof LabelError && e.code === code);

test("étiquette multilingue : tissu principal, doublure ignorée, pays", () => {
  const r = readLabelText(`SHELL / EXTERIOR / EXTÉRIEUR
95% COTTON · ALGODÓN · COTON
5% ELASTANE · ELASTANO · ÉLASTHANNE
LINING / FORRO / DOUBLURE
100% POLYESTER
MADE IN MOROCCO · HECHO EN MARRUECOS`);
  assert.equal(r.composition, "95 % coton, 5 % élasthanne");
  assert.equal(r.country?.code, "MA");
  assert.ok(r.notes.some((n) => n.includes("doublure")));
  assert.doesNotThrow(() => parseComposition(r.composition));
});

test("composition répétée dans plusieurs langues : un seul bloc", () => {
  const r = readLabelText("60% coton 40% polyester / 60% cotton 40% polyester / 60% algodón 40% poliéster  Fabriqué au Bangladesh");
  assert.equal(r.composition, "60 % coton, 40 % polyester");
  assert.equal(r.country?.label, "Bangladesh");
});

test("erreurs de lecture classiques : % lu « 96 », O au lieu de 0, %100 turc", () => {
  assert.equal(fixOcr("6096 COTTON 4096 POLYESTER"), "60% COTTON 40% POLYESTER");
  assert.equal(readLabelText("10096 COTTON MADE IN CHINA").composition, "100 % coton");
  assert.equal(readLabelText("1O0% coton").composition, "100 % coton");
  const tr = readLabelText("%100 PAMUK / COTTON  Made in Turkey");
  assert.equal(tr.composition, "100 % coton");
  assert.equal(tr.country?.code, "TR");
});

test("matière avant le pourcentage, arabe", () => {
  const r = readLabelText("قطن 100%  صنع في المغرب");
  assert.equal(r.composition, "100 % coton");
  assert.equal(r.country?.code, "MA");
  assert.equal(readLabelText("Cotton 80% Polyester 20%").composition, "80 % coton, 20 % polyester");
});

test("matières recyclées, bio, approximations", () => {
  assert.equal(readLabelText("70% recycled polyester 30% organic cotton").composition, "70 % polyester recyclé, 30 % coton bio");
  assert.doesNotThrow(() => parseComposition("70 % polyester recyclé, 30 % coton bio"));
  assert.equal(readLabelText("50% Baumwolle 50% Lyocell").composition, "50 % coton, 50 % modal");
});

test("refus clairs", () => {
  err(() => readLabelText("70% wool 30% cashmere"), "matiere_non_prise_en_charge");
  err(() => readLabelText("Prix 99 DH taille M"), "composition_introuvable");
  err(() => readLabelText("60% cotton"), "composition_incomplete");
  err(() => readLabelText(""), "illisible");
});

test("pays dans plusieurs langues", () => {
  assert.equal(countryFromName("China")?.code, "CN");
  assert.equal(countryFromName("Türkiye")?.code, "TR");
  assert.equal(countryFromName("المغرب")?.code, "MA");
  assert.equal(countryFromName("Portugal")?.code, "REO");
  assert.equal(countryFromName("Marruecos")?.code, "MA");
  assert.equal(countryFromName("nulle part"), null);
  assert.equal(countryFromName(null), null);
});

test("lecture par IA : contrôles", () => {
  const ok = fromAiReading({
    is_care_label: true,
    legible: true,
    main_fabric: [{ material: "coton biologique", percent: 95 }, { material: "élasthanne", percent: 5 }],
    other_parts: [{ part: "doublure", composition: "100 % polyester" }],
    country_of_manufacture: "Maroc",
    brand: "  Marwa ",
    raw_text: "95% organic cotton 5% elastane",
  });
  assert.equal(ok.composition, "95 % coton bio, 5 % élasthanne");
  assert.equal(ok.country?.code, "MA");
  assert.equal(ok.brand, "Marwa");
  assert.ok(ok.notes[0].includes("doublure"));
  err(() => fromAiReading({ is_care_label: false, legible: true, main_fabric: [] }), "pas_une_etiquette");
  err(() => fromAiReading({ is_care_label: true, legible: false, main_fabric: [] }), "illisible");
  err(() => fromAiReading({ is_care_label: true, legible: true, main_fabric: [{ material: "soie", percent: 100 }] }), "matiere_non_prise_en_charge");
  err(() => fromAiReading({ is_care_label: true, legible: true, main_fabric: [{ material: "coton", percent: 90 }] }), "composition_incomplete");
});

const form = {
  company: "Atelier Textile Casablanca",
  city: "Casablanca",
  product_name: "T-shirt col rond",
  reference: "TS-24",
  gtin: "6111234567895",
  category: "T-shirt",
  composition: "100 % coton bio",
  mass_g: "160",
  country_spinning: "Turquie",
  country_fabric: "Maroc",
  country_dyeing: "Maroc",
  country_making: "Maroc",
  air_transport_pct: "0",
};

test("passeport : saisie valide → requête Ecobalyse complète, fiabilité haute", () => {
  assert.ok(isValidGtin("6111234567895"));
  const p = validatePassport(form);
  assert.equal(p.mass_kg, 0.16);
  assert.equal(p.country_making.code, "MA");
  assert.equal(p.air_transport_ratio, 0);
  const built = passportQuery(p);
  assert.equal(built.product, "tshirt");
  assert.equal(built.query.mass, 0.16);
  assert.equal(built.query.countrySpinning, "TR");
  assert.equal(built.query.countryMaking, "MA");
  assert.equal(built.query.airTransportRatio, 0);
  assert.equal(built.confidence, "haute");
});

test("passeport : erreurs de saisie", () => {
  err(() => validatePassport({ ...form, company: "" }), "entreprise");
  err(() => validatePassport({ ...form, gtin: "6111234567890" }), "gtin");
  err(() => validatePassport({ ...form, mass_g: "3" }), "poids");
  err(() => validatePassport({ ...form, country_making: "" }), "pays");
  err(() => validatePassport({ ...form, country_dyeing: "Atlantide" }), "pays");
  err(() => validatePassport({ ...form, composition: "100 % soie" }), "composition");
  err(() => validatePassport({ ...form, category: "Chaussures" }), "categorie");
  err(() => validatePassport({ ...form, air_transport_pct: "150" }), "avion");
  assert.equal(validatePassport({ ...form, gtin: "" }).gtin, null);
  assert.equal(validatePassport({ ...form, air_transport_pct: "" }).air_transport_ratio, null);
});

test("étapes du cycle de vie", () => {
  const s = stagesFromLifeCycle([
    { label: "Matières premières", impacts: { ecs: 100.04, cch: 1.2345 }, transport: { impacts: { ecs: 2, cch: 0.01 } } },
    { label: "Confection", impacts: { ecs: 20, cch: 0.3 }, transport: { impacts: { ecs: 3, cch: 0.02 } } },
  ]);
  assert.deepEqual(s.map((x) => x.label), ["Matières premières", "Confection", "Transports (toutes étapes)"]);
  assert.equal(s[0].ecs, 100);
  assert.equal(s[2].ecs, 5);
  assert.throws(() => stagesFromLifeCycle(null));
});

test("doublure seule lisible : refus plutôt que noter la doublure", () => {
  assert.throws(
    () => readLabelText("SHELL / EXTERIOR\n5% COTTON\n5% ELASTANE\nLINING / DOUBLURE\n100% POLYESTER\nMADE IN MOROCCO"),
    (e: unknown) => e instanceof LabelError && e.code === "composition_incomplete",
  );
  const ok = readLabelText("SHELL\n95% COTTON\n5% ELASTANE\nLINING\n100% POLYESTER");
  assert.equal(ok.composition, "95 % coton, 5 % élasthanne");
});
