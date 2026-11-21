-- STUDIO T01 — funil comercial do estúdio.
-- ADITIVA: não altera clientes, projetos, orçamentos nem policies existentes.
-- O negócio (studio_negocios) REFERENCIA o cadastro de clientes que já existe
-- (sem segundo cadastro) e tem etapa COMERCIAL própria, separada do status de
-- produção do projeto. Escrita só por RPC; histórico de etapas imutável.
-- Papéis (0051): dono/admin/editor escrevem; visualizador só lê. Cliente final
-- nunca é membro da organização. NÃO aplicada em ambiente remoto.
begin;

create table public.studio_negocios (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  cliente_id     uuid not null references public.clientes (id) on delete cascade,
  projeto_id     uuid references public.projetos (id) on delete set null,
  orcamento_id   uuid references public.orcamentos (id) on delete set null,
  titulo         text not null check (char_length(btrim(titulo)) between 2 and 160),
  etapa          text not null default 'lead' check (etapa in ('lead', 'contato', 'proposta', 'fechado', 'perdido')),
  motivo_perda   text check (motivo_perda in ('preco', 'sem_resposta', 'concorrente', 'data_indisponivel', 'desistiu', 'outro')),
  motivo_detalhe text check (char_length(motivo_detalhe) <= 500),
  origem         text not null default 'outro' check (origem in ('indicacao', 'instagram', 'site', 'google', 'facebook', 'whatsapp', 'evento', 'parceiro', 'outro')),
  valor_estimado numeric(12, 2) not null default 0 check (valor_estimado >= 0),
  responsavel_id uuid references public.profiles (id) on delete set null,
  etapa_em       timestamptz not null default clock_timestamp(),
  fechado_em     timestamptz,
  criado_por     uuid references public.profiles (id) on delete set null,
  chave_idem     text,
  created_at     timestamptz not null default clock_timestamp(),
  updated_at     timestamptz not null default clock_timestamp(),
  constraint studio_negocios_perda check ((etapa = 'perdido') = (motivo_perda is not null)),
  constraint studio_negocios_fechado check ((etapa = 'fechado') = (fechado_em is not null))
);
comment on table public.studio_negocios is
  'Negócio comercial (0080) sobre um cliente EXISTENTE. etapa é comercial e não toca no status de produção do projeto. Escrita só por RPC.';
create unique index uq_studio_negocios_chave on public.studio_negocios (organizacao_id, chave_idem) where chave_idem is not null;
-- No máximo um negócio em andamento por cliente (evita cadastro/funil duplicado).
create unique index uq_studio_negocios_ativo on public.studio_negocios (cliente_id) where etapa not in ('fechado', 'perdido');
create index idx_studio_negocios_org on public.studio_negocios (organizacao_id, etapa, etapa_em desc);
create index idx_studio_negocios_cliente on public.studio_negocios (cliente_id);

create table public.studio_negocio_historico (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references public.studio_negocios (id) on delete cascade,
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  de_etapa       text,
  para_etapa     text not null check (para_etapa in ('lead', 'contato', 'proposta', 'fechado', 'perdido')),
  motivo         text,
  ator_id        uuid references public.profiles (id) on delete set null,
  chave_idem     text,
  created_at     timestamptz not null default clock_timestamp()
);
comment on table public.studio_negocio_historico is
  'Histórico imutável de mudanças de etapa (0080): ator, de→para e quando. UPDATE/DELETE bloqueados por trigger; só ações referenciais (cascata, ator removido) passam.';
create unique index uq_studio_historico_chave on public.studio_negocio_historico (negocio_id, chave_idem) where chave_idem is not null;
create index idx_studio_historico_negocio on public.studio_negocio_historico (negocio_id, created_at desc);

create function public.studio_historico_imutavel() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'TRUNCATE' then raise exception 'Histórico é imutável.' using errcode = '42501'; end if;
  -- Profundidade > 1 = ação referencial (cascata de exclusão ou ator removido).
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; end if;
    if new.ator_id is null and (new.id, new.negocio_id, new.organizacao_id, new.de_etapa, new.para_etapa, new.motivo, new.chave_idem, new.created_at)
         is not distinct from (old.id, old.negocio_id, old.organizacao_id, old.de_etapa, old.para_etapa, old.motivo, old.chave_idem, old.created_at) then
      return new;
    end if;
  end if;
  raise exception 'Histórico é imutável.' using errcode = '42501';
end $$;
revoke all on function public.studio_historico_imutavel() from public, anon, authenticated, service_role;
create trigger trg_studio_historico_imutavel before update or delete on public.studio_negocio_historico
  for each row execute function public.studio_historico_imutavel();
create trigger trg_studio_historico_truncate before truncate on public.studio_negocio_historico
  for each statement execute function public.studio_historico_imutavel();

alter table public.studio_negocios enable row level security;
alter table public.studio_negocio_historico enable row level security;
revoke all on table public.studio_negocios, public.studio_negocio_historico from public, anon, authenticated;
grant select on table public.studio_negocios, public.studio_negocio_historico to authenticated;
grant select on table public.studio_negocios, public.studio_negocio_historico to service_role;
create policy studio_negocios_select on public.studio_negocios for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) is not null);
create policy studio_historico_select on public.studio_negocio_historico for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) is not null);

