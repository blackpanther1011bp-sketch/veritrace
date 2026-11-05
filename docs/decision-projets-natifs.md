# Décision : projets Android et iOS générés par la CI (point 25 de l'audit)

Décidé le 5 novembre 2026. À revoir si l'un des cas « quand changer » ci-dessous arrive.

## Décision

Les dossiers `flutter/android/` et `flutter/ios/` ne sont **pas** versionnés. À chaque build, la CI les recrée avec
`flutter create` (Flutter **3.47.9**, version fixée), puis applique nos réglages par script :

| Plateforme | Réglages appliqués | Où |
| --- | --- | --- |
| Android | nom « VeriTrace », identifiant `ma.studiokante.veritrace`, permissions (Internet ; micro et stockage retirés), signature, icônes, écran de démarrage, règles R8 | `.github/scripts/android_setup.py` |
| iOS | nom affiché, textes d'autorisation caméra et photos, icônes | étapes des workflows `flutter-ios-check.yml` et `flutter-ios-testflight.yml` |

Tout le reste de l'app (Dart, plugin de réalité augmentée `packages/veritrace_ar`, polices, icônes sources dans
`flutter/branding`) est versionné normalement.

## Pourquoi

- **Rien de manuel à oublier.** Chaque réglage natif est écrit dans un script relu et versionné ; un projet généré
  à la main dérive avec le temps (réglage fait sur un poste, jamais reporté).
- **Montées de version de Flutter propres.** Le modèle natif suit la version de Flutter choisie, sans fusion à la
  main des fichiers Gradle et Xcode générés.
- **Garde-fous.** Le script Android échoue avec un message clair si le modèle de Flutter change (balise ou bloc
  attendu absent) ; la CI vérifie ensuite la signature et les permissions de l'APK (`apksigner`, `aapt2`).
  Côté iOS, `plutil -lint` vérifie le fichier Info.plist modifié.
- **Version de Flutter fixée** dans tous les workflows : deux builds du même commit produisent le même projet.

## Ce que ça implique

- Pour lancer l'app en local : `flutter create . --project-name veritrace --org ma.studiokante
  --platforms=android,ios` puis `python3 ../.github/scripts/android_setup.py` (voir `flutter/README.md`).
- Un réglage natif (permission, clé Info.plist, option Gradle) se fait **dans le script**, jamais à la main
  dans le dossier généré.
- Monter la version de Flutter : changer `flutter-version` dans les workflows, lancer la CI, corriger le script
  si un garde-fou échoue.

## Quand changer et versionner les dossiers

- code natif propre à l'app hors plugin (extension iOS, widget, service Android) ;
- configuration de services tiers déposée dans les dossiers natifs (Firebase, notifications, deep links signés) ;
- réglages Xcode trop nombreux pour un script fiable (capabilities, schémas de build multiples).

Dans ces cas : générer une fois avec la même commande, appliquer les scripts, versionner le résultat, puis
retirer les étapes de génération des workflows.
