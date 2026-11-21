-- Store (S01–S04): venda do ESTÚDIO ao cliente final, no servidor.
-- ADR-004: contexto financeiro PRÓPRIO ('venda_estudio'). Não reaproveita
-- orders/faturas nem metadata de outros contextos (serviço SeuAlbum e assinatura
-- SaaS seguem separados). O estúdio é o vendedor; a plataforma não define aqui
-- gateway, split, tributação nem disputa — por isso o único provedor aceito é
-- 'simulado' (CHECK) e trocar isso é decisão própria, com migration própria.
-- Regras: preço SEMPRE calculado no banco a partir do catálogo (o cliente nunca
-- envia total); pedido congela preço/comissão; chave idempotente; estados finais
-- nunca reabrem; valor divergente não é aplicado; entrega só de mídia do próprio
-- projeto e só depois de pago. Comprador é o convidado do portal (link+código),
-- sem conta. Comissões/preços são hipóteses. NÃO aplicada em ambiente remoto.
begin;

create table public.store_produtos (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  nome           text not null check (length(trim(nome)) between 2 and 120),
  descricao      text check (descricao is null or length(descricao) <= 600),
  tipo           text not null check (tipo in ('colecao_digital', 'foto_avulsa', 'impressao', 'servico')),
  preco_centavos integer not null check (preco_centavos >= 0 and preco_centavos <= 100000000),
  comissao_bps   integer not null default 0 check (comissao_bps between 0 and 5000),
  ativo          boolean not null default true,
  criado_por     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index idx_store_produtos_org on public.store_produtos (organizacao_id, ativo);

create table public.store_projeto_produtos (
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  produto_id uuid not null references public.store_produtos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (projeto_id, produto_id)
);

create table public.store_pedidos (
  id               uuid primary key default gen_random_uuid(),
  organizacao_id   uuid not null references public.organizacoes (id) on delete restrict,
  projeto_id       uuid not null references public.projetos (id) on delete restrict,
  chave            uuid not null unique,
  payload_hash     text not null,
  comprador_nome   text not null check (length(trim(comprador_nome)) between 2 and 120),
  comprador_email  text not null check (length(comprador_email) between 5 and 254 and comprador_email = lower(comprador_email)),
  contexto         text not null default 'venda_estudio' check (contexto = 'venda_estudio'),
  status           text not null default 'pendente' check (status in ('pendente', 'pago', 'recusado', 'cancelado', 'estornado')),
  moeda            text not null default 'BRL' check (moeda = 'BRL'),
  total_centavos   integer not null check (total_centavos >= 0),
  comissao_centavos integer not null check (comissao_centavos >= 0 and comissao_centavos <= total_centavos),
  liquido_centavos integer not null check (liquido_centavos = total_centavos - comissao_centavos),
  provedor         text not null default 'simulado' check (provedor = 'simulado'),
  token_hash       text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at       timestamptz not null default now(),
  pago_em          timestamptz,
  encerrado_em     timestamptz
);
create index idx_store_pedidos_org on public.store_pedidos (organizacao_id, created_at desc);
create index idx_store_pedidos_projeto on public.store_pedidos (projeto_id, status);

create table public.store_pedido_itens (
  id             uuid primary key default gen_random_uuid(),
  pedido_id      uuid not null references public.store_pedidos (id) on delete cascade,
  produto_id     uuid not null references public.store_produtos (id) on delete restrict,
  nome           text not null,
  tipo           text not null,
  preco_centavos integer not null check (preco_centavos >= 0),
  comissao_bps   integer not null check (comissao_bps between 0 and 5000),
  quantidade     integer not null check (quantidade between 1 and 1000),
  foto_ids       uuid[] not null default '{}',
  total_centavos integer not null check (total_centavos >= 0),
  comissao_centavos integer not null check (comissao_centavos >= 0)
);
create index idx_store_itens_pedido on public.store_pedido_itens (pedido_id);

create table public.store_eventos_pagamento (
  id             uuid primary key default gen_random_uuid(),
  provedor       text not null,
  evento_id      text not null check (length(evento_id) between 1 and 200),
  organizacao_id uuid references public.organizacoes (id) on delete set null,
  pedido_id      uuid references public.store_pedidos (id) on delete set null,
  tipo           text not null check (tipo in ('pago', 'recusado', 'estornado')),
  valor_centavos integer not null check (valor_centavos >= 0),
  resultado      text not null check (resultado in ('aplicado', 'replay', 'divergente', 'fora_de_ordem', 'pedido_inexistente')),
  detalhe        text,
  created_at     timestamptz not null default now(),
  unique (provedor, evento_id)
);
create index idx_store_eventos_pedido on public.store_eventos_pagamento (pedido_id);

create table public.store_entrega_falhas (
  id         uuid primary key default gen_random_uuid(),
  pedido_id  uuid not null references public.store_pedidos (id) on delete cascade,
  foto_id    uuid,
  motivo     text not null check (length(motivo) <= 300),
  created_at timestamptz not null default now()
);

alter table public.store_produtos enable row level security;
alter table public.store_projeto_produtos enable row level security;
alter table public.store_pedidos enable row level security;
alter table public.store_pedido_itens enable row level security;
alter table public.store_eventos_pagamento enable row level security;
alter table public.store_entrega_falhas enable row level security;
revoke all on table public.store_produtos, public.store_projeto_produtos, public.store_pedidos,
  public.store_pedido_itens, public.store_eventos_pagamento, public.store_entrega_falhas from public, anon, authenticated;
grant select on table public.store_produtos, public.store_projeto_produtos to authenticated;
-- Pedidos e financeiro: só dono e admin da organização (token_hash nunca legível).
grant select (id, organizacao_id, projeto_id, chave, comprador_nome, comprador_email, contexto, status, moeda,
  total_centavos, comissao_centavos, liquido_centavos, provedor, created_at, pago_em, encerrado_em)
  on table public.store_pedidos to authenticated;
grant select on table public.store_pedido_itens, public.store_eventos_pagamento, public.store_entrega_falhas to authenticated;
grant all on table public.store_produtos, public.store_projeto_produtos, public.store_pedidos,
  public.store_pedido_itens, public.store_eventos_pagamento, public.store_entrega_falhas to service_role;

create policy store_produtos_select on public.store_produtos for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) is not null);
create policy store_projeto_produtos_select on public.store_projeto_produtos for select to authenticated
  using (public.pode_ler_projeto_org(projeto_id));
