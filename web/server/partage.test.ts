// Tests de la page de partage d'un passeport (aperçu WhatsApp, Facebook…) :
// node --experimental-strip-types --test web/server/partage.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { escapeHtml, injectMeta, passportMeta, renderPassportPage } from "./partage.js";

const ORIGIN = "https://veritrace-wine.vercel.app";
const PASSPORT = { id: "a1b2c3d4e5f6", product_name: "T-shirt Atlas", company: "Atelier Nour", city: "Casablanca", eco_cost: 1265.8, env_grade: "C" };
const TEMPLATE = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="description" content="Description du site" />
    <meta property="og:title" content="VeriTrace" />
    <meta property="og:image" content="https://veritrace-wine.vercel.app/icon-512.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <title>VeriTrace</title>
    <script type="module" crossorigin src="/assets/index-AbC123.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-XyZ789.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

test("échappement HTML", () => {
  assert.equal(escapeHtml(`<a href="x">L'été & co</a>`), "&lt;a href=&quot;x&quot;&gt;L&#39;été &amp; co&lt;/a&gt;");
});

test("balises d'un passeport : titre, coût, note indicative, adresse propre", () => {
  const m = passportMeta(PASSPORT, ORIGIN);
  assert.equal(m.title, "T-shirt Atlas · Atelier Nour · Passeport numérique");
  assert.match(m.description, /Coût environnemental : 1\s266 points \(Ecobalyse, données du fabricant\)/);
  assert.match(m.description, /note VeriTrace C, indicative \(ni label ni certification\)/);
  assert.match(m.description, /Fabricant : Atelier Nour, Casablanca\./);
  assert.equal(m.url, `${ORIGIN}/passeport/a1b2c3d4e5f6`);
  assert.equal(m.image.url, `${ORIGIN}/partage-passeport.jpg`);
  assert.ok(m.title.length <= 110 && m.description.length <= 300);
});

test("passeport inconnu : balises génériques", () => {
  const m = passportMeta(null, ORIGIN);
  assert.equal(m.title, "Passeport numérique · VeriTrace");
  assert.equal(m.url, `${ORIGIN}/`);
});

