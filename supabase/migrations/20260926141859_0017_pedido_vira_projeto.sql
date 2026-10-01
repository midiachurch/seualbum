-- =============================================================================
-- Migration 0017: Fase 1 da ligação `orders` (compra) → `projetos` (produção)
--
-- Decisões de produto (ver tese de arquitetura):
--   - Tabelas separadas, ligadas 1:1 por `orders.projeto_id`. Fundir exporia
--     dados de pagamento ao cliente final, que lê a linha do projeto (RLS é
--     por linha, não por coluna) e quebraria o white label.
--   - Quando o pedido é liberado para produção (sai de `pendente`, seja pelo
--     pagamento, seja por nascer como pedido de assinante), um trigger chama
--     `converter_pedido_em_projeto()`, que cria cliente final + projeto e
--     registra as fotos já enviadas — sem copiar arquivos (`fotos.bucket`).
--   - `clientes.email` passa a ser opcional: o wizard não pode exigir os dados
--     do casal para gerar o pedido.
--   - O fotógrafo, dono do projeto, também aprova e comenta a prova (antes
--     só o cliente final).
--
-- A conversão NUNCA derruba a liberação do pedido: se falhar (ex.: o dono do
-- pedido não é um estúdio), o trigger só registra um WARNING e o pedido segue
-- liberado sem projeto; `converter_pedido_em_projeto(id)` pode ser rodada de
-- novo depois (é idempotente).
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Colunas novas e e-mail opcional
-- -----------------------------------------------------------------------------

alter table public.orders
  add column if not exists projeto_id uuid references public.projetos (id) on delete set null;

do $$ begin
  alter table public.orders add constraint orders_projeto_id_key unique (projeto_id);
exception when duplicate_object or duplicate_table then null; end $$;

-- Em qual bucket está o arquivo: fotos do wizard ficam onde foram enviadas.
alter table public.fotos
  add column if not exists bucket text not null default 'projetos_fotos';

do $$ begin
  alter table public.fotos
    add constraint fotos_bucket_check check (bucket in ('projetos_fotos', 'pedidos_fotos'));
exception when duplicate_object then null; end $$;

alter table public.clientes alter column email drop not null;

-- -----------------------------------------------------------------------------
-- 2. Prazo em dias úteis (seg–sex, fuso de São Paulo; feriados não entram)
-- -----------------------------------------------------------------------------

create or replace function public.somar_dias_uteis(p_inicio timestamptz, p_dias integer)
returns timestamptz
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_data  timestamptz := p_inicio;
  v_somados integer := 0;
begin
  while v_somados < greatest(coalesce(p_dias, 0), 0) loop
    v_data := v_data + interval '1 day';
    if extract(isodow from v_data at time zone 'America/Sao_Paulo') < 6 then
      v_somados := v_somados + 1;
    end if;
  end loop;
  return v_data;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Conversão pedido → projeto (idempotente)
-- -----------------------------------------------------------------------------