create policy store_pedidos_select on public.store_pedidos for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) in ('dono', 'admin'));
create policy store_pedido_itens_select on public.store_pedido_itens for select to authenticated
  using (exists (select 1 from public.store_pedidos p where p.id = pedido_id and public.papel_na_organizacao(p.organizacao_id) in ('dono', 'admin')));
create policy store_eventos_select on public.store_eventos_pagamento for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) in ('dono', 'admin'));
create policy store_entrega_falhas_select on public.store_entrega_falhas for select to authenticated
  using (exists (select 1 from public.store_pedidos p where p.id = pedido_id and public.papel_na_organizacao(p.organizacao_id) in ('dono', 'admin')));

-- Divergências acionáveis para quem gere o financeiro (RLS do invocador).
create view public.store_divergencias with (security_invoker = true) as
  select e.id, e.organizacao_id, e.pedido_id, e.provedor, e.evento_id, e.tipo, e.valor_centavos, e.resultado, e.detalhe, e.created_at
    from public.store_eventos_pagamento e
   where e.resultado in ('divergente', 'fora_de_ordem', 'pedido_inexistente');
grant select on public.store_divergencias to authenticated;

-- S01/S02: catálogo. Só dono e admin gerem produtos; a chave p_id torna o retry idempotente.
create function public.store_salvar_produto(p_id uuid, p_org uuid, p_nome text, p_tipo text, p_preco integer,
  p_comissao_bps integer, p_ativo boolean, p_descricao text default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_papel text; v_existente public.store_produtos;
begin
  v_papel := public.papel_na_organizacao(p_org);
  if v_papel is null or v_papel not in ('dono', 'admin') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_id is null or p_nome is null or length(trim(p_nome)) not between 2 and 120
     or p_tipo is null or p_tipo not in ('colecao_digital', 'foto_avulsa', 'impressao', 'servico')
     or p_preco is null or p_preco not between 0 and 100000000
     or p_comissao_bps is null or p_comissao_bps not between 0 and 5000 or p_ativo is null
     or (p_descricao is not null and length(p_descricao) > 600) then
    raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 55));
  select * into v_existente from public.store_produtos where id = p_id;
  if found then
    if v_existente.organizacao_id <> p_org then raise exception 'Sem permissão.' using errcode = '42501'; end if;
    -- Preço/comissão novos valem só para pedidos futuros: pedidos antigos têm snapshot.
    update public.store_produtos set nome = trim(p_nome), descricao = p_descricao, tipo = p_tipo,
      preco_centavos = p_preco, comissao_bps = p_comissao_bps, ativo = p_ativo where id = p_id;
  else
    insert into public.store_produtos(id, organizacao_id, nome, descricao, tipo, preco_centavos, comissao_bps, ativo, criado_por)
      values (p_id, p_org, trim(p_nome), p_descricao, p_tipo, p_preco, p_comissao_bps, p_ativo, auth.uid());
  end if;
  return p_id;
