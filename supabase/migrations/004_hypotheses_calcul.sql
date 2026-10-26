-- VeriTrace 004 : hypothèses du calcul, visibles dans l'app et dans la file de calcul

-- Hypothèses retenues pour un produit (pays inconnu, poids type, matière approchée…)
alter table public.products
  add column assumptions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(assumptions) = 'array');

-- Même information côté saisie, lisible dans le tableau de bord
alter table public.product_drafts
  add column notes text;
