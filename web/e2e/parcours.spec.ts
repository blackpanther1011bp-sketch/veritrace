import { expect, test } from "@playwright/test";
import { ALTERNATIVE, EAN, EAN_INCONNU, ecritureDans, PRODUIT, simulerSupabase } from "./supabase";

test.describe("Scanner un vêtement", () => {
  test("saisie du code-barres, fiche avec le coût et la note VeriTrace", async ({ page }) => {
    const ecritures = await simulerSupabase(page);
    await page.goto("/");
    await expect(page).toHaveTitle("Scanner un vêtement · VeriTrace");
    await expect(page.getByRole("heading", { level: 1, name: "VeriTrace" })).toBeVisible();

    await page.getByRole("button", { name: "Saisir le code à la main" }).click();
    await page.getByRole("textbox", { name: "Code-barres", exact: true }).fill(EAN);
    await page.getByRole("button", { name: "Valider" }).click();

    await expect(page).toHaveURL(new RegExp(`#/p/${EAN}$`));
    await expect(page.getByText(PRODUIT.name).first()).toBeVisible();
    await expect(page.getByText("Note VeriTrace", { exact: true })).toBeVisible();
    const cout = page.getByRole("region", { name: "Coût environnemental" });
    await expect(cout).toContainText("points d'impact");
    await expect(cout).toContainText(/1\s?266/);
    await expect(cout).toContainText("officiel");

    const evenement = await ecritureDans(page, ecritures, "events");
    expect(evenement.session_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("code-barres invalide : message d'erreur, on reste sur l'accueil", async ({ page }) => {
    await simulerSupabase(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Saisir le code à la main" }).click();
    await page.getByRole("textbox", { name: "Code-barres", exact: true }).fill("1234567890123");
    await page.getByRole("button", { name: "Valider" }).click();
    await expect(page.getByText("Ce code ne ressemble pas à un code-barres valide")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Code-barres", exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(page).not.toHaveURL(/#\/p\//);
  });

  test("alternatives mieux notées", async ({ page }) => {
    await simulerSupabase(page);
    await page.goto(`/#/p/${EAN}/alternatives`);
    await expect(page.getByText(ALTERNATIVE.name).first()).toBeVisible();
    await expect(page.getByText(ALTERNATIVE.brand.name).first()).toBeVisible();
  });

  test("vêtement introuvable : signalement envoyé", async ({ page }) => {
    const ecritures = await simulerSupabase(page, { produit: null });
    await page.goto(`/#/p/${EAN_INCONNU}`);
    await expect(page).toHaveURL(new RegExp(`#/inconnu/${EAN_INCONNU}$`));
    await page.getByLabel("Marque (facultatif)").fill("Marque test");
    await page.getByRole("button", { name: "Signaler cet article" }).click();
    await expect(page.getByText("Merci, c'est envoyé !")).toBeVisible();
    const signalement = await ecritureDans(page, ecritures, "product_reports");
    expect(signalement).toMatchObject({ ean: EAN_INCONNU, brand: "Marque test" });
  });

  test("serveur en panne : message clair et bouton Réessayer", async ({ page }) => {
    await simulerSupabase(page, { produit: "panne" });
    await page.goto(`/#/p/${EAN}`);
    await expect(page.getByText("Connexion impossible")).toBeVisible();
    await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible();
  });
});

test.describe("Pages légales", () => {
  test("confidentialité : formulaire de contact envoyé", async ({ page }) => {
    const ecritures = await simulerSupabase(page);
    await page.goto("/#/confidentialite");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("table")).toContainText("13 mois");

    await page.getByLabel("Sujet").selectOption("Erreur sur un vêtement");
    await page.getByLabel("Message").fill("court");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByText("Écrivez au moins quelques mots")).toBeVisible();
    expect(ecritures.filter((e) => e.table === "contact_messages")).toHaveLength(0);

    await page.getByLabel("Message").fill("La composition affichée pour ce vêtement est fausse.");
    await page.getByLabel(/Votre e-mail/).fill("test@example.com");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByText("Message envoyé")).toBeVisible();
    const message = await ecritureDans(page, ecritures, "contact_messages");
    expect(message).toMatchObject({ subject: "Erreur sur un vêtement", reply_email: "test@example.com" });
  });

  test("mentions légales : éditeur et hébergeurs", async ({ page }) => {
    await simulerSupabase(page);
    await page.goto("/#/mentions-legales");
    await expect(page.getByText("Bangaly Kanté").first()).toBeVisible();
    await expect(page.getByText(/Vercel, Inc\./)).toBeVisible();
    await expect(page.getByText(/Supabase Pte\. Ltd\./)).toBeVisible();
  });

  test("conditions : la note n'est pas un label", async ({ page }) => {
    await simulerSupabase(page);
    await page.goto("/#/conditions");
    await expect(page.getByText(/label/).first()).toBeVisible();
  });

  test("liens légaux présents sur l'accueil", async ({ page }) => {
    await simulerSupabase(page);
    await page.goto("/");
    for (const nom of ["Confidentialité", "Mentions légales", "Conditions d'utilisation"]) {
      await expect(page.getByRole("link", { name: nom })).toBeVisible();
    }
  });
});
