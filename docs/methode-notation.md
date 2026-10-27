# Méthode de notation VeriTrace (v1)

## Environnement et carbone : Ecobalyse

Chaque produit réel est calculé par l'API officielle **Ecobalyse** (ministère de la Transition écologique,
<https://ecobalyse.beta.gouv.fr>), à partir de :

- la catégorie de vêtement, la composition (matières et pourcentages) et le poids ;
- les pays de tissage ou tricotage, de teinture et de confection ;
- la part de transport en avion, le prix, le type d'entreprise et la taille du catalogue, quand ils sont connus.

Toute information manquante prend la valeur par défaut d'Ecobalyse, volontairement pénalisante. Les hypothèses
retenues sont enregistrées avec le produit et affichées dans l'application.

Deux résultats sont conservés :

- le **coût environnemental** (points d'impact), qui agrège plusieurs indicateurs (climat, eau, toxicité,
  ressources, microfibres…) : il donne la **note environnement** ;
- l'**impact climat** (kg CO₂e) : il donne la **note carbone** et la répartition par étape du cycle de vie.

## Registre officiel de l'affichage environnemental

La plupart des vêtements réels de l'application viennent du **registre officiel** publié par l'État sur
data.gouv.fr (« Affichage environnemental des vêtements », Licence Ouverte 2.0, mis à jour chaque mois) :
plus de 570 000 codes-barres déclarés par 150 marques (Kiabi, Gémo, Okaïdi, Jules, Celio, Promod, Jacadi…).

Pour chaque code-barres, la marque y déclare le coût environnemental calculé avec Ecobalyse, le coût pour 100 g,
la durabilité, l'impact climat et la répartition par étape. VeriTrace reprend ces valeurs telles quelles :

- la fiche affiche « Fiabilité : Officielle » et un lien vers la fiche publique du ministère ;
- le registre ne publie ni la composition ni les pays de fabrication : l'application l'indique (« Non publié ») ;
- les codes-barres dont la clé de contrôle est fausse et les déclarations de test sont écartés ;
- l'import est automatique : GitHub Actions découpe le fichier chaque mois, puis Supabase le recharge
  (fonctions `registry_sync_start` et `registry_sync_step`, tâches planifiées `veritrace-registre-*`).

Le registre ne couvre que l'environnement : la **note sociale** de ces marques s'affiche « non évaluée » et la
note globale est alors la note environnement seule. VeriTrace n'invente pas de note sociale.

## De la valeur à la note A–E

Pour chaque type de vêtement (T-shirt, jean, pull…), VeriTrace calcule avec Ecobalyse deux références au même poids
(le poids type d'Ecobalyse pour ce vêtement) :

| Référence | Paramètres |
| --- | --- |
| Vertueuse | coton biologique, tissage, teinture et confection en France, petite marque (200 références), prix × 3 |
| Majorant par défaut | exemple officiel Ecobalyse : coton, pays inconnus, grande marque sans réparation |

L'écart entre les deux est découpé en cinq classes égales :

- **A** : jusqu'à 20 % de l'écart au-dessus de la référence vertueuse ;
- **B, C, D** : jusqu'à 40 %, 60 % et 80 % ;
- **E** : au-delà, jusqu'au majorant et plus.

**À poids égal.** Avant comparaison, le coût de chaque article est ramené au poids type de son vêtement
(coût pour 100 g × poids type) : un manteau lourd n'est pas pénalisé pour sa taille, ni un body de bébé avantagé
pour sa légèreté. Le coût affiché reste celui de l'article.

Les seuils sont stockés dans la table `grade_thresholds` (lisible publiquement). Supprimer une ligne force un
nouveau calibrage au calcul suivant, par exemple après une mise à jour d'Ecobalyse.

## Note globale

Moyenne de la note environnement et de la note sociale ; en cas d'égalité entre deux lettres, la meilleure est retenue.
Sans note sociale (marques du registre officiel), la note globale est la note environnement.

## Fiabilité affichée

| Niveau | Condition |
| --- | --- |
| Officielle | coût déclaré par la marque au registre officiel |
| Haute | données transmises par la marque, poids et trois pays connus, aucune matière approchée |
| Moyenne | au moins le pays de confection connu (cas typique d'une étiquette) |
| Faible | sinon : surtout des valeurs par défaut |

## Limites connues

- Matières absentes d'Ecobalyse (soie, cachemire, cuir…) : le produit est refusé plutôt qu'estimé.
- Approximations signalées : modal et lyocell comptés comme viscose ; laine et polyamide recyclés comptés comme neufs.
- Pays absents de la liste Ecobalyse (Portugal, Espagne, Italie…) : la région correspondante est utilisée
  (Europe de l'Ouest, etc.).
- La note sociale est encore attribuée par l'équipe VeriTrace ; une méthode sourcée (certifications vérifiées,
  Fashion Transparency Index, Open Supply Hub) est prévue.
- Les seuils A–E sont une convention VeriTrace, publiée ici ; ce n'est pas une note officielle de l'État.
