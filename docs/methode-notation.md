# Méthode de notation VeriTrace (v2)

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

- la fiche affiche « Coût officiel » et un lien vers la fiche publique du ministère ;
- le registre ne publie ni la composition ni les pays de fabrication : l'application l'indique (« Non publié ») ;
- les codes-barres dont la clé de contrôle est fausse et les déclarations de test sont écartés ;
- l'import est automatique : GitHub Actions découpe le fichier chaque mois, puis Supabase le recharge
  (fonctions `registry_sync_start` et `registry_sync_step`, tâches planifiées `veritrace-registre-*`).

Le registre ne couvre que l'environnement. La **note sociale** vient d'ailleurs : de preuves publiques vérifiées par
VeriTrace pour chaque marque (voir [methode-note-sociale.md](methode-note-sociale.md)). Sans preuves, elle s'affiche
« non évaluée » et la note globale est la note environnement seule. VeriTrace n'invente pas de note sociale.

## De la valeur à la note A–E (v2, novembre 2026)

La note VeriTrace situe le coût environnemental d'un vêtement par rapport aux vêtements **du même type déclarés au
registre officiel** (568 264 vêtements notés en novembre 2026), à poids égal :

| Note | Position parmi les vêtements du même type |
| --- | --- |
| A | parmi les 10 % les mieux placés |
| B | entre 10 % et 30 % |
| C | entre 30 % et 60 % |
| D | entre 60 % et 80 % |
| E | parmi les 20 % les moins bien placés |

Les seuils sont les quantiles 10 / 30 / 60 / 80 % du coût (note environnement) et de l'impact climat (note carbone),
calculés par type de vêtement (fonction SQL `recalibrate_grade_thresholds`, tâche planifiée
`veritrace-notes-recalibrage`, le 4 de chaque mois, après l'import du registre). Un type qui compte moins de
500 vêtements au registre garde ses seuils précédents.

**Pourquoi ce changement.** La v1 découpait en cinq classes égales l'écart entre une référence « vertueuse » (coton
bio, fabrication en France) et le majorant par défaut d'Ecobalyse, volontairement pénalisant et que presque aucune
marque déclarée n'atteint : 48 % du registre était noté A et 82 % A ou B. Une note aussi généreuse ne distinguait plus
rien.

**À poids égal.** Avant comparaison, le coût de chaque article est ramené au poids type de son vêtement
(coût pour 100 g × poids type) : un manteau lourd n'est pas pénalisé pour sa taille, ni un body de bébé avantagé
pour sa légèreté. Le coût affiché reste celui de l'article.

**Le coût d'abord.** Partout où la note apparaît, le coût environnemental en points est affiché avec elle, et la
note est présentée comme « note VeriTrace » : depuis le 1er octobre 2026, quiconque communique un score sur un
vêtement en France doit aussi publier le coût officiel, et ne pas créer de confusion avec lui.

Les seuils sont stockés dans la table `grade_thresholds` (lisible publiquement, colonne `method`).

## Note globale

Moyenne de la note environnement et de la note sociale ; en cas d'égalité entre deux lettres, la meilleure est retenue.
Sans note sociale (marque non évaluée, étiquette lue, passeport), la note globale est la note environnement, et la fiche
l'indique : « Note environnement seule : note sociale non évaluée ».

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
- La note sociale (v1) ne couvre encore que six marques du registre et trois critères de transparence et de contrôle
  (voir [methode-note-sociale.md](methode-note-sociale.md)) ; les produits de démonstration gardent des données
  sociales fictives, signalées comme telles.
- Les seuils A–E sont une convention VeriTrace, publiée ici ; ce n'est pas une note officielle de l'État, ni un
  label : un fabricant ne peut pas la reproduire sur ses produits (conditions d'utilisation).
- La note est relative : elle compare aux vêtements déclarés au registre (surtout des marques vendues en France).