-- Auxiliares internos (só chamados por outras funções SECURITY DEFINER).
-- nível: leitura (qualquer membro), escrita (dono/admin/editor), gestao (dono/admin).
create function public.studio_exigir(p_org uuid, p_nivel text) returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v text;
begin
  v := public.papel_na_organizacao(p_org);
  if v is null or (p_nivel = 'escrita' and v = 'visualizador') or (p_nivel = 'gestao' and v not in ('dono', 'admin')) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return v;
end $$;
revoke all on function public.studio_exigir(uuid, text) from public, anon, authenticated, service_role;

create function public.studio_membro_ativo(p_org uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.organizacao_membros m
    where m.organizacao_id = p_org and m.user_id = p_user and m.status = 'ativo')
$$;
revoke all on function public.studio_membro_ativo(uuid, uuid) from public, anon, authenticated, service_role;

-- Criar negócio: reaproveita o cliente do estúdio (por id ou por e-mail) ou cria
-- o cliente no cadastro existente. Idempotente pela chave.
create function public.criar_negocio_studio(
  p_org uuid, p_chave text, p_titulo text, p_nome text, p_email text, p_telefone text,
  p_origem text, p_valor numeric, p_cliente_id uuid default null, p_responsavel uuid default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_dono uuid; v_neg uuid; v_cli uuid; v_resp uuid; v_email text; v_nome text;
begin
  perform public.studio_exigir(p_org, 'escrita');
  if p_chave is null or char_length(p_chave) not between 8 and 100
     or p_titulo is null or char_length(btrim(p_titulo)) not between 2 and 160
     or p_valor is null or p_valor < 0 or p_valor > 99999999
     or p_origem is null or p_origem not in ('indicacao', 'instagram', 'site', 'google', 'facebook', 'whatsapp', 'evento', 'parceiro', 'outro')
     or char_length(coalesce(p_telefone, '')) > 40 or char_length(coalesce(p_email, '')) > 254 then
    raise exception 'Dados inválidos.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 80));
  select id into v_neg from public.studio_negocios where organizacao_id = p_org and chave_idem = p_chave;
  if found then return v_neg; end if;
  select dono_id into v_dono from public.organizacoes where id = p_org;
  v_resp := coalesce(p_responsavel, auth.uid());
  if not public.studio_membro_ativo(p_org, v_resp) then
    raise exception 'O responsável precisa ser membro ativo da equipe.' using errcode = '22023';
  end if;
  v_email := nullif(lower(btrim(coalesce(p_email, ''))), '');
  if p_cliente_id is not null then
    select id into v_cli from public.clientes where id = p_cliente_id and fotografo_id = v_dono;
    if not found then raise exception 'Cliente não encontrado.' using errcode = '22023'; end if;
  else
    if v_email is not null then
      select id into v_cli from public.clientes where fotografo_id = v_dono and lower(email) = v_email order by created_at limit 1;
    end if;
    if v_cli is null then
      v_nome := btrim(coalesce(p_nome, ''));
      if char_length(v_nome) not between 2 and 120 then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
      insert into public.clientes (fotografo_id, nome, email, telefone, origem)
        values (v_dono, v_nome, v_email, nullif(btrim(coalesce(p_telefone, '')), ''), p_origem)
        returning id into v_cli;
    end if;
  end if;
  if exists (select 1 from public.studio_negocios where cliente_id = v_cli and etapa not in ('fechado', 'perdido')) then
    raise exception 'Este cliente já tem um negócio em andamento.' using errcode = '22023';
  end if;
  insert into public.studio_negocios (organizacao_id, cliente_id, titulo, origem, valor_estimado, responsavel_id, criado_por, chave_idem)
    values (p_org, v_cli, btrim(p_titulo), p_origem, p_valor, v_resp, auth.uid(), p_chave)
    returning id into v_neg;
  insert into public.studio_negocio_historico (negocio_id, organizacao_id, de_etapa, para_etapa, ator_id, chave_idem)
    values (v_neg, p_org, null, 'lead', auth.uid(), p_chave);
  return v_neg;
end $$;
revoke all on function public.criar_negocio_studio(uuid, text, text, text, text, text, text, numeric, uuid, uuid) from public, anon, service_role;
grant execute on function public.criar_negocio_studio(uuid, text, text, text, text, text, text, numeric, uuid, uuid) to authenticated;

-- Mudança de etapa: idempotente por chave (retry não duplica histórico) e
-- no-op quando já está na etapa pedida. Retorna se houve mudança nesta chamada.
create function public.mudar_etapa_negocio_studio(
  p_negocio uuid, p_para text, p_chave text, p_motivo text default null, p_detalhe text default null)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_neg public.studio_negocios;
begin
  select organizacao_id into v_org from public.studio_negocios where id = p_negocio;
  if v_org is null then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  perform public.studio_exigir(v_org, 'escrita');
  if p_chave is null or char_length(p_chave) not between 8 and 100
     or p_para is null or p_para not in ('lead', 'contato', 'proposta', 'fechado', 'perdido')
     or char_length(coalesce(p_detalhe, '')) > 500 then
    raise exception 'Dados inválidos.' using errcode = '22023';
  end if;
  if p_para = 'perdido' and (p_motivo is null or p_motivo not in ('preco', 'sem_resposta', 'concorrente', 'data_indisponivel', 'desistiu', 'outro')) then
    raise exception 'Informe o motivo da perda.' using errcode = '22023';
  end if;
  select * into v_neg from public.studio_negocios where id = p_negocio for update;
  if exists (select 1 from public.studio_negocio_historico where negocio_id = p_negocio and chave_idem = p_chave) then
    return false;
  end if;
  if v_neg.etapa = p_para then return false; end if;
  begin
    update public.studio_negocios set
      etapa = p_para, etapa_em = clock_timestamp(), updated_at = clock_timestamp(),
      motivo_perda = case when p_para = 'perdido' then p_motivo end,
      motivo_detalhe = case when p_para = 'perdido' then nullif(btrim(coalesce(p_detalhe, '')), '') end,
      fechado_em = case when p_para = 'fechado' then clock_timestamp() end
     where id = p_negocio;
  exception when unique_violation then
    raise exception 'Este cliente já tem outro negócio em andamento.' using errcode = '22023';
  end;
  insert into public.studio_negocio_historico (negocio_id, organizacao_id, de_etapa, para_etapa, motivo, ator_id, chave_idem)
    values (p_negocio, v_org, v_neg.etapa, p_para, case when p_para = 'perdido' then p_motivo end, auth.uid(), p_chave);
  return true;
end $$;
revoke all on function public.mudar_etapa_negocio_studio(uuid, text, text, text, text) from public, anon, service_role;
grant execute on function public.mudar_etapa_negocio_studio(uuid, text, text, text, text) to authenticated;

-- Dados do negócio (valor, origem, responsável, orçamento). Não mexe na etapa.
create function public.atualizar_negocio_studio(
  p_negocio uuid, p_titulo text, p_valor numeric, p_origem text, p_responsavel uuid, p_orcamento uuid default null)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_dono uuid;
begin
  select n.organizacao_id, o.dono_id into v_org, v_dono
    from public.studio_negocios n join public.organizacoes o on o.id = n.organizacao_id where n.id = p_negocio;
  if v_org is null then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  perform public.studio_exigir(v_org, 'escrita');
  if p_titulo is null or char_length(btrim(p_titulo)) not between 2 and 160
     or p_valor is null or p_valor < 0 or p_valor > 99999999
     or p_origem is null or p_origem not in ('indicacao', 'instagram', 'site', 'google', 'facebook', 'whatsapp', 'evento', 'parceiro', 'outro') then
    raise exception 'Dados inválidos.' using errcode = '22023';
  end if;
  if p_responsavel is null or not public.studio_membro_ativo(v_org, p_responsavel) then
    raise exception 'O responsável precisa ser membro ativo da equipe.' using errcode = '22023';
  end if;
  if p_orcamento is not null and not exists (select 1 from public.orcamentos where id = p_orcamento and fotografo_id = v_dono) then
    raise exception 'Orçamento não encontrado.' using errcode = '22023';
  end if;
  update public.studio_negocios set titulo = btrim(p_titulo), valor_estimado = p_valor, origem = p_origem,
    responsavel_id = p_responsavel, orcamento_id = p_orcamento, updated_at = clock_timestamp()
   where id = p_negocio;
  return true;
end $$;
revoke all on function public.atualizar_negocio_studio(uuid, text, numeric, text, uuid, uuid) from public, anon, service_role;
grant execute on function public.atualizar_negocio_studio(uuid, text, numeric, text, uuid, uuid) to authenticated;

-- Vínculo cliente↔projeto SEM duplicar cadastro: o projeto precisa ser do mesmo
-- cliente e do mesmo estúdio. Não altera o projeto nem o status de produção.
create function public.vincular_projeto_negocio_studio(p_negocio uuid, p_projeto uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_cli uuid; v_dono uuid;
begin
  select n.organizacao_id, n.cliente_id, o.dono_id into v_org, v_cli, v_dono
    from public.studio_negocios n join public.organizacoes o on o.id = n.organizacao_id where n.id = p_negocio;
  if v_org is null then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  perform public.studio_exigir(v_org, 'escrita');
  if p_projeto is not null and not exists (
      select 1 from public.projetos where id = p_projeto and cliente_id = v_cli and fotografo_id = v_dono) then
    raise exception 'O projeto precisa ser do mesmo cliente e estúdio.' using errcode = '22023';
  end if;
  update public.studio_negocios set projeto_id = p_projeto, updated_at = clock_timestamp() where id = p_negocio;
  return true;
end $$;
revoke all on function public.vincular_projeto_negocio_studio(uuid, uuid) from public, anon, service_role;
grant execute on function public.vincular_projeto_negocio_studio(uuid, uuid) to authenticated;

commit;
