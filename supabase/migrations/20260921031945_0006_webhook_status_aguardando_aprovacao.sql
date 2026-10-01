-- =============================================================================
-- Migration 0006: infraestrutura de automação (Fase 8) — Database Webhook que
-- dispara sempre que um projeto muda de status para
-- 'aguardando_aprovacao_cliente'. A entrega usa pg_net (assíncrono, não trava
-- a transação) chamando a API Route /api/webhooks/status da aplicação.
--
-- Em desenvolvimento local, a URL abaixo aponta para localhost — o Postgres
-- do Supabase Cloud não alcança a máquina do desenvolvedor, então a entrega
-- falha com "Couldn't connect to server" (ver net._http_response). Isso é
-- esperado: o gatilho e o payload já estão corretos e testados: assim que a
-- aplicação for implantada com uma URL pública, atualize
-- private.app_config.webhook_status_url para o domínio real.
-- =============================================================================

create extension if not exists pg_net with schema extensions;

create schema if not exists private;

-- Config isolada num schema próprio (não em profiles/projetos) para o
-- segredo do webhook nunca aparecer em nenhuma policy de SELECT comum.
create table if not exists private.app_config (
  key   text primary key,
  value text not null
);

revoke all on private.app_config from anon, authenticated;

insert into private.app_config (key, value) values
  ('webhook_status_url', 'http://localhost:3000/api/webhooks/status')
on conflict (key) do nothing;

-- O segredo NÃO fica versionado: grave-o direto no banco (SQL Editor), com o
-- mesmo valor de WEBHOOK_SECRET do ambiente da aplicação:
--   insert into private.app_config (key, value) values ('webhook_secret', '<WEBHOOK_SECRET>')
--   on conflict (key) do update set value = excluded.value;
-- Sem ele o gatilho envia o cabeçalho vazio e a rota recusa a chamada.

create or replace function public.notificar_status_aguardando_aprovacao()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_url    text;
  v_secret text;
begin
  if new.status = 'aguardando_aprovacao_cliente' and old.status is distinct from 'aguardando_aprovacao_cliente' then
    select value into v_url    from private.app_config where key = 'webhook_status_url';
    select value into v_secret from private.app_config where key = 'webhook_secret';

    if v_url is not null then
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(v_secret, '')),
        body := jsonb_build_object(
          'type', 'UPDATE',
          'table', 'projetos',
          'schema', 'public',
          'record', jsonb_build_object('id', new.id, 'nome', new.nome, 'status', new.status, 'cliente_id', new.cliente_id),
          'old_record', jsonb_build_object('status', old.status)
        )
      );
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.notificar_status_aguardando_aprovacao() from public, anon, authenticated;

drop trigger if exists trg_notificar_aguardando_aprovacao on public.projetos;
create trigger trg_notificar_aguardando_aprovacao
  after update on public.projetos
  for each row execute function public.notificar_status_aguardando_aprovacao();
