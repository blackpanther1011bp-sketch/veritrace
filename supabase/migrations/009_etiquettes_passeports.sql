-- Deux nouveautés :
--  1. Lecture d'étiquette : un utilisateur photographie l'étiquette cousue d'un vêtement (composition,
--     « Made in »), la fonction « outils » la lit (sur le téléphone ou par IA) et calcule la note avec
--     Ecobalyse. Avec un code-barres, le résultat est publié pour les utilisateurs suivants (« non vérifié »).
--  2. Passeport numérique : un fabricant (ex. usine marocaine qui exporte vers l'Europe) saisit les données
--     d'un produit et obtient son coût environnemental officiel, une page publique et un QR code.
--
-- Écritures : uniquement par la fonction « outils » (connexion serveur). Lecture publique des résultats.

-- 1. Réglages et quotas ------------------------------------------------------------------------------

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  note text
);
alter table public.app_settings enable row level security;

insert into public.app_settings (key, value, note) values
  ('etiquette_ia_par_jour', '300', 'Lectures d''étiquette par IA par jour, tous utilisateurs confondus (protège le budget de la clé IA)'),
  ('etiquette_par_appareil_par_jour', '40', 'Lectures d''étiquette par jour pour une même connexion (anti-abus)'),
  ('etiquette_publication_auto', 'true', 'true : une étiquette lue avec un code-barres est publiée aussitôt, marquée « non vérifiée » ; false : le résultat n''est montré qu''à la personne qui a pris la photo'),
  ('passeports_par_jour', '200', 'Passeports créés par jour, tous fabricants confondus')
on conflict (key) do nothing;

create table public.usage_counters (
  day date not null default current_date,
  bucket text not null,
  n int not null default 0,
  primary key (day, bucket)
);
alter table public.usage_counters enable row level security;

-- Prend une unité de quota ; faux si la limite du jour est atteinte.
create or replace function public.take_quota(p_bucket text, p_limit int)
returns boolean
language sql
volatile
set search_path = ''
as $$
  with up as (
    insert into public.usage_counters as u (day, bucket, n)
    select current_date, p_bucket, 1 where p_limit > 0
    on conflict (day, bucket) do update set n = u.n + 1 where u.n < p_limit
    returning n
  )
  select exists (select 1 from up)
$$;
revoke execute on function public.take_quota(text, int) from public, anon, authenticated;

-- 2. Lectures d'étiquettes ---------------------------------------------------------------------------

create table public.label_readings (
  id uuid primary key default gen_random_uuid(),
  -- identifiant public court, utilisé quand le vêtement n'a pas de code-barres (ex. L3fa09c1b27de)
  code text not null unique default ('L' || substr(md5(gen_random_uuid()::text), 1, 12)) check (code ~ '^L[0-9a-f]{12}$'),
  ean text check (ean is null or ean ~ '^[0-9]{8,14}$'),
  brand_name text check (brand_name is null or length(brand_name) <= 80),
  name text not null,
  category text not null,
  eco_product text not null,
  composition text not null,
  country_making text,
  method text not null check (method in ('texte', 'ia')),
  model text,
  extracted jsonb not null default '{}'::jsonb,
  confidence text not null check (confidence in ('haute', 'moyenne', 'faible')),
  eco_cost real not null,
  climate_kg real not null,
  env_grade text not null check (env_grade in ('A','B','C','D','E')),
  carbon_grade text not null check (carbon_grade in ('A','B','C','D','E')),
  carbon_breakdown jsonb not null,
  eco_web_url text check (eco_web_url is null or eco_web_url like 'https://ecobalyse.beta.gouv.fr/%'),
  assumptions jsonb not null default '[]'::jsonb,
  methodology text,
  photo_path text,
  status text not null default 'publie' check (status in ('publie', 'masque')),
  created_at timestamptz not null default now()
);
comment on table public.label_readings is
  'Étiquettes photographiées et notées. Pour retirer une lecture erronée : status = masque.';
