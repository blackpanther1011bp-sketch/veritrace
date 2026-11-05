-- Lectures à valider : indique si le code-barres est déjà au registre officiel. Dans ce cas, la fiche officielle
-- reste prioritaire au scan : valider la lecture ne change rien pour les utilisateurs, elle peut être ignorée.

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
       left(r.extracted->>'raw_text', 200) as texte_lu,
       exists (
         select 1 from public.registry_products p
          where p.gtin = case when length(r.extracted->>'ean_saisi') < 13
                              then lpad(r.extracted->>'ean_saisi', 13, '0') else r.extracted->>'ean_saisi' end
       ) as deja_au_registre
  from public.label_readings r
 where r.status = 'publie'
   and r.ean is null
   and r.extracted->>'ean_saisi' is not null
 order by r.created_at;

revoke all on public.lectures_a_valider from anon, authenticated;
