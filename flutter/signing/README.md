# Signature de l'APK

- `veritrace-test.jks` : **clé de test publique**, utilisée seulement pour les APK de test publiés sur GitHub.
  Elle est la même à chaque build : un testeur peut installer une nouvelle version par-dessus l'ancienne
  sans perdre son historique. Mot de passe et alias : `veritrace-test` / `veritrace`.
  Comme elle est publique, **elle ne doit jamais servir à publier sur le Play Store**.
- Clé de publication (Play Store) : à créer une fois, puis à ajouter dans les secrets GitHub du dépôt
  (Settings → Secrets and variables → Actions) :
  - `ANDROID_KEYSTORE_BASE64` : le fichier `.jks` encodé en base64 ;
  - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
  Dès que ces secrets existent, le workflow « Flutter Android » signe avec eux au lieu de la clé de test.
  Garder une copie de la clé en lieu sûr : sans elle, impossible de mettre à jour l'app sur le Play Store.
