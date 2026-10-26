# VeriTrace — application Flutter (iOS / Android)

Version native du MVP VeriTrace. Elle reprend exactement les écrans et la base de données de la web app déjà en ligne.

## Ce qui est fait

- **Scan caméra** des codes-barres EAN-13, EAN-8 et UPC-A (`mobile_scanner`), avec vérification de la clé de contrôle.
- **Saisie manuelle** du code quand la caméra n'est pas disponible.
- **Fiche produit** : note globale A–E, notes Carbone et Social, pays, composition, transport.
- **Comprendre la note** : détail carbone par poste, engagements sociaux de la marque.
- **Alternatives** : même catégorie, mieux notées, marques responsables ou seconde main. Une gratuite, les autres derrière une offre Premium **simulée**.
- **Produit introuvable** : signalement envoyé dans la table `product_reports`.
- **Mesure d'usage** dans la table `events`, dont `exit_after_bad_grade` (l'utilisateur quitte l'app sur un vêtement noté D ou E).
- Historique des derniers scans sur l'appareil.

La réalité augmentée n'est **pas** incluse : elle est prévue en V2, une fois le scan validé auprès des utilisateurs.

## Démarrer

Prérequis : Flutter 3.27 ou plus récent.

```bash
cd flutter
flutter create . --project-name veritrace --platforms=android,ios   # génère les dossiers android/ et ios/
flutter pub get
flutter test
flutter run
```

Ensuite, deux réglages de plateforme pour la caméra :

- **iOS** : dans `ios/Runner/Info.plist`, ajouter la clé `NSCameraUsageDescription`, par exemple « VeriTrace utilise la caméra pour lire le code-barres des étiquettes ».
- **Android** : vérifier le `minSdk` demandé par la version de `mobile_scanner` installée (voir sa page pub.dev) dans `android/app/build.gradle`.

## Base de données (Supabase)

Projet `veritrace` (région Paris). Schéma et données dans `../supabase/` :

| Table / fonction | Rôle | Accès depuis l'app |
| --- | --- | --- |
| `brands` | Marques et engagements sociaux | lecture |
| `products` | Fiches indexées par code-barres | lecture |
| `get_alternatives(p_ean)` | Alternatives mieux notées | appel |
| `product_reports` | Produits signalés comme introuvables | écriture seule |
| `events` | Mesure d'usage | écriture seule |

La clé utilisée dans `lib/config.dart` est la clé **publishable** : elle peut être embarquée dans l'app, la sécurité repose sur les règles RLS. Pour changer de projet : `flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_PUBLISHABLE_KEY=...`.

Les 50 produits sont **fictifs** et utilisent des codes de la plage 200–299 (réservée, aucun vrai produit). La planche `../test-barcodes/codes-barres-test.pdf` permet de les scanner.

## À faire avant un lancement public

1. **Méthode de notation sourcée** (par exemple Ecobalyse pour le carbone) et sources sociales vérifiables : les notes actuelles sont un barème de démonstration.
2. **Vrai abonnement** (RevenueCat ou achats intégrés) avec vérification côté serveur ; aujourd'hui Premium est un simple interrupteur local.
3. **Politique de confidentialité** et conformité (loi 09-08 / CNDP au Maroc, RGPD en Europe) avant de collecter des événements à grande échelle.
4. Icônes d'application et écran de lancement.

## Organisation du code

```
lib/
  main.dart               initialisation Supabase et thème
  config.dart             URL et clé Supabase, réglages Premium
  api.dart                requêtes, cache mémoire, événements
  storage.dart            historique et Premium simulé (appareil)
  barcode.dart            validation et format des codes GTIN
  models.dart             Product, Brand, notes
  theme.dart, widgets.dart
  screens/                scan, fiche, détails, alternatives, introuvable
test/barcode_test.dart
```
