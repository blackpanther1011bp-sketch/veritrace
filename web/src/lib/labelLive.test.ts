// node --experimental-strip-types --test src/lib/labelLive.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { compositionInText, labelLines } from "./labelLive.ts";

test("composition complète en plusieurs langues", () => {
  const r = compositionInText("60% COTTON / COTON / ALGODON\n40% POLYESTER\nMADE IN MOROCCO");
  assert.equal(r.complete, true);
  assert.equal(r.preview, "60 % cotton, 40 % polyester");
});

test("composition incomplète (image floue) : pas d'appel au serveur", () => {
  const r = compositionInText("60% COTTON\n4O% POLY");
  assert.equal(r.seen, true);
  assert.equal(r.complete, false);
});

test("étiquette turque %100 PAMUK", () => {
  assert.equal(compositionInText("%100 PAMUK\nMADE IN TURKEY").complete, true);
});

test("matière avant le pourcentage", () => {
  assert.equal(compositionInText("Cotton 95%\nElastane 5%").complete, true);
});

test("étiquette de prix sans composition", () => {
  const r = compositionInText("BIM 39,95 DH -20% PROMO");
  assert.equal(r.seen, false);
  assert.equal(r.complete, false);
});

test("cadre autour des lignes de composition seulement", () => {
  const box = labelLines([
    { text: "RN 12345 CA 678", bbox: { x0: 0, y0: 0, x1: 500, y1: 20 } },
    { text: "95% COTTON", bbox: { x0: 40, y0: 100, x1: 300, y1: 130 } },
    { text: "5% ELASTANE", bbox: { x0: 40, y0: 140, x1: 320, y1: 170 } },
    { text: "MADE IN MOROCCO", bbox: { x0: 30, y0: 200, x1: 360, y1: 230 } },
  ]);
  assert.deepEqual(box, { x0: 30, y0: 100, x1: 360, y1: 230 });
  assert.equal(labelLines([{ text: "WASH 30", bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } }]), null);
});

test("doublure lue seule : on attend le tissu principal", () => {
  const blurry = compositionInText("SHELL / EXTERIOR\n5% COTTON ALGODON\n5% ELASTANE\nLINING / FORRO / DOUBLURE\n100% POLYESTER\nMADE IN MOROCCO");
  assert.equal(blurry.complete, false);
  const sharp = compositionInText("SHELL / EXTERIOR\n95% COTTON ALGODON\n5% ELASTANE\nLINING / FORRO / DOUBLURE\n100% POLYESTER");
  assert.equal(sharp.complete, true);
  assert.equal(sharp.preview, "95 % cotton, 5 % elastane");
});
