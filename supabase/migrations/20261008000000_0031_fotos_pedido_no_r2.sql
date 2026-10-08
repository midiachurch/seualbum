-- =============================================================================
-- Migration 0031: corte das fotos do pedido para o Cloudflare R2
--
-- Depois desta migration, as fotos do wizard de novo pedido existem só no R2
-- (índice em `pedidos_fotos_r2`, 0030). O bucket `pedidos_fotos` do Supabase
-- deixa de ser lido e escrito pelo app:
--   1. `pedidos_fotos_r2` guarda o EXIF de captura (antes ia no user_metadata
--      do objeto do Storage, 0025);
--   2. `fotos.bucket` aceita 'r2' — `storage_path` passa a ser a chave no R2;
--   3. a conversão pedido → projeto lê `pedidos_fotos_r2`, não storage.objects;
--   4. a limpeza de rascunhos parados (72h) passa a ser o cron da Vercel
--      (/api/cron/limpar-fotos-r2), que usa `rascunhos_r2_expirados`; o job
--      do pg_cron que chamava a edge function `limpar-fotos-orfas` sai.
--
-- O bucket `pedidos_fotos` e o que houver nele ficam intocados: apagar é
-- decisão manual, no painel do Supabase.
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

-- 1. EXIF de captura ----------------------------------------------------------
alter table public.pedidos_fotos_r2
  add column if not exists capturada_em timestamp without time zone,
  add column if not exists camera text check (camera is null or char_length(camera) <= 80);

-- 2. fotos no R2 --------------------------------------------------------------
alter table public.fotos drop constraint if exists fotos_bucket_check;
alter table public.fotos
  add constraint fotos_bucket_check check (bucket in ('projetos_fotos', 'pedidos_fotos', 'r2'));

-- 3. Conversão pedido → projeto ----------------------------------------------
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
    -- As fotos ficam no R2 (migration 0030); o projeto só registra a chave.
    -- Os metadados de captura (EXIF lido no navegador) vêm da confirmação.
    insert into public.fotos (projeto_id, storage_path, bucket, enviado_por, capturada_em, camera)
    select v_projeto_id, r.r2_key, 'r2', v_order.client_id, r.capturada_em, r.camera
    from public.pedidos_fotos_r2 r
    where r.client_id = v_order.client_id
      and r.chave_idempotencia = v_order.chave_idempotencia
    order by r.r2_key;
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

-- 4. Limpeza dos rascunhos parados -------------------------------------------
-- Chaves de rascunhos cuja última foto tem mais de N horas e que nunca viraram
-- pedido. Mesma regra da 0015/0016, agora sobre `pedidos_fotos_r2`.
create or replace function public.rascunhos_r2_expirados(p_horas integer default 72, p_limite integer default 1000)
returns table (r2_key text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with rascunhos as (
    select r.client_id, r.chave_idempotencia, max(r.created_at) as ultima_atividade
    from public.pedidos_fotos_r2 r
    group by 1, 2
  )
  select r.r2_key
  from public.pedidos_fotos_r2 r
  join rascunhos x using (client_id, chave_idempotencia)
  where x.ultima_atividade < now() - make_interval(hours => greatest(p_horas, 0))
    and not exists (
      select 1 from public.orders o where o.chave_idempotencia = r.chave_idempotencia
    )
  order by r.r2_key
  limit greatest(least(p_limite, 1000), 1);
$$;

revoke execute on function public.rascunhos_r2_expirados(integer, integer) from public, anon, authenticated;
grant execute on function public.rascunhos_r2_expirados(integer, integer) to service_role;

-- O job antigo apagava do bucket `pedidos_fotos`, que não recebe mais nada.
do $$ begin
  perform cron.unschedule('limpeza-fotos-orfas');
exception when others then null; -- job (ou extensão) inexistente
end $$;
