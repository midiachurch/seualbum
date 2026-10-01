-- =============================================================================
-- Migration 0021: workspace do designer + aviso de nova versão da prova
--
-- 1. Papel `designer` (criado na 0020) entra na equipe de PRODUÇÃO:
--    `is_equipe()` passa a incluí-lo — projetos, fotos, versões, lâminas, pins
--    e os buckets de fotos continuam funcionando sem tocar em cada policy.
--
-- 2. ...mas fica fora do financeiro e dos dados de clientes. Nova função
--    `is_operacao()` = a equipe de antes (admin/gestor/operador), usada onde o
--    designer não entra: clientes, pedidos (valores/pagamento), faturas,
--    orçamentos e a caixa de saída de e-mails.
--
-- 3. Notificação "Nova versão disponível para aprovação": quando o projeto
--    volta a `aguardando_aprovacao_cliente` com uma versão > 1 liberada, a
--    caixa de saída registra `nova_versao` (antes repetia "Sua prova está
--    pronta!") — para o cliente final E para o fotógrafo dono, que também
--    aprova (0017). `destinatario` diz para quem é cada registro. O webhook
--    de status (pg_net) passa a mandar o número da versão.
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Papéis
-- -----------------------------------------------------------------------------

create or replace function public.is_equipe()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.current_role_v() in ('admin', 'gestor', 'operador', 'designer');
$$;

create or replace function public.is_designer()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.current_role_v() = 'designer';
$$;

create or replace function public.is_operacao()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.current_role_v() in ('admin', 'gestor', 'operador');
$$;

grant execute on function public.is_designer() to anon, authenticated, service_role;
grant execute on function public.is_operacao() to anon, authenticated, service_role;

-- Convite pela equipe (edge function admin-create-user grava o papel em
-- app_metadata, confiável) passa a aceitar `designer`.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.platform_role;
begin
  v_role := case
    when new.raw_app_meta_data ->> 'role' in ('admin', 'gestor', 'operador', 'designer', 'fotografo', 'cliente')
      then (new.raw_app_meta_data ->> 'role')::public.platform_role
    when new.raw_user_meta_data ->> 'role' = 'fotografo'
      then 'fotografo'::public.platform_role
    else 'cliente'::public.platform_role
  end;

  insert into public.profiles (id, email, nome_completo, telefone, role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nome_completo'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'nome_contato'), ''),
      split_part(new.email, '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data ->> 'telefone'), ''),
    v_role
  )
  on conflict (id) do nothing;

  if v_role = 'fotografo' then
    insert into public.fotografos (id, estudio)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'estudio'), ''), nullif(trim(new.raw_user_meta_data ->> 'nome_estudio'), ''), 'Novo Estúdio')
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Designer fora do financeiro e dos dados de clientes
-- -----------------------------------------------------------------------------

drop policy if exists "clientes_select_own_scope" on public.clientes;
create policy "clientes_select_own_scope" on public.clientes for select to authenticated
  using (fotografo_id = auth.uid() or user_id = auth.uid() or public.is_operacao());

drop policy if exists "orders_select_own_or_equipe" on public.orders;
create policy "orders_select_own_or_equipe" on public.orders for select to authenticated
  using (client_id = auth.uid() or public.is_operacao());

drop policy if exists "orders_update_own_while_pendente" on public.orders;
create policy "orders_update_own_while_pendente" on public.orders for update to authenticated
  using ((client_id = auth.uid() and status = 'pendente'::public.order_status) or public.is_operacao())
  with check (client_id = auth.uid() or public.is_operacao());

drop policy if exists "faturas_select_scope" on public.faturas;
create policy "faturas_select_scope" on public.faturas for select to authenticated
  using (public.pode_ver_projeto(projeto_id) and not public.is_designer());

drop policy if exists "faturas_insert_scope" on public.faturas;
create policy "faturas_insert_scope" on public.faturas for insert to authenticated
  with check (public.pode_ver_projeto(projeto_id) and not public.is_designer());

