// node --experimental-strip-types --test src/lib/compare.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { compareProducts } from "./compare.ts";
import type { Grade, Product } from "./types.ts";

const p = (ean: string, grade: Grade, cost: number | null, category = "T-shirt"): Product =>
  ({ ean, name: `Article ${ean}`, category, global_grade: grade, eco_cost: cost }) as unknown as Product;

test("moins de deux articles : pas de comparaison", () => {
  assert.equal(compareProducts([p("1", "B", 500)]), null);
  assert.equal(compareProducts([p("1", "B", 500), p("1", "B", 500)]), null);
});

test("classement par note puis par coût environnemental", () => {
  const c = compareProducts([p("1", "D", 1400), p("2", "B", 600), p("3", "B", 520), p("4", "E", 2100)])!;
  assert.deepEqual(c.ranked.map((x) => x.ean), ["3", "2", "1", "4"]);
  assert.equal(c.best.ean, "3");
  assert.equal(c.worst.ean, "4");
  assert.equal(c.summary, "4 fois moins d'impact que le moins bon (E)");
});

test("types de vêtements différents : comparaison par note seulement", () => {
  const c = compareProducts([p("1", "B", 600, "T-shirt"), p("2", "D", 2400, "Manteau")])!;
  assert.equal(c.summary, "Note B, contre D pour le moins bon");
});

test("mêmes notes, coûts proches", () => {
  const c = compareProducts([p("1", "C", 1000), p("2", "C", 1050)])!;
  assert.equal(c.summary, "Notes proches : tous notés C");
});

test("mêmes notes, types différents", () => {
  const c = compareProducts([p("1", "D", 900, "T-shirt"), p("2", "D", 2000, "Jean")])!;
  assert.equal(c.summary, "Notes proches : tous notés D");
});

test("même note mais nettement moins d'impact, même type", () => {
  const c = compareProducts([p("1", "C", 800), p("2", "C", 1200)])!;
  assert.equal(c.summary, "1,5 fois moins d'impact que le moins bon (C)");
});
