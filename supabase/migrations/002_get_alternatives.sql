-- Alternatives : même catégorie, note globale strictement meilleure,
-- marques responsables ou seconde main uniquement
create or replace function public.get_alternatives(p_ean text)
returns setof public.products
language sql
stable
security invoker
set search_path = ''
as $$
  select a.*
  from public.products p
  join public.products a
    on a.category = p.category
   and a.global_grade < p.global_grade
  join public.brands b
    on b.id = a.brand_id
   and b.kind in ('responsable', 'seconde_main')
  where p.ean = p_ean
  order by a.global_grade, b.kind, a.name;
$$;

grant execute on function public.get_alternatives(text) to anon, authenticated;
