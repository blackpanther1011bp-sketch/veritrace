-- Fiches du registre officiel : nom lisible (type de vêtement) au lieu de la référence interne de la marque
-- (ex. « ACT42 BLACK_WH »), qui reste disponible dans le champ reference et s'affiche en petit dans les apps.

create or replace function public.registry_product_json(p_gtin text, p_ean text default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with r as (
    select p.*, b.name as brand_name, c.label as category_label, c.eco_product,
           -- facteur pour ramener l'article au poids type (à poids égal) : coût/100 g × 10 × poids type
           case when p.eco_cost_100g > 0 then public.eco_ref_mass(c.eco_product) * 10 * p.eco_cost_100g / p.eco_cost end as k
      from public.registry_products p
      join public.registry_brands b on b.id = p.brand_id
      join public.registry_categories c on c.id = p.category_id
     where p.gtin = p_gtin and c.eco_product is not null
  ),
  g as (
    select r.*,
           public.grade_for(r.eco_cost * coalesce(r.k, 1), r.eco_product, 'ecs') as env_grade,
           public.grade_for(r.climate_kg * coalesce(r.k, 1), r.eco_product, 'cch') as carbon_grade
      from r
  )
  select jsonb_build_object(
           'ean', coalesce(p_ean, g.gtin),
           -- nom lisible : le type de vêtement (« Jean », « T-shirt / Polo »…) ; la référence interne de la marque à part
           'name', regexp_replace(g.category_label, '\s*\(.*\)\s*$', ''),
           'reference', nullif(g.reference, ''),
           'category', public.vt_category(g.eco_product),
           'origin_country', 'Non publié',
           'composition', 'Non publiée par le registre',
           'transport', 'Non publié',
           'carbon_grade', g.carbon_grade,
           'env_grade', g.env_grade,
           'social_grade', null,
           'global_grade', g.env_grade,
           'carbon_breakdown', public.registry_breakdown(g.stages),
           'is_sample', false,
           'data_source', 'registre',
           'confidence', null,
           'source_ref', 'Registre officiel de l''affichage environnemental (data.gouv.fr)',
           'source_date', g.declared_at,
           'eco_cost', round(g.eco_cost::numeric, 1),
           'climate_kg', round(g.climate_kg::numeric, 2),
           'eco_web_url', 'https://affichage-environnemental.ecobalyse.beta.gouv.fr/produits/' || g.gtin,
           'assumptions', '[]'::jsonb,
           'methodology', 'Coût déclaré par la marque au registre officiel (méthode Ecobalyse) · VeriTrace notes v1',
           'scored_at', g.declared_at,
           'brand', jsonb_build_object(
             'id', 'registre-' || g.brand_id, 'name', g.brand_name, 'kind', 'non_classee',
             'country', '', 'social_checks', '[]'::jsonb))
    from g
   where g.env_grade is not null and g.carbon_grade is not null
$$;
