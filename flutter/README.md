# VeriTrace — application Flutter (iOS / Android)

Version native de VeriTrace. Elle reprend les écrans et la base de données de la web app.

Identifiant de l'app : `ma.studiokante.veritrace` (le même sur Android et iPhone). Nom affiché : « VeriTrace ».

## Ce qui est fait

- **Réalité augmentée native, Android** (`packages/veritrace_ar`, ARCore + ML Kit) : la note de chaque vêtement visé
  est posée en 3D sur son code-barres et reste à sa place quand on se déplace. Sur les téléphones sans ARCore, et sur
  iPhone pour l'instant, l'app bascule sur le scan léger ci-dessous.
- **Scan léger** (`lib/screens/ar_scan_screen.dart`) : caméra plein écran, badge accroché au code-barres dans
  l'image. Codes EAN-13, EAN-8 et UPC-A, avec vérification de la clé de contrôle (`lib/ar_geometry.dart`, testé).
- **Lecture d'étiquette** (photo de l'étiquette de composition) et **contribution** d'un vêtement absent.
- **Fiche produit** : coût environnemental en points (« Coût officiel » quand il vient du registre de l'État),
  note VeriTrace A–E (environnement, carbone, social), pays, composition. La note n'est pas un label
  (voir `../docs/methode-notation.md`).
- **Alternatives**, signalement d'un produit introuvable (`product_reports`), mesure d'usage (`events`).
- Délais d'attente : 12 s sur les requêtes, 60 s sur les fonctions serveur (message « délai dépassé » au lieu d'un
  écran figé).
- Polices embarquées (DM Sans, Space Grotesk, licence OFL dans `fonts/`) : l'app ne télécharge aucune police.
- Lien vers Confidentialité · Mentions légales · Conditions (pages du site web) depuis l'écran d'accueil.

## Construire

Flutter **3.47.9** (version fixée dans les workflows). Les dossiers `android/` et `ios/` ne sont pas versionnés :
la CI les génère puis les règle.

```bash
cd flutter
flutter create . --project-name veritrace --org ma.studiokante --platforms=android,ios
python3 ../.github/scripts/android_setup.py   # nom, permissions, signature, icônes, écran de démarrage
flutter pub get
flutter test
flutter run
```

`android_setup.py` retire les permissions ajoutées par les dépendances et inutiles (micro, stockage) : l'APK ne
demande que la caméra et l'accès réseau. Il copie aussi les icônes et l'écran de démarrage de `branding/android`.
Côté iPhone, les workflows copient `branding/ios/AppIcon.appiconset` et règlent `NSCameraUsageDescription`.

## APK Android

Chaque modification de `flutter/` sur `main` fabrique deux APK (workflow « Flutter Android ») publiés dans les
Releases du dépôt :

- `VeriTrace.apk` : téléphones récents (64 bits, la grande majorité) ;
- `VeriTrace-ancien-telephone.apk` : téléphones 32 bits.

**Signature.** Sans secrets configurés, les APK sont signés avec la clé de test publique `signing/veritrace-test.jks` :
la même à chaque build, donc les mises à jour s'installent par-dessus. Cette clé est publique : **jamais pour le Play
Store**. Pour la clé de publication, ajouter dans les secrets du dépôt `ANDROID_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (voir `signing/README.md`). La CI vérifie
la signature et les permissions de chaque APK.

## Base de données (Supabase)

Projet `veritrace` (région Paris). Schéma dans `../supabase/migrations`. L'app lit les fiches (registre officiel de
l'affichage environnemental et fiches de fabricants), écrit seulement les signalements, contributions et événements,
tous plafonnés par jour côté serveur.

La clé de `lib/config.dart` est la clé **publishable** : elle peut être embarquée dans l'app, la sécurité repose sur
les règles RLS. Pour changer de projet : `flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_PUBLISHABLE_KEY=...`.

La planche `../test-barcodes/codes-barres-test.pdf` contient des codes de démonstration à scanner.

## À faire avant un lancement public

1. Réalité augmentée native sur iPhone (ARKit).
2. Abonnement VeriTrace+ (bons plans, dressing et revente, entretien) avec achats intégrés vérifiés côté serveur. Les alternatives mieux notées restent gratuites pour tous.
3. Clé de publication Android, comptes Play Console et Apple Developer.
4. Déclaration CNDP (loi 09-08) déposée : voir `../docs/dossier-cndp.md`.

## Organisation du code

```
lib/
  main.dart               initialisation Supabase et thème
  config.dart             URL et clé Supabase, adresse du site
  api.dart                requêtes (avec délais), cache mémoire, événements
  native_ar.dart          pont vers la réalité augmentée native (packages/veritrace_ar)
  ar_geometry.dart        position des badges du scan léger
  label_reader.dart, label_live.dart   lecture d'étiquette
  reliability.dart        provenance des chiffres, format des points
  models.dart, barcode.dart, scanned_code.dart, compare.dart, contribute.dart
  theme.dart, widgets.dart, sources_card.dart, navigation.dart, storage.dart
  screens/                scan, fiche, détails, alternatives, étiquette, contribution, introuvable
packages/veritrace_ar/    plugin Android (Java) : ARCore, ML Kit, panneaux OpenGL
branding/                 icônes et écran de démarrage Android / iOS
fonts/                    DM Sans, Space Grotesk (OFL)
signing/                  clé de test publique (jamais pour le Play Store)
test/                     tests unitaires
```
