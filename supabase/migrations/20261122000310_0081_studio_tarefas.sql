-- STUDIO T02 — tarefas, próxima ação e listagem do funil.
-- ADITIVA. Tarefas pertencem à organização, têm responsável (membro ATIVO),
-- prazo, prioridade e status, e podem apontar para cliente/negócio/projeto/
-- orçamento do MESMO estúdio. "Próxima ação" do cliente é derivada da tarefa
-- aberta mais próxima (sem segunda fonte de verdade). Escrita só por RPC:
-- dono/admin alteram qualquer tarefa; editor só as suas; visualizador só lê.
-- NÃO aplicada em ambiente remoto.
begin;

create table public.studio_tarefas (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  titulo         text not null check (char_length(btrim(titulo)) between 2 and 200),
  descricao      text check (char_length(descricao) <= 2000),
  responsavel_id uuid references public.profiles (id) on delete set null,
  prazo          timestamptz,
  prioridade     text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  status         text not null default 'aberta' check (status in ('aberta', 'concluida', 'cancelada')),
  cliente_id     uuid references public.clientes (id) on delete cascade,
  negocio_id     uuid references public.studio_negocios (id) on delete cascade,
  projeto_id     uuid references public.projetos (id) on delete set null,
  orcamento_id   uuid references public.orcamentos (id) on delete set null,
  concluida_em   timestamptz,
  concluida_por  uuid references public.profiles (id) on delete set null,
  criado_por     uuid references public.profiles (id) on delete set null,
  chave_idem     text,
  created_at     timestamptz not null default clock_timestamp(),
  updated_at     timestamptz not null default clock_timestamp(),
  constraint studio_tarefas_concluida check ((status = 'concluida') = (concluida_em is not null))
);
comment on table public.studio_tarefas is
  'Tarefas comerciais da organização (0081). Responsável deve ser membro ativo (trigger). Escrita só por RPC.';
create unique index uq_studio_tarefas_chave on public.studio_tarefas (organizacao_id, chave_idem) where chave_idem is not null;
create index idx_studio_tarefas_org on public.studio_tarefas (organizacao_id, status, prazo);
create index idx_studio_tarefas_resp on public.studio_tarefas (responsavel_id) where status = 'aberta';
create index idx_studio_tarefas_cliente on public.studio_tarefas (cliente_id) where cliente_id is not null;

-- Defesa em profundidade: responsável membro ativo e vínculos do mesmo estúdio.
create function public.studio_tarefas_valida() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_dono uuid;
begin
  if new.responsavel_id is not null and (tg_op = 'INSERT' or new.responsavel_id is distinct from old.responsavel_id)
     and not public.studio_membro_ativo(new.organizacao_id, new.responsavel_id) then
    raise exception 'O responsável precisa ser membro ativo da equipe.' using errcode = '22023';
  end if;
  select dono_id into v_dono from public.organizacoes where id = new.organizacao_id;
  if new.cliente_id is not null and not exists (select 1 from public.clientes where id = new.cliente_id and fotografo_id = v_dono) then
    raise exception 'Cliente de outro estúdio.' using errcode = '22023'; end if;
  if new.negocio_id is not null and not exists (select 1 from public.studio_negocios where id = new.negocio_id and organizacao_id = new.organizacao_id) then
    raise exception 'Negócio de outro estúdio.' using errcode = '22023'; end if;
  if new.projeto_id is not null and not exists (select 1 from public.projetos where id = new.projeto_id and fotografo_id = v_dono) then
    raise exception 'Projeto de outro estúdio.' using errcode = '22023'; end if;
  if new.orcamento_id is not null and not exists (select 1 from public.orcamentos where id = new.orcamento_id and fotografo_id = v_dono) then
    raise exception 'Orçamento de outro estúdio.' using errcode = '22023'; end if;
  return new;
end $$;
revoke all on function public.studio_tarefas_valida() from public, anon, authenticated, service_role;
create trigger trg_studio_tarefas_valida before insert or update on public.studio_tarefas
  for each row execute function public.studio_tarefas_valida();

alter table public.studio_tarefas enable row level security;
revoke all on table public.studio_tarefas from public, anon, authenticated;
grant select on table public.studio_tarefas to authenticated, service_role;
create policy studio_tarefas_select on public.studio_tarefas for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) is not null);

