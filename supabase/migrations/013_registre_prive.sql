-- Registre officiel : plus de lecture directe par l'API publique (audit du 5 novembre 2026, point 21).
--
-- Avant : la table registry_products (568 000 vêtements) était lisible par tous : on pouvait l'aspirer en entier ou
-- lancer des requêtes sur des colonnes non indexées, qui parcourent toute la table.
-- Désormais, les apps passent seulement par get_product et get_alternatives_json (ce qu'elles font déjà) : les deux
-- fonctions qui lisent le registre s'exécutent avec les droits du propriétaire, et la table n'est plus lisible
-- directement. Les tables marques et catégories (petites) restent lisibles.

alter function public.registry_product_json(text, text) security definer;
alter function public.get_alternatives_json(text) security definer;

drop policy if exists "Registre : produits lisibles par tous" on public.registry_products;
revoke select on public.registry_products from anon, authenticated;
revoke select on public.registry_jobs, public.registry_batches from anon, authenticated;

comment on table public.registry_products is 'Registre officiel de l''affichage environnemental. Lecture publique seulement par get_product et get_alternatives_json.';