test("injection dans le HTML du build : une seule fois chaque balise, fichiers de l'app gardés", () => {
  const html = injectMeta(TEMPLATE, passportMeta(PASSPORT, ORIGIN));
  assert.equal(count(html, /<title>/g), 1);
  assert.match(html, /<title>T-shirt Atlas · Atelier Nour · Passeport numérique<\/title>/);
  assert.equal(count(html, /property="og:title"/g), 1);
  assert.equal(count(html, /property="og:image"/g), 1);
  assert.equal(count(html, /name="description"/g), 1);
  assert.ok(!html.includes("icon-512.png"), "ancienne image d'aperçu retirée");
  assert.ok(!html.includes("Description du site"), "ancienne description retirée");
  assert.ok(html.includes('src="/assets/index-AbC123.js"'), "script de l'app gardé");
  assert.ok(html.includes('href="/assets/index-XyZ789.css"'), "styles de l'app gardés");
  assert.ok(html.includes('name="apple-mobile-web-app-capable"'), "autres balises gardées");
  assert.ok(html.indexOf('property="og:title"') < html.indexOf("</head>"));
  assert.match(html, /<link rel="canonical" href="https:\/\/veritrace-wine\.vercel\.app\/passeport\/a1b2c3d4e5f6" \/>/);
  assert.match(html, /property="og:locale" content="fr_FR"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
});

test("données de la base échappées (pas d'injection de script)", () => {
  const evil = { ...PASSPORT, product_name: `<script>alert(1)</script>"><img src=x onerror=alert(2)>`, company: "A&B" };
  const html = injectMeta(TEMPLATE, passportMeta(evil, ORIGIN));
  assert.ok(!html.includes("<script>alert"), "pas de script injecté");
  assert.ok(!html.includes("<img src=x"), "pas de balise injectée");
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(html.includes("A&amp;B"));
});

const deps = (over: Partial<Parameters<typeof renderPassportPage>[0]> = {}) => ({
  id: PASSPORT.id,
  origin: ORIGIN,
  fetchPassport: async () => PASSPORT,
  loadTemplate: async () => TEMPLATE,
  ...over,
});

test("réponse : passeport trouvé → 200, en cache sur le CDN", async () => {
  const r = await renderPassportPage(deps());
  assert.equal(r.status, 200);
  assert.equal(r.headers["Content-Type"], "text/html; charset=utf-8");
  assert.match(r.headers["Cache-Control"], /s-maxage=300/);
  assert.match(r.body, /T-shirt Atlas/);
  assert.match(r.body, /id="root"/);
});

test("réponse : passeport inconnu → 404 avec balises génériques et l'app (« introuvable »)", async () => {
  const r = await renderPassportPage(deps({ fetchPassport: async () => null }));
  assert.equal(r.status, 404);
  assert.match(r.body, /<title>Passeport numérique · VeriTrace<\/title>/);
  assert.match(r.body, /id="root"/);
});

test("réponse : identifiant invalide → 404 sans appel à la base", async () => {
  let called = false;
  const r = await renderPassportPage(deps({ id: "../../etc", fetchPassport: async () => ((called = true), PASSPORT) }));
  assert.equal(r.status, 404);
  assert.equal(called, false);
});

test("réponse : base injoignable → 200 sans cache, l'app réessaiera", async () => {
  const r = await renderPassportPage(deps({ fetchPassport: async () => Promise.reject(new Error("panne")) }));
  assert.equal(r.status, 200);
  assert.equal(r.headers["Cache-Control"], "no-store");
});

test("réponse : HTML du build introuvable → page de secours avec aperçu et renvoi vers l'app", async () => {
  const r = await renderPassportPage(deps({ loadTemplate: async () => null }));
  assert.equal(r.status, 200);
  assert.match(r.body, /<meta http-equiv="refresh" content="0; url=\/#\/passeport\/a1b2c3d4e5f6" \/>/);
  assert.match(r.body, /property="og:title" content="T-shirt Atlas/);
  assert.ok(!r.body.includes("<script"), "aucun script (CSP du site)");
});

test("configuration : adresse /passeport/<id> servie par la fonction, clé Supabase identique à web/.env", () => {
  const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const rewrite = vercel.rewrites.find((r: { source: string }) => r.source.startsWith("/passeport/"));
  assert.equal(rewrite?.destination, "/api/passeport");
  const gs1 = vercel.rewrites.findIndex((r: { has?: unknown }) => r.has);
  const generic = vercel.rewrites.findIndex((r: { source: string; has?: unknown }) => r.source === "/01/:path*" && !r.has);
  assert.ok(gs1 >= 0 && gs1 < generic, "le QR GS1 avec passeport passe par la fonction avant la règle générique");
  assert.ok(vercel.headers.some((h: { source: string }) => h.source === "/(.*)"), "en-têtes de sécurité sur toutes les adresses");

  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const fn = readFileSync(new URL("../api/passeport.js", import.meta.url), "utf8");
  for (const key of ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]) {
    const value = env.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1].trim();
    assert.ok(value && fn.includes(`"${value}"`), `${key} identique dans api/passeport.js`);
  }
});

test("fonction Vercel api/passeport.js : HTML du déploiement + passeport lu dans Supabase", async () => {
  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  process.env.VERCEL_URL = "veritrace-abc123.vercel.app";
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "veritrace-wine.vercel.app";
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url === "https://veritrace-abc123.vercel.app/index.html") return new Response(TEMPLATE, { status: 200 });
    if (url.includes("/rest/v1/passports")) return new Response(JSON.stringify(url.includes("id=eq.a1b2c3d4e5f6") ? [PASSPORT] : []), { status: 200 });
    return new Response("inattendu", { status: 500 });
  }) as typeof fetch;
  try {
    const { GET } = await import("../api/passeport.js");
    const ok = await GET(new Request("https://veritrace-wine.vercel.app/api/passeport?id=a1b2c3d4e5f6"));
    assert.equal(ok.status, 200);
    const html = await ok.text();
    assert.match(html, /property="og:url" content="https:\/\/veritrace-wine\.vercel\.app\/passeport\/a1b2c3d4e5f6"/);
    assert.match(html, /src="\/assets\/index-AbC123\.js"/);
    const missing = await GET(new Request("https://veritrace-wine.vercel.app/api/passeport?id=ffffffffffff"));
    assert.equal(missing.status, 404);
    // le HTML du déploiement n'est récupéré qu'une fois (gardé en mémoire)
    assert.equal(calls.filter((u) => u.endsWith("/index.html")).length, 1);
    assert.ok(calls.some((u) => u.startsWith("https://vqegfoncyrqivtrbvorg.supabase.co/rest/v1/passports?select=")));
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  }
});