drop policy if exists "faturas_update_equipe" on public.faturas;
create policy "faturas_update_equipe" on public.faturas for update to authenticated
  using (public.is_operacao())
  with check (public.is_operacao());

drop policy if exists "orcamentos_select_dono_ou_equipe" on public.orcamentos;
create policy "orcamentos_select_dono_ou_equipe" on public.orcamentos for select to authenticated
  using (fotografo_id = auth.uid() or public.is_operacao());

drop policy if exists "comunicacoes_log_select_equipe_ou_fotografo" on public.comunicacoes_log;
create policy "comunicacoes_log_select_equipe_ou_fotografo" on public.comunicacoes_log for select to authenticated
  using (
    public.is_operacao()
    or exists (select 1 from public.projetos p where p.id = projeto_id and p.fotografo_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 3. Caixa de saída: "Nova versão disponível para aprovação"
-- -----------------------------------------------------------------------------

alter table public.comunicacoes_log
  add column if not exists destinatario text not null default 'cliente';

do $$ begin
  alter table public.comunicacoes_log
    add constraint comunicacoes_log_destinatario_check check (destinatario in ('cliente', 'fotografo'));
exception when duplicate_object then null; end $$;

create or replace function public.registrar_comunicacao_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cliente   record;
  v_fotografo text;
  v_versao    integer;
  v_tipo      text;
  v_assunto   text;
  v_corpo     text;
  v_rodape    text := '<p style="color:#595959;font-size:12px">Este é um e-mail simulado — nenhuma mensagem real foi enviada (infraestrutura de e-mail ainda não conectada).</p>';
begin
  if new.status = old.status then
    return new;
  end if;

  v_tipo := case new.status
    when 'aguardando_fotos' then 'aguardando_fotos'
    when 'aguardando_aprovacao_cliente' then 'prova_pronta'
    when 'aprovado' then 'aprovado'
    when 'enviado' then 'enviado'
    when 'finalizado' then 'finalizado'
    else null
  end;

  if v_tipo is null then
    return new;
  end if;

  -- Prova liberada de novo depois de ajustes: é uma NOVA VERSÃO, não a primeira.
  if v_tipo = 'prova_pronta' then
    select max(numero) into v_versao
    from public.design_versions
    where projeto_id = new.id and status = 'aprovada';
    if coalesce(v_versao, 1) > 1 then
      v_tipo := 'nova_versao';
    end if;
  end if;

  select c.nome, c.email into v_cliente from public.clientes c where c.id = new.cliente_id;

  v_assunto := case v_tipo
    when 'aguardando_fotos' then 'Estamos esperando as fotos do seu evento — ' || new.nome
    when 'prova_pronta' then 'Sua prova digital está pronta! — ' || new.nome
    when 'nova_versao' then 'Nova versão disponível para aprovação — ' || new.nome || ' (versão ' || v_versao || ')'
    when 'aprovado' then 'Álbum aprovado — a caminho da gráfica! — ' || new.nome
    when 'enviado' then 'Seu álbum está a caminho! — ' || new.nome
    when 'finalizado' then 'Seu álbum foi finalizado! — ' || new.nome
  end;

  v_corpo := '<div style="font-family:sans-serif;color:#171717;line-height:1.5">'
    || '<p>Olá, ' || coalesce(v_cliente.nome, 'cliente') || '!</p>'
    || '<p>' || (case v_tipo
        when 'aguardando_fotos' then 'Recebemos seu pedido para o projeto <strong>' || new.nome || '</strong> e estamos aguardando o envio das fotos para começar a diagramação.'
        when 'prova_pronta' then 'A prova digital do seu álbum <strong>' || new.nome || '</strong> já está pronta. Acesse o portal para revisar e aprovar quando quiser.'
        when 'nova_versao' then 'Aplicamos os ajustes que você pediu. A versão ' || v_versao || ' do álbum <strong>' || new.nome || '</strong> já está disponível para aprovação no portal.'
        when 'aprovado' then 'Seu álbum <strong>' || new.nome || '</strong> foi aprovado e já seguiu para a produção gráfica. Em breve você recebe novidades sobre a entrega.'
        when 'enviado' then 'Seu álbum <strong>' || new.nome || '</strong> foi despachado!' ||
          case when new.codigo_rastreio is not null then ' Código de rastreio: <strong>' || new.codigo_rastreio || '</strong>.' else '' end
        when 'finalizado' then 'Seu álbum <strong>' || new.nome || '</strong> foi finalizado. Obrigado por confiar no nosso trabalho!'
      end) || '</p>'
    || v_rodape
    || '</div>';

  insert into public.comunicacoes_log (projeto_id, cliente_id, tipo_evento, assunto, corpo_html, status, destinatario)
  values (new.id, new.cliente_id, v_tipo, v_assunto, v_corpo, 'simulado', 'cliente');

  -- O fotógrafo dono também aprova a prova (0017): avisa o estúdio quando há
  -- prova para revisar.
  if v_tipo in ('prova_pronta', 'nova_versao') and new.fotografo_id is not null then
    select coalesce(nullif(trim(f.estudio), ''), pr.nome_completo) into v_fotografo
    from public.profiles pr left join public.fotografos f on f.id = pr.id
    where pr.id = new.fotografo_id;

    insert into public.comunicacoes_log (projeto_id, cliente_id, tipo_evento, assunto, corpo_html, status, destinatario)
    values (
      new.id, new.cliente_id, v_tipo,
      case v_tipo
        when 'nova_versao' then 'Nova versão disponível para aprovação — ' || new.nome || ' (versão ' || v_versao || ')'
        else 'Prova digital pronta para revisão — ' || new.nome
      end,
      '<div style="font-family:sans-serif;color:#171717;line-height:1.5">'
        || '<p>Olá, ' || coalesce(v_fotografo, 'estúdio') || '!</p>'
        || '<p>' || (case v_tipo
            when 'nova_versao' then 'A equipe aplicou os ajustes da versão anterior. A versão ' || v_versao || ' do álbum <strong>' || new.nome || '</strong> está disponível para aprovação no seu painel, em Meus álbuns.'
            else 'A prova digital do álbum <strong>' || new.nome || '</strong> está pronta. Revise, marque os pontos de ajuste e aprove pelo seu painel, em Meus álbuns.'
          end) || '</p>'
        || v_rodape
        || '</div>',
      'simulado', 'fotografo'
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.registrar_comunicacao_status() from public, anon, authenticated;

-- Webhook de status (0006): leva também o número da versão liberada, para o
-- disparo real de e-mail/WhatsApp diferenciar "primeira prova" de "nova versão".
create or replace function public.notificar_status_aguardando_aprovacao()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_url    text;
  v_secret text;
  v_versao integer;
begin
  if new.status = 'aguardando_aprovacao_cliente' and old.status is distinct from 'aguardando_aprovacao_cliente' then
    select value into v_url    from private.app_config where key = 'webhook_status_url';
    select value into v_secret from private.app_config where key = 'webhook_secret';
    select max(numero) into v_versao from public.design_versions where projeto_id = new.id and status = 'aprovada';

    if v_url is not null then
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(v_secret, '')),
        body := jsonb_build_object(
          'type', 'UPDATE',
          'table', 'projetos',
          'schema', 'public',
          'record', jsonb_build_object(
            'id', new.id, 'nome', new.nome, 'status', new.status, 'cliente_id', new.cliente_id,
            'fotografo_id', new.fotografo_id, 'versao', v_versao,
            'evento', case when coalesce(v_versao, 1) > 1 then 'nova_versao' else 'prova_pronta' end
          ),
          'old_record', jsonb_build_object('status', old.status)
        )
      );
    end if;
  end if;
  return new;
end;
$$;
