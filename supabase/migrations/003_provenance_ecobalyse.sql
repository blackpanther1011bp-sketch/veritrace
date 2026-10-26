-- VeriTrace 003 : provenance des données et calcul des notes avec Ecobalyse
--
-- Circuit d'un produit réel :
--   1. on saisit (ou importe en CSV) une ligne dans product_drafts : composition, pays, source…
--   2. un déclencheur appelle la fonction « ecobalyse-score » (et une tâche planifiée la relance chaque minute)
--   3. la fonction interroge l'API Ecobalyse, calcule les notes A–E et publie le produit dans products
--   4. en cas de problème, la ligne passe en « erreur » avec un message lisible

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Mise à jour automatique de updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 1. Produits : d'où viennent les données, quelle fiabilité, quel calcul ------------------------

alter table public.products
  add column data_source text not null default 'demo'
    check (data_source in ('demo', 'marque', 'etiquette', 'estimation')),
  add column confidence text check (confidence in ('haute', 'moyenne', 'faible')),
  add column source_ref text check (source_ref is null or char_length(source_ref) <= 500),
  add column source_date date,
  add column env_grade text check (env_grade in ('A','B','C','D','E')),
  add column eco_cost numeric check (eco_cost is null or eco_cost >= 0),
  add column climate_kg numeric check (climate_kg is null or climate_kg >= 0),
  add column eco_web_url text check (eco_web_url is null or eco_web_url like 'https://ecobalyse.beta.gouv.fr/%'),
  add column methodology text,
  add column scored_at timestamptz,
  add column updated_at timestamptz not null default now();

-- Les 50 produits existants restent des données de démonstration ; tout nouveau produit doit déclarer sa source.
alter table public.products alter column data_source drop default;

comment on column public.products.data_source is 'demo (fictif), marque (données transmises par la marque), etiquette (relevé sur l''étiquette), estimation (valeurs par défaut)';
comment on column public.products.confidence is 'Fiabilité du calcul : haute, moyenne ou faible selon les informations connues';
comment on column public.products.env_grade is 'Note environnement issue du coût environnemental Ecobalyse (eco_cost)';
comment on column public.products.eco_cost is 'Coût environnemental Ecobalyse, en points d''impact';
comment on column public.products.climate_kg is 'Impact sur le changement climatique, en kg CO2e (Ecobalyse)';

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Paramètres économiques de la marque utilisés par Ecobalyse (durabilité non physique)
alter table public.brands
  add column eco_business text check (eco_business in ('small-business', 'large-business-with-services', 'large-business-without-services')),
  add column eco_references integer check (eco_references between 1 and 999999);

comment on column public.brands.eco_business is 'Ecobalyse : small-business (PME/TPE), large-business-with-services (grande entreprise avec réparation), large-business-without-services';
comment on column public.brands.eco_references is 'Ecobalyse : nombre de références au catalogue de la marque';

-- 2. Fiches à calculer (saisie ou import CSV depuis le tableau de bord Supabase) --------------------

create table public.product_drafts (
  ean text primary key check (ean ~ '^[0-9]{8,14}$'),
  brand_id text not null references public.brands(id),
  name text not null check (char_length(name) between 1 and 120),
  category text not null check (char_length(category) between 1 and 40),
  composition text not null check (char_length(composition) between 3 and 300),
  social_grade text not null check (social_grade in ('A','B','C','D','E')),
  data_source text not null check (data_source in ('marque', 'etiquette', 'estimation')),
  source_ref text check (source_ref is null or char_length(source_ref) <= 500),
  source_date date,
  mass_kg numeric check (mass_kg is null or mass_kg between 0.01 and 5),
  country_fabric text check (country_fabric is null or char_length(country_fabric) <= 40),
  country_dyeing text check (country_dyeing is null or char_length(country_dyeing) <= 40),
  country_making text check (country_making is null or char_length(country_making) <= 40),
  air_transport_ratio numeric check (air_transport_ratio is null or air_transport_ratio between 0 and 1),
  price_eur numeric check (price_eur is null or price_eur between 1 and 1000),
  transport text check (transport is null or char_length(transport) <= 80),
  eco_product text check (eco_product is null or eco_product in (
    'calecon', 'chaussettes', 'chemise', 'jean', 'jupe', 'maillot-de-bain', 'manteau', 'pantalon', 'pull', 'slip', 'tshirt'
  )),
  status text not null default 'a_calculer' check (status in ('a_calculer', 'en_cours', 'publie', 'erreur')),
  error text,
  attempts integer not null default 0,
  eco_query jsonb,
  claimed_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_drafts_status_idx on public.product_drafts (status, created_at);

comment on table public.product_drafts is 'Produits réels à calculer : une ligne = un code-barres. Statut a_calculer → publie (ou erreur avec message).';

-- Réservé à l'administration (tableau de bord) et à la fonction de calcul : aucune policy publique.
alter table public.product_drafts enable row level security;

-- Toute modification des informations du produit relance le calcul ; repasser une ligne
-- en « a_calculer » à la main remet aussi le compteur d'essais à zéro.
create or replace function public.product_drafts_requeue()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.brand_id, new.name, new.category, new.composition, new.social_grade, new.data_source,
      new.source_ref, new.source_date, new.mass_kg, new.country_fabric, new.country_dyeing,
      new.country_making, new.air_transport_ratio, new.price_eur, new.transport, new.eco_product)
     is distinct from
     (old.brand_id, old.name, old.category, old.composition, old.social_grade, old.data_source,
      old.source_ref, old.source_date, old.mass_kg, old.country_fabric, old.country_dyeing,
      old.country_making, old.air_transport_ratio, old.price_eur, old.transport, old.eco_product)
  then
    new.status := 'a_calculer';
  end if;
  if new.status = 'a_calculer' and old.status in ('publie', 'erreur') then
    new.attempts := 0;
    new.error := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger product_drafts_requeue
  before update on public.product_drafts
  for each row execute function public.product_drafts_requeue();

