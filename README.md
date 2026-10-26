# VeriTrace — MVP

Application qui affiche l'impact environnemental et social d'un vêtement à partir du code-barres de son étiquette.

| Dossier | Contenu |
| --- | --- |
| `web/` | Web app mobile (React + Vite), en ligne sur https://veritrace-wine.vercel.app |
| `flutter/` | Application native iOS / Android, mêmes écrans, même base (voir `flutter/README.md`) |
| `supabase/` | Schéma SQL, règles de sécurité et données d'exemple (50 produits fictifs) |
| `test-barcodes/` | Planche PDF des 50 codes-barres de test, à scanner sur écran ou imprimée |
| `.github/workflows/` | Compilation automatique : à chaque modification de `flutter/`, GitHub vérifie le code, lance les tests et fabrique l'APK Android (onglet **Actions**, section *Artifacts*) |

## Lancer la web app en local

```bash
cd web
npm install
npm run dev
```

La caméra demande une connexion https (ou `localhost`). Pour tester sur un téléphone, utilisez l'adresse en ligne.

## Données

Toutes les marques et notes sont **fictives** (barème de démonstration). Avant un lancement public, il faut une méthode de notation sourcée et des données vérifiées.
