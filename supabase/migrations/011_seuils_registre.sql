-- Notes A–E recalibrées sur la distribution réelle du registre officiel (audit du 5 novembre 2026).
--
-- Avant : 5 classes égales entre une référence « vertueuse » et le majorant par défaut d'Ecobalyse, que presque
-- aucune marque déclarée n'atteint : 48 % du registre était noté A et 82 % A ou B.
-- Désormais, pour chaque type de vêtement, les seuils sont les quantiles du coût environnemental (et de l'impact
-- climat) des vêtements déclarés au registre, ramenés au poids type :
--   A = les 10 % les mieux placés, B = jusqu'à 30 %, C = jusqu'à 60 %, D = jusqu'à 80 %, E = les 20 % restants.
-- Recalcul chaque mois, le lendemain de l'import du registre. Un type avec moins de 500 vêtements garde ses seuils.

-- Copie des seuils v1, pour pouvoir revenir en arrière si besoin (accès serveur uniquement)
create table if not exists public.grade_thresholds_v1 as table public.grade_thresholds;
alter table public.grade_thresholds_v1 enable row level security;
revoke all on public.grade_thresholds_v1 from anon, authenticated;
comment on table public.grade_thresholds_v1 is 'Seuils A–E v1 (avant recalibrage du 5 novembre 2026). Sauvegarde, accès serveur uniquement.';

create or replace function public.recalibrate_grade_thresholds()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  with r as (
    select c.eco_product,
           p.eco_cost * coalesce(case when p.eco_cost_100g > 0
             then public.eco_ref_mass(c.eco_product) * 10 * p.eco_cost_100g / p.eco_cost end, 1) as ecs,
           p.climate_kg * coalesce(case when p.eco_cost_100g > 0
             then public.eco_ref_mass(c.eco_product) * 10 * p.eco_cost_100g / p.eco_cost end, 1) as cch
    from public.registry_products p
    join public.registry_categories c on c.id = p.category_id
    where c.eco_product is not null and p.eco_cost > 0 and p.climate_kg > 0
  ), q as (
    select eco_product, count(*) as n,
           percentile_cont(array[0.1, 0.3, 0.6, 0.8]) within group (order by ecs) as e,
           percentile_cont(array[0.1, 0.3, 0.6, 0.8]) within group (order by cch) as c
    from r
    group by eco_product
    having count(*) >= 500
  )
  update public.grade_thresholds g
     set a_max = (case when g.metric = 'ecs' then q.e[1] else q.c[1] end)::numeric,
         b_max = (case when g.metric = 'ecs' then q.e[2] else q.c[2] end)::numeric,
         c_max = (case when g.metric = 'ecs' then q.e[3] else q.c[3] end)::numeric,
         d_max = (case when g.metric = 'ecs' then q.e[4] else q.c[4] end)::numeric,
         method = 'VeriTrace notes v2 : quantiles 10 / 30 / 60 / 80 % du registre officiel ('
                  || q.n || ' vêtements de ce type, à poids égal)',
         computed_at = now()
    from q
   where q.eco_product = g.eco_product
     and g.metric in ('ecs', 'cch');
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.recalibrate_grade_thresholds() from public, anon, authenticated;

select public.recalibrate_grade_thresholds();

select cron.schedule('veritrace-notes-recalibrage', '40 6 4 * *', 'select public.recalibrate_grade_thresholds()');
