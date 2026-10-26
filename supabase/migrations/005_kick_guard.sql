-- VeriTrace 005 : kick_scoring ne se rappelle plus lui-même via le déclencheur
-- (la remise en file des fiches bloquées déclenchait un second appel imbriqué).

create or replace function public.kick_scoring(force boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last timestamptz;
begin
  perform set_config('veritrace.kicking', 'on', true);

  update public.product_drafts
     set status = case when attempts >= 3 then 'erreur' else 'a_calculer' end,
         error = case when attempts >= 3 then 'Calcul interrompu 3 fois : réessayez plus tard' else error end,
         claimed_at = null
   where status = 'en_cours' and claimed_at < now() - interval '5 minutes';

  if not exists (select 1 from public.product_drafts where status = 'a_calculer') then
    return false;
  end if;

  select last_kick_at into v_last from public.scoring_state where id for update;
  if not force and v_last is not null and v_last > now() - interval '45 seconds' then
    return false;
  end if;
  update public.scoring_state set last_kick_at = now() where id;

  -- Clé « anon » : publique par conception (déjà présente dans les applications).
  perform net.http_post(
    url := 'https://vqegfoncyrqivtrbvorg.supabase.co/functions/v1/ecobalyse-score',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZWdmb25jeXJxaXZ0cmJ2b3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMDk3NjksImV4cCI6MjEwODU4NTc2OX0.T5qnXXvEIk7fjOU7GInZGLp-GQfxBOD7JZ3bV95p4qM'
    ),
    timeout_milliseconds := 150000
  );
  return true;
end;
$$;

revoke execute on function public.kick_scoring(boolean) from public, anon, authenticated;

create or replace function public.product_drafts_kick()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 or current_setting('veritrace.kicking', true) = 'on' then
    return null;
  end if;
  if exists (select 1 from new_rows where status = 'a_calculer') then
    perform public.kick_scoring();
  end if;
  return null;
end;
$$;

revoke execute on function public.product_drafts_kick() from public, anon, authenticated;
