-- Note sociale sourcée, méthode v1 (docs/methode-note-sociale.md, audit du 5 novembre 2026, point 30).
--
-- Règle « pas de source, pas de note » : une marque n'a une note sociale que si VeriTrace a vérifié les trois critères
-- ci-dessous, chacun avec une source publique datée. Sinon la note sociale est « non évaluée » (null) et la note
-- globale est la note environnement seule.
--
--   usines     : liste des usines publiée par la marque              oui 2 · partiel 1 · non démontré 0
--   controle   : contrôle indépendant des usines (Fair Wear, FLA)     oui 2 · partiel 1 · non démontré 0
--   entreprise : certification sociale de l'entreprise (B Corp)      oui 1 ·             non démontré 0
--   Total sur 5 : 5 = A, 4 = B, 3 = C, 2 = D, 0-1 = E.
--
-- « Non démontré » : VeriTrace n'a trouvé aucune preuve publique (ou seulement une preuve de plus de 5 ans) à la date
-- de vérification. La note mesure ce que la marque rend public et vérifiable, pas les conditions de travail elles-mêmes.

-- 1. Preuves ------------------------------------------------------------------------------------------------
create table if not exists public.brand_social_evidence (
  id bigint generated always as identity primary key,
  registry_brand_id smallint references public.registry_brands (id) on delete cascade,
  brand_id text references public.brands (id) on delete cascade,
  criterion text not null check (criterion in ('usines', 'controle', 'entreprise')),
  status text not null check (status in ('oui', 'partiel', 'non_demontre')),
  detail text not null check (char_length(detail) between 5 and 300),
  source_url text not null check (source_url ~ '^https://'),
  source_title text not null check (char_length(source_title) between 3 and 200),
  -- date du document source (année, mois ou jour) ; null si la page n'est pas datée
  source_period text check (source_period is null or source_period ~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$'),
  checked_at date not null,
  check ((registry_brand_id is null) <> (brand_id is null)),
  check (status <> 'partiel' or criterion <> 'entreprise')
);
create unique index if not exists brand_social_evidence_registry_uq
  on public.brand_social_evidence (registry_brand_id, criterion) where registry_brand_id is not null;
create unique index if not exists brand_social_evidence_brand_uq
  on public.brand_social_evidence (brand_id, criterion) where brand_id is not null;

alter table public.brand_social_evidence enable row level security;
drop policy if exists "Preuves sociales lisibles par tous" on public.brand_social_evidence;
create policy "Preuves sociales lisibles par tous" on public.brand_social_evidence
  for select to anon, authenticated using (true);
comment on table public.brand_social_evidence is
  'Note sociale VeriTrace v1 : une preuve publique datée par critère et par marque (docs/methode-note-sociale.md).';

-- 2. Calcul -------------------------------------------------------------------------------------------------
-- Note globale : moyenne des rangs environnement et social, arrondie vers la meilleure lettre (comme combineGlobal
-- dans core.ts) ; sans note sociale, la note environnement seule.
create or replace function public.combine_global(p_env text, p_social text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
           when p_env is null then null
           when p_social is null then p_env
           else substr('ABCDE',
                       ceil(((strpos('ABCDE', p_env) - 1) + (strpos('ABCDE', p_social) - 1)) / 2.0 - 0.5)::int + 1,
                       1)
         end
$$;

-- Note sociale et critères sourcés d'une marque du registre : {"grade": "B" | null, "checks": [...]}
create or replace function public.registry_social(p_registry_brand_id smallint)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with e as (
    select ev.*,
           case ev.criterion when 'usines' then 1 when 'controle' then 2 else 3 end as rang,
           case
             when ev.criterion in ('usines', 'controle') and ev.status = 'oui' then 2
             when ev.criterion in ('usines', 'controle') and ev.status = 'partiel' then 1
             when ev.criterion = 'entreprise' and ev.status = 'oui' then 1
             else 0
           end as points
      from public.brand_social_evidence ev
     where ev.registry_brand_id = p_registry_brand_id
  )
  select jsonb_build_object(
           'grade', case when (select count(distinct criterion) from e) = 3 then
                      case (select sum(points) from e)
                        when 5 then 'A' when 4 then 'B' when 3 then 'C' when 2 then 'D' else 'E'
                      end
                    end,
           'checks', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'label', case e.criterion
                                 when 'usines' then 'Liste des usines publiée'
                                 when 'controle' then 'Contrôle indépendant des usines (Fair Wear, Fair Labor Association)'
                                 else 'Certification sociale de l''entreprise (B Corp)'
                               end,
                      'status', e.status,
                      'detail', e.detail,
                      'source_url', e.source_url,
                      'source_title', e.source_title,
                      'source_period', e.source_period,
                      'checked_at', e.checked_at) order by e.rang)
               from e), '[]'::jsonb))
