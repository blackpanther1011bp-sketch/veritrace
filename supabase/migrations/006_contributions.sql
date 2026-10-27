-- VeriTrace 006 : ajout de vêtements depuis l'app (contributions), avec validation par l'équipe
--
-- 1. En magasin, un utilisateur scanne un code-barres inconnu et remplit l'étiquette
--    (marque, nom, catégorie, composition, pays) avec une photo facultative.
-- 2. La contribution arrive dans product_submissions au statut « a_verifier » (rien n'est publié).
-- 3. L'équipe vérifie (photo à l'appui), choisit la marque, puis passe le statut à « valide » :
--    la fiche part dans product_drafts et la note est calculée avec Ecobalyse.

-- Note sociale par défaut de la marque (évite de la ressaisir pour chaque vêtement)
alter table public.brands
  add column social_grade text check (social_grade in ('A','B','C','D','E'));

comment on column public.brands.social_grade is 'Note sociale de la marque (A à E), reprise pour les vêtements validés';

-- Notes sociales des marques de démonstration : la plus fréquente parmi leurs produits
update public.brands b
   set social_grade = (
     select p.social_grade from public.products p
      where p.brand_id = b.id
      group by p.social_grade
      order by count(*) desc, p.social_grade
      limit 1)
 where b.is_sample;

-- Contributions ------------------------------------------------------------------------------------

create table public.product_submissions (
  id uuid primary key default gen_random_uuid(),
  ean text not null check (ean ~ '^[0-9]{8,14}$'),
  brand_name text not null check (char_length(brand_name) between 1 and 80),
  name text not null check (char_length(name) between 1 and 120),
  category text not null check (char_length(category) between 1 and 40),
  composition text not null check (char_length(composition) between 3 and 300),
  country_making text check (country_making is null or char_length(country_making) <= 40),
  photo_path text check (photo_path is null or photo_path ~ '^[0-9a-f-]{36}\.jpg$'),
  session_id uuid,
  created_at timestamptz not null default now(),
  -- Validation (réservée à l'équipe, depuis le tableau de bord)
  status text not null default 'a_verifier' check (status in ('a_verifier', 'valide', 'refuse')),
  brand_id text references public.brands(id),
  social_grade text check (social_grade in ('A','B','C','D','E')),
  moderator_note text,
  reviewed_at timestamptz
);
create index product_submissions_status_idx on public.product_submissions (status, created_at);

comment on table public.product_submissions is 'Vêtements ajoutés depuis l''app. Vérifier, choisir brand_id, puis passer status à valide pour lancer le calcul.';

alter table public.product_submissions enable row level security;

-- L'app peut seulement déposer une contribution « à vérifier » ; elle ne peut ni lire ni modifier.
create policy "Contribution d'un vêtement à vérifier"
  on public.product_submissions for insert to anon, authenticated
  with check (
    status = 'a_verifier'
    and brand_id is null
    and social_grade is null
    and moderator_note is null
    and reviewed_at is null
  );

-- Validation : la fiche part au calcul ------------------------------------------------------------

create or replace function public.product_submissions_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brand public.brands%rowtype;
  v_grade text;
begin
  if new.status = 'valide' and old.status is distinct from 'valide' then
    -- Marque : celle choisie par l'équipe, sinon une marque existante du même nom
    if new.brand_id is not null then
      select * into v_brand from public.brands where id = new.brand_id;
    else
      select * into v_brand from public.brands where lower(name) = lower(trim(new.brand_name)) limit 1;
    end if;
    if v_brand.id is null then
      raise exception 'Marque « % » inconnue : créez-la dans brands puis indiquez son identifiant dans brand_id', new.brand_name;
    end if;

    v_grade := coalesce(new.social_grade, v_brand.social_grade);
    if v_grade is null then
      raise exception 'Note sociale manquante : renseignez social_grade ici ou dans la marque « % »', v_brand.name;
    end if;

    insert into public.product_drafts (
      ean, brand_id, name, category, composition, social_grade, data_source,
      source_ref, source_date, country_making, status
    ) values (
      new.ean, v_brand.id, new.name, new.category, new.composition, v_grade, 'etiquette',
      'Étiquette relevée en magasin (contribution du ' || to_char(new.created_at, 'DD/MM/YYYY') || ')',
      new.created_at::date, nullif(trim(new.country_making), ''), 'a_calculer'
    )
    on conflict (ean) do update set
      brand_id = excluded.brand_id, name = excluded.name, category = excluded.category,
      composition = excluded.composition, social_grade = excluded.social_grade,
      data_source = excluded.data_source, source_ref = excluded.source_ref,
      source_date = excluded.source_date, country_making = excluded.country_making,
      status = 'a_calculer';

    new.brand_id := v_brand.id;
    new.social_grade := v_grade;
    new.reviewed_at := now();
    perform public.kick_scoring();
  elsif new.status = 'refuse' and old.status is distinct from 'refuse' then
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.product_submissions_review() from public, anon, authenticated;

create trigger product_submissions_review
  before update on public.product_submissions
  for each row execute function public.product_submissions_review();

-- Photos d'étiquettes : dépôt seulement, lecture réservée à l'équipe ------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('etiquettes', 'etiquettes', false, 3145728, array['image/jpeg'])
on conflict (id) do nothing;

create policy "Dépôt d'une photo d'étiquette"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'etiquettes' and name ~ '^[0-9a-f-]{36}\.jpg$');

-- Suivi d'usage : deux nouveaux événements ---------------------------------------------------------

do $$
declare
  c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.events'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%exit_after_bad_grade%';
  if c is not null then
    execute format('alter table public.events drop constraint %I', c);
  end if;
end $$;

alter table public.events add constraint events_event_check check (event in (
  'scan', 'product_view', 'not_found', 'details_view', 'alternatives_view',
  'premium_view', 'premium_start', 'report_sent', 'exit_after_bad_grade',
  'contribution_start', 'contribution_sent'
));