create or replace function public.converter_pedido_em_projeto(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order      public.orders%rowtype;
  v_cliente_id uuid;
  v_projeto_id uuid;
  v_prazo      timestamptz;
  v_nome       text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido % não encontrado', p_order_id;
  end if;

  if v_order.projeto_id is not null then
    return v_order.projeto_id; -- já convertido
  end if;

  if v_order.status in ('pendente', 'cancelado') then
    raise exception 'Pedido #% ainda não foi liberado para produção (status %)', v_order.numero, v_order.status;
  end if;

  if not exists (select 1 from public.fotografos f where f.id = v_order.client_id) then
    raise exception 'O dono do pedido #% não é um estúdio cadastrado em fotografos', v_order.numero;
  end if;

  -- Cliente final: reaproveita o do mesmo estúdio com o mesmo e-mail; sem
  -- e-mail (ou e-mail novo), cria um registro com o que houver.
  if v_order.cliente_final_email is not null then
    select c.id into v_cliente_id
    from public.clientes c
    where c.fotografo_id = v_order.client_id
      and lower(c.email) = lower(v_order.cliente_final_email)
    order by c.created_at
    limit 1;
  end if;

  if v_cliente_id is null then
    v_nome := nullif(trim(v_order.cliente_final_nome), '');
    if v_nome is null or char_length(v_nome) < 2 then
      v_nome := v_order.nome_projeto;
    end if;

    insert into public.clientes (fotografo_id, nome, email, telefone, origem)
    values (
      v_order.client_id,
      left(v_nome, 120),
      v_order.cliente_final_email,
      v_order.cliente_final_telefone,
      'pedido'
    )
    returning id into v_cliente_id;
  end if;

  v_prazo := public.somar_dias_uteis(
    now(),
    coalesce((select pl.prazo_dias from public.planos pl where pl.id = v_order.plan_id), 7)
  );

  -- Fotos e briefing já vêm prontos do wizard: entra direto como
  -- "pronto para diagramação".
  insert into public.projetos (
    nome, cliente_id, fotografo_id, plano_id, data_evento, status, prazo, data_limite_producao, briefing
  )
  values (
    v_order.nome_projeto,
    v_cliente_id,
    v_order.client_id,
    v_order.plan_id,
    v_order.data_evento,
    'pronto_para_diagramacao',
    v_prazo,
    v_prazo,
    jsonb_strip_nulls(jsonb_build_object(
      'origem', 'pedido',
      'pedidoNumero', v_order.numero,
      'estilo', v_order.estilo_design,
      'observacoes', v_order.briefing,
      'linkFotosBrutas', v_order.link_fotos_brutas
    ))
  )
  returning id into v_projeto_id;

  -- As fotos continuam em pedidos_fotos/{client_id}/{chave}/ — só registra.
  if v_order.chave_idempotencia is not null then
    insert into public.fotos (projeto_id, storage_path, bucket, enviado_por)
    select v_projeto_id, o.name, 'pedidos_fotos', v_order.client_id
    from storage.objects o
    where o.bucket_id = 'pedidos_fotos'
      and o.name like v_order.client_id::text || '/' || v_order.chave_idempotencia::text || '/%'
    order by o.name;
  end if;

  update public.orders set projeto_id = v_projeto_id where id = v_order.id;

  insert into public.projeto_atividades (projeto_id, autor_id, mensagem)
  values (
    v_projeto_id,
    null,
    format('Projeto criado a partir do pedido #%s (estilo %s).', v_order.numero, v_order.estilo_design)
  );

  return v_projeto_id;
end;
$$;

revoke execute on function public.converter_pedido_em_projeto(uuid) from public, anon, authenticated;
grant execute on function public.converter_pedido_em_projeto(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 4. Trigger: pedido liberado → projeto
-- -----------------------------------------------------------------------------

create or replace function public.pedido_liberado_vira_projeto()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.projeto_id is null
     and new.status not in ('pendente', 'cancelado')
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
  then
    begin
      perform public.converter_pedido_em_projeto(new.id);
    exception when others then
      -- Não derruba o pagamento/pedido: fica liberado sem projeto e o erro
      -- aparece no log do Postgres para reprocessar.
      raise warning '[converter_pedido_em_projeto] pedido #% (%): %', new.numero, new.id, sqlerrm;
    end;
  end if;
  return null;
end;
$$;

revoke execute on function public.pedido_liberado_vira_projeto() from public, anon, authenticated;

drop trigger if exists trg_pedido_liberado_vira_projeto on public.orders;
create trigger trg_pedido_liberado_vira_projeto
  after insert or update of status on public.orders
  for each row execute function public.pedido_liberado_vira_projeto();

-- -----------------------------------------------------------------------------
-- 5. Prova: o fotógrafo dono do projeto também aprova e comenta
-- -----------------------------------------------------------------------------

drop policy if exists "aprovacoes_insert_cliente" on public.aprovacoes;
drop policy if exists "aprovacoes_insert_cliente_ou_fotografo" on public.aprovacoes;
create policy "aprovacoes_insert_cliente_ou_fotografo"
  on public.aprovacoes for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1
      from public.projetos p
      left join public.clientes c on c.id = p.cliente_id
      where p.id = aprovacoes.projeto_id
        and (c.user_id = auth.uid() or p.fotografo_id = auth.uid())
    )
  );

drop policy if exists "prova_comentarios_insert_cliente" on public.prova_comentarios;
drop policy if exists "prova_comentarios_insert_cliente_ou_fotografo" on public.prova_comentarios;
create policy "prova_comentarios_insert_cliente_ou_fotografo"
  on public.prova_comentarios for insert to authenticated
  with check (
    autor_id = auth.uid()
    and exists (
      select 1
      from public.projetos p
      left join public.clientes c on c.id = p.cliente_id
      where p.id = prova_comentarios.projeto_id
        and (c.user_id = auth.uid() or p.fotografo_id = auth.uid())
    )
  );

-- O histórico dizia "Cliente aprovou…" para qualquer aprovação; agora que o
-- fotógrafo também aprova, a mensagem diz quem foi.
create or replace function public.aplicar_aprovacao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quem text;
begin
  update public.projetos
    set status = case when new.status = 'aprovado' then 'aprovado'::public.project_status
                       else 'alteracoes_solicitadas'::public.project_status end
    where id = new.projeto_id;

  v_quem := case
    when exists (select 1 from public.projetos p where p.id = new.projeto_id and p.fotografo_id = new.usuario_id)
      then 'Fotógrafo'
    else 'Cliente'
  end;

  insert into public.projeto_atividades (projeto_id, autor_id, mensagem)
  values (
    new.projeto_id,
    new.usuario_id,
    case when new.status = 'aprovado' then v_quem || ' aprovou a versão ' || new.versao
         else v_quem || ' solicitou alterações na versão ' || new.versao end
  );
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Backfill: pedidos já liberados antes desta migration
-- -----------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select id, numero from public.orders
    where projeto_id is null and status not in ('pendente', 'cancelado')
  loop
    begin
      perform public.converter_pedido_em_projeto(r.id);
    exception when others then
      raise warning '[backfill] pedido #%: %', r.numero, sqlerrm;
    end;
  end loop;
end $$;
