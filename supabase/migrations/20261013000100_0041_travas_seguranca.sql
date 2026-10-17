-- =============================================================================
-- Migration 0041: travas de segurança na camada de banco (auditoria de out/26)
--
-- Tudo aqui fecha um caminho que a API (PostgREST, sessão `authenticated`)
-- deixava aberto, sem mudar os fluxos legítimos — que rodam por funções
-- SECURITY DEFINER (cadastro, conversão pedido → projeto, aprovação), pela
-- service_role (webhooks, scripts) ou pela equipe.
--
-- Padrão dos gatilhos novos (o mesmo da 0023 e da 0036): SECURITY INVOKER e
-- `current_user in ('authenticated', 'anon')` = a escrita veio direto da
-- sessão do usuário. Dentro de uma função security definer `current_user` é o
-- dono dela, e para a service_role é `service_role` — esses passam.
--
--   1. `fotografos`: qualquer conta (até cliente final) inseria a própria linha
--      com `plano_id` de assinatura e `status = 'ativo'`, e com isso
--      `minha_assinatura()` + `orders_insert_own` abriam pedido já
--      `na_fila_design` (projeto sem pagar). Agora: só fotógrafo (ou gestão)
--      insere; na inserção pela sessão, plano e status são sempre os padrões;
--      `minha_assinatura()` e o pedido próprio exigem o papel `fotografo`.
--   2. `projetos`: INSERT pela sessão (não gestão) sai sempre como projeto novo
--      (status, responsável, plano, franquia, prazos, expedição e controle de
--      diagramação no padrão) e o cliente precisa ser do mesmo estúdio.
--   3. `orders`: pela sessão (não gestão), `projeto_id` e `chave_idempotencia`
--      não mudam, a sessão do Stripe não pode ser apagada e o plano trava
--      depois de aberto o checkout.
--   4. `projeto_herda_franquia_do_pedido`: só copia a franquia para projeto do
--      mesmo estúdio do pedido.
--   5. `clientes.observacoes_internas`: o cliente final lia as anotações
--      internas do estúdio/equipe sobre ele (`select *` no próprio registro).
--      A coluna sai do SELECT de `authenticated`; quem tem direito lê pela
--      função `listar_clientes_visiveis()`.
--   6. `projeto_atividades`: `autor_id` é sempre quem está logado.
--   7. `projetos`: prazos (`prazo`, `data_limite_producao`,
--      `data_limite_aprovacao`), expedição (`codigo_rastreio`, `enviado_em`) e
--      `produto_id` só pela equipe.
--   8. `fotos`: pela sessão, só `bucket = 'r2'` e `enviado_por` = quem envia.
--   9. `get_orcamento_publico`: orçamento em rascunho não aparece no link
--      público (o app marca como enviado ao copiar o link).
--  10. `registrar_comunicacao_status()`: escapa o HTML de tudo que vem do
--      usuário (nome do projeto, do cliente, do estúdio, rastreio, itens).
--      Linhas antigas de `comunicacoes_log` não são alteradas.
--
-- Fica como está: EXECUTE de `_usuario_eh_equipe(uuid)` para `authenticated`
-- (0037) — a policy `conversa_leituras_select` a chama com o papel de quem
-- consulta; sem o grant a leitura de mensagens quebra.
--
-- Idempotente: pode ser reexecutada com segurança. Aplicada em 17/10/2026.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. fotografos / assinatura / pedido de assinatura
-- -----------------------------------------------------------------------------

-- A linha de `fotografos` nasce pelo cadastro (handle_new_user,
-- concluir_cadastro_google — ambas security definer). Pela API, só quem já é
-- fotógrafo (perfil) ou a gestão.
drop policy if exists "fotografos_insert_self_or_equipe" on public.fotografos;
create policy "fotografos_insert_self_or_equipe"
  on public.fotografos for insert to authenticated
  with check (
    (id = auth.uid() and public.current_role_v() = 'fotografo')
    or public.is_gestor_ou_admin()
  );

-- O guard de UPDATE (0002) não cobria o INSERT: plano e status nascem no
-- padrão quando a linha vem da sessão de quem não é gestão.
create or replace function public.guardar_insercao_fotografo()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_gestor_ou_admin() then
    new.plano_id := null;
    new.status := 'ativo';
  end if;
  return new;
