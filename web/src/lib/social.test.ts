// node --experimental-strip-types --test src/lib/social.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPeriod, isSourced, socialScore } from "./social.ts";
import type { CheckStatus, SocialCheck } from "./types.ts";

const check = (status: CheckStatus, sourced = true): SocialCheck => ({
  label: "critère",
  status,
  detail: "détail",
  ...(sourced ? { source_url: "https://exemple.org/preuve", source_title: "Preuve", checked_at: "2026-11-05" } : {}),
});

test("barème : usines et contrôle valent 2, la certification de l'entreprise 1", () => {
  assert.deepEqual(socialScore([check("oui"), check("oui"), check("oui")]), { points: 5, grade: "A" });
  assert.deepEqual(socialScore([check("oui"), check("oui"), check("non_demontre")]), { points: 4, grade: "B" });
  assert.deepEqual(socialScore([check("partiel"), check("oui"), check("non_demontre")]), { points: 3, grade: "C" });
  assert.deepEqual(socialScore([check("oui"), check("non_demontre"), check("oui")]), { points: 3, grade: "C" });
  assert.deepEqual(socialScore([check("partiel"), check("non_demontre"), check("oui")]), { points: 2, grade: "D" });
  assert.deepEqual(socialScore([check("non_demontre"), check("non_demontre"), check("oui")]), { points: 1, grade: "E" });
  assert.deepEqual(socialScore([check("non_demontre"), check("non_demontre"), check("non_demontre")]), { points: 0, grade: "E" });
});

test("pas de source, pas de note : critères manquants ou données de démonstration", () => {
  assert.equal(socialScore([]), null);
  assert.equal(socialScore([check("oui"), check("oui")]), null);
  assert.equal(socialScore([check("oui", false), check("oui", false), check("oui", false)]), null);
  assert.equal(isSourced([check("oui"), check("non", false)]), false);
});

test("dates des sources en français", () => {
  assert.equal(formatPeriod("2022-08"), "août 2022");
  assert.equal(formatPeriod("2025-11-05"), "5 novembre 2025");
  assert.equal(formatPeriod("2019"), "2019");
  assert.equal(formatPeriod(null), null);
  assert.equal(formatPeriod("n'importe quoi"), null);
});
