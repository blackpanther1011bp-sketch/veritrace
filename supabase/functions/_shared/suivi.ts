// Suivi des erreurs des fonctions serveur (Sentry, projet veritrace-serveur, données hébergées en Allemagne).
//
// Réglage strict pour la vie privée : ni adresse IP ni identité, ni en-têtes, ni corps de requêtes, ni paramètres
// d'adresse, ni variables locales. Sentry reçoit seulement l'erreur, sa pile d'appels et le nom de la fonction.
// Le SDK est chargé à la demande, au premier incident : s'il ne se charge pas sur le runtime de Supabase, la
// fonction continue de répondre normalement (l'incident reste dans les journaux Supabase).
// Le DSN est public par conception (il ne permet que d'envoyer des erreurs, pas de les lire).

const DSN = Deno.env.get("SENTRY_DSN") ??
  "https://bb72cc941940dd3fc18728e339dcf5ba@o4512380700721152.ingest.de.sentry.io/4512380737552464";

/** Ce que VeriTrace utilise du SDK @sentry/deno (chargé à la demande). */
interface SentrySdk {
  init(options: Record<string, unknown>): void;
  setTag(key: string, value: string): void;
  withScope(callback: (scope: { setTag(key: string, value: string): void }) => void): void;
  captureException(error: unknown): string;
  captureMessage(message: string, level?: string): string;
  flush(timeout?: number): Promise<boolean>;
}

let sdk: Promise<SentrySdk | null> | null = null;

function load(): Promise<SentrySdk | null> {
  sdk ??= (import("npm:@sentry/deno@11.8.0") as Promise<unknown>)
    .then((module) => {
      const Sentry = module as SentrySdk;
      Sentry.init({
        dsn: DSN,
        // runtime Supabase : pas d'intégrations automatiques (gestionnaires globaux, contexte système)
        defaultIntegrations: false,
        environment: "production",
        tracesSampleRate: 0,
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
          stackFrameVariables: false,
        },
      });
      Sentry.setTag("region", Deno.env.get("SB_REGION") ?? "inconnue");
      return Sentry;
    })
    .catch((e) => {
      console.error("Suivi des erreurs (Sentry) indisponible :", e);
      return null;
    });
  return sdk;
}

/** Erreur inattendue : envoyée à Sentry avec le nom de la fonction (attend l'envoi, 2 s au plus). */
export async function reportError(error: unknown, fonction: string): Promise<void> {
  const Sentry = await load();
  if (!Sentry) return;
  Sentry.withScope((scope) => {
    scope.setTag("fonction", fonction);
    Sentry.captureException(error);
  });
  await Sentry.flush(2000);
}

/** Incident attendu mais à surveiller (service externe indisponible…) : message sans donnée d'utilisateur. */
export async function reportWarning(message: string, fonction: string): Promise<void> {
  const Sentry = await load();
  if (!Sentry) return;
  Sentry.withScope((scope) => {
    scope.setTag("fonction", fonction);
    Sentry.captureMessage(message, "warning");
  });
  await Sentry.flush(2000);
}
