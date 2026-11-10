import { expect, test } from "@playwright/test";
import { en } from "../src/lib/i18n-en";
import { es } from "../src/lib/i18n-es";
import { fr } from "../src/lib/i18n-fr";
import { EAN, simulerSupabase } from "./supabase";

// Anglais et espagnol : choix dans le menu, mémorisation, fiche produit traduite, aucun débordement à 390 px.

const LANGUES = [
  { code: "en", dict: en },
  { code: "es", dict: es },
] as const;

for (const { code, dict } of LANGUES) {
  test.describe(`Langue ${code}`, () => {
    test("accueil : choix dans le menu, mémorisé au rechargement", async ({ page }) => {
      await simulerSupabase(page);
      await page.goto("/");
      await page.getByRole("combobox", { name: fr["lang.label"] }).selectOption(code);
      await expect(page.locator("html")).toHaveAttribute("lang", code);
      await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
      await expect(page.getByRole("button", { name: dict["scan.start"] })).toBeVisible();
      await expect(page).toHaveTitle(`${dict["title.scan"]} · VeriTrace`);
      await page.reload();
      await expect(page.getByRole("button", { name: dict["scan.start"] })).toBeVisible();
    });

    test("fiche produit traduite, sans débordement horizontal", async ({ page }) => {
      await page.addInitScript((c) => localStorage.setItem("vt_lang", c), code);
      await simulerSupabase(page);
      await page.goto(`/#/p/${EAN}`);
      await expect(page.getByRole("heading", { name: dict["product.header"] })).toBeVisible();
      await expect(page.getByText(dict["verdict.D.title"])).toBeVisible();
      await expect(page.getByRole("button", { name: dict["product.understand"] })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  });
}

test("téléphone réglé en espagnol : le site s'ouvre en espagnol", async ({ browser }) => {
  const context = await browser.newContext({ locale: "es-ES" });
  const page = await context.newPage();
  await simulerSupabase(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("button", { name: es["scan.start"] })).toBeVisible();
  await context.close();
});
