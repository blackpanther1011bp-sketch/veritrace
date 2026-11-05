# Suivi des erreurs (Sentry)

VeriTrace envoie ses erreurs techniques à Sentry (organisation `studio-kante`, données hébergées en Allemagne,
région Europe). Trois projets :

| Projet | Ce qui est suivi | Code |
| --- | --- | --- |
| `veritrace-web` | Site (erreurs du navigateur et de React, lenteurs sur 20 % des visites) | `web/src/instrument.ts` |
| `veritrace-app` | App Flutter publiée (Android, iOS) | `flutter/lib/main.dart` |
| `veritrace-serveur` | Fonctions `outils` et `menage-photos` | `supabase/functions/_shared/suivi.ts` |

## Ce qui est envoyé, et ce qui ne l'est pas

Envoyé : le message d'erreur, la pile d'appels, l'écran concerné, le navigateur ou le modèle de téléphone, la
version. Sentry déduit à la réception le pays et la ville approximatifs, sans conserver l'adresse IP.

Jamais envoyé : adresse IP (consigne `infer_ip: never` côté site et serveur, `sendDefaultPii = false` dans l'app),
identité, identifiant d'installation (retiré de chaque rapport de l'app), cookies, en-têtes, corps de requêtes,
paramètres d'adresse, variables locales, captures ou enregistrements d'écran. Pas de suivi des sessions dans l'app.

Conservation : 30 jours (offre gratuite de Sentry ; 90 jours au plus sur une offre payante).

## Vérifier que le suivi fonctionne

- **Serveur** : `POST https://vqegfoncyrqivtrbvorg.supabase.co/functions/v1/outils` avec
  `{"action":"diagnostic_sentry"}` (3 fois par jour au plus) → erreur « Test Sentry VeriTrace … (serveur) ».
- **App** : à l'accueil, appui long sur le nom « VeriTrace » → message « Rapport de test envoyé » et erreur
  « Test Sentry VeriTrace … (app) ». Rien n'est envoyé dans une version de développement.
  Sans téléphone Android : GitHub → Actions → « Vérification Sentry (app Android sur émulateur) » → Run workflow.
  Le dernier APK publié est installé sur un émulateur et l'appui long est fait automatiquement (captures d'écran
  en artefact).
- **Site** : pas de déclencheur ; toute vraie erreur du site publié arrive dans `veritrace-web`.

Après une vérification, marquer l'erreur de test « résolue » dans Sentry.

## Réglages à faire dans les tableaux de bord (une fois)

1. **Sentry → Settings → Security & Privacy** (organisation) :
   - activer « Prevent Storing of IP Addresses » (double sécurité : aucune IP gardée, même par erreur) ;
   - dans « Advanced Data Scrubbing », ajouter deux règles : *Remove* · *Anything* · `$user.id`, puis *Remove* ·
     *Anything* · `contexts.device.id` (retirent aussi l'identifiant d'installation qu'Android ajoute aux plantages
     natifs, rares ; l'app le retire déjà de ses propres rapports).
2. **Erreurs du site lisibles** (cartes de code) : créer un jeton d'organisation dans Sentry (Settings → Auth
   Tokens), l'ajouter dans Vercel (projet `veritrace` → Settings → Environment Variables) sous le nom
   `SENTRY_AUTH_TOKEN`, environnement Production, puis republier le site. Les cartes sont envoyées à Sentry pendant
   la construction puis supprimées : elles ne sont jamais publiées. Le jeton ne doit jamais être écrit dans le
   dépôt ni dans une conversation.