end $$;
revoke all on function public.store_salvar_produto(uuid, uuid, text, text, integer, integer, boolean, text) from public, anon, service_role;
grant execute on function public.store_salvar_produto(uuid, uuid, text, text, integer, integer, boolean, text) to authenticated;

-- Oferece (ou retira) um produto numa galeria: editor+ do projeto; produto da MESMA organização.
create function public.store_vincular_produto(p_projeto uuid, p_produto uuid, p_vincular boolean) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org_projeto uuid; v_org_produto uuid;
begin
  if p_vincular is null then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  select organizacao_id into v_org_projeto from public.projetos where id = p_projeto;
  if v_org_projeto is null or not (public.pode_editar_projeto_org(p_projeto)
     or exists (select 1 from public.projetos p where p.id = p_projeto and p.fotografo_id = auth.uid())) then
    raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select organizacao_id into v_org_produto from public.store_produtos where id = p_produto;
  if v_org_produto is distinct from v_org_projeto then raise exception 'Produto de outra organização.' using errcode = '42501'; end if;
  if p_vincular then
    insert into public.store_projeto_produtos(projeto_id, produto_id) values (p_projeto, p_produto) on conflict do nothing;
  else
    delete from public.store_projeto_produtos where projeto_id = p_projeto and produto_id = p_produto;
  end if;
  return true;
end $$;
revoke all on function public.store_vincular_produto(uuid, uuid, boolean) from public, anon, service_role;
grant execute on function public.store_vincular_produto(uuid, uuid, boolean) to authenticated;

