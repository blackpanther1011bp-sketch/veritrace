import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, type Page, test } from "@playwright/test";
import { simulerSupabase } from "./supabase";

// Page passeport à l'adresse propre /passeport/<id> (lien de partage avec aperçu) et à l'ancienne adresse #/passeport/<id>.

const ID = "a1b2c3d4e5f6";
const PASSEPORT = {
  id: ID,
  gtin: null,
  company: "Atelier Nour",
  city: "Casablanca",
  country: "Maroc",
  product_name: "T-shirt Atlas",
  reference: "AT-01",
  category: "T-shirt",
  eco_product: "tshirt",
  composition: "100 % coton",
  mass_kg: 0.16,
  country_spinning: "Turquie",
  country_fabric: "Maroc",
  country_dyeing: "Maroc",
  country_making: "Maroc",
  air_transport_ratio: 0,
  eco_cost: 812.4,
  climate_kg: 4.1,
  env_grade: "C",
  carbon_grade: "C",
  carbon_breakdown: [],
  stages: [
    { label: "Matières", ecs: 400, cch: 2 },
    { label: "Confection", ecs: 200, cch: 1 },
  ],
  eco_web_url: null,
  assumptions: [],
  confidence: "haute",
  methodology: "Ecobalyse · VeriTrace notes v2",
  verified: false,
  created_at: "2026-11-05T08:00:00Z",
};

async function simulerPasseports(page: Page, passeports: Record<string, unknown>[]) {
  await simulerSupabase(page);
  // déclaré après simulerSupabase : prioritaire pour la table passports
  await page.route(/supabase\.co\/rest\/v1\/passports/, (route) => {
    const id = new URL(route.request().url()).searchParams.get("id")?.replace(/^eq\./, "");
    const rows = passeports.filter((p) => p.id === id);
    return route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: JSON.stringify(rows) });
  });
}

test("adresse propre /passeport/<id> : la page du passeport s'affiche", async ({ page }) => {
  await simulerPasseports(page, [PASSEPORT]);
  await page.goto(`/passeport/${ID}`);
  await expect(page).toHaveTitle("Passeport numérique · VeriTrace");
  await expect(page.getByText("T-shirt Atlas").first()).toBeVisible();
  await expect(page.getByText("812 points")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/passeport/${ID}$`));
});

test("ancienne adresse #/passeport/<id> : toujours valable", async ({ page }) => {
  await simulerPasseports(page, [PASSEPORT]);
  await page.goto(`/#/passeport/${ID}`);
  await expect(page.getByText("T-shirt Atlas").first()).toBeVisible();
});

test("lien à partager et QR code : adresse propre (sans code-barres)", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  // pas de feuille de partage du système dans le navigateur de test : le lien est copié
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
  await simulerPasseports(page, [PASSEPORT]);
  await page.goto(`/#/passeport/${ID}`);
  const lien = `${baseURL}/passeport/${ID}`;
  await expect(page.getByRole("region", { name: "Partager le passeport" })).toContainText(lien);
  await expect(page.getByRole("img", { name: "QR code du passeport" })).toHaveAttribute("data-lien", lien);
  await page.getByRole("button", { name: "Partager le lien" }).click();
  await expect(page.getByText("Lien copié")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(lien);
});

test("QR code d'un produit avec code-barres : GS1 Digital Link (aperçu aussi servi sur cette adresse)", async ({ page, baseURL }) => {
  await simulerPasseports(page, [{ ...PASSEPORT, gtin: "6111234567871" }]);
  await page.goto(`/passeport/${ID}`);
  await expect(page.getByRole("img", { name: "QR code du passeport" })).toHaveAttribute("data-lien", `${baseURL}/01/06111234567871?passeport=${ID}`);
  await expect(page.getByRole("region", { name: "Partager le passeport" })).toContainText(`${baseURL}/passeport/${ID}`);
});

test("depuis l'adresse propre, la navigation reprend avec # (retour à l'accueil)", async ({ page }) => {
  await simulerPasseports(page, [PASSEPORT]);
  await page.goto(`/passeport/${ID}`);
  await expect(page.getByText("T-shirt Atlas").first()).toBeVisible();
  await page.getByRole("button", { name: "Retour à l'accueil" }).click();
  await expect(page).toHaveURL(/\/#\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "VeriTrace" })).toBeVisible();
});

test("passeport inconnu : message clair", async ({ page }) => {
  await simulerPasseports(page, []);
  await page.goto("/passeport/ffffffffffff");
  await expect(page.getByText("Passeport introuvable")).toBeVisible();
});

test("page passeport : aucune erreur d'accessibilité (WCAG 2.2 AA)", async ({ page }) => {
  await simulerPasseports(page, [PASSEPORT]);
  await page.goto(`/passeport/${ID}`);
  await expect(page.getByText("T-shirt Atlas").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.evaluate(readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8"));
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (ctx: Document, opts: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
    const res = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
    return res.violations.map((v) => `${v.id} → ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
  });
  expect(violations).toEqual([]);
});