end;
$$;

revoke execute on function public.guardar_insercao_fotografo() from public, anon, authenticated;

drop trigger if exists trg_guardar_insercao_fotografo on public.fotografos;
create trigger trg_guardar_insercao_fotografo
  before insert on public.fotografos
  for each row execute function public.guardar_insercao_fotografo();

-- Assinatura só vale para conta de estúdio (papel `fotografo` no perfil).
create or replace function public.minha_assinatura()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select f.plano_id
  from public.fotografos f
  join public.profiles pr on pr.id = f.id and pr.role = 'fotografo'
  join public.planos p on p.id = f.plano_id
  where f.id = auth.uid()
    and f.status = 'ativo'
    and p.tipo_cobranca = 'assinatura';
$$;

-- Pedido próprio: só conta de estúdio (o app já exige o papel em criarPedidoAction).
drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
  on public.orders for insert to authenticated
  with check (
    (
      client_id = auth.uid()
      and public.current_role_v() = 'fotografo'
      and pago_em is null
      and valor_pago is null
      and (
        status = 'pendente'
        or (status = 'na_fila_design' and plan_id is not null and plan_id = public.minha_assinatura())
      )
    )
    or public.is_equipe()
  );

-- -----------------------------------------------------------------------------
-- 2. projetos: INSERT pela sessão sai sempre como projeto novo
-- -----------------------------------------------------------------------------
-- Gestão (wizard /admin/projetos/novo) segue livre. A conversão de pedido
-- (`converter_pedido_em_projeto`, security definer) e a service_role passam
-- pelo `current_user`. Roda depois de `trg_franquia_do_projeto` (ordem
-- alfabética dos gatilhos BEFORE), então a franquia também zera aqui.
create or replace function public.guardar_insercao_projeto()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_gestor_ou_admin() then
    return new;
  end if;

  -- RLS de `clientes` com o papel de quem insere: cliente de outro estúdio
  -- nem aparece, então cai aqui também.
  if not exists (
    select 1 from public.clientes c
    where c.id = new.cliente_id and c.fotografo_id = new.fotografo_id
  ) then
    raise exception 'O cliente não pertence a este estúdio.' using errcode = '42501';
  end if;

  new.status                := 'projeto_criado';
  new.responsavel_id        := null;
  new.plano_id              := null;
  new.laminas_inclusas      := null;
  new.preco_lamina_extra    := null;
  new.produto_id            := null;
  new.prazo                 := null;
  new.data_limite_producao  := now() + interval '7 days';
  new.data_limite_aprovacao := null;
  new.codigo_rastreio       := null;
  new.enviado_em            := null;
  new.prioridade            := 'normal';
  new.em_espera             := false;
  new.em_espera_motivo      := null;
  new.em_espera_desde       := null;
  return new;
end;
$$;

revoke execute on function public.guardar_insercao_projeto() from public, anon, authenticated;

drop trigger if exists trg_guardar_insercao_projeto on public.projetos;
create trigger trg_guardar_insercao_projeto
  before insert on public.projetos
  for each row execute function public.guardar_insercao_projeto();

-- -----------------------------------------------------------------------------
-- 3. orders: vínculo com projeto, idempotência, checkout e plano
-- -----------------------------------------------------------------------------
-- `guard_order_admin_fields` (0012) é security definer — não enxerga quem
-- chamou. Este complementa, invoker: a conversão (definer) grava `projeto_id`
-- e o webhook (service_role) grava a sessão do Stripe sem passar por aqui.
-- O app, pela sessão do estúdio, só grava `stripe_checkout_session_id` ao
-- abrir (ou reabrir) o checkout — continua podendo trocar por outra sessão.
create or replace function public.guardar_campos_pedido()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_gestor_ou_admin() then
    return new;
  end if;

  if new.projeto_id is distinct from old.projeto_id
     or new.chave_idempotencia is distinct from old.chave_idempotencia then
    raise exception 'Projeto e chave do pedido são controlados pela plataforma.' using errcode = '42501';
  end if;

  if old.stripe_checkout_session_id is not null and new.stripe_checkout_session_id is null then
    raise exception 'A sessão de pagamento do pedido não pode ser apagada.' using errcode = '42501';
  end if;

  if new.plan_id is distinct from old.plan_id and old.stripe_checkout_session_id is not null then
    raise exception 'O plano não muda depois de aberto o pagamento. Crie um novo pedido.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.guardar_campos_pedido() from public, anon, authenticated;

