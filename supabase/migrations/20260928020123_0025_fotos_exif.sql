-- =============================================================================
-- Migration 0025: Smart Layout local — data/hora de captura (EXIF) nas fotos
--
-- O navegador lê o EXIF no upload (lib/exif, `exifr`, custo zero) e grava no
-- próprio objeto do Storage (`user_metadata`: capturadaEm, camera). Aqui:
--   * `fotos` ganha `capturada_em` (timestamp SEM fuso: o relógio da câmera,
--     como ela marcou — o agrupamento só depende da diferença entre fotos) e
--     `camera` (modelo + fim do nº de série, para separar 2 câmeras);
--   * a conversão pedido → projeto passa a copiar esses metadados do Storage
--     para `fotos`;
--   * retroativo: fotos já registradas cujo objeto tenha os metadados.
-- O agrupamento em cenas é calculado na leitura (tela do designer), sobre
-- TODAS as fotos do projeto — nunca fica desatualizado se chegarem mais fotos.
-- =============================================================================

alter table public.fotos
  add column if not exists capturada_em timestamp without time zone,
  add column if not exists camera text check (camera is null or char_length(camera) <= 80);

create index if not exists idx_fotos_projeto_captura on public.fotos (projeto_id, capturada_em);

-- Texto vindo do navegador → timestamp, ou null se vier qualquer coisa estranha.
create or replace function public._captura_ou_nulo(p_texto text)
returns timestamp without time zone
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_texto is null or p_texto !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?$' then
    return null;
  end if;
  return p_texto::timestamp without time zone;
exception when others then
  return null;
end;
$$;

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
    return v_order.projeto_id;
  end if;

  if v_order.status in ('pendente', 'cancelado') then
    raise exception 'Pedido #% ainda não foi liberado para produção (status %)', v_order.numero, v_order.status;
  end if;

  if not exists (select 1 from public.fotografos f where f.id = v_order.client_id) then
    raise exception 'O dono do pedido #% não é um estúdio cadastrado em fotografos', v_order.numero;
  end if;

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

  if v_order.chave_idempotencia is not null then
    -- Os metadados de captura (EXIF lido no navegador) vêm junto com o arquivo.
    insert into public.fotos (projeto_id, storage_path, bucket, enviado_por, capturada_em, camera)
    select
      v_projeto_id, o.name, 'pedidos_fotos', v_order.client_id,
      public._captura_ou_nulo(o.user_metadata ->> 'capturadaEm'),
      left(nullif(trim(o.user_metadata ->> 'camera'), ''), 80)
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

-- Retroativo: fotos já registradas cujo objeto no Storage tenha os metadados.
update public.fotos f
  set capturada_em = public._captura_ou_nulo(o.user_metadata ->> 'capturadaEm'),
      camera = coalesce(f.camera, left(nullif(trim(o.user_metadata ->> 'camera'), ''), 80))
  from storage.objects o
  where o.bucket_id = f.bucket
    and o.name = f.storage_path
    and f.capturada_em is null
    and o.user_metadata ? 'capturadaEm';
