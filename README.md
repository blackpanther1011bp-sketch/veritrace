# VeriTrace — MVP

Application qui affiche l'impact environnemental et social d'un vêtement à partir du code-barres de son étiquette.

| Dossier | Contenu |
| --- | --- |
| `web/` | Web app mobile (React + Vite), en ligne sur https://veritrace-wine.vercel.app |
| `flutter/` | Application native iOS / Android, mêmes écrans, même base (voir `flutter/README.md`) |
| `supabase/` | Schéma SQL, règles de sécurité et données d'exemple (50 produits fictifs) |
| `test-barcodes/` | Planche PDF des 50 codes-barres de test, à scanner sur écran ou imprimée |
| `.github/workflows/` | Compilation automatique : à chaque modification de `flutter/`, GitHub vérifie le code, lance les tests, fabrique l'APK Android et le publie dans **Releases** |

## Installer l'app Android

Dernière version, à ouvrir depuis le téléphone (connecté à GitHub si le dépôt est privé) :
https://github.com/blackpanther1011bp-sketch/veritrace/releases/latest/download/VeriTrace.apk

Android demandera d'autoriser l'installation depuis le navigateur (« sources inconnues ») : c'est normal pour une app de test hors Play Store.

## Installer l'app iPhone (TestFlight)

La compilation iPhone se lance à la main : onglet **Actions** > **Flutter iOS (TestFlight)** > **Run workflow**. Elle nécessite un compte Apple Developer et quatre secrets (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`, `IOS_CERTIFICATE_PRIVATE_KEY`), décrits en tête de `.github/workflows/flutter-ios-testflight.yml`. Identifiant de l'app : `ma.studiokante.veritrace`. Une fois traitée par Apple, la version apparaît dans l'app TestFlight des testeurs internes.

## Lancer la web app en local

```bash
cd web
npm install
npm run dev
```

La caméra demande une connexion https (ou `localhost`). Pour tester sur un téléphone, utilisez l'adresse en ligne.

## Données

Toutes les marques et notes sont **fictives** (barème de démonstration). Avant un lancement public, il faut une méthode de notation sourcée et des données vérifiées.
