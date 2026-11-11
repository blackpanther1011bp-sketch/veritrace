-- Import du registre officiel sans gonflement de la base (11 novembre 2026).
--
-- Le registre est passé de 570 000 à 970 000 vêtements en une semaine. L'import réécrivait chaque ligne à chaque
-- mise à jour (pour y noter le numéro du lot), ce qui double provisoirement la place occupée : avec 970 000 lignes,
-- la base risquait de dépasser les 500 Mo de l'offre gratuite de Supabase.
-- Désormais : une ligne inchangée n'est pas réécrite ; les codes-barres du lot sont notés dans une petite table
-- provisoire (registry_seen), qui sert à retirer à la fin ceux qui ont disparu du registre ; l'index sur le numéro
-- de lot, devenu inutile, est supprimé.

drop index if exists public.registry_products_batch_id_idx;

create unlogged table if not exists public.registry_seen (gtin text not null);
alter table public.registry_seen enable row level security;
revoke all on public.registry_seen from anon, authenticated;
comment on table public.registry_seen is 'Provisoire : codes-barres du lot du registre en cours d''import. Vide en dehors d''un import.';

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
      truncate public.registry_seen;
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
      -- codes-barres présents dans ce lot (pour retirer à la fin ceux qui ont disparu)
      insert into public.registry_seen (gtin) select e->>0 from jsonb_array_elements(r.content::jsonb) e;
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
        batch_id = excluded.batch_id
      -- une ligne inchangée n'est pas réécrite : pas de place perdue à chaque mise à jour du registre
      where (registry_products.brand_id, registry_products.category_id, registry_products.reference, registry_products.eco_cost,
             registry_products.eco_cost_100g, registry_products.durability, registry_products.climate_kg,
             registry_products.stages, registry_products.declared_at)
            is distinct from
            (excluded.brand_id, excluded.category_id, excluded.reference, excluded.eco_cost,
             excluded.eco_cost_100g, excluded.durability, excluded.climate_kg, excluded.stages, excluded.declared_at);
      v_rows := jsonb_array_length(r.content::jsonb);
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
      delete from public.registry_products p where not exists (select 1 from public.registry_seen s where s.gtin = p.gtin);
      truncate public.registry_seen;
      update public.registry_batches set status = 'termine', finished_at = now() where id = v_batch.id;
      v_log := v_log || 'lot ' || v_batch.batch || ' terminé ; ';
    end if;
  end loop;

  return v_log || v_done || ' bloc(s) importé(s)';
end;
$$;

revoke execute on function public.registry_sync_step(int) from public, anon, authenticated;
