import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Polices de la marque servies par le site (aucune requête vers Google), alphabet latin seulement
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-700.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initLang, useLang } from "./lib/i18n";
import "./styles.css";

/** Toute l'application est redessinée quand la langue change (textes, sens de lecture). */
function Root() {
  const lang = useLang();
  return <App key={lang} />;
}

// Langue choisie avant le premier affichage (en arabe, le dictionnaire et la police sont chargés d'abord)
void initLang().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <Root />
      </ErrorBoundary>
    </StrictMode>,
  );
});
