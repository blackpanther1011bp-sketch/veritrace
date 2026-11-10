import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";
import { ar } from "../src/lib/i18n-ar";
import { fr } from "../src/lib/i18n-fr";
import { ecritureDans, EAN, EAN_INCONNU, PRODUIT_SOCIAL_SOURCE, simulerSupabase } from "./supabase";

// Interface en arabe : bascule de langue, lecture de droite à gauche, accessibilité, aucun débordement à 390 px.

const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

/** Ouvre la page directement en arabe (choix mémorisé, comme après une première visite). */
async function enArabe(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vt_lang", "ar");
    } catch {
      // ignoré
    }
  });
}

test.describe("Bascule de langue", () => {
  test("accueil : passer en arabe puis revenir en français, choix mémorisé", async ({ page }) => {
    await simulerSupabase(page);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByText(fr["scan.hint"])).toBeVisible();

    await page.getByRole("combobox", { name: fr["lang.label"] }).selectOption("ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByText(ar["scan.hint"])).toBeVisible();
    await expect(page.getByRole("button", { name: ar["scan.start"] })).toBeVisible();
    await expect(page).toHaveTitle(`${ar["title.scan"]} · VeriTrace`);

    // choix mémorisé au rechargement
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText(ar["scan.hint"])).toBeVisible();

    await page.getByRole("combobox", { name: ar["lang.label"] }).selectOption("fr");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByText(fr["scan.hint"])).toBeVisible();
  });

  test.describe("téléphone réglé en arabe", () => {
    test.use({ locale: "ar-MA" });
    test("premier lancement directement en arabe", async ({ page }) => {
      await simulerSupabase(page);
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.getByText(ar["scan.hint"])).toBeVisible();
    });
  });
});

test.describe("Parcours en arabe", () => {
  test("saisie du code-barres et fiche : coût et note VeriTrace en arabe, code-barres lisible", async ({ page }) => {
    await enArabe(page);
    await simulerSupabase(page);
    await page.goto("/");
    await page.getByRole("button", { name: ar["scan.enterByHand"] }).click();
    await page.getByRole("textbox", { name: ar["scan.codeLabel"], exact: true }).fill(EAN);
    await page.getByRole("button", { name: ar["scan.validate"] }).click();
    await expect(page).toHaveURL(new RegExp(`#/p/${EAN}$`));
    await expect(page.getByText(ar["product.kicker"], { exact: true })).toBeVisible();
    const cout = page.getByRole("region", { name: ar["product.costAria"] });
    await expect(cout).toContainText(ar["product.costUnit"]);
    await expect(cout).toContainText(/1\s?266/);
    await expect(page.getByRole("button", { name: ar["product.understand"] })).toBeVisible();
  });

  test("formulaire de contact : libellés en arabe, sujet envoyé en français", async ({ page }) => {
    await enArabe(page);
    const ecritures = await simulerSupabase(page);
    await page.goto("/#/confidentialite");
    await expect(page.getByText(ar["legal.arNotice"])).toBeVisible();
    // le texte juridique reste en français (version qui fait foi), marqué comme tel
    await expect(page.locator(".legal-body")).toHaveAttribute("lang", "fr");
    await page.getByLabel(ar["contact.subject"]).selectOption("Erreur sur un vêtement");
    await page.getByLabel(ar["contact.message"], { exact: true }).fill("المعلومات المعروضة عن هذه القطعة غير صحيحة.");
    await page.getByRole("button", { name: ar["contact.send"] }).click();
    await expect(page.getByText(ar["contact.sent"])).toBeVisible();
    const message = await ecritureDans(page, ecritures, "contact_messages");
    expect(message).toMatchObject({ subject: "Erreur sur un vêtement" });
  });
});

test.describe("Note sociale sourcée en arabe", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("critères traduits, sources gardées, mois en arabe, accessibilité", async ({ page }) => {
    await enArabe(page);
    await simulerSupabase(page, { produit: PRODUIT_SOCIAL_SOURCE });
    await page.goto(`/#/p/${PRODUIT_SOCIAL_SOURCE.ean}/details?onglet=social`);
    const liste = page.getByRole("list", { name: ar["details.socialChecksAria"] });
    await expect(liste.getByRole("listitem")).toHaveCount(3);
    await expect(liste).toContainText(ar["status.non_demontre"]);
    await expect(liste).toContainText("(غشت 2022)");
    await expect(liste).toContainText("تم التحقق في 5 نونبر 2026");
    // le titre de la source (donnée de la base) reste tel quel, le lien aussi
    await expect(liste.getByRole("link", { name: "Fair Wear – fiche de la marque ARMEDANGELS" })).toHaveAttribute(
      "href",
      "https://www.fairwear.org/brands/armedangels/",
    );
    await expect(page.getByText("4 من 5", { exact: false })).toBeVisible();

    await page.evaluate(axeSource);
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (ctx: Document, opts: unknown) => Promise<{ violations: { id: string }[] }> } }).axe;
      const res = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
      return res.violations.map((v) => v.id);
    });
    expect(violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    // la fiche résume la note sociale en arabe
    await page.goto(`/#/p/${PRODUIT_SOCIAL_SOURCE.ean}`);
    await expect(page.getByText("النقاط: 4 من 5", { exact: false })).toBeVisible();
  });
});

const PAGES = [
  "/",
  `/#/p/${EAN}`,
  `/#/p/${EAN}/details`,
  `/#/p/${EAN}/details?onglet=social`,
  `/#/p/${EAN}/alternatives`,
  `/#/inconnu/${EAN_INCONNU}`,
  `/#/ajouter/${EAN_INCONNU}`,
  "/#/etiquette",
  "/#/fabricants",
  "/#/confidentialite",
  "/#/conditions",
];

test.describe("Qualité en arabe", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const chemin of PAGES) {
    test(`accessibilité et mise en page : ${chemin}`, async ({ page }) => {
      await enArabe(page);
      await simulerSupabase(page, { produit: chemin.includes(EAN_INCONNU) ? null : undefined });
      await page.goto(chemin);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

      await page.evaluate(axeSource);
      const violations = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (ctx: Document, opts: unknown) => Promise<{ violations: { id: string; help: string; nodes: { target: string[] }[] }[] }> } }).axe;
        const res = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
        return res.violations.map((v) => `${v.id} : ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      });
      expect(violations).toEqual([]);

      // rien ne déborde horizontalement à 390 px de large
      const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(debord).toBeLessThanOrEqual(0);

      // texte de 13 px au moins
      const petitTexte = await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter((e) => e.childElementCount === 0 && e.textContent?.trim() && parseFloat(getComputedStyle(e).fontSize) < 13)
          .map((e) => `${getComputedStyle(e).fontSize} « ${e.textContent!.trim().slice(0, 30)} »`),
      );
      expect(petitTexte).toEqual([]);
    });
  }
});