create index label_readings_ean_idx on public.label_readings (ean, created_at desc) where status = 'publie' and ean is not null;

alter table public.label_readings enable row level security;
create policy "Lectures d'étiquettes publiées lisibles par tous"
  on public.label_readings for select to anon, authenticated using (status = 'publie');

-- Fiche au format des apps pour une lecture d'étiquette (par son code L…)
create or replace function public.label_product_json(p_code text, p_ean text default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
           'ean', coalesce(p_ean, r.ean, r.code),
           'name', r.name,
           'category', r.category,
           'origin_country', coalesce(nullif(r.country_making, ''), 'Non indiqué'),
           'composition', r.composition,
           'transport', 'Non indiqué',
           'carbon_grade', r.carbon_grade,
           'env_grade', r.env_grade,
           'social_grade', null,
           'global_grade', r.env_grade,
           'carbon_breakdown', r.carbon_breakdown,
           'is_sample', false,
           'data_source', 'etiquette',
           'confidence', r.confidence,
           'source_ref', case r.method
                           when 'ia' then 'Étiquette photographiée par un utilisateur, lue par IA (non vérifiée)'
                           else 'Étiquette photographiée par un utilisateur, lue sur le téléphone (non vérifiée)'
                         end,
           'source_date', to_char(r.created_at, 'YYYY-MM-DD'),
           'eco_cost', r.eco_cost,
           'climate_kg', r.climate_kg,
           'eco_web_url', r.eco_web_url,
           'assumptions', r.assumptions,
           'methodology', r.methodology,
           'scored_at', r.created_at,
           'eco_product', r.eco_product,
           'label_code', r.code,
           'brand', jsonb_build_object(
             'id', 'etiquette', 'name', coalesce(nullif(r.brand_name, ''), 'Marque non indiquée'),
             'kind', 'non_classee', 'country', '', 'social_checks', '[]'::jsonb))
    from public.label_readings r
   where r.code = p_code and r.status = 'publie'
$$;

-- 3. Passeports numériques ---------------------------------------------------------------------------