create function public.criar_tarefa_studio(
  p_org uuid, p_chave text, p_titulo text, p_responsavel uuid default null, p_prazo timestamptz default null,
  p_prioridade text default 'media', p_cliente uuid default null, p_negocio uuid default null,
  p_projeto uuid default null, p_orcamento uuid default null, p_descricao text default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_cli uuid := p_cliente;
begin
  perform public.studio_exigir(p_org, 'escrita');
  if p_chave is null or char_length(p_chave) not between 8 and 100
     or p_titulo is null or char_length(btrim(p_titulo)) not between 2 and 200
     or p_prioridade is null or p_prioridade not in ('baixa', 'media', 'alta')
     or char_length(coalesce(p_descricao, '')) > 2000 then
    raise exception 'Dados inválidos.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 81));
  select id into v_id from public.studio_tarefas where organizacao_id = p_org and chave_idem = p_chave;
  if found then return v_id; end if;
  if v_cli is null and p_negocio is not null then
    select cliente_id into v_cli from public.studio_negocios where id = p_negocio and organizacao_id = p_org;
  end if;
  insert into public.studio_tarefas (organizacao_id, titulo, descricao, responsavel_id, prazo, prioridade,
      cliente_id, negocio_id, projeto_id, orcamento_id, criado_por, chave_idem)
    values (p_org, btrim(p_titulo), nullif(btrim(coalesce(p_descricao, '')), ''), coalesce(p_responsavel, auth.uid()), p_prazo,
      p_prioridade, v_cli, p_negocio, p_projeto, p_orcamento, auth.uid(), p_chave)
    returning id into v_id;
  return v_id;
end $$;
revoke all on function public.criar_tarefa_studio(uuid, text, text, uuid, timestamptz, text, uuid, uuid, uuid, uuid, text) from public, anon, service_role;
grant execute on function public.criar_tarefa_studio(uuid, text, text, uuid, timestamptz, text, uuid, uuid, uuid, uuid, text) to authenticated;

-- Quem altera: dono/admin qualquer tarefa; editor só quando é o responsável.
create function public.studio_pode_alterar_tarefa(p_org uuid, p_responsavel uuid) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v text := public.papel_na_organizacao(p_org);
begin
  -- coalesce: não-membro (v nulo) deve dar false, nunca nulo (nulo passaria pelo "not").
  return coalesce(v in ('dono', 'admin') or (v = 'editor' and p_responsavel is not null and p_responsavel = auth.uid()), false);
end $$;
revoke all on function public.studio_pode_alterar_tarefa(uuid, uuid) from public, anon, authenticated, service_role;

create function public.atualizar_tarefa_studio(
  p_id uuid, p_titulo text, p_responsavel uuid, p_prazo timestamptz, p_prioridade text, p_descricao text default null)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_t public.studio_tarefas;
begin
  select * into v_t from public.studio_tarefas where id = p_id for update;
  if not found or not public.studio_pode_alterar_tarefa(v_t.organizacao_id, v_t.responsavel_id) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_titulo is null or char_length(btrim(p_titulo)) not between 2 and 200
     or p_prioridade is null or p_prioridade not in ('baixa', 'media', 'alta')
     or p_responsavel is null or char_length(coalesce(p_descricao, '')) > 2000 then
    raise exception 'Dados inválidos.' using errcode = '22023';
  end if;
  if v_t.status <> 'aberta' then raise exception 'Tarefa já encerrada.' using errcode = '22023'; end if;
  update public.studio_tarefas set titulo = btrim(p_titulo), responsavel_id = p_responsavel, prazo = p_prazo,
    prioridade = p_prioridade, descricao = nullif(btrim(coalesce(p_descricao, '')), ''), updated_at = clock_timestamp()
   where id = p_id;
  return true;
end $$;
revoke all on function public.atualizar_tarefa_studio(uuid, text, uuid, timestamptz, text, text) from public, anon, service_role;
grant execute on function public.atualizar_tarefa_studio(uuid, text, uuid, timestamptz, text, text) to authenticated;

-- Concluir/cancelar/reabrir. Repetir o mesmo status é inofensivo (retorna false).
create function public.mudar_status_tarefa_studio(p_id uuid, p_status text) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_t public.studio_tarefas;
begin
  select * into v_t from public.studio_tarefas where id = p_id for update;
  if not found or not public.studio_pode_alterar_tarefa(v_t.organizacao_id, v_t.responsavel_id) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('aberta', 'concluida', 'cancelada') then
    raise exception 'Dados inválidos.' using errcode = '22023';
  end if;
  if v_t.status = p_status then return false; end if;
  update public.studio_tarefas set status = p_status, updated_at = clock_timestamp(),
    concluida_em = case when p_status = 'concluida' then clock_timestamp() end,
    concluida_por = case when p_status = 'concluida' then auth.uid() end
   where id = p_id;
  return true;
end $$;
revoke all on function public.mudar_status_tarefa_studio(uuid, text) from public, anon, service_role;
grant execute on function public.mudar_status_tarefa_studio(uuid, text) to authenticated;

-- Listagem com filtros: abertas, minhas, atrasadas, hoje (fuso de Brasília),
-- responsavel, concluidas, todas. Leitura para qualquer membro.
create function public.listar_tarefas_studio(
  p_org uuid, p_filtro text default 'abertas', p_responsavel uuid default null, p_cliente uuid default null)
returns table (
  id uuid, titulo text, descricao text, responsavel_id uuid, responsavel_nome text, prazo timestamptz,
  prioridade text, status text, cliente_id uuid, cliente_nome text, negocio_id uuid, projeto_id uuid,
  orcamento_id uuid, atrasada boolean, pode_editar boolean, concluida_em timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_agora timestamptz := clock_timestamp();
begin
  perform public.studio_exigir(p_org, 'leitura');
  if p_filtro is null or p_filtro not in ('abertas', 'minhas', 'atrasadas', 'hoje', 'responsavel', 'concluidas', 'todas')
     or (p_filtro = 'responsavel' and p_responsavel is null) then
    raise exception 'Dados inválidos.' using errcode = '22023';
  end if;
  return query
    select t.id, t.titulo, t.descricao, t.responsavel_id, p.nome_completo, t.prazo, t.prioridade, t.status,
           t.cliente_id, c.nome, t.negocio_id, t.projeto_id, t.orcamento_id,
           (t.status = 'aberta' and t.prazo is not null and t.prazo < v_agora),
           public.studio_pode_alterar_tarefa(t.organizacao_id, t.responsavel_id),
           t.concluida_em
      from public.studio_tarefas t
      left join public.profiles p on p.id = t.responsavel_id
      left join public.clientes c on c.id = t.cliente_id
     where t.organizacao_id = p_org
       and (p_cliente is null or t.cliente_id = p_cliente)
       and case p_filtro
             when 'abertas' then t.status = 'aberta'
             when 'minhas' then t.status = 'aberta' and t.responsavel_id = auth.uid()
             when 'atrasadas' then t.status = 'aberta' and t.prazo is not null and t.prazo < v_agora
             when 'hoje' then t.status = 'aberta' and t.prazo is not null
                  and (t.prazo at time zone 'America/Sao_Paulo')::date = (v_agora at time zone 'America/Sao_Paulo')::date
             when 'responsavel' then t.status = 'aberta' and t.responsavel_id = p_responsavel
             when 'concluidas' then t.status = 'concluida'
             else true end
     order by (t.status = 'aberta') desc, t.prazo nulls last,
              case t.prioridade when 'alta' then 0 when 'media' then 1 else 2 end, t.created_at
     limit 500;
end $$;
revoke all on function public.listar_tarefas_studio(uuid, text, uuid, uuid) from public, anon, service_role;
grant execute on function public.listar_tarefas_studio(uuid, text, uuid, uuid) to authenticated;

-- Funil: negócios com cliente, responsável e PRÓXIMA AÇÃO (tarefa aberta mais
-- próxima do cliente). Qualquer membro lê; escrita continua só por RPC.
create function public.listar_funil_studio(p_org uuid)
returns table (
  id uuid, cliente_id uuid, cliente_nome text, cliente_email text, cliente_telefone text, titulo text,
  etapa text, motivo_perda text, origem text, valor_estimado numeric, responsavel_id uuid, responsavel_nome text,
  projeto_id uuid, projeto_nome text, orcamento_id uuid, etapa_em timestamptz, dias_na_etapa integer,
  proxima_acao_titulo text, proxima_acao_prazo timestamptz, tarefas_abertas integer, tarefas_atrasadas integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_agora timestamptz := clock_timestamp();
begin
  perform public.studio_exigir(p_org, 'leitura');
  return query
    select n.id, n.cliente_id, c.nome, c.email, c.telefone, n.titulo, n.etapa, n.motivo_perda, n.origem,
           n.valor_estimado, n.responsavel_id, r.nome_completo, n.projeto_id, pj.nome, n.orcamento_id, n.etapa_em,
           greatest(0, floor(extract(epoch from (v_agora - n.etapa_em)) / 86400))::integer,
           pa.titulo, pa.prazo,
           coalesce(ta.abertas, 0)::integer, coalesce(ta.atrasadas, 0)::integer
      from public.studio_negocios n
      join public.clientes c on c.id = n.cliente_id
      left join public.profiles r on r.id = n.responsavel_id
      left join public.projetos pj on pj.id = n.projeto_id
      left join lateral (
        select t.titulo, t.prazo from public.studio_tarefas t
         where t.organizacao_id = p_org and t.cliente_id = n.cliente_id and t.status = 'aberta'
         order by t.prazo nulls last, t.created_at limit 1) pa on true
      left join lateral (
        select count(*) as abertas, count(*) filter (where t.prazo is not null and t.prazo < v_agora) as atrasadas
          from public.studio_tarefas t
         where t.organizacao_id = p_org and t.cliente_id = n.cliente_id and t.status = 'aberta') ta on true
     where n.organizacao_id = p_org
     order by n.etapa_em desc
     limit 500;
end $$;
revoke all on function public.listar_funil_studio(uuid) from public, anon, service_role;
grant execute on function public.listar_funil_studio(uuid) to authenticated;

commit;
