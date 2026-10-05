-- =============================================================================
-- Migration 0029: cron da limpeza de fotos órfãs no projeto atual
--
-- A 0015 agendou o job chamando a edge function do projeto antigo
-- (ogsnfnehmjljcaafnffn). O projeto agora é o ytqbyfmroyilinxdhopv.
-- `cron.schedule` com o mesmo nome substitui o job existente.
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

select cron.schedule(
  'limpeza-fotos-orfas',
  '17 * * * *',
  $job$
    select net.http_post(
      url := 'https://ytqbyfmroyilinxdhopv.supabase.co/functions/v1/limpar-fotos-orfas',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'limpeza_fotos_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);
