# Réalité augmentée, version 2

La version 1 affiche la note A–E sur l'image de la caméra, accrochée au code-barres. La version 2 ajoute
quatre fonctions, sur le site (iPhone et Android) et dans l'app Flutter.

## 1. RA ancrée dans l'espace (panneau 3D)

- Fiche d'un vêtement → **« Voir en réalité augmentée »** → **« Placer dans la pièce »**.
- Un panneau 3D (note, verdict, coût environnemental, climat, répartition de l'impact) est posé sur une
  surface et reste fixé dans l'espace quand on se déplace. Taille réelle : environ 24 × 33 cm.
- iPhone : AR Quick Look d'Apple (fichier USDZ créé à la volée dans Safari). Android : WebXR (Chrome).
  Ordinateur : aperçu 3D qu'on fait tourner au doigt ou à la souris.
- Code : `web/src/lib/ar3d.ts` (dessin du panneau et export glTF), `web/src/components/ArPanel.tsx`
  (`<model-viewer>`, chargé seulement à l'ouverture : environ 320 Ko compressés).
- App Flutter : le bouton de la fiche ouvre la même page dans l'app (`/#/p/<code>?ra=1` ouvre la RA
  directement).
- Contrôle : le fichier USDZ passe les validateurs USD (Pixar) sans erreur.

## 2. RA sur l'étiquette cousue (lecture en direct)

- Accueil → **« Pas de code-barres ? Lire l'étiquette »**, ou code-barres inconnu → **« Viser l'étiquette :
  note en direct »**.
- On vise l'étiquette de composition : le texte est lu en continu sur le téléphone (site : Tesseract ;
  app : ML Kit), dans la zone de visée seulement (texte plus grand, lecture plus rapide).
- Dès que la composition du **tissu principal** fait 100 %, un seul appel au serveur calcule la note avec
  Ecobalyse ; la note s'affiche sur l'étiquette. Une doublure lue seule n'est jamais notée à la place du
  tissu principal (même règle sur le serveur pour la lecture par photo).
- Le type de vêtement est choisi une fois (pastilles en bas) et mémorisé.
- Code : `web/src/lib/labelLive.ts`, `web/src/screens/LabelLiveScreen.tsx` ;
  `flutter/lib/label_live.dart`, `flutter/lib/screens/label_live_screen.dart`.

## 3. Comparateur en rayon

- Dans le scanner, tous les vêtements reconnus pendant la visite (ensemble à l'image ou l'un après
  l'autre) sont classés : note, puis coût environnemental.
- Le mieux noté reçoit une **couronne** ; un bandeau « Le meilleur ici » résume l'écart (« 2,3 fois moins
  d'impact que le moins bon » quand les vêtements sont du même type) ; « Comparer » ouvre le classement.
- Code : `web/src/lib/compare.ts`, `flutter/lib/compare.dart`.

## 4. Fiche RA enrichie

- Dans le scanner, toucher le badge d'un vêtement ouvre une fiche accrochée au code-barres, sans quitter
  la caméra : verdict, répartition de l'impact, pays, composition, meilleure alternative, fiche complète.

## 5. RA native Android (ARCore) : la note posée sur le code-barres

- Scanner → bouton **« 3D »** en haut (visible seulement sur un Android compatible ARCore).
- On vise un ou plusieurs codes-barres : chaque note est **posée en 3D sur son code-barres** (point vert)
  et reste à sa place quand on tourne autour ou qu'on s'éloigne. Le mieux noté reçoit la couronne,
  la consigne du bas résume l'écart. Toucher une note ouvre la fiche (ou l'écran « pas encore noté »).
- Fonctionnement : ARCore suit le téléphone dans l'espace ; ML Kit lit les codes-barres sur l'image
  d'ARCore (jusqu'à 1920 × 1080, mise au point automatique) ; la position du code est calculée avec la
  direction vue par la caméra et la distance (points suivis par ARCore sur l'étiquette, sinon taille du
  code : environ 3,1 cm de large). Les fiches sont demandées à l'app Flutter (même cache, mêmes règles).
- Si « Services Google Play pour la RA » manque, le Play Store le propose à l'ouverture. Sur un téléphone
  non compatible, le bouton n'apparaît pas : le scanner classique reste disponible.
- iPhone : à faire plus tard (ARKit, nécessite TestFlight et un compte Apple Developer).
- Code : plugin local `flutter/packages/veritrace_ar` (Java : `ArActivity`, `Geometry`, `PanelData`,
  `PanelPainter`, `BarcodeReader`), lien Flutter dans `flutter/lib/native_ar.dart`.
- Mesure d'usage : `ar3d_view` à l'ouverture, `ar3d_place` pour chaque note posée.

### Tester sur un téléphone Android

1. Installer l'APK : `https://github.com/<compte>/<dépôt>/releases/latest/download/VeriTrace.apk`.
2. Vérifier que le téléphone figure dans la liste ARCore :
   https://developers.google.com/ar/devices (la plupart des Android récents de milieu et haut de gamme).
3. Scanner → « 3D » → accepter l'installation de « Services Google Play pour la RA » si demandé.
4. Bouger doucement le téléphone 2 secondes, puis viser un code-barres à 20–40 cm : la note apparaît sur
   le code et reste en place en tournant autour. N'importe quel code-barres convient (un vêtement absent de
   la base affiche « Pas encore noté ») ; `docs/codes-barres-test.png` contient les trois vêtements fictifs
   de la démo, à afficher sur un écran d'ordinateur ou à imprimer.

## Mesure d'usage

Événements : `ar3d_view`, `ar3d_place`, `label_live_start`, `label_live_read`, `compare_view`,
`ar_card_open` (migration `supabase/migrations/010_evenements_ra.sql`, appliquée en production).

## Tests

- Unitaires : `node --experimental-strip-types --test web/src/lib/*.test.ts` ; `flutter test`.
- Navigateur (Chromium, fausse caméra) : lecture en direct de vraies étiquettes, comparateur avec six
  codes-barres à l'image, panneau 3D et export USDZ.
