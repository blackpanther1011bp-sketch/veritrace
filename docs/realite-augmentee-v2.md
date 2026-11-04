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

## Mesure d'usage

Événements : `ar3d_view`, `ar3d_place`, `label_live_start`, `label_live_read`, `compare_view`,
`ar_card_open` (migration `supabase/migrations/010_evenements_ra.sql`, appliquée en production).

## Tests

- Unitaires : `node --experimental-strip-types --test web/src/lib/*.test.ts` ; `flutter test`.
- Navigateur (Chromium, fausse caméra) : lecture en direct de vraies étiquettes, comparateur avec six
  codes-barres à l'image, panneau 3D et export USDZ.
