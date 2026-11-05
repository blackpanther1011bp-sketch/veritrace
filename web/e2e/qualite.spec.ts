import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";
import { EAN, EAN_INCONNU, simulerSupabase } from "./supabase";

// Accessibilité (axe-core, règles WCAG 2.2 AA) et sécurité (en-têtes de production, aucune ressource externe).

const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

const PAGES = [
  "/",
  `/#/p/${EAN}`,
  `/#/p/${EAN}/details`,
  `/#/p/${EAN}/details?onglet=social`,
  `/#/p/${EAN}/alternatives`,
  `/#/inconnu/${EAN_INCONNU}`,
  "/#/fabricants",
  "/#/confidentialite",
  "/#/mentions-legales",
  "/#/conditions",
];

test.describe("Accessibilité", () => {
  for (const chemin of PAGES) {
    test(`aucune erreur d'accessibilité : ${chemin}`, async ({ page }) => {
      await simulerSupabase(page, { produit: chemin.includes(EAN_INCONNU) ? null : undefined });
      await page.goto(chemin);
      await page.waitForLoadState("networkidle");
      // axe est injecté par l'outil de test : la CSP du site (scripts externes interdits) ne le concerne pas
      await page.evaluate(axeSource);
      const violations = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (ctx: Document, opts: unknown) => Promise<{ violations: { id: string; help: string; nodes: { target: string[] }[] }[] }> } }).axe;
        const res = await axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
        });
        return res.violations.map((v) => `${v.id} : ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      });
      expect(violations).toEqual([]);

      // Texte de 13 px au moins
      const petitTexte = await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter((e) => e.childElementCount === 0 && e.textContent?.trim() && parseFloat(getComputedStyle(e).fontSize) < 13)
          .map((e) => `${getComputedStyle(e).fontSize} « ${e.textContent!.trim().slice(0, 30)} »`),
      );
      expect(petitTexte).toEqual([]);
    });
  }
});

test.describe("Sécurité", () => {
  test("en-têtes de sécurité de production", async ({ page }) => {
    await simulerSupabase(page);
    const reponse = await page.goto("/");
    const h = reponse!.headers();
    expect(h["content-security-policy"]).toContain("default-src 'self'");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["permissions-policy"]).toContain("microphone=()");
  });

  test("aucune ressource chargée depuis un autre site (polices comprises)", async ({ page }) => {
    await simulerSupabase(page);
    const externes: string[] = [];
    page.on("request", (r) => {
      const url = new URL(r.url());
      if (url.hostname !== "localhost" && !url.hostname.endsWith("supabase.co") && url.protocol.startsWith("http")) externes.push(r.url());
    });
    await page.goto(`/#/p/${EAN}`);
    await page.waitForLoadState("networkidle");
    expect(externes).toEqual([]);
    const police = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(police).toContain("DM Sans");
  });
});
