import { defineConfig, devices } from "@playwright/test";

// Tests de parcours du site (dossier e2e) : le site construit (npm run build) est servi par `vite preview`, avec les
// mêmes en-têtes de sécurité qu'en production. Supabase est simulé dans chaque test (e2e/supabase.ts) : aucun test
// n'écrit dans la vraie base, et les résultats ne dépendent pas des données du moment.
const PORT = 4173;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "telephone", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
