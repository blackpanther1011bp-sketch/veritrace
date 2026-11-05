import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/bundler-plugins/vite";
import { copieMoteurOcr } from "./scripts/copy-ocr.mjs";

// En-têtes de sécurité de production (vercel.json), appliqués aussi à `vite preview` pour les tester en local
const vercel = JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url), "utf8")) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const securityHeaders = Object.fromEntries(vercel.headers.flatMap((h) => h.headers.map((x) => [x.key, x.value])));

// Cartes de code (source maps) envoyées à Sentry pour lire les erreurs dans le code d'origine, seulement quand le
// jeton SENTRY_AUTH_TOKEN est défini (variable d'environnement de Vercel, jamais dans le dépôt). Les cartes sont
// supprimées de dist/ juste après l'envoi : elles ne sont jamais publiées sur le site.
// Nom accepté : SENTRY_AUTH_TOKEN, ou un nom qui commence ainsi (Vercel a refusé le nom exact pour ce projet ; la
// variable y est enregistrée sous SENTRY_AUTH_TOKEN10).
const sentryToken = (
  process.env.SENTRY_AUTH_TOKEN ??
    Object.entries(process.env).find(([nom]) => nom.startsWith("SENTRY_AUTH_TOKEN"))?.[1]
)?.trim();
const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12);
const sentryPlugins = sentryToken
  ? sentryVitePlugin({
    org: "studio-kante",
    project: "veritrace-web",
    url: "https://de.sentry.io/",
    authToken: sentryToken,
    telemetry: false,
    // même nom de version que dans src/instrument.ts
    release: { name: `veritrace-web@${commit ?? "inconnue"}`, inject: false },
    sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
  })
  : [];

export default defineConfig({
  preview: { headers: securityHeaders },
  // copieMoteurOcr : moteur de lecture d'étiquettes servi par le site lui-même (dist/ocr)
  // Sentry en dernier (consigne de l'extension)
  plugins: [react(), copieMoteurOcr(), ...sentryPlugins],
  build: {
    target: "es2020",
    // le décodeur de codes-barres (WebAssembly) est servi depuis notre propre domaine
    assetsInlineLimit: 0,
    // cartes « cachées » (aucun lien dans les fichiers publiés), produites seulement pour l'envoi à Sentry
    sourcemap: sentryToken ? "hidden" : false,
  },
});
