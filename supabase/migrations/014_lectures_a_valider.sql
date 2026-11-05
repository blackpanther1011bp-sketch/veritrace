-- Lectures d'étiquettes à valider (tableau de bord Supabase).
--
-- Depuis la migration 012, une lecture envoyée avec un code-barres n'est plus rattachée à ce code-barres
-- automatiquement : elle reste visible par son auteur seul (code L…). Cette vue liste les lectures en attente ;
-- deux fonctions permettent de les publier ou de les masquer, depuis l'éditeur SQL :
--   select public.valider_lecture('L0123456789ab');   -- visible par tous ceux qui scannent ce code-barres
--   select public.refuser_lecture('L0123456789ab');   -- masquée, y compris pour son auteur
-- Réservé à l'équipe : ni la vue ni les fonctions ne sont accessibles depuis les apps.

create or replace view public.lectures_a_valider
with (security_invoker = true) as
select r.code,
       r.created_at as envoyee_le,
       r.extracted->>'ean_saisi' as code_barres,
       r.brand_name as marque,
       r.category as vetement,
       r.composition,
       r.country_making as fabrique_en,
       r.env_grade as note,
       r.eco_cost as cout_points,
       r.method as lecture,
       r.confidence as fiabilite,
       r.photo_path as photo,
       left(r.extracted->>'raw_text', 200) as texte_lu
  from public.label_readings r
 where r.status = 'publie'
   and r.ean is null
   and r.extracted->>'ean_saisi' is not null
 order by r.created_at;

revoke all on public.lectures_a_valider from anon, authenticated;
comment on view public.lectures_a_valider is
  'Lectures d''étiquettes en attente. Publier : select public.valider_lecture(''L…''); masquer : select public.refuser_lecture(''L…''); (éditeur SQL)';

create or replace function public.valider_lecture(p_code text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_ean text;
begin
  update public.label_readings
     set ean = extracted->>'ean_saisi'
   where code = p_code
     and status = 'publie'
     and ean is null
     and extracted->>'ean_saisi' is not null
  returning ean into v_ean;
  if v_ean is null then
    raise exception 'Lecture % introuvable, sans code-barres ou déjà traitée', p_code;
  end if;
  return 'Lecture ' || p_code || ' publiée sur le code-barres ' || v_ean;
end;
$$;

create or replace function public.refuser_lecture(p_code text)
returns text
language plpgsql
set search_path = ''
as $$
begin
  update public.label_readings set status = 'masque', ean = null where code = p_code and status = 'publie';
  if not found then
    raise exception 'Lecture % introuvable ou déjà masquée', p_code;
  end if;
  return 'Lecture ' || p_code || ' masquée';
end;
$$;

revoke all on function public.valider_lecture(text) from public, anon, authenticated;
revoke all on function public.refuser_lecture(text) from public, anon, authenticated;
