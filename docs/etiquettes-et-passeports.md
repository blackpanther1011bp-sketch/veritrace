# Lecture d'étiquette et passeport numérique

## 1. Lire l'étiquette d'un vêtement (grand public)

Pour un vêtement absent de la base (ou sans code-barres), l'utilisateur photographie l'**étiquette cousue**
(composition, « Made in ») et choisit le type de vêtement.

1. Le **texte est lu sur l'appareil**, gratuitement :
   - version web : Tesseract (logiciel libre), servi par le site lui-même (`web/scripts/copy-ocr.mjs`) ;
   - app Android : ML Kit de Google, intégré à l'app.
2. La fonction Supabase `outils` (action `lire_etiquette`) en tire la composition et le pays, dans les langues
   courantes des étiquettes (français, anglais, espagnol, italien, allemand, portugais, turc, arabe…),
   puis calcule la note avec Ecobalyse.
3. Avec un code-barres, le résultat est **publié aussitôt, marqué « non vérifié »** : la personne suivante
   qui scanne ce vêtement voit la note. Sans code-barres, il reste accessible par son code `L…`.

Le poids et les pays de tissage et de teinture ne figurent pas sur l'étiquette : Ecobalyse applique ses valeurs
par défaut, ce qui est affiché dans les hypothèses du calcul (fiabilité « moyenne » ou « faible »).

### Modération

- Retirer une lecture erronée : table `label_readings`, colonne `status` → `masque`.
- La photo est gardée dans le dépôt `etiquettes` (dossier `lectures/`), visible seulement par l'équipe.
- Réglages (table `app_settings`) :
  - `etiquette_publication_auto` : `false` pour ne plus rien publier automatiquement ;
  - `etiquette_par_appareil_par_jour` : lectures par connexion et par jour (anti-abus, 40 par défaut).

### Lecture par IA (facultative, désactivée par défaut)

Si un jour la lecture sur l'appareil ne suffit pas, une IA de vision peut prendre le relais : ajouter le secret
`ANTHROPIC_API_KEY` (Edge Functions → Secrets). Plafond journalier : `etiquette_ia_par_jour` (300 par défaut).
Sans ce secret, rien n'est appelé et rien n'est payé.

## 2. Espace fabricants et passeport numérique (B2B)

Page web `/#/fabricants` : une usine décrit un produit (composition, poids, pays de filature, tissage, teinture,
confection, transport). VeriTrace calcule le coût environnemental avec Ecobalyse et crée une page publique
`/#/passeport/<id>` :

- chaîne de fabrication, coût par étape du cycle de vie, méthode et hypothèses ;
- **QR code** à imprimer, au format **GS1 Digital Link** quand le produit a un code-barres
  (`https://…/01/<GTIN>?passeport=<id>`), le format prévu pour les passeports numériques européens ;
- export des données (JSON) et impression en PDF.

Le format officiel européen pour les vêtements (règlement ESPR, attendu vers 2027-2028) n'est pas encore publié :
la page l'indique.

### Vérification

Un passeport est visible par son lien dès sa création, mais il n'apparaît dans l'app grand public (quand on
scanne son code-barres) qu'après vérification : table `passports`, colonne `verified` → `true`.
Plafond : `passeports_par_jour` (200 par défaut).

## 3. Lecture des QR codes

Le scanner de l'app lit aussi les QR codes : un QR GS1 Digital Link (`…/01/<GTIN>`) ouvre la fiche du vêtement,
un QR de passeport VeriTrace ouvre la page du passeport.