-- Catálogo visto pelo comprador convidado (sem comissão: é dado interno do estúdio).
create function public.store_catalogo_portal(p_sessao_hash text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.portal_acessos;
begin
  a := private.portal_validar(p_sessao_hash);
  return coalesce((select jsonb_agg(jsonb_build_object('id', pr.id, 'nome', pr.nome, 'descricao', pr.descricao,
            'tipo', pr.tipo, 'preco_centavos', pr.preco_centavos) order by pr.nome)
     from public.store_projeto_produtos vp join public.store_produtos pr on pr.id = vp.produto_id
     join public.projetos p on p.id = vp.projeto_id
    where vp.projeto_id = a.projeto_id and pr.ativo and pr.organizacao_id = p.organizacao_id), '[]'::jsonb);
end $$;
revoke all on function public.store_catalogo_portal(text) from public, service_role;
grant execute on function public.store_catalogo_portal(text) to anon, authenticated;

-- S03: pedido. O total NUNCA vem do cliente: sai do catálogo, em centavos inteiros.
create function public.store_criar_pedido(p_sessao_hash text, p_chave uuid, p_nome text, p_email text,
  p_itens jsonb, p_token_hash text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.portal_acessos; v_org uuid; v_email text; v_item jsonb; v_prod public.store_produtos;
  v_fotos uuid[]; v_qtd integer; v_total integer; v_com integer; v_tot_pedido integer := 0; v_com_pedido integer := 0;
  v_norm jsonb := '[]'::jsonb; v_hash text; v_existente public.store_pedidos; v_id uuid; v_ids uuid[] := '{}';
  v_linhas jsonb := '[]'::jsonb;
begin
  a := private.portal_validar(p_sessao_hash);
  v_email := lower(trim(coalesce(p_email, '')));
  if p_chave is null or p_nome is null or length(trim(p_nome)) not between 2 and 120
     or length(v_email) not between 5 and 254 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'
     or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
     or p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) not between 1 and 50 then
    raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  select organizacao_id into v_org from public.projetos where id = a.projeto_id;
  if v_org is null then raise exception 'Loja indisponível.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_chave::text, 55));

  -- Normaliza e calcula (e rejeita item inválido antes de qualquer escrita).
  for v_item in select * from jsonb_array_elements(p_itens) loop
    if jsonb_typeof(v_item) <> 'object' or (v_item->>'produto_id') !~ '^[0-9a-f-]{36}$' then
      raise exception 'Dados inválidos.' using errcode = '22023'; end if;
    select * into v_prod from public.store_produtos where id = (v_item->>'produto_id')::uuid and ativo and organizacao_id = v_org
       and exists (select 1 from public.store_projeto_produtos vp where vp.projeto_id = a.projeto_id and vp.produto_id = store_produtos.id);
    if not found then raise exception 'Produto indisponível.' using errcode = '22023'; end if;
    if v_prod.id = any (v_ids) then raise exception 'Produto repetido.' using errcode = '22023'; end if;
    v_ids := v_ids || v_prod.id;
    select coalesce(array_agg(distinct x::uuid order by x::uuid), '{}') into v_fotos
      from jsonb_array_elements_text(coalesce(v_item->'foto_ids', '[]'::jsonb)) x where x ~ '^[0-9a-f-]{36}$';
    if cardinality(v_fotos) > 1000 or (select count(*) from public.fotos f where f.projeto_id = a.projeto_id and f.id = any (v_fotos)) <> cardinality(v_fotos) then
      raise exception 'Foto indisponível.' using errcode = '22023'; end if;
    v_qtd := coalesce((v_item->>'quantidade')::integer, 1);
    if v_prod.tipo in ('colecao_digital', 'foto_avulsa') then
      if cardinality(v_fotos) = 0 then raise exception 'Escolha ao menos uma foto.' using errcode = '22023'; end if;
      v_qtd := case when v_prod.tipo = 'foto_avulsa' then cardinality(v_fotos) else 1 end;
    elsif v_qtd not between 1 and 99 then raise exception 'Quantidade inválida.' using errcode = '22023'; end if;
    v_total := v_prod.preco_centavos * v_qtd;
    v_com := (v_total::bigint * v_prod.comissao_bps + 5000) / 10000;
    v_tot_pedido := v_tot_pedido + v_total; v_com_pedido := v_com_pedido + v_com;
    v_norm := v_norm || jsonb_build_object('p', v_prod.id, 'q', v_qtd, 'f', to_jsonb(v_fotos));
    v_linhas := v_linhas || jsonb_build_object('prod', to_jsonb(v_prod), 'qtd', v_qtd, 'fotos', to_jsonb(v_fotos), 'total', v_total, 'com', v_com);
  end loop;
  if v_tot_pedido > 1000000000 then raise exception 'Valor acima do permitido.' using errcode = '22023'; end if;
  v_hash := md5((select jsonb_agg(e order by e->>'p') from jsonb_array_elements(v_norm) e)::text || '|' || trim(p_nome) || '|' || v_email || '|' || a.projeto_id::text);

  select * into v_existente from public.store_pedidos where chave = p_chave;
  if found then
    if v_existente.projeto_id <> a.projeto_id or v_existente.payload_hash <> v_hash then
      raise exception 'Chave já utilizada com outros dados.' using errcode = '22023'; end if;
    return jsonb_build_object('id', v_existente.id, 'status', v_existente.status, 'total_centavos', v_existente.total_centavos);
  end if;
  -- Contenção de abuso: o portal é anônimo.
  if (select count(*) from public.store_pedidos where projeto_id = a.projeto_id and status = 'pendente') >= 50 then
    raise exception 'Muitos pedidos pendentes.' using errcode = '22023'; end if;

  insert into public.store_pedidos(organizacao_id, projeto_id, chave, payload_hash, comprador_nome, comprador_email,
      total_centavos, comissao_centavos, liquido_centavos, token_hash)
    values (v_org, a.projeto_id, p_chave, v_hash, trim(p_nome), v_email, v_tot_pedido, v_com_pedido, v_tot_pedido - v_com_pedido, p_token_hash)
    returning id into v_id;
  insert into public.store_pedido_itens(pedido_id, produto_id, nome, tipo, preco_centavos, comissao_bps, quantidade, foto_ids, total_centavos, comissao_centavos)
    select v_id, (l->'prod'->>'id')::uuid, l->'prod'->>'nome', l->'prod'->>'tipo', (l->'prod'->>'preco_centavos')::integer,
           (l->'prod'->>'comissao_bps')::integer, (l->>'qtd')::integer,
           coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(l->'fotos') x), '{}'),
           (l->>'total')::integer, (l->>'com')::integer
      from jsonb_array_elements(v_linhas) l;
  return jsonb_build_object('id', v_id, 'status', 'pendente', 'total_centavos', v_tot_pedido);
