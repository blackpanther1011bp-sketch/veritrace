-- Protections issues de l'audit du 5 novembre 2026.
--
-- 1. Lectures d'étiquettes : plus de publication automatique sur le code-barres (une lecture reste visible par son
--    auteur, code L…, jusqu'à validation) ; plafond global de lectures par jour ; quota de passeports par appareil.
-- 2. Ajouts publics plafonnés (événements, signalements, contributions, photos) : statistiques d'usage non faussables,
--    stockage qui ne peut plus gonfler sans limite.
-- 3. Index des clés étrangères signalés par Supabase ; tables « serveur seulement » documentées.
-- 4. Formulaire de contact (page Confidentialité) et durées de conservation annoncées : événements 13 mois,
--    messages 12 mois, compteurs de quotas 30 jours.

-- 1. Réglages -----------------------------------------------------------------------------------------------
update public.app_settings set value = to_jsonb(false) where key = 'etiquette_publication_auto';
insert into public.app_settings (key, value, note) values
  ('etiquettes_par_jour', to_jsonb(2000), 'Lectures d''étiquettes par jour, tous appareils confondus'),
  ('passeports_par_appareil_par_jour', to_jsonb(10), 'Passeports créés par jour depuis une même connexion')
on conflict (key) do nothing;

-- Formulaire de contact (droits sur les données, erreurs, fabricants) : lu par l'équipe dans Supabase
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid,
  subject text not null check (char_length(subject) <= 60),
  message text not null check (char_length(message) between 10 and 2000),
  reply_email text check (reply_email is null or (char_length(reply_email) <= 120 and reply_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
alter table public.contact_messages enable row level security;
drop policy if exists "Envoi d'un message de contact" on public.contact_messages;
create policy "Envoi d'un message de contact" on public.contact_messages
  for insert to anon, authenticated
  with check (handled_at is null);
comment on table public.contact_messages is 'Messages du formulaire de contact. Lecture : équipe seulement (tableau de bord Supabase). Conservés 12 mois.';

-- 2. Plafonds des ajouts publics ----------------------------------------------------------------------------
create or replace function public.limit_public_inserts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  if tg_table_name = 'events' then
    v_ok := public.take_quota('evenements:' || new.session_id::text, 1000)
        and public.take_quota('evenements', 50000);
  elsif tg_table_name = 'product_reports' then
    v_ok := public.take_quota('signalements', 500);
  elsif tg_table_name = 'contact_messages' then
    v_ok := public.take_quota('contact:' || coalesce(new.session_id::text, 'sans-session'), 5)
        and public.take_quota('contact', 100);
  elsif tg_table_name = 'product_submissions' then
    v_ok := public.take_quota('contributions:' || coalesce(new.session_id::text, 'sans-session'), 20)
        and public.take_quota('contributions', 300);
  else
    v_ok := true;
  end if;
  if not v_ok then
    raise exception 'Limite quotidienne atteinte' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_public_inserts() from public, anon, authenticated;

drop trigger if exists events_limit on public.events;
create trigger events_limit before insert on public.events
  for each row execute function public.limit_public_inserts();
drop trigger if exists product_reports_limit on public.product_reports;
create trigger product_reports_limit before insert on public.product_reports
  for each row execute function public.limit_public_inserts();
drop trigger if exists contact_messages_limit on public.contact_messages;
create trigger contact_messages_limit before insert on public.contact_messages
  for each row execute function public.limit_public_inserts();
drop trigger if exists product_submissions_limit on public.product_submissions;
create trigger product_submissions_limit before insert on public.product_submissions
  for each row execute function public.limit_public_inserts();

-- Photos d'étiquettes : 300 dépôts par jour au plus (fonction hors du schéma exposé par l'API)
create schema if not exists private;
create or replace function private.photo_upload_allowed()
returns boolean
language sql
security definer
set search_path = ''
as $$ select public.take_quota('photos', 300) $$;
revoke all on function private.photo_upload_allowed() from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.photo_upload_allowed() to anon, authenticated;

drop policy if exists "Dépôt d'une photo d'étiquette" on storage.objects;
create policy "Dépôt d'une photo d'étiquette" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'etiquettes' and name ~ '^[0-9a-f-]{36}\.jpg$' and private.photo_upload_allowed());

-- Durées de conservation annoncées dans la politique de confidentialité
select cron.schedule('veritrace-menage', '15 3 * * *', $$
  delete from public.usage_counters where day < current_date - 30;
  delete from public.events where created_at < now() - interval '13 months';
  delete from public.contact_messages where created_at < now() - interval '12 months';
$$);

-- 3. Index et documentation ---------------------------------------------------------------------------------
create index if not exists product_drafts_brand_id_idx on public.product_drafts (brand_id);
create index if not exists product_submissions_brand_id_idx on public.product_submissions (brand_id);
create index if not exists registry_jobs_batch_id_idx on public.registry_jobs (batch_id);
create index if not exists registry_products_batch_id_idx on public.registry_products (batch_id);
create index if not exists registry_products_brand_id_idx on public.registry_products (brand_id);

comment on table public.app_settings is 'Réglages des fonctions serveur. RLS sans règle : accès serveur uniquement (voulu).';
comment on table public.usage_counters is 'Compteurs des quotas journaliers. RLS sans règle : accès serveur uniquement (voulu).';
comment on table public.scoring_state is 'État du calcul des fiches. RLS sans règle : accès serveur uniquement (voulu).';
comment on table public.product_drafts is 'Fiches en attente de calcul. RLS sans règle : accès serveur uniquement (voulu).';
comment on table public.registry_batches is 'Lots d''import du registre. RLS sans règle : accès serveur uniquement (voulu).';
comment on table public.registry_jobs is 'Étapes d''import du registre. RLS sans règle : accès serveur uniquement (voulu).';
