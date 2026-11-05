-- Suppression automatique des photos d'étiquettes (lectures et contributions) de plus de 12 mois, chaque nuit,
-- comme annoncé dans la politique de confidentialité. La fonction menage-photos passe par l'API Storage.
select cron.schedule('veritrace-menage-photos', '45 3 * * *', $$
  select net.http_post(
    url := 'https://vqegfoncyrqivtrbvorg.supabase.co/functions/v1/menage-photos',
    body := '{}'::jsonb,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 120000
  )
$$);
