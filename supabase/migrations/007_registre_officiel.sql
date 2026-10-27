-- VeriTrace 007 : registre officiel « Affichage environnemental des vêtements » (data.gouv.fr)
--
-- Chaque mois, GitHub Actions découpe le registre (plus de 570 000 codes-barres déclarés par les
-- marques) en blocs JSON publiés dans la branche donnees-affichage-env du dépôt public.
-- Supabase vérifie chaque jour s'il y a un nouveau lot, puis télécharge et importe les blocs lui-même
-- (pg_net + pg_cron) : aucun secret à partager.
--
-- Les apps cherchent un code-barres avec get_product : produits VeriTrace d'abord, puis registre.

-- 1. Données -----------------------------------------------------------------------------------------

create table public.registry_brands (
  id smallint generated always as identity primary key,
  name text not null unique
);

create table public.registry_categories (
  id smallint generated always as identity primary key,
  label text not null unique,       -- libellé du registre, ex. « T-shirt / Polo »
  eco_product text                  -- type Ecobalyse (tshirt…) ; null pour « Lot de produits »
);

create table public.registry_batches (
  id int generated always as identity primary key,
  batch text not null unique,       -- identifiant du lot (manifeste)
  manifest jsonb not null,
  status text not null default 'en_cours' check (status in ('en_cours', 'termine', 'erreur')),
  rows_loaded int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.registry_products (
  gtin text primary key check (gtin ~ '^[0-9]{13,14}$'),
  brand_id smallint not null references public.registry_brands(id),
  category_id smallint not null references public.registry_categories(id),
  reference text,
  eco_cost real not null,           -- coût environnemental déclaré (points d'impact, par article)
  eco_cost_100g real,               -- coût pour 100 g
  durability real,
  climate_kg real,                  -- changement climatique (kg CO2e, par article)
  stages real[] not null,           -- coût par étape (ordre du manifeste, avant durabilité)
  declared_at date,
  batch_id int not null references public.registry_batches(id)
);
create index registry_products_alt_idx on public.registry_products (category_id, eco_cost_100g);

comment on table public.registry_products is 'Registre officiel de l''affichage environnemental (Licence Ouverte 2.0), importé automatiquement chaque mois.';

create table public.registry_jobs (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('manifest', 'bloc')),
  batch_id int references public.registry_batches(id),
  file text,
  request_id bigint,
  attempts int not null default 1,
  status text not null default 'en_attente' check (status in ('en_attente', 'fait', 'erreur')),
  rows int,
  error text,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index registry_jobs_pending_idx on public.registry_jobs (status) where status = 'en_attente';

-- Données ouvertes : lecture publique ; suivi des imports réservé à l'administration.
alter table public.registry_brands enable row level security;
alter table public.registry_categories enable row level security;
alter table public.registry_products enable row level security;
alter table public.registry_batches enable row level security;
alter table public.registry_jobs enable row level security;
create policy "Registre : marques lisibles par tous" on public.registry_brands for select to anon, authenticated using (true);
create policy "Registre : catégories lisibles par tous" on public.registry_categories for select to anon, authenticated using (true);
create policy "Registre : produits lisibles par tous" on public.registry_products for select to anon, authenticated using (true);

-- 2. Notes ------------------------------------------------------------------------------------------

-- Poids type Ecobalyse de chaque type de vêtement (celui des références de calibrage).
create or replace function public.eco_ref_mass(p_eco_product text)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case p_eco_product
    when 'tshirt' then 0.15 when 'chemise' then 0.25 when 'jupe' then 0.3 when 'jean' then 0.45
    when 'pantalon' then 0.45 when 'manteau' then 0.95 when 'pull' then 0.55 when 'chaussettes' then 0.04
    when 'calecon' then 0.04 when 'slip' then 0.03 when 'maillot-de-bain' then 0.1
  end
$$;

-- Note A–E d'une valeur déjà ramenée au poids type ; null si le type n'est pas calibré.
create or replace function public.grade_for(p_value double precision, p_eco_product text, p_metric text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
           when p_value is null then null
           when p_value <= t.a_max then 'A'
           when p_value <= t.b_max then 'B'
           when p_value <= t.c_max then 'C'
           when p_value <= t.d_max then 'D'
           else 'E'
         end
    from public.grade_thresholds t
   where t.eco_product = p_eco_product and t.metric = p_metric
$$;

-- Catégorie affichée dans VeriTrace
create or replace function public.vt_category(p_eco_product text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_eco_product
    when 'tshirt' then 'T-shirt' when 'pull' then 'Pull' when 'pantalon' then 'Pantalon'
    when 'chemise' then 'Chemise' when 'manteau' then 'Veste' when 'jupe' then 'Robe'
    when 'jean' then 'Jean' when 'slip' then 'Sous-vêtement' when 'calecon' then 'Sous-vêtement'
    when 'maillot-de-bain' then 'Maillot de bain' when 'chaussettes' then 'Chaussettes'
  end
$$;

-- Répartition du coût environnemental par grande étape (mêmes regroupements que les produits VeriTrace)
create or replace function public.registry_breakdown(s real[])
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with g(ord, label, detail, v) as (values
    (1, 'Matière première', 'Production des fibres', s[2]),
    (2, 'Fabrication', 'Filature, tissage ou tricot, confection, accessoires', s[1] + s[3] + s[4] + s[6]),
    (3, 'Teinture et finitions', 'Teinture, impression et apprêts', s[5]),
    (4, 'Transport', 'Transports entre les étapes et distribution', s[7]),
    (5, 'Utilisation et fin de vie', 'Lavages, séchage, repassage, fin de vie', s[8] + s[9])
  ),
  t as (select sum(greatest(coalesce(v, 0), 0)) as total from g),
  p as (select ord, label, detail, round(100 * greatest(coalesce(v, 0), 0) / nullif(t.total, 0))::int as pct from g, t)
  select coalesce(jsonb_agg(jsonb_build_object(
           'label', label,
           'level', case when pct >= 35 then 'fort' when pct >= 15 then 'moyen' else 'faible' end,
           'detail', detail || ' : ' || pct || ' % du coût environnemental',
           'share', greatest(pct, 2)) order by ord) filter (where pct >= 1), '[]'::jsonb)
    from p
$$;

-- 3. Fiche d'un code-barres ------------------------------------------------------------------------

-- Fiche au format des apps pour un code-barres du registre ; null si inconnu ou non noté.
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
           'name', coalesce(nullif(g.reference, ''), g.category_label),
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

-- Recherche d'un code-barres : produits VeriTrace (démo et réels), puis registre officiel.
create or replace function public.get_product(p_ean text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v jsonb;
begin
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
  return public.registry_product_json(case when length(p_ean) < 13 then lpad(p_ean, 13, '0') else p_ean end, p_ean);
end;
$$;

-- Alternatives : démo inchangée ; pour un vrai vêtement, des articles du registre du même type,
-- mieux notés à poids égal et de taille comparable (± 40 %).
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
  if v_cur->>'data_source' = 'registre' then
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

grant execute on function public.get_product(text) to anon, authenticated;
grant execute on function public.get_alternatives_json(text) to anon, authenticated;
grant execute on function public.registry_product_json(text, text) to anon, authenticated;

-- 4. Import automatique -----------------------------------------------------------------------------

create or replace function public.registry_base_url()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'https://raw.githubusercontent.com/blackpanther1011bp-sketch/veritrace/donnees-affichage-env/data/registre/'::text
$$;

-- Demande le manifeste du dernier lot (sans effet si une demande est déjà en cours).
create or replace function public.registry_sync_start()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if exists (select 1 from public.registry_jobs where status = 'en_attente') then
    return null;
  end if;
  insert into public.registry_jobs (kind, request_id)
  values ('manifest', net.http_get(
            public.registry_base_url() || 'manifest.json?v=' || extract(epoch from now())::bigint,
            timeout_milliseconds := 30000))
  returning id into v_id;
  return v_id;
end;
$$;

-- Traite les réponses reçues : manifeste → demande des blocs ; bloc → import (p_max_blocs par appel).
create or replace function public.registry_sync_step(p_max_blocs int default 4)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  j record;
  r record;
  m jsonb;
  v_batch public.registry_batches%rowtype;
  v_brands text[];
  v_cats text[];
  v_rows int;
  v_done int := 0;
  v_log text := '';
begin
  for j in select * from public.registry_jobs where status = 'en_attente' order by id for update skip locked loop
    select status_code, content, error_msg into r from net._http_response where id = j.request_id;
    if not found then
      if j.created_at < now() - interval '20 minutes' then
        update public.registry_jobs set status = 'erreur', error = 'pas de réponse', done_at = now() where id = j.id;
      end if;
      continue;
    end if;

    if r.status_code is distinct from 200 then
      if j.kind = 'bloc' and j.attempts < 3 then
        update public.registry_jobs
           set attempts = attempts + 1, created_at = now(), error = coalesce(r.error_msg, 'HTTP ' || r.status_code),
               request_id = net.http_get(public.registry_base_url() || j.file || '?v=' || j.batch_id || '-' || (j.attempts + 1),
                                         timeout_milliseconds := 120000)
         where id = j.id;
      else
        update public.registry_jobs set status = 'erreur', error = coalesce(r.error_msg, 'HTTP ' || r.status_code), done_at = now()
         where id = j.id;
      end if;
      continue;
    end if;

    if j.kind = 'manifest' then
      m := r.content::jsonb;
      if exists (select 1 from public.registry_batches where batch = m->>'batch') then
        update public.registry_jobs set status = 'fait', error = 'lot déjà importé', done_at = now() where id = j.id;
        continue;
      end if;
      insert into public.registry_batches (batch, manifest) values (m->>'batch', m) returning * into v_batch;
      insert into public.registry_brands (name)
        select jsonb_array_elements_text(m->'brands') on conflict (name) do nothing;
      insert into public.registry_categories (label, eco_product)
        select c->>'label', c->>'eco_product' from jsonb_array_elements(m->'categories') c
        on conflict (label) do update set eco_product = excluded.eco_product;
      insert into public.registry_jobs (kind, batch_id, file, request_id)
        select 'bloc', v_batch.id, c->>'file',
               net.http_get(public.registry_base_url() || (c->>'file') || '?v=' || (m->>'batch'), timeout_milliseconds := 120000)
          from jsonb_array_elements(m->'chunks') c;
      update public.registry_jobs set status = 'fait', batch_id = v_batch.id, done_at = now() where id = j.id;
      v_log := v_log || 'manifeste ' || (m->>'batch') || ' ; ';
      continue;
    end if;

    -- Bloc de produits
    exit when v_done >= p_max_blocs;
    select * into v_batch from public.registry_batches where id = j.batch_id;
    v_brands := array(select jsonb_array_elements_text(v_batch.manifest->'brands'));
    v_cats := array(select c->>'label' from jsonb_array_elements(v_batch.manifest->'categories') c);
    begin
      insert into public.registry_products (
        gtin, brand_id, category_id, reference, eco_cost, eco_cost_100g, durability, climate_kg,
        stages, declared_at, batch_id)
      select e->>0, b.id, c.id, nullif(e->>3, ''), (e->>4)::real, (e->>5)::real, (e->>6)::real, (e->>7)::real,
             array(select x::real from jsonb_array_elements_text(e->8) x), nullif(e->>9, '')::date, v_batch.id
        from jsonb_array_elements(r.content::jsonb) e
        join public.registry_brands b on b.name = v_brands[(e->>1)::int + 1]
        join public.registry_categories c on c.label = v_cats[(e->>2)::int + 1]
      on conflict (gtin) do update set
        brand_id = excluded.brand_id, category_id = excluded.category_id, reference = excluded.reference,
        eco_cost = excluded.eco_cost, eco_cost_100g = excluded.eco_cost_100g, durability = excluded.durability,
        climate_kg = excluded.climate_kg, stages = excluded.stages, declared_at = excluded.declared_at,
        batch_id = excluded.batch_id;
      get diagnostics v_rows = row_count;
      update public.registry_jobs set status = 'fait', rows = v_rows, error = null, done_at = now() where id = j.id;
      update public.registry_batches set rows_loaded = rows_loaded + v_rows where id = v_batch.id;
      v_log := v_log || j.file || ' : ' || v_rows || ' ; ';
    exception when others then
      update public.registry_jobs set status = 'erreur', error = left(sqlerrm, 500), done_at = now() where id = j.id;
      v_log := v_log || j.file || ' : erreur ; ';
    end;
    v_done := v_done + 1;
  end loop;

  -- Lot complet : on retire les codes-barres qui ont disparu du registre.
  for v_batch in
    select b.* from public.registry_batches b
     where b.status = 'en_cours'
       and exists (select 1 from public.registry_jobs where batch_id = b.id and kind = 'bloc')
       and not exists (select 1 from public.registry_jobs where batch_id = b.id and kind = 'bloc' and status = 'en_attente')
  loop
    if exists (select 1 from public.registry_jobs where batch_id = v_batch.id and kind = 'bloc' and status = 'erreur') then
      update public.registry_batches set status = 'erreur', finished_at = now() where id = v_batch.id;
      v_log := v_log || 'lot ' || v_batch.batch || ' incomplet ; ';
    else
      delete from public.registry_products where batch_id <> v_batch.id;
      update public.registry_batches set status = 'termine', finished_at = now() where id = v_batch.id;
      v_log := v_log || 'lot ' || v_batch.batch || ' terminé ; ';
    end if;
  end loop;

  return v_log || v_done || ' bloc(s) importé(s)';
end;
$$;

revoke execute on function public.registry_sync_start() from public, anon, authenticated;
revoke execute on function public.registry_sync_step(int) from public, anon, authenticated;

-- Chaque jour : nouveau lot ? Chaque minute : import des blocs reçus (rien à faire la plupart du temps).
select cron.schedule('veritrace-registre-verification', '20 4 * * *', $$select public.registry_sync_start()$$);
select cron.schedule('veritrace-registre-import', '* * * * *', $$select public.registry_sync_step()$$);
