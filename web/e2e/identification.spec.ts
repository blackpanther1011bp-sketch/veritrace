import { expect, test } from "@playwright/test";
import { EAN_INCONNU, simulerSupabase } from "./supabase";

// Vêtement absent du registre officiel mais reconnu (marque, nom, type) par la base ouverte de codes-barres.
test("code-barres inconnu du registre mais reconnu : nom affiché, étiquette préremplie", async ({ page }) => {
  await simulerSupabase(page);
  const demandes: string[] = [];
  await page.route("**/identification/*.json", async (route) => {
    demandes.push(new URL(route.request().url()).pathname);
    await route.fulfill({ json: { [EAN_INCONNU]: ["Adidas", "Veste training Condivo 20", "Veste"] } });
  });

  await page.goto(`/#/inconnu/${EAN_INCONNU}`);
  await expect(page.getByRole("heading", { name: "Vêtement reconnu, pas encore noté" })).toBeVisible();
  await expect(page.getByText("Veste training Condivo 20")).toBeVisible();
  await expect(page.getByText("Nom fourni par Nudger")).toBeVisible();
  // le fichier demandé est celui du reste de la division du code-barres par 4 096
  expect(demandes).toEqual([`/identification/${String(Number(BigInt(EAN_INCONNU) % 4096n)).padStart(4, "0")}.json`]);
  await expect(page.locator("#brand")).toHaveValue("Adidas");

  await page.goto(`/#/etiquette/${EAN_INCONNU}`);
  await expect(page.locator("#l-brand")).toHaveValue("Adidas");
  await expect(page.locator("#l-category")).toHaveValue("Veste");
});

test("marque coupée à trois lettres dans la source : elle n'est ni affichée ni préremplie", async ({ page }) => {
  await simulerSupabase(page);
  await page.route("**/identification/*.json", (route) => route.fulfill({ json: { [EAN_INCONNU]: ["JOM", "Maillot manches longues Joma Combi", "T-shirt"] } }));
  await page.goto(`/#/inconnu/${EAN_INCONNU}`);
  await expect(page.getByText("Maillot manches longues Joma Combi")).toBeVisible();
  await expect(page.getByText("JOM", { exact: true })).toHaveCount(0);
  await expect(page.locator("#brand")).toHaveValue("");
});

test("code-barres inconnu partout : écran « pas encore référencé » inchangé", async ({ page }) => {
  await simulerSupabase(page);
  await page.route("**/identification/*.json", (route) => route.fulfill({ json: {} }));
  await page.goto(`/#/inconnu/${EAN_INCONNU}`);
  await expect(page.getByRole("heading", { name: "Article pas encore référencé" })).toBeVisible();
  await expect(page.locator("#brand")).toHaveValue("");
});
