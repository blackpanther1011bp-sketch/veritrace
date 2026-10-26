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

## De la valeur à la note A–E

Pour chaque type de vêtement (T-shirt, jean, pull…), VeriTrace calcule avec Ecobalyse deux références au même poids :

| Référence | Paramètres |
| --- | --- |
| Vertueuse | coton biologique, tissage, teinture et confection en France, petite marque (200 références), prix × 3 |
| Majorant par défaut | exemple officiel Ecobalyse : coton, pays inconnus, grande marque sans réparation |

L'écart entre les deux est découpé en cinq classes égales :

- **A** : jusqu'à 20 % de l'écart au-dessus de la référence vertueuse ;
- **B, C, D** : jusqu'à 40 %, 60 % et 80 % ;
- **E** : au-delà, jusqu'au majorant et plus.

Les seuils sont stockés dans la table `grade_thresholds` (lisible publiquement). Supprimer une ligne force un
nouveau calibrage au calcul suivant, par exemple après une mise à jour d'Ecobalyse.

## Note globale

Moyenne de la note environnement et de la note sociale ; en cas d'égalité entre deux lettres, la meilleure est retenue.

## Fiabilité affichée

| Niveau | Condition |
| --- | --- |
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