end $$;
revoke all on function public.store_criar_pedido(text, uuid, text, text, jsonb, text) from public, service_role;
grant execute on function public.store_criar_pedido(text, uuid, text, text, jsonb, text) to anon, authenticated;

-- Comprador cancela o que ainda está pendente.
create function public.store_cancelar_pedido(p_sessao_hash text, p_pedido uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.portal_acessos;
begin
  a := private.portal_validar(p_sessao_hash);
  update public.store_pedidos set status = 'cancelado', encerrado_em = now()
   where id = p_pedido and projeto_id = a.projeto_id and status = 'pendente';
  return found;
end $$;
revoke all on function public.store_cancelar_pedido(text, uuid) from public, service_role;
grant execute on function public.store_cancelar_pedido(text, uuid) to anon, authenticated;

-- S04: reconciliação. SÓ o servidor (webhook/adaptador) chama; nunca o navegador.
-- Idempotente por (provedor, evento_id); estados finais não reabrem; valor divergente
-- não é aplicado; estorno que chega ANTES do pagamento é registrado e aplicado quando
-- o pagamento chegar.
create function public.store_aplicar_evento(p_provedor text, p_evento_id text, p_pedido uuid, p_tipo text, p_valor integer) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ev public.store_eventos_pagamento; v_ped public.store_pedidos; v_res text; v_det text;
begin
  if p_provedor is distinct from 'simulado' or p_evento_id is null or length(p_evento_id) not between 1 and 200
     or p_tipo is null or p_tipo not in ('pago', 'recusado', 'estornado') or p_valor is null or p_valor < 0 then
    raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_provedor || ':' || p_evento_id, 55));
  select * into v_ev from public.store_eventos_pagamento where provedor = p_provedor and evento_id = p_evento_id;
  if found then
    return jsonb_build_object('resultado', 'replay', 'original', v_ev.resultado, 'pedido_id', v_ev.pedido_id);
  end if;
  select * into v_ped from public.store_pedidos where id = p_pedido for update;
  if not found then
    insert into public.store_eventos_pagamento(provedor, evento_id, pedido_id, tipo, valor_centavos, resultado, detalhe)
      values (p_provedor, p_evento_id, null, p_tipo, p_valor, 'pedido_inexistente', 'Pedido não encontrado.');
    return jsonb_build_object('resultado', 'pedido_inexistente');
  end if;

  if p_tipo = 'pago' then
    if v_ped.status = 'pendente' then
      if p_valor <> v_ped.total_centavos then v_res := 'divergente'; v_det := format('Valor recebido %s difere do pedido %s.', p_valor, v_ped.total_centavos);
      else
        update public.store_pedidos set status = 'pago', pago_em = now() where id = v_ped.id;
        v_res := 'aplicado';
        -- Estorno que chegou antes: fecha a sequência pago → estornado.
        if exists (select 1 from public.store_eventos_pagamento where pedido_id = v_ped.id and tipo = 'estornado' and resultado = 'fora_de_ordem') then
          update public.store_pedidos set status = 'estornado', encerrado_em = now() where id = v_ped.id;
          update public.store_eventos_pagamento set resultado = 'aplicado', detalhe = 'Aplicado após o pagamento (chegou fora de ordem).'
           where pedido_id = v_ped.id and tipo = 'estornado' and resultado = 'fora_de_ordem';
        end if;
      end if;
    elsif v_ped.status = 'pago' then v_res := 'replay'; v_det := 'Pedido já estava pago.';
    else v_res := 'fora_de_ordem'; v_det := format('Pagamento recebido para pedido %s: estado final, não reaberto.', v_ped.status);
    end if;
  elsif p_tipo = 'recusado' then
    if v_ped.status = 'pendente' then
      update public.store_pedidos set status = 'recusado', encerrado_em = now() where id = v_ped.id; v_res := 'aplicado';
    else v_res := 'fora_de_ordem'; v_det := format('Recusa recebida para pedido %s.', v_ped.status);
    end if;
  else -- estornado
    if v_ped.status = 'pago' then
      if p_valor <> v_ped.total_centavos then v_res := 'divergente'; v_det := format('Estorno de %s difere do total pago %s (estorno parcial exige tratamento manual).', p_valor, v_ped.total_centavos);
      else update public.store_pedidos set status = 'estornado', encerrado_em = now() where id = v_ped.id; v_res := 'aplicado';
      end if;
    elsif v_ped.status = 'pendente' then v_res := 'fora_de_ordem'; v_det := 'Estorno antes do pagamento: aguardando o pagamento.';
    elsif v_ped.status = 'estornado' then v_res := 'replay'; v_det := 'Pedido já estornado.';
    else v_res := 'fora_de_ordem'; v_det := format('Estorno recebido para pedido %s.', v_ped.status);
    end if;
  end if;
  insert into public.store_eventos_pagamento(provedor, evento_id, organizacao_id, pedido_id, tipo, valor_centavos, resultado, detalhe)
    values (p_provedor, p_evento_id, v_ped.organizacao_id, v_ped.id, p_tipo, p_valor, v_res, v_det);
  return jsonb_build_object('resultado', v_res, 'pedido_id', v_ped.id,
    'status', (select status from public.store_pedidos where id = v_ped.id));
