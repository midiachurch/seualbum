-- =============================================================================
-- Migration 0015: limpeza automática de fotos órfãs (rascunhos abandonados)
--
-- O wizard sobe as fotos para `pedidos_fotos/{userId}/{chave}/` ANTES do pedido
-- existir. Rascunho abandonado = pasta cuja chave nunca virou pedido.
--
-- Regra: apagar a pasta quando (a) nenhum pedido tem essa `chave_idempotencia`
-- e (b) o arquivo mais recente dela tem mais de 24h (a pasta inteira fica
-- intocada enquanto o fotógrafo ainda está mandando fotos). Pedidos já criados
-- — pagos, em produção, finalizados — nunca são tocados.
--
-- O Postgres não pode apagar objetos do Storage direto (a API do Storage
-- barra DELETE em storage.objects), então o trabalho é dividido:
--   - `fotos_orfas_pedidos()` (aqui) diz QUAIS arquivos apagar;
--   - a edge function `limpar-fotos-orfas` apaga pela API do Storage;
--   - o pg_cron chama a edge function de hora em hora, autenticado por um
--     segredo guardado no Vault (validado por `validar_segredo_limpeza_fotos`).
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

create extension if not exists pg_cron;

create or replace function public.fotos_orfas_pedidos(p_horas integer default 24, p_limite integer default 1000)
returns table (nome text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with pastas as (
    select
      (storage.foldername(o.name))[1] as dono,
      (storage.foldername(o.name))[2] as chave,
      max(o.created_at) as ultima_atividade
    from storage.objects o
    where o.bucket_id = 'pedidos_fotos'
    group by 1, 2
  )
  select o.name
  from storage.objects o
  join pastas p
    on (storage.foldername(o.name))[1] = p.dono
   and (storage.foldername(o.name))[2] = p.chave
  where o.bucket_id = 'pedidos_fotos'
    -- Só a convenção {userId}/{chave}/arquivo; qualquer outra coisa fica.
    and p.dono is not null
    and p.chave ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and p.ultima_atividade < now() - make_interval(hours => greatest(p_horas, 0))
    and not exists (
      select 1 from public.orders ord where ord.chave_idempotencia::text = p.chave
    )
  limit greatest(least(p_limite, 1000), 1);
$$;

revoke execute on function public.fotos_orfas_pedidos(integer, integer) from public, anon, authenticated;
grant execute on function public.fotos_orfas_pedidos(integer, integer) to service_role;

-- Segredo compartilhado entre o pg_cron e a edge function (gerado uma vez).
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'limpeza_fotos_cron_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'limpeza_fotos_cron_secret',
      'Autentica o pg_cron na edge function limpar-fotos-orfas'
    );
  end if;
end $$;

create or replace function public.validar_segredo_limpeza_fotos(p_segredo text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'limpeza_fotos_cron_secret' and decrypted_secret = p_segredo
  );
$$;

revoke execute on function public.validar_segredo_limpeza_fotos(text) from public, anon, authenticated;
grant execute on function public.validar_segredo_limpeza_fotos(text) to service_role;

-- De hora em hora, no minuto 17 (fora do pico de jobs no minuto 0).
-- `cron.schedule` com o mesmo nome substitui o job existente.
select cron.schedule(
  'limpeza-fotos-orfas',
  '17 * * * *',
  $job$
    select net.http_post(
      url := 'https://ogsnfnehmjljcaafnffn.supabase.co/functions/v1/limpar-fotos-orfas',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'limpeza_fotos_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);
