# Note sociale VeriTrace (v1, novembre 2026)

La note sociale mesure ce qu'une marque **rend public et vérifiable** sur la fabrication de ses vêtements : où ils
sont fabriqués, si les usines sont contrôlées par un organisme indépendant, et si l'entreprise entière est certifiée
sur son volet social. Elle ne mesure pas directement les conditions de travail dans chaque usine.

**Règle n° 1 : pas de source, pas de note.** Une marque n'a une note sociale que si VeriTrace a vérifié les trois
critères ci-dessous, chacun avec une source publique datée. Sinon, la fiche affiche « Note sociale non évaluée » et la
note globale est la **note environnement seule**, libellée comme telle.

## Critères et barème

| Critère | Oui | Partiel | Non démontré |
| --- | --- | --- | --- |
| **Liste des usines publiée** : noms et adresses (ou villes) des usines de confection, au moins | 2 points | 1 point (pays ou sélection seulement) | 0 |
| **Contrôle indépendant des usines** : membre de Fair Wear, ou programme social accrédité par la Fair Labor Association | 2 points | 1 point | 0 |
| **Certification sociale de l'entreprise** : B Corp (B Lab) | 1 point | — | 0 |

Total sur 5 : **5 = A, 4 = B, 3 = C, 2 = D, 0 ou 1 = E.**

- « Non démontré » veut dire : VeriTrace n'a trouvé aucune preuve publique à la date de vérification. Ce n'est pas
  une accusation : la note récompense la transparence, et une marque peut envoyer ses preuves par le formulaire de
  contact pour être réévaluée.
- Une preuve compte si son document date de **moins de 5 ans**, ou si la marque figure sur la liste officielle en
  vigueur le jour de la vérification. Au-delà, le critère redevient « non démontré » (la preuve ancienne reste
  affichée).
- Chaque critère affiché porte sa source (lien), la date du document quand elle existe, et la date de vérification.
- Les preuves sont stockées dans la table `brand_social_evidence` (lisible publiquement), la note est calculée par
  la fonction `registry_social` (migration `017_note_sociale_sourcee.sql`).

## Note globale

Moyenne des rangs environnement et social, arrondie vers la meilleure lettre en cas d'égalité (A et C donnent B ;
A et B donnent A). Sans note sociale, la note globale est la note environnement, et la fiche le dit : « Note
environnement seule : note sociale non évaluée ».

## Sources étudiées (vérifiées le 5 novembre 2026)

| Source | Ce qu'elle établit | Conditions de réutilisation | Retenue |
| --- | --- | --- | --- |
| [Fair Wear](https://www.fairwear.org/brands-we-work-with) — fiches marques et rapports « Brand Performance Check » | Adhésion, score annuel de l'évaluation, publication des usines | Faits publics, cités avec lien | Oui (critères 1 et 2) |
| [Fair Labor Association](https://fairlabor.org/affiliates/participating-companies) — entreprises participantes | Programme social accrédité ou non | Faits publics, cités avec lien | Oui (critère 2) |
| [B Lab — annuaire des B Corp](https://www.bcorporation.net/en-us/find-a-b-corp/) | Certification B Corp de l'entreprise, date, score | Faits publics, cités avec lien | Oui (critère 3) |
| Sites des marques (pages « usines », « fournisseurs ») | Liste des usines publiée | Faits publics, cités avec lien | Oui (critère 1) |
| [Open Supply Hub](https://info.opensupplyhub.org/faqs) | Usines et marques qui ont publié leur liste | Données ouvertes, licence CC BY-SA 4.0 ; accès automatisé payant au-delà de 5 000 sites par an | Pas encore : à brancher pour le critère 1 (vérifier l'usage commercial) |
| [Fashion Transparency Index](https://wikirate.org/Fashion_Revolution+Fashion_Transparency_Index_2025) (Fashion Revolution) | Score de transparence des 200-250 plus grandes marques ; l'édition 2025 porte sur le climat | Licence non commerciale (CC BY-NC) | Non : incompatible avec une offre payante ; à revoir avec un accord |

## Marques évaluées au 5 novembre 2026

Six marques du registre officiel, toutes vérifiées le 5 novembre 2026 :

| Marque (registre) | Usines publiées | Contrôle indépendant | Certification | Note |
| --- | --- | --- | --- | --- |
| ARMEDANGELS | Oui (Fair Wear, 2022) | Oui (Fair Wear, 2026) | Non démontré | B |
| ODLO FRANCE | Oui (Fair Wear, 2025) | Oui (Fair Wear, 2026) | Non démontré | B |
| GILDAN ACTIVEWEAR | Partiel (usines du groupe et sélection de sous-traitants) | Oui (FLA) | Non démontré | C |
| NOBODY'S CHILD LIMITED | Oui (2025) | Non démontré | Oui (B Corp, 2025) | C |
| PICTURE ORGANIC CLOTHING | Oui | Non démontré (dernier rapport Fair Wear : 2019) | Oui (B Corp) | C |
| VEJA FAIR TRADE S.A.R.L. | Partiel (pays et régions seulement) | Non démontré | Oui (B Corp) | D |

Les 146 autres marques du registre restent « non évaluées ». Les liens exacts sont dans la migration 017 et
s'affichent dans l'application.

## Produits de démonstration

Les 50 produits et 8 marques de démonstration sont **fictifs** (marqués « Exemple » dans l'application) : leurs
engagements sociaux et leurs notes sont des données d'exemple sans source, gardées pour la démonstration et signalées
comme telles. Ils ne suivent pas cette méthode.

## Limites

- Trois critères seulement, centrés sur la transparence et le contrôle : pas encore de critère sur le salaire vital
  ni sur les résultats des audits.
- Recherche manuelle : la liste des membres Fair Wear et l'annuaire B Lab ne se lisent pas en entier
  automatiquement ; un « non démontré » peut donc manquer une preuve existante (d'où la possibilité de réévaluation).
- Une marque du registre peut regrouper plusieurs sociétés (ex. ODLO FRANCE, filiale d'Odlo International AG) : la
  preuve du groupe s'applique.