end $$;
revoke all on function public.store_aplicar_evento(text, text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.store_aplicar_evento(text, text, uuid, text, integer) to service_role;

-- Entrega: só de pedido PAGO, só das fotos do próprio pedido/projeto. O token (256 bits) é o segredo.
create function public.store_entrega(p_token_hash text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ped public.store_pedidos;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Entrega indisponível.' using errcode = '42501'; end if;
  select * into v_ped from public.store_pedidos where token_hash = p_token_hash;
  if not found then raise exception 'Entrega indisponível.' using errcode = '42501'; end if;
  if v_ped.status <> 'pago' then
    return jsonb_build_object('pedido_id', v_ped.id, 'status', v_ped.status, 'itens', '[]'::jsonb);
  end if;
  return jsonb_build_object('pedido_id', v_ped.id, 'status', v_ped.status, 'itens', coalesce((
    select jsonb_agg(jsonb_build_object('nome', i.nome, 'tipo', i.tipo, 'quantidade', i.quantidade, 'fotos', coalesce((
        select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome_original) order by f.id)
          from public.fotos f where f.projeto_id = v_ped.projeto_id and f.id = any (i.foto_ids)), '[]'::jsonb)) order by i.nome)
      from public.store_pedido_itens i where i.pedido_id = v_ped.id), '[]'::jsonb));
end $$;
revoke all on function public.store_entrega(text) from public, service_role;
grant execute on function public.store_entrega(text) to anon, authenticated;

-- Dados para assinar UMA foto entregue (o servidor só assina depois deste passe).
create function public.store_entrega_foto(p_token_hash text, p_foto_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ped public.store_pedidos; v jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or p_foto_id is null then raise exception 'Entrega indisponível.' using errcode = '42501'; end if;
  select * into v_ped from public.store_pedidos where token_hash = p_token_hash and status = 'pago';
  if not found then raise exception 'Entrega indisponível.' using errcode = '42501'; end if;
  select jsonb_build_object('pedido_id', v_ped.id, 'bucket', f.bucket, 'path', f.storage_path, 'nome', f.nome_original) into v
    from public.fotos f
   where f.id = p_foto_id and f.projeto_id = v_ped.projeto_id
     and exists (select 1 from public.store_pedido_itens i where i.pedido_id = v_ped.id and p_foto_id = any (i.foto_ids));
  if v is null then raise exception 'Entrega indisponível.' using errcode = '42501'; end if;
  return v;
end $$;
revoke all on function public.store_entrega_foto(text, uuid) from public, service_role;
grant execute on function public.store_entrega_foto(text, uuid) to anon, authenticated;

-- Falha ao entregar fica registrada para o estúdio agir (só o servidor registra).
create function public.store_registrar_falha_entrega(p_pedido uuid, p_foto uuid, p_motivo text) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_motivo is null or length(p_motivo) not between 1 and 300 then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  insert into public.store_entrega_falhas(pedido_id, foto_id, motivo) select p_pedido, p_foto, p_motivo
    where exists (select 1 from public.store_pedidos where id = p_pedido);
  return found;
end $$;
revoke all on function public.store_registrar_falha_entrega(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.store_registrar_falha_entrega(uuid, uuid, text) to service_role;

commit;
