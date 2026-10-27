# Ajouter des produits réels

Les notes des produits réels sont calculées automatiquement avec **Ecobalyse**, la méthode officielle française
d'affichage environnemental des vêtements. Vous saisissez ce que vous savez du vêtement ; la base s'occupe du reste.

> Plus de 570 000 vêtements du **registre officiel** (Kiabi, Gémo, Okaïdi, Jules, Celio, Promod…) sont déjà
> chargés et se mettent à jour seuls chaque mois : rien à saisir pour eux (voir `methode-notation.md`).
> Les étapes ci-dessous servent aux vêtements absents du registre, par exemple ceux des marques marocaines.
> Un produit saisi ici prime sur le registre pour le même code-barres.

## Une seule fois : le jeton Ecobalyse

1. Créez un compte sur <https://ecobalyse.beta.gouv.fr> (connexion par e-mail) et copiez votre **jeton d'API**.
2. Dans Supabase : **Edge Functions → Secrets → Add new secret**
   - Name : `ECOBALYSE_TOKEN`
   - Value : votre jeton
3. Ne collez jamais ce jeton dans une conversation, un fichier du dépôt ou une capture d'écran.

## Ajouter une marque (si elle n'existe pas encore)

Dans **SQL Editor** :

```sql
insert into public.brands (id, name, kind, country, social_checks, is_sample, social_grade, eco_business, eco_references)
values (
  'nom-de-la-marque',        -- identifiant : minuscules, chiffres et tirets
  'Nom de la marque',
  'fast_fashion',            -- fast_fashion, responsable ou seconde_main
  'Maroc',
  '[{"label":"Audit social indépendant","status":"non_communique"},
    {"label":"Salaire vital garanti","status":"non_communique"},
    {"label":"Liste des usines publiée","status":"non_communique"},
    {"label":"Politique contre le travail forcé","status":"non_communique"}]'::jsonb,
  false,
  'C',                       -- note sociale de la marque, reprise pour ses vêtements
  'large-business-without-services',  -- ou small-business, large-business-with-services (facultatif)
  null                                 -- nombre de références au catalogue (facultatif)
);
```

## Valider les vêtements ajoutés depuis l'app

Dans l'app, un code-barres inconnu propose « Ajouter ce vêtement » : la personne recopie l'étiquette
(marque, nom, catégorie, composition, pays) et peut la photographier. Rien n'est publié avant votre validation.

1. **Table Editor → product_submissions** : les nouveaux ajouts ont le statut `a_verifier`.
2. Vérifiez la saisie avec la photo : **Storage → etiquettes**, fichier indiqué dans `photo_path`.
3. Pour valider, passez `status` à `valide`.
   - La marque est retrouvée par son nom ; sinon, créez-la (voir plus haut) ou indiquez son identifiant dans `brand_id`.
   - La note sociale est celle de la marque (`brands.social_grade`) ; vous pouvez la préciser dans `social_grade`.
   - S'il manque quelque chose, Supabase affiche un message et ne valide pas.
4. Le vêtement part au calcul Ecobalyse et apparaît dans l'app quelques secondes après (suivi dans `product_drafts`).
5. Pour refuser : `status` = `refuse` et la raison dans `moderator_note`.

## Ajouter des produits vous-même

**Table Editor → product_drafts → Insert** (une ligne), ou **Import data from CSV** avec le modèle
`supabase/templates/produits_reels_modele.csv`.

| Colonne | Obligatoire | Exemple | Remarque |
| --- | --- | --- | --- |
| `ean` | oui | `6111234567890` | code-barres, 8 à 14 chiffres |
| `brand_id` | oui | `atelier-oued` | identifiant de la marque |
| `name` | oui | `T-shirt col rond` | |
| `category` | oui | `T-shirt` | T-shirt, Chemise, Robe, Jupe, Jean, Pantalon, Pull, Sweat, Veste, Manteau… |
| `composition` | oui | `60 % coton, 40 % polyester` | recopiée de l'étiquette ; total = 100 % |
| `social_grade` | oui | `C` | note sociale A à E (méthode sociale sourcée à venir) |
| `data_source` | oui | `etiquette` | `marque`, `etiquette` ou `estimation` |
| `source_ref` | non | lien de la fiche produit ou référence du document | affiché dans l'app |
| `source_date` | non | `2026-10-20` | date de la source |
| `mass_kg` | non | `0.18` | sinon poids type Ecobalyse |
| `country_fabric` | non | `Turquie` | pays de tissage ou tricotage |
| `country_dyeing` | non | `Turquie` | pays de teinture et finition |
| `country_making` | non | `Maroc` | pays de confection (« Made in ») |
| `air_transport_ratio` | non | `0` | part de transport en avion, de 0 à 1 |
| `price_eur` | non | `25` | prix en euros (durabilité selon Ecobalyse) |
| `transport` | non | `Camion` | texte affiché ; sinon déduit de l'avion |
| `eco_product` | non | `jupe` | seulement si la catégorie n'est pas reconnue |

Un pays absent est remplacé par la valeur par défaut d'Ecobalyse, volontairement **pénalisante** :
plus la marque est transparente, plus la note est juste.

## Suivre le calcul

La colonne `status` de `product_drafts` passe de `a_calculer` à `publie` en quelques secondes
(le produit apparaît alors dans l'app), ou à `erreur` avec un message dans `error`
(par exemple « Matière non prise en charge par Ecobalyse : soie »).

- **Corriger une erreur** : modifiez la ligne ; le calcul repart tout seul.
- **Relancer après avoir ajouté le jeton** (SQL Editor) :

  ```sql
  update public.product_drafts set status = 'a_calculer' where status = 'erreur';
  ```

- Les hypothèses retenues (pays inconnu, poids type…) sont dans `notes` et affichées dans l'app.

Le détail de la méthode de notation est dans [methode-notation.md](methode-notation.md).