$$;

-- 3. Fiche d'un vêtement du registre : note sociale et critères sourcés de sa marque -------------------------
-- Reprise exacte de la définition en place (migration 013 : SECURITY DEFINER conservé), avec :
--   social_grade / global_grade / brand.social_checks issus des preuves ; méthode « VeriTrace notes v2 ».
create or replace function public.registry_product_json(p_gtin text, p_ean text default null::text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
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
           public.grade_for(r.climate_kg * coalesce(r.k, 1), r.eco_product, 'cch') as carbon_grade,
           public.registry_social(r.brand_id) as social
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
           'social_grade', g.social->>'grade',
           'global_grade', public.combine_global(g.env_grade, g.social->>'grade'),
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
           'methodology', 'Coût déclaré par la marque au registre officiel (méthode Ecobalyse) · VeriTrace notes v2'
                          || case when g.social->>'grade' is not null then ' · note sociale VeriTrace v1 (sources publiques)' else '' end,
           'scored_at', g.declared_at,
           'brand', jsonb_build_object(
             'id', 'registre-' || g.brand_id, 'name', g.brand_name, 'kind', 'non_classee',
             'country', '', 'social_checks', g.social->'checks'))
    from g
   where g.env_grade is not null and g.carbon_grade is not null
$function$;

-- 4. Preuves vérifiées le 5 novembre 2026 (seulement des sources publiques ouvertes ; voir la méthode) ---------
-- Insertion par nom de marque du registre : rien n'est inséré si la marque n'y figure pas.
insert into public.brand_social_evidence
  (registry_brand_id, criterion, status, detail, source_url, source_title, source_period, checked_at)
