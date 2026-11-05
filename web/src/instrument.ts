import * as Sentry from "@sentry/react";

// Suivi des erreurs (Sentry, projet veritrace-web, données hébergées en Allemagne).
// Réglage strict pour la vie privée : ni adresse IP ni identité, ni cookies, ni en-têtes, ni corps de requêtes, ni
// paramètres d'adresse, ni enregistrement d'écran. Sentry reçoit l'erreur, l'écran concerné, le navigateur et la
// version du site. Désactivé en local (développement et tests) : seul le site publié envoie des erreurs.
// Chargé à part (import dynamique dans main.tsx) : le SDK n'alourdit pas le premier affichage.
// Le DSN est public par conception (il ne permet que d'envoyer des erreurs, pas de les lire).

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

export const enabled = Boolean(dsn) && !local;

if (enabled) {
  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_VERCEL_ENV as string | undefined) ?? "production",
    release: `veritrace-web@${(import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined)?.slice(0, 12) ?? "inconnue"}`,
    integrations: [Sentry.browserTracingIntegration()],
    // Performances : 1 visite sur 5 suffit pour repérer les lenteurs
    tracesSampleRate: 0.2,
    // En-têtes de suivi seulement vers le site lui-même (jamais vers Supabase : CORS)
    tracePropagationTargets: [/^\//],
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
  });

  // Vérification de l'installation : ouvrir /#/diagnostic-sentry déclenche une vraie erreur (à retirer ensuite)
  if (window.location.hash === "#/diagnostic-sentry") {
    setTimeout(() => {
      throw new Error("Test Sentry VeriTrace : vérification de l'installation (site)");
    }, 500);
  }
}

/** Erreurs de React (racine de l'application) transmises à Sentry. */
export const reactErrorHandler = Sentry.reactErrorHandler();