drop trigger if exists trg_guardar_campos_pedido on public.orders;
create trigger trg_guardar_campos_pedido
  before update on public.orders
  for each row execute function public.guardar_campos_pedido();

-- -----------------------------------------------------------------------------
-- 4. A franquia do pedido só vai para projeto do mesmo estúdio
-- -----------------------------------------------------------------------------
create or replace function public.projeto_herda_franquia_do_pedido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.projeto_id is not null and old.projeto_id is null then
    update public.projetos
      set laminas_inclusas = new.laminas_inclusas, preco_lamina_extra = new.preco_lamina_extra
      where id = new.projeto_id
        and fotografo_id = new.client_id;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. clientes.observacoes_internas fora do alcance do cliente final
-- -----------------------------------------------------------------------------
-- RLS não filtra coluna: tira-se o SELECT da coluna de `authenticated` (as
-- demais seguem liberadas; a RLS continua decidindo as linhas). INSERT e
-- UPDATE da coluna seguem como estavam (cadastro do CRM). As funções security
-- definer que leem `clientes` não são afetadas.
revoke select on public.clientes from anon, authenticated;
grant select (
  id, user_id, fotografo_id, nome, email, telefone, cidade, estado, origem, status, created_at, updated_at
) on public.clientes to authenticated;

-- Lista completa (com a anotação interna) para quem a escreve: o estúdio dono
-- e a operação — mesma regra de `clientes_select_own_scope`, sem o ramo do
-- cliente final.
create or replace function public.listar_clientes_visiveis()
returns setof public.clientes
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.*
  from public.clientes c
  where c.fotografo_id = auth.uid() or public.is_operacao();
$$;

revoke execute on function public.listar_clientes_visiveis() from public, anon;
grant execute on function public.listar_clientes_visiveis() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. projeto_atividades: o autor é quem está logado
-- -----------------------------------------------------------------------------
-- Gatilhos security definer (aprovação do cliente, conversão de pedido) seguem
-- gravando o autor que escolhem (ou null = sistema).
create or replace function public.fixar_autor_atividade()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.autor_id := auth.uid();
  end if;
  return new;
end;
$$;

revoke execute on function public.fixar_autor_atividade() from public, anon, authenticated;

drop trigger if exists trg_fixar_autor_atividade on public.projeto_atividades;
create trigger trg_fixar_autor_atividade
  before insert on public.projeto_atividades
  for each row execute function public.fixar_autor_atividade();

-- -----------------------------------------------------------------------------
-- 7. projetos: prazos, expedição e produto só pela equipe
-- -----------------------------------------------------------------------------
-- Igual à 0023, mais as colunas novas na trava de "não equipe". Ninguém fora
-- da equipe grava essas colunas no app (expedição e diagramação são da
-- equipe; o prazo de aprovação é carimbado por `definir_prazo_aprovacao`
-- quando a produção muda o status).
create or replace function public.guardar_campos_projeto()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if (new.laminas_inclusas is distinct from old.laminas_inclusas
      or new.preco_lamina_extra is distinct from old.preco_lamina_extra)
     and not public.is_gestor_ou_admin() then
    raise exception 'Só a gestão altera a franquia de lâminas do projeto.' using errcode = '42501';
  end if;

  if not public.is_equipe() and (
       new.status         is distinct from old.status
    or new.plano_id       is distinct from old.plano_id
    or new.responsavel_id is distinct from old.responsavel_id
    or new.fotografo_id   is distinct from old.fotografo_id
    or new.cliente_id     is distinct from old.cliente_id
  ) then
    raise exception 'Status e responsáveis do projeto são controlados pela produção.' using errcode = '42501';
  end if;

  if not public.is_equipe() and (
       new.prazo                 is distinct from old.prazo
    or new.data_limite_producao  is distinct from old.data_limite_producao
    or new.data_limite_aprovacao is distinct from old.data_limite_aprovacao
    or new.codigo_rastreio       is distinct from old.codigo_rastreio
    or new.enviado_em            is distinct from old.enviado_em
    or new.produto_id            is distinct from old.produto_id
  ) then
    raise exception 'Prazos, produto e expedição do projeto são controlados pela produção.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'aprovado_aguardando_pagamento' or old.status = 'aprovado_aguardando_pagamento' then
      raise exception 'Este projeto está com lâminas extras a pagar: libere pelo pagamento ou pela cortesia.' using errcode = '42501';
    end if;
    if new.status = 'aprovado' and not public.is_gestor_ou_admin() then
      raise exception 'Só a gestão marca um projeto como aprovado para impressão.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. fotos: pela sessão, só R2 e em nome de quem envia
