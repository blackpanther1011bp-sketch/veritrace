# Dossier de déclaration CNDP — VeriTrace

Brouillon préparé le 5 novembre 2026 pour la déclaration du traitement auprès de la Commission nationale de contrôle de
la protection des données à caractère personnel (CNDP, Maroc), au titre de la loi n° 09-08. À déposer par le
responsable du traitement sur cndp.ma (formulaire de déclaration), puis à mettre à jour si le service change.

Une fois le récépissé reçu, remplacer « Déclaration auprès de la CNDP : en cours » par le numéro du récépissé dans
`web/src/screens/LegalScreen.tsx` (page Confidentialité).

## 1. Responsable du traitement

- Nom : Bangaly Kanté (personne physique), éditeur du projet VeriTrace.
- Adresse : à compléter (Casablanca).
- Contact pour les personnes concernées : formulaire de contact de la page Confidentialité du site.
- Cadre : projet de master (Marketing et Transformation Digitale, HESTIM), service gratuit, sans publicité.

## 2. Finalités

1. Afficher le coût environnemental et la note d'un vêtement à partir de son code-barres ou de son étiquette.
2. Compléter le catalogue (vêtements signalés, ajoutés, étiquettes lues), après vérification.
3. Publier les passeports produits créés par des fabricants.
4. Mesurer l'usage de l'application de façon agrégée (étude de master).
5. Limiter les abus (quotas journaliers).
6. Répondre aux messages du formulaire de contact.

Pas de prospection, pas de profilage, pas de décision automatisée sur les personnes, pas de vente de données.

## 3. Personnes concernées et données

| Catégorie | Données | Durée de conservation |
| --- | --- | --- |
| Visiteurs et utilisateurs de l'app | Identifiant de session tiré au hasard à chaque visite, écrans vus, codes-barres scannés, notes affichées | 13 mois |
| Utilisateurs qui envoient une étiquette | Photo de l'étiquette, texte lu, composition, résultat | Photo : 12 mois au plus ; résultat : durée du service (donnée sur le vêtement) |
| Contributeurs | Vêtement signalé ou ajouté : code-barres, marque, composition | Durée du service |
| Fabricants | Entreprise, ville, produit, étapes de fabrication | Jusqu'à demande de suppression |
| Toute connexion aux fonctions serveur | Empreinte HMAC secrète de l'adresse IP, renouvelée chaque jour (l'adresse elle-même n'est pas stockée) | 30 jours |
| Personnes qui écrivent | Objet, message, e-mail de réponse (facultatif) | 12 mois |

Aucune donnée sensible au sens de la loi 09-08 (santé, opinions, origine, etc.) n'est demandée. Pas de compte, pas de
nom ni d'e-mail obligatoire, pas de cookie de suivi. L'historique des scans reste sur l'appareil.

Base du traitement : consentement (envoi volontaire d'une étiquette, d'une contribution, d'un message) et intérêt
légitime (mesure d'usage minimale, sécurité du service).

## 4. Destinataires et sous-traitants

| Sous-traitant | Rôle | Lieu des données |
| --- | --- | --- |
| Supabase Pte. Ltd. (Singapour) | Base de données, stockage des photos, fonctions serveur | Serveurs à Paris (France, Union européenne) |
| Vercel, Inc. (États-Unis) | Hébergement du site web | Réseau mondial ; journaux techniques (adresse IP) |
| GitHub, Inc. (États-Unis) | Téléchargement de l'application Android | Journaux techniques |
| Ecobalyse (ministère français de la Transition écologique) | Calcul du coût environnemental | Ne reçoit que la composition et les pays du vêtement, aucune donnée personnelle |
| Anthropic, PBC (États-Unis), facultatif | Lecture par IA de la photo d'une étiquette, seulement si la clé est configurée et que le texte n'a pas pu être lu sur l'appareil | Photo d'étiquette |

## 5. Transferts hors du Maroc

Toutes les données sont hébergées hors du Maroc : la base dans l'Union européenne (France), le site et le
téléchargement de l'app par des sociétés américaines. **Point à faire confirmer par la CNDP** lors du dépôt : si un
transfert vers un pays non reconnu comme assurant une protection suffisante doit faire l'objet d'une autorisation, et
s'il faut la demander pour les journaux techniques de Vercel et GitHub (et pour Anthropic si la lecture IA est
activée).

## 6. Sécurité

- Accès à la base protégé par des règles par table (RLS) : le public ne peut lire que les fiches publiées et ne peut
  qu'ajouter (jamais lire) les événements, signalements, contributions et messages.
- Ajouts publics plafonnés par jour (événements, signalements, contributions, photos, messages).
- Clés serveur et secrets jamais embarqués dans les apps ; seule la clé publique est embarquée.
- Connexions chiffrées (HTTPS) ; en-têtes de sécurité sur le site (CSP, interdiction d'intégration dans une autre page).
- Suppression automatique des événements (13 mois), des messages (12 mois) et des compteurs de quotas (30 jours).
- Accès d'administration : compte Supabase du responsable.

## 7. Droits des personnes

Accès, rectification, opposition et suppression par le formulaire de contact. Comme il n'y a pas de compte, la
personne indique ce qui permet de retrouver ses données (code-barres, date, code du passeport). Réponse sous un mois.

## 8. Restant à faire avant le dépôt

1. Compléter l'adresse postale du responsable.
2. Suppression automatique des photos d'étiquettes après 12 mois (aujourd'hui annoncée, à faire à la main tant que la
   tâche n'est pas en place).
3. Joindre la page Confidentialité du site en annexe.