create table public.passports (
  id text primary key check (id ~ '^[0-9a-f]{12}$'),
  gtin text check (gtin is null or gtin ~ '^[0-9]{8,14}$'),
  company text not null check (length(company) between 2 and 120),
  city text check (city is null or length(city) <= 80),
  country text not null default 'Maroc',
  product_name text not null check (length(product_name) between 2 and 120),
  reference text check (reference is null or length(reference) <= 80),
  category text not null,
  eco_product text not null,
  composition text not null,
  mass_kg real not null check (mass_kg > 0 and mass_kg < 10),
  country_spinning text,
  country_fabric text,
  country_dyeing text,
  country_making text not null,
  air_transport_ratio real check (air_transport_ratio is null or air_transport_ratio between 0 and 1),
  eco_query jsonb not null,
  eco_cost real not null,
  climate_kg real not null,
  env_grade text not null check (env_grade in ('A','B','C','D','E')),
  carbon_grade text not null check (carbon_grade in ('A','B','C','D','E')),
  carbon_breakdown jsonb not null,
  stages jsonb not null,
  eco_web_url text,
  assumptions jsonb not null default '[]'::jsonb,
  confidence text not null check (confidence in ('haute', 'moyenne', 'faible')),
  methodology text not null,
  -- vérifié par l'équipe VeriTrace : seul un passeport vérifié apparaît quand on scanne le code-barres
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.passports is
  'Passeports créés par des fabricants. verified = true après vérification : le produit devient alors scannable dans l''app.';
create index passports_gtin_idx on public.passports (gtin, created_at desc) where verified and gtin is not null;

alter table public.passports enable row level security;
create policy "Passeports lisibles par tous (page publique)"
  on public.passports for select to anon, authenticated using (true);

-- Fiche au format des apps pour un passeport vérifié
create or replace function public.passport_product_json(p_id text, p_ean text default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
           'ean', coalesce(p_ean, p.gtin),
           'name', p.product_name,
           'category', p.category,
           'origin_country', p.country_making,
           'composition', p.composition,
           'transport', case
                          when p.air_transport_ratio is null then 'Non communiqué'
                          when p.air_transport_ratio = 0 then 'Sans avion'
                          when p.air_transport_ratio >= 1 then 'Avion'
                          else 'Avion pour ' || round(p.air_transport_ratio * 100) || ' %'
                        end,
           'carbon_grade', p.carbon_grade,
           'env_grade', p.env_grade,
           'social_grade', null,
           'global_grade', p.env_grade,
           'carbon_breakdown', p.carbon_breakdown,
           'is_sample', false,
           'data_source', 'marque',
           'confidence', p.confidence,
           'source_ref', 'Passeport numérique déclaré par le fabricant ' || p.company || ' (vérifié par VeriTrace)',
           'source_date', to_char(p.created_at, 'YYYY-MM-DD'),
           'eco_cost', p.eco_cost,
           'climate_kg', p.climate_kg,
           'eco_web_url', p.eco_web_url,
           'assumptions', p.assumptions,
           'methodology', p.methodology,
           'scored_at', p.created_at,
           'eco_product', p.eco_product,
           'mass_kg', p.mass_kg,
           'passport_id', p.id,
           'reference', p.reference,
           'brand', jsonb_build_object(
             'id', 'fabricant', 'name', p.company, 'kind', 'non_classee',
             'country', p.country, 'social_checks', '[]'::jsonb))
    from public.passports p
   where p.id = p_id and p.verified
$$;

-- 4. Recherche d'un code : catalogue VeriTrace, registre officiel, passeport vérifié, étiquette lue -------

create or replace function public.get_product(p_ean text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v jsonb;
  v_gtin text;
  v_id text;
begin
  if p_ean ~ '^L[0-9a-f]{12}$' then
    return public.label_product_json(p_ean);
  end if;
  if p_ean is null or p_ean !~ '^[0-9]{8,14}$' then
    return null;
  end if;
  select to_jsonb(p) || jsonb_build_object('brand', jsonb_build_object(
           'id', b.id, 'name', b.name, 'kind', b.kind, 'country', b.country, 'social_checks', b.social_checks))
    into v
    from public.products p
    join public.brands b on b.id = p.brand_id
   where p.ean = p_ean;
  if v is not null then
    return v;
  end if;

  v_gtin := case when length(p_ean) < 13 then lpad(p_ean, 13, '0') else p_ean end;
  v := public.registry_product_json(v_gtin, p_ean);
  if v is not null then
    return v;
  end if;

  select p.id into v_id
    from public.passports p
   where p.verified and p.gtin in (p_ean, v_gtin)
   order by p.created_at desc
   limit 1;
  if v_id is not null then
    return public.passport_product_json(v_id, p_ean);
  end if;

  select r.code into v_id
    from public.label_readings r
   where r.status = 'publie' and r.ean in (p_ean, v_gtin)
   order by r.created_at desc
   limit 1;
  if v_id is not null then
    return public.label_product_json(v_id, p_ean);
  end if;
  return null;
end;
$$;

-- Alternatives : mêmes règles qu'en 007, étendues aux étiquettes lues et aux passeports
create or replace function public.get_alternatives_json(p_ean text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_cur jsonb;
  v_eco text;
  v_grade text;
  v_mass numeric;
  v_ref numeric;
  v_bound double precision;
  v_out jsonb;
begin
  v_cur := public.get_product(p_ean);
  if v_cur is null then
    return '[]'::jsonb;
  end if;

  if v_cur->>'data_source' = 'demo' then
    select coalesce(jsonb_agg(public.get_product(a.ean) order by a.global_grade, a.name), '[]'::jsonb)
      into v_out
      from public.get_alternatives(p_ean) a;
    return v_out;
  end if;

  -- Type Ecobalyse, note environnement et poids de l'article actuel
  if v_cur ? 'eco_product' then
    -- étiquette lue ou passeport : poids déclaré, sinon poids type
    v_eco := v_cur->>'eco_product';
    v_mass := coalesce((v_cur->>'mass_kg')::numeric, public.eco_ref_mass(v_eco));
  elsif v_cur->>'data_source' = 'registre' then
    select c.eco_product,
           case when p.eco_cost_100g > 0 then p.eco_cost / p.eco_cost_100g / 10 end
      into v_eco, v_mass
      from public.registry_products p join public.registry_categories c on c.id = p.category_id
     where p.gtin = case when length(p_ean) < 13 then lpad(p_ean, 13, '0') else p_ean end;
  else
    select coalesce(d.eco_product, (d.eco_query->>'product')), (d.eco_query->>'mass')::numeric
      into v_eco, v_mass
      from public.product_drafts d where d.ean = p_ean;
  end if;
  v_grade := coalesce(v_cur->>'env_grade', v_cur->>'global_grade');
  if v_eco is null or v_grade is null or v_grade = 'A' then
    return '[]'::jsonb;
  end if;

  -- Seuil (à poids égal) de la note juste au-dessus, converti en coût pour 100 g
  select case v_grade when 'B' then t.a_max when 'C' then t.b_max when 'D' then t.c_max else t.d_max end
    into v_bound
    from public.grade_thresholds t where t.eco_product = v_eco and t.metric = 'ecs';
  v_ref := public.eco_ref_mass(v_eco);
  if v_bound is null or v_ref is null then
    return '[]'::jsonb;
  end if;

  with cand as (
    select p.gtin, p.brand_id, p.reference, p.eco_cost_100g
      from public.registry_products p
     where p.category_id in (select id from public.registry_categories where eco_product = v_eco)
       and p.eco_cost_100g > 0
       and p.eco_cost_100g <= v_bound / (10 * v_ref)
       and (v_mass is null or (p.eco_cost / p.eco_cost_100g / 10) between v_mass * 0.6 and v_mass * 1.4)
     order by p.eco_cost_100g
     limit 400
  ),
  uniq as (
    select distinct on (brand_id, coalesce(reference, gtin)) gtin, eco_cost_100g
      from cand
     order by brand_id, coalesce(reference, gtin), eco_cost_100g
  ),
  best as (
    select gtin, eco_cost_100g from uniq order by eco_cost_100g limit 8
  )
  select coalesce(jsonb_agg(j order by b.eco_cost_100g), '[]'::jsonb)
    into v_out
    from best b
    cross join lateral public.registry_product_json(b.gtin) j
   where j is not null;
  return v_out;
end;
$$;

grant execute on function public.label_product_json(text, text) to anon, authenticated;
grant execute on function public.passport_product_json(text, text) to anon, authenticated;
grant execute on function public.get_product(text) to anon, authenticated;
grant execute on function public.get_alternatives_json(text) to anon, authenticated;

-- 5. Événements d'usage : nouveaux types, codes L… acceptés --------------------------------------------

alter table public.events drop constraint if exists events_event_check;
alter table public.events add constraint events_event_check check (event in (
  'scan', 'product_view', 'not_found', 'details_view', 'alternatives_view',
  'premium_view', 'premium_start', 'report_sent', 'exit_after_bad_grade',
  'contribution_start', 'contribution_sent',
  'label_start', 'label_read', 'label_failed', 'passport_created', 'passport_view'
));

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.events'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%(ean ~ %'
  loop
    execute format('alter table public.events drop constraint %I', c);
  end loop;
end $$;
alter table public.events add constraint events_ean_check
  check (ean is null or ean ~ '^([0-9]{8,14}|L[0-9a-f]{12})$');