-- 3. Seuils des notes A–E par type de vêtement ------------------------------------------------------
-- Calculés automatiquement par la fonction à partir de deux références Ecobalyse
-- (voir docs/methode-notation.md). Supprimer une ligne force un nouveau calibrage.

create table public.grade_thresholds (
  eco_product text not null,
  metric text not null check (metric in ('ecs', 'cch')),
  best_ref numeric not null,
  worst_ref numeric not null,
  a_max numeric not null,
  b_max numeric not null,
  c_max numeric not null,
  d_max numeric not null,
  method text not null,
  computed_at timestamptz not null default now(),
  primary key (eco_product, metric),
  check (best_ref < worst_ref and a_max < b_max and b_max < c_max and c_max < d_max)
);

alter table public.grade_thresholds enable row level security;
create policy "Seuils des notes lisibles par tous"
  on public.grade_thresholds for select to anon, authenticated using (true);

-- 4. Lancement automatique du calcul -----------------------------------------------------------------

create table public.scoring_state (
  id boolean primary key default true check (id),
  last_kick_at timestamptz
);
insert into public.scoring_state (id) values (true);
alter table public.scoring_state enable row level security;

-- Appelle la fonction de calcul s'il reste des fiches à calculer (au plus une fois toutes les 45 s).
-- Les fiches bloquées en « en_cours » depuis plus de 5 minutes sont remises en file (3 essais maximum).
create or replace function public.kick_scoring(force boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last timestamptz;
begin
  update public.product_drafts
     set status = case when attempts >= 3 then 'erreur' else 'a_calculer' end,
         error = case when attempts >= 3 then 'Calcul interrompu 3 fois : réessayez plus tard' else error end,
         claimed_at = null
   where status = 'en_cours' and claimed_at < now() - interval '5 minutes';

  if not exists (select 1 from public.product_drafts where status = 'a_calculer') then
    return false;
  end if;

  select last_kick_at into v_last from public.scoring_state where id for update;
  if not force and v_last is not null and v_last > now() - interval '45 seconds' then
    return false;
  end if;
  update public.scoring_state set last_kick_at = now() where id;

  -- Clé « anon » : publique par conception (déjà présente dans les applications).
  perform net.http_post(
    url := 'https://vqegfoncyrqivtrbvorg.supabase.co/functions/v1/ecobalyse-score',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZWdmb25jeXJxaXZ0cmJ2b3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMDk3NjksImV4cCI6MjEwODU4NTc2OX0.T5qnXXvEIk7fjOU7GInZGLp-GQfxBOD7JZ3bV95p4qM'
    ),
    timeout_milliseconds := 150000
  );
  return true;
end;
$$;

revoke execute on function public.kick_scoring(boolean) from public, anon, authenticated;

-- Déclencheur : dès qu'une instruction laisse des fiches « a_calculer », on lance le calcul.
create or replace function public.product_drafts_kick()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  if exists (select 1 from new_rows where status = 'a_calculer') then
    perform public.kick_scoring();
  end if;
  return null;
end;
$$;

revoke execute on function public.product_drafts_kick() from public, anon, authenticated;

create trigger product_drafts_kick_insert
  after insert on public.product_drafts
  referencing new table as new_rows
  for each statement execute function public.product_drafts_kick();

create trigger product_drafts_kick_update
  after update on public.product_drafts
  referencing new table as new_rows
  for each statement execute function public.product_drafts_kick();

-- Filet de sécurité : relance chaque minute (gros imports, Ecobalyse momentanément indisponible).
select cron.schedule('veritrace-scoring', '* * * * *', $$select public.kick_scoring()$$);