-- -----------------------------------------------------------------------------
-- O upload do app (/api/uploads/projeto-foto/confirmar) grava sempre
-- `bucket = 'r2'` e `enviado_por` = o usuário. O bucket antigo
-- `projetos_fotos` só é lido (fotos legadas); a conversão de pedido e os
-- scripts gravam fora da RLS.
drop policy if exists "fotos_insert" on public.fotos;
create policy "fotos_insert" on public.fotos for insert to authenticated
  with check (
    public.pode_ver_projeto(projeto_id)
    and bucket = 'r2'
    and enviado_por = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- 9. Link público do orçamento: rascunho não aparece
-- -----------------------------------------------------------------------------
create or replace function public.get_orcamento_publico(p_hash text)
returns table (
  cliente_final_nome text,
  itens_json         jsonb,
  valor_total        numeric,
  estudio            text,
  logo_url           text,
  criado_em          timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select o.cliente_final_nome, o.itens_json, o.valor_total, f.estudio, f.logo_url, o.created_at
  from public.orcamentos o
  join public.fotografos f on f.id = o.fotografo_id
  where o.hash_publico = p_hash
    and o.status <> 'rascunho';
$$;

revoke execute on function public.get_orcamento_publico(text) from public;
grant execute on function public.get_orcamento_publico(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 10. E-mails simulados: HTML escapado
-- -----------------------------------------------------------------------------
create or replace function private.escapar_html(p_texto text)
returns text
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select replace(replace(replace(replace(replace(
    p_texto,
    '&', '&amp;'),
    '<', '&lt;'),
    '>', '&gt;'),
    '"', '&quot;'),
    '''', '&#39;');
$$;

revoke execute on function private.escapar_html(text) from public, anon, authenticated;

-- Idêntica à 0026b, exceto pelo `private.escapar_html` em cada valor vindo de
-- usuário dentro do `corpo_html`. O assunto é texto puro (não é HTML).
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
  v_fatura    record;
  v_lista     text;
  v_tipo      text;
  v_assunto   text;
  v_corpo     text;
  v_nome      text := private.escapar_html(new.nome);
  v_rodape    text := '<p style="color:#595959;font-size:12px">Este é um e-mail simulado — nenhuma mensagem real foi enviada (infraestrutura de e-mail ainda não conectada).</p>';
begin
  if new.status = old.status then
    return new;
  end if;

  v_tipo := case new.status
    when 'aguardando_fotos' then 'aguardando_fotos'
    when 'aguardando_aprovacao_cliente' then 'prova_pronta'
    when 'aprovado_aguardando_pagamento' then 'excedente_pendente'
    when 'aprovado' then 'aprovado'
    when 'enviado' then 'enviado'
    when 'finalizado' then 'finalizado'
    else null
  end;

  if v_tipo is null then
    return new;
  end if;

  if v_tipo = 'prova_pronta' then
    select max(numero) into v_versao
    from public.design_versions
    where projeto_id = new.id and status = 'aprovada';
    if coalesce(v_versao, 1) > 1 then
      v_tipo := 'nova_versao';
    end if;
  end if;

  if new.fotografo_id is not null then
    select coalesce(nullif(trim(f.estudio), ''), pr.nome_completo) into v_fotografo
    from public.profiles pr left join public.fotografos f on f.id = pr.id
    where pr.id = new.fotografo_id;
  end if;

  -- Fechamento do estúdio (lâminas extras e/ou adicionais): só o fotógrafo recebe.
  if v_tipo = 'excedente_pendente' then
    select fa.id, fa.valor_total,
           exists (select 1 from public.fatura_itens i where i.fatura_id = fa.id and i.situacao = 'aguardando_estudio') as tem_pedido_cliente
      into v_fatura
      from public.faturas fa where fa.projeto_id = new.id and fa.status_pagamento = 'pendente'
      order by fa.created_at desc limit 1;

    select string_agg('<li>' || i.quantidade || '× ' || private.escapar_html(i.descricao)
                      || case when i.situacao = 'aguardando_estudio' then ' <em>(pedido do cliente — aguarda sua confirmação)</em>' else '' end
                      || '</li>', '' order by i.created_at)
      into v_lista
      from public.fatura_itens i where i.fatura_id = v_fatura.id and i.situacao <> 'removido';

    insert into public.comunicacoes_log (projeto_id, cliente_id, tipo_evento, assunto, corpo_html, status, destinatario)
    values (
      new.id, new.cliente_id, v_tipo,
      case when v_fatura.tem_pedido_cliente
        then 'Seu cliente pediu adicionais — confirme no painel — ' || new.nome
        else 'Álbum aprovado — fechamento pendente — ' || new.nome end,
      '<div style="font-family:sans-serif;color:#171717;line-height:1.5">'
        || '<p>Olá, ' || coalesce(private.escapar_html(v_fotografo), 'estúdio') || '!</p>'
        || '<p>O álbum <strong>' || v_nome || '</strong> foi aprovado. Para seguir para a gráfica, falta o fechamento no seu painel, em Meus álbuns:</p>'
        || '<ul>' || coalesce(v_lista, '') || '</ul>'
        || v_rodape || '</div>',
      'simulado', 'fotografo'
    );
    return new;
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
    || '<p>Olá, ' || coalesce(private.escapar_html(v_cliente.nome), 'cliente') || '!</p>'
    || '<p>' || (case v_tipo
        when 'aguardando_fotos' then 'Recebemos seu pedido para o projeto <strong>' || v_nome || '</strong> e estamos aguardando o envio das fotos para começar a diagramação.'
        when 'prova_pronta' then 'A prova digital do seu álbum <strong>' || v_nome || '</strong> já está pronta. Acesse o portal para revisar e aprovar quando quiser.'
        when 'nova_versao' then 'Aplicamos os ajustes que você pediu. A versão ' || v_versao || ' do álbum <strong>' || v_nome || '</strong> já está disponível para aprovação no portal.'
        when 'aprovado' then 'Seu álbum <strong>' || v_nome || '</strong> foi aprovado e já seguiu para a produção gráfica. Em breve você recebe novidades sobre a entrega.'
        when 'enviado' then 'Seu álbum <strong>' || v_nome || '</strong> foi despachado!' ||
          case when new.codigo_rastreio is not null then ' Código de rastreio: <strong>' || private.escapar_html(new.codigo_rastreio) || '</strong>.' else '' end
        when 'finalizado' then 'Seu álbum <strong>' || v_nome || '</strong> foi finalizado. Obrigado por confiar no nosso trabalho!'
      end) || '</p>'
    || v_rodape
    || '</div>';

  insert into public.comunicacoes_log (projeto_id, cliente_id, tipo_evento, assunto, corpo_html, status, destinatario)
  values (new.id, new.cliente_id, v_tipo, v_assunto, v_corpo, 'simulado', 'cliente');

  if v_tipo in ('prova_pronta', 'nova_versao') and new.fotografo_id is not null then
    insert into public.comunicacoes_log (projeto_id, cliente_id, tipo_evento, assunto, corpo_html, status, destinatario)
    values (
      new.id, new.cliente_id, v_tipo,
      case v_tipo
        when 'nova_versao' then 'Nova versão disponível para aprovação — ' || new.nome || ' (versão ' || v_versao || ')'
        else 'Prova digital pronta para revisão — ' || new.nome
      end,
      '<div style="font-family:sans-serif;color:#171717;line-height:1.5">'
        || '<p>Olá, ' || coalesce(private.escapar_html(v_fotografo), 'estúdio') || '!</p>'
        || '<p>' || (case v_tipo
            when 'nova_versao' then 'A equipe aplicou os ajustes da versão anterior. A versão ' || v_versao || ' do álbum <strong>' || v_nome || '</strong> está disponível para aprovação no seu painel, em Meus álbuns.'
            else 'A prova digital do álbum <strong>' || v_nome || '</strong> está pronta. Revise, marque os pontos de ajuste e aprove pelo seu painel, em Meus álbuns.'
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
