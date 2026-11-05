import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";
import { PRODUIT_SOCIAL_NON_EVALUE, PRODUIT_SOCIAL_SOURCE, simulerSupabase } from "./supabase";

// Note sociale sourcée (docs/methode-note-sociale.md) : chaque critère avec sa source, ou « non évaluée ».

const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

test.describe("Note sociale sourcée", () => {
  test("marque évaluée : critères, sources cliquables et dates", async ({ page }) => {
    await simulerSupabase(page, { produit: PRODUIT_SOCIAL_SOURCE });
    await page.goto(`/#/p/${PRODUIT_SOCIAL_SOURCE.ean}/details?onglet=social`);
    const liste = page.getByRole("list", { name: "Critères de la note sociale et leurs sources" });
    await expect(liste.getByRole("listitem")).toHaveCount(3);
    await expect(liste).toContainText("Liste des usines publiée");
    await expect(liste).toContainText("Non démontré");
    await expect(liste).toContainText("(août 2022)");
    await expect(liste).toContainText("vérifié le 5 novembre 2026");
    const lien = liste.getByRole("link", { name: "Fair Wear – fiche de la marque ARMEDANGELS" });
    await expect(lien).toHaveAttribute("href", "https://www.fairwear.org/brands/armedangels/");
    await expect(lien).toHaveAttribute("target", "_blank");
    await expect(page.getByText("4 points sur 5")).toBeVisible();

    // Accessibilité de l'onglet avec ses sources
    await page.evaluate(axeSource);
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (ctx: Document, opts: unknown) => Promise<{ violations: { id: string }[] }> } }).axe;
      const res = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
      return res.violations.map((v) => v.id);
    });
    expect(violations).toEqual([]);
  });

  test("marque évaluée : la fiche résume la note sociale", async ({ page }) => {
    await simulerSupabase(page, { produit: PRODUIT_SOCIAL_SOURCE });
    await page.goto(`/#/p/${PRODUIT_SOCIAL_SOURCE.ean}`);
    await expect(page.getByText("4 points sur 5 · sources publiques")).toBeVisible();
    await expect(page.getByText("Note environnement seule")).toHaveCount(0);
  });

  test("marque sans preuve : non évaluée, note environnement seule", async ({ page }) => {
    await simulerSupabase(page, { produit: PRODUIT_SOCIAL_NON_EVALUE });
    await page.goto(`/#/p/${PRODUIT_SOCIAL_NON_EVALUE.ean}`);
    await expect(page.getByText("Note environnement seule : note sociale non évaluée.")).toBeVisible();
    await expect(page.getByText("Non évaluée : aucune source publique vérifiable")).toBeVisible();

    await page.goto(`/#/p/${PRODUIT_SOCIAL_NON_EVALUE.ean}/details?onglet=social`);
    await expect(page.getByText("Note sociale non évaluée : aucune source publique vérifiable pour cette marque.", { exact: false })).toBeVisible();
    await expect(page.getByRole("list", { name: "Critères de la note sociale et leurs sources" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Une preuve manque ? Écrivez-nous." })).toHaveAttribute("href", "#/confidentialite?contact=1");
  });
});