select b.id, v.criterion, v.status, v.detail, v.source_url, v.source_title, v.source_period, date '2026-11-05'
  from (values
    -- ARMEDANGELS
    ('ARMEDANGELS', 'usines', 'oui',
     'Fournisseurs couvrant 100 % des achats publiés sur le site de Fair Wear (constat de l''évaluation 2022).',
     'https://api.fairwear.org/wp-content/uploads/2022/10/BPC-Social-Fashion-Company-GmbH-ARMEDANGELS-2022.pdf',
     'Fair Wear – Brand Performance Check ARMEDANGELS 2022', '2022-08'),
    ('ARMEDANGELS', 'controle', 'oui',
     'Membre de Fair Wear depuis 2015 ; dernière évaluation publiée en 2026 (score 85/100).',
     'https://www.fairwear.org/brands/armedangels/',
     'Fair Wear – fiche de la marque ARMEDANGELS', '2026-09'),
    ('ARMEDANGELS', 'entreprise', 'non_demontre',
     'Aucune certification B Corp trouvée dans l''annuaire de B Lab.',
     'https://www.bcorporation.net/en-us/find-a-b-corp/',
     'B Lab – annuaire des B Corp', null),
    -- ODLO (marque du groupe Odlo International AG)
    ('ODLO FRANCE', 'usines', 'oui',
     'Odlo publie la liste de ses sites de production sur son site (constat de Fair Wear, évaluation 2023-2024).',
     'https://api.fairwear.org/wp-content/uploads/2025/04/Odlo-Performance-Check-2024-1.pdf',
     'Fair Wear – Performance Check Odlo 2024', '2025-04'),
    ('ODLO FRANCE', 'controle', 'oui',
     'Membre de Fair Wear ; dernière évaluation publiée en 2026 (score 75/100).',
     'https://www.fairwear.org/brands/odlo/',
     'Fair Wear – fiche de la marque Odlo', '2026-03'),
    ('ODLO FRANCE', 'entreprise', 'non_demontre',
     'Aucune certification B Corp trouvée dans l''annuaire de B Lab.',
     'https://www.bcorporation.net/en-us/find-a-b-corp/',
     'B Lab – annuaire des B Corp', null),
    -- GILDAN
    ('GILDAN ACTIVEWEAR', 'usines', 'partiel',
     'Usines du groupe et une sélection de sous-traitants publiées (carte et tableau téléchargeable), pas tous les sous-traitants.',
     'https://gildancorp.com/en/company/our-factories/',
     'Gildan – Our factories', null),
    ('GILDAN ACTIVEWEAR', 'controle', 'oui',
     'Programme social accrédité par la Fair Labor Association (accréditation en 2007, renouvelée en 2019).',
     'https://fairlabor.org/affiliates/participating-companies',
     'Fair Labor Association – entreprises participantes', '2026-02'),
    ('GILDAN ACTIVEWEAR', 'entreprise', 'non_demontre',
     'Aucune certification B Corp trouvée dans l''annuaire de B Lab.',
     'https://www.bcorporation.net/en-us/find-a-b-corp/',
     'B Lab – annuaire des B Corp', null),
    -- VEJA
    ('VEJA FAIR TRADE S.A.R.L.', 'usines', 'partiel',
     'Pays et régions de production indiqués (Brésil, Portugal), sans le nom ni l''adresse des usines.',
     'https://project.veja-store.com/en/single/production',
     'VEJA – Production', null),
    ('VEJA FAIR TRADE S.A.R.L.', 'controle', 'non_demontre',
     'Aucune preuve trouvée d''un contrôle des usines par Fair Wear ou la Fair Labor Association.',
     'https://www.fairwear.org/brands-we-work-with',
     'Fair Wear – marques membres', null),
    ('VEJA FAIR TRADE S.A.R.L.', 'entreprise', 'oui',
     'Entreprise certifiée B Corp (annuaire de B Lab).',
     'https://www.bcorporation.net/en-us/find-a-b-corp/company/veja',
     'B Lab – fiche VEJA', null),
    -- NOBODY'S CHILD
    ('NOBODY''S CHILD LIMITED', 'usines', 'oui',
     'Liste des partenaires de fabrication publiée (noms et pays), mise à jour en novembre 2025.',
     'https://www.nobodyschild.com/pages/sustainability-supplypartners',
     'Nobody''s Child – Supply partners', '2025-11'),
    ('NOBODY''S CHILD LIMITED', 'controle', 'non_demontre',
     'Aucune preuve trouvée d''un contrôle des usines par Fair Wear ou la Fair Labor Association.',
     'https://www.fairwear.org/brands-we-work-with',
     'Fair Wear – marques membres', null),
    ('NOBODY''S CHILD LIMITED', 'entreprise', 'oui',
     'Certifiée B Corp depuis novembre 2025 (score 100,6).',
     'https://www.bcorporation.net/find-a-b-corp/company/nobodys-child',
     'B Lab – fiche Nobody''s Child', '2025-11'),
    -- PICTURE ORGANIC CLOTHING
    ('PICTURE ORGANIC CLOTHING', 'usines', 'oui',
     'Usines publiées avec leur nom et leur ville (Turquie, Chine, Vietnam, Portugal, France…).',
     'https://eco.picture-organic-clothing.com/en/suppliers',
     'Picture – Where are our products made?', null),
    ('PICTURE ORGANIC CLOTHING', 'controle', 'non_demontre',
     'Dernière évaluation Fair Wear publiée en 2019 : plus de 5 ans, elle ne compte plus.',
     'https://api.fairwear.org/wp-content/uploads/2019/08/picture-organic-clothing-performance-check-2019-Final.pdf',
     'Fair Wear – Brand Performance Check Picture 2019', '2019-08'),
    ('PICTURE ORGANIC CLOTHING', 'entreprise', 'oui',
     'Certifiée B Corp depuis novembre 2019 (annuaire de B Lab).',
     'https://www.bcorporation.net/en-us/find-a-b-corp/company/picture-organic-clothing',
     'B Lab – fiche Picture Organic Clothing', '2019-11')
  ) as v (brand_name, criterion, status, detail, source_url, source_title, source_period)
  join public.registry_brands b on b.name = v.brand_name
on conflict do nothing;
