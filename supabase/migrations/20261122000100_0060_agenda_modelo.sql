-- Booking (B01) — recursos de agenda, disponibilidade semanal e bloqueios.
-- ADITIVA: não altera policy/RLS existente. Escopo por organização (0051):
-- quem opera é membro ativo; o cliente final nunca é membro. Escrita só por
-- RPC (SECURITY DEFINER); tabelas com RLS e SELECT mínimo para membros.
-- Decisões de mercado (Calendly/Acuity/Pic-Time): fuso IANA por recurso,
-- disponibilidade semanal em horário local, duração/buffer/antecedência
-- mínima e máxima por recurso, política de cancelamento em horas.
-- Pagamento/sinal é SIMULADO (campo, sem provedor). NÃO aplicada em remoto.
begin;

create extension if not exists btree_gist with schema extensions;

create table public.agenda_recursos (
  id                          uuid primary key default gen_random_uuid(),
  organizacao_id              uuid not null references public.organizacoes (id) on delete cascade,
  nome                        text not null check (length(trim(nome)) between 2 and 120),
  slug                        text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$'),
  tipo                        text not null default 'pessoa' check (tipo in ('pessoa', 'equipamento', 'espaco')),
  descricao                   text check (descricao is null or length(descricao) <= 1000),
  fuso                        text not null,
  duracao_min                 integer not null default 60 check (duracao_min between 5 and 720),
  buffer_min                  integer not null default 0 check (buffer_min between 0 and 240),
  intervalo_min               integer not null default 30 check (intervalo_min between 5 and 240),
  antecedencia_min_min        integer not null default 120 check (antecedencia_min_min between 0 and 20160),
  antecedencia_max_dias       integer not null default 60 check (antecedencia_max_dias between 1 and 365),
  cancelamento_antecedencia_h integer not null default 24 check (cancelamento_antecedencia_h between 0 and 720),
  sinal_centavos              integer check (sinal_centavos is null or sinal_centavos between 0 and 10000000),
  publicado                   boolean not null default false,
  ativo                       boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index idx_agenda_recursos_org on public.agenda_recursos (organizacao_id) where ativo;
comment on table public.agenda_recursos is
  'Recurso reservável (pessoa, equipamento ou espaço) de uma organização (0060). Fuso IANA próprio; sinal em centavos é SIMULADO.';

create table public.agenda_disponibilidade (
  id         uuid primary key default gen_random_uuid(),
  recurso_id uuid not null references public.agenda_recursos (id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  inicio     time not null,
  fim        time not null,
  constraint agenda_disp_intervalo check (fim > inicio)
);
create index idx_agenda_disp_recurso on public.agenda_disponibilidade (recurso_id, dia_semana);
comment on table public.agenda_disponibilidade is
  'Janelas semanais em horário LOCAL do recurso (0060). dia_semana 0=domingo..6=sábado; fim 24:00 permitido.';

create table public.agenda_bloqueios (
  id         uuid primary key default gen_random_uuid(),
  recurso_id uuid not null references public.agenda_recursos (id) on delete cascade,
  periodo    tstzrange not null check (not isempty(periodo) and lower(periodo) is not null and upper(periodo) is not null),
  motivo     text check (motivo is null or length(motivo) <= 200),
  criado_por uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_agenda_bloqueios_recurso on public.agenda_bloqueios using gist (recurso_id, periodo);
comment on table public.agenda_bloqueios is 'Folgas, férias e exceções (0060): o período bloqueado nunca vira slot.';

create table public.agenda_reservas (
  id                   uuid primary key default gen_random_uuid(),
  organizacao_id       uuid not null references public.organizacoes (id) on delete cascade,
  recurso_id           uuid not null references public.agenda_recursos (id) on delete cascade,
  status               text not null default 'hold' check (status in ('hold', 'confirmada', 'cancelada', 'expirada', 'concluida')),
  inicio               timestamptz not null,
  fim                  timestamptz not null,
  -- Fim da ocupação = fim + buffer do recurso na data da criação (fixo; mudar o buffer não reescreve o passado).
  ocupa_ate            timestamptz not null,
  contato_nome         text not null check (length(trim(contato_nome)) between 2 and 120),
  contato_email        text not null check (length(contato_email) <= 254 and contato_email = lower(contato_email) and contato_email ~ '^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$'),
  contato_telefone     text check (contato_telefone is null or length(contato_telefone) <= 30),
  -- Hash do segredo que o cliente guarda; também é a chave de idempotência da criação.
  token_hash           text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expira_em            timestamptz,
  confirmada_em        timestamptz,
  cancelada_em         timestamptz,
  cancelada_por        text check (cancelada_por in ('cliente', 'estudio')),
  motivo_cancelamento  text check (motivo_cancelamento is null or length(motivo_cancelamento) <= 300),
  concluida_em         timestamptz,
  cliente_id           uuid references public.clientes (id) on delete set null,
  sinal_centavos       integer check (sinal_centavos is null or sinal_centavos >= 0),
  sinal_status         text not null default 'nenhum' check (sinal_status in ('nenhum', 'pendente', 'pago', 'reembolso_pendente', 'reembolsado')),
  remarcacoes          integer not null default 0 check (remarcacoes >= 0),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint agenda_reservas_intervalo check (fim > inicio and ocupa_ate >= fim),
  constraint agenda_reservas_hold_expira check (status <> 'hold' or expira_em is not null),
  constraint agenda_reservas_cancelamento check ((status = 'cancelada') = (cancelada_em is not null)),
  -- Invariante transacional: um recurso não tem duas reservas vivas sobrepostas.
  -- Holds vencidos só deixam de ocupar quando marcados 'expirada' sob lock
  -- (restrição não pode usar now()); as RPCs fazem isso antes de inserir.
  constraint agenda_reservas_sem_sobreposicao exclude using gist (
    recurso_id with =,
    tstzrange(inicio, ocupa_ate, '[)') with &&
  ) where (status in ('hold', 'confirmada'))
);
create index idx_agenda_reservas_org on public.agenda_reservas (organizacao_id, inicio desc);
create index idx_agenda_reservas_email on public.agenda_reservas (organizacao_id, contato_email, created_at desc);
create index idx_agenda_reservas_cliente on public.agenda_reservas (cliente_id) where cliente_id is not null;
comment on table public.agenda_reservas is
  'Reservas e holds (0060). Instantes em UTC; fuso vive no recurso. Escrita só por RPC; token_hash nunca é legível.';

create table public.agenda_reserva_eventos (
  id         uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.agenda_reservas (id) on delete cascade,
  tipo       text not null check (tipo in ('hold', 'confirmada', 'cancelada', 'expirada', 'concluida', 'remarcada', 'sinal', 'cliente_vinculado', 'reembolso')),
  ator       text not null check (ator in ('cliente', 'estudio', 'sistema')),
  ator_id    uuid references public.profiles (id) on delete set null,
  detalhes   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_agenda_eventos_reserva on public.agenda_reserva_eventos (reserva_id, created_at);
comment on table public.agenda_reserva_eventos is 'Trilha de auditoria das reservas (0060); somente anexada por RPC.';

create trigger trg_agenda_recursos_updated_at before update on public.agenda_recursos
  for each row execute function public.set_updated_at();
create trigger trg_agenda_reservas_updated_at before update on public.agenda_reservas
  for each row execute function public.set_updated_at();

alter table public.agenda_recursos enable row level security;
alter table public.agenda_disponibilidade enable row level security;
alter table public.agenda_bloqueios enable row level security;
alter table public.agenda_reservas enable row level security;
alter table public.agenda_reserva_eventos enable row level security;
revoke all on table public.agenda_recursos, public.agenda_disponibilidade, public.agenda_bloqueios,
  public.agenda_reservas, public.agenda_reserva_eventos from public, anon, authenticated;
grant select on table public.agenda_recursos, public.agenda_disponibilidade, public.agenda_bloqueios,
  public.agenda_reserva_eventos to authenticated;
-- token_hash fora do alcance de qualquer leitura direta.
grant select (id, organizacao_id, recurso_id, status, inicio, fim, ocupa_ate, contato_nome, contato_email, contato_telefone,
  expira_em, confirmada_em, cancelada_em, cancelada_por, motivo_cancelamento, concluida_em, cliente_id, sinal_centavos,
  sinal_status, remarcacoes, created_at, updated_at) on table public.agenda_reservas to authenticated;
grant all on table public.agenda_recursos, public.agenda_disponibilidade, public.agenda_bloqueios,
  public.agenda_reservas, public.agenda_reserva_eventos to service_role;

create policy agenda_recursos_select on public.agenda_recursos for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) is not null);
create policy agenda_disponibilidade_select on public.agenda_disponibilidade for select to authenticated
  using (exists (select 1 from public.agenda_recursos r where r.id = recurso_id and public.papel_na_organizacao(r.organizacao_id) is not null));
create policy agenda_bloqueios_select on public.agenda_bloqueios for select to authenticated
  using (exists (select 1 from public.agenda_recursos r where r.id = recurso_id and public.papel_na_organizacao(r.organizacao_id) is not null));
create policy agenda_reservas_select on public.agenda_reservas for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) is not null);
create policy agenda_reserva_eventos_select on public.agenda_reserva_eventos for select to authenticated
  using (exists (select 1 from public.agenda_reservas v where v.id = reserva_id and public.papel_na_organizacao(v.organizacao_id) is not null));

-- Valida fuso IANA (interno).
create function public.agenda_fuso_valido(p_fuso text) returns boolean
language sql stable set search_path = public, pg_temp as $$
  select p_fuso is not null and length(p_fuso) <= 64 and exists (select 1 from pg_catalog.pg_timezone_names where name = p_fuso)
$$;
revoke all on function public.agenda_fuso_valido(text) from public, anon, authenticated, service_role;

-- Cria ou atualiza um recurso. Somente dono/admin configuram a agenda.
create function public.agenda_salvar_recurso(
  p_org uuid, p_id uuid, p_nome text, p_slug text, p_tipo text, p_descricao text, p_fuso text,
  p_duracao_min integer, p_buffer_min integer, p_intervalo_min integer, p_antecedencia_min_min integer,
  p_antecedencia_max_dias integer, p_cancelamento_antecedencia_h integer, p_sinal_centavos integer, p_publicado boolean
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_papel text; v_id uuid; v_slug text := lower(trim(coalesce(p_slug, '')));
begin
  v_papel := public.papel_na_organizacao(p_org);
  if v_papel is null or v_papel not in ('dono', 'admin') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_nome is null or length(trim(p_nome)) not between 2 and 120
     or v_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$'
     or p_tipo is null or p_tipo not in ('pessoa', 'equipamento', 'espaco')
     or (p_descricao is not null and length(p_descricao) > 1000)
     or not public.agenda_fuso_valido(p_fuso)
     or p_duracao_min is null or p_duracao_min not between 5 and 720
     or p_buffer_min is null or p_buffer_min not between 0 and 240
     or p_intervalo_min is null or p_intervalo_min not between 5 and 240
     or p_antecedencia_min_min is null or p_antecedencia_min_min not between 0 and 20160
     or p_antecedencia_max_dias is null or p_antecedencia_max_dias not between 1 and 365
     or p_cancelamento_antecedencia_h is null or p_cancelamento_antecedencia_h not between 0 and 720
     or (p_sinal_centavos is not null and p_sinal_centavos not between 0 and 10000000)
     or p_publicado is null then
    raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('agenda-slug:' || v_slug, 60));
  begin
    if p_id is null then
      insert into public.agenda_recursos(organizacao_id, nome, slug, tipo, descricao, fuso, duracao_min, buffer_min, intervalo_min,
        antecedencia_min_min, antecedencia_max_dias, cancelamento_antecedencia_h, sinal_centavos, publicado)
      values (p_org, trim(p_nome), v_slug, p_tipo, nullif(trim(coalesce(p_descricao, '')), ''), p_fuso, p_duracao_min, p_buffer_min,
        p_intervalo_min, p_antecedencia_min_min, p_antecedencia_max_dias, p_cancelamento_antecedencia_h, nullif(p_sinal_centavos, 0), p_publicado)
      returning id into v_id;
    else
      update public.agenda_recursos set nome = trim(p_nome), slug = v_slug, tipo = p_tipo,
        descricao = nullif(trim(coalesce(p_descricao, '')), ''), fuso = p_fuso, duracao_min = p_duracao_min, buffer_min = p_buffer_min,
        intervalo_min = p_intervalo_min, antecedencia_min_min = p_antecedencia_min_min, antecedencia_max_dias = p_antecedencia_max_dias,
        cancelamento_antecedencia_h = p_cancelamento_antecedencia_h, sinal_centavos = nullif(p_sinal_centavos, 0), publicado = p_publicado
       where id = p_id and organizacao_id = p_org and ativo
      returning id into v_id;
      if v_id is null then raise exception 'Recurso não encontrado.' using errcode = '22023'; end if;
    end if;
  exception when unique_violation then
    raise exception 'Endereço já em uso.' using errcode = '22023';
  end;
  return v_id;
end $$;
revoke all on function public.agenda_salvar_recurso(uuid, uuid, text, text, text, text, text, integer, integer, integer, integer, integer, integer, integer, boolean) from public, anon, service_role;
grant execute on function public.agenda_salvar_recurso(uuid, uuid, text, text, text, text, text, integer, integer, integer, integer, integer, integer, integer, boolean) to authenticated;

-- Arquiva (não apaga): reservas e auditoria permanecem; o recurso sai do ar.
create function public.agenda_arquivar_recurso(p_recurso uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_papel text;
begin
  select organizacao_id into v_org from public.agenda_recursos where id = p_recurso;
  v_papel := case when v_org is null then null else public.papel_na_organizacao(v_org) end;
  if v_papel is null or v_papel not in ('dono', 'admin') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  update public.agenda_recursos set ativo = false, publicado = false where id = p_recurso and ativo;
  return found;
end $$;
revoke all on function public.agenda_arquivar_recurso(uuid) from public, anon, service_role;
grant execute on function public.agenda_arquivar_recurso(uuid) to authenticated;

-- Substitui a grade semanal inteira: p_janelas = [{"dia":1,"inicio":"09:00","fim":"12:00"}, ...].
create function public.agenda_definir_disponibilidade(p_recurso uuid, p_janelas jsonb) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_papel text; j jsonb; v_n integer := 0; v_dia smallint; v_ini time; v_fim time;
begin
  select organizacao_id into v_org from public.agenda_recursos where id = p_recurso and ativo;
  v_papel := case when v_org is null then null else public.papel_na_organizacao(v_org) end;
  if v_papel is null or v_papel not in ('dono', 'admin') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_janelas is null or jsonb_typeof(p_janelas) <> 'array' or jsonb_array_length(p_janelas) > 70 then
    raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_recurso::text, 60));
  delete from public.agenda_disponibilidade where recurso_id = p_recurso;
  for j in select * from jsonb_array_elements(p_janelas) loop
    begin
      v_dia := (j ->> 'dia')::smallint; v_ini := (j ->> 'inicio')::time; v_fim := (j ->> 'fim')::time;
    exception when others then raise exception 'Dados inválidos.' using errcode = '22023'; end;
    if v_dia is null or v_dia not between 0 and 6 or v_ini is null or v_fim is null or v_fim <= v_ini then
      raise exception 'Dados inválidos.' using errcode = '22023'; end if;
    if exists (select 1 from public.agenda_disponibilidade d where d.recurso_id = p_recurso and d.dia_semana = v_dia
               and d.inicio < v_fim and v_ini < d.fim) then
      raise exception 'Janelas sobrepostas no mesmo dia.' using errcode = '22023'; end if;
    insert into public.agenda_disponibilidade(recurso_id, dia_semana, inicio, fim) values (p_recurso, v_dia, v_ini, v_fim);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.agenda_definir_disponibilidade(uuid, jsonb) from public, anon, service_role;
grant execute on function public.agenda_definir_disponibilidade(uuid, jsonb) to authenticated;

-- Bloqueio pontual (folga, manutenção). Não cancela reservas existentes: o estúdio decide caso a caso.
create function public.agenda_criar_bloqueio(p_recurso uuid, p_inicio timestamptz, p_fim timestamptz, p_motivo text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_papel text; v_id uuid;
begin
  select organizacao_id into v_org from public.agenda_recursos where id = p_recurso and ativo;
  v_papel := case when v_org is null then null else public.papel_na_organizacao(v_org) end;
  if v_papel is null or v_papel not in ('dono', 'admin', 'editor') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_inicio is null or p_fim is null or p_fim <= p_inicio or p_fim - p_inicio > interval '366 days'
     or (p_motivo is not null and length(p_motivo) > 200) then
    raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  insert into public.agenda_bloqueios(recurso_id, periodo, motivo, criado_por)
    values (p_recurso, tstzrange(p_inicio, p_fim, '[)'), nullif(trim(coalesce(p_motivo, '')), ''), auth.uid()) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.agenda_criar_bloqueio(uuid, timestamptz, timestamptz, text) from public, anon, service_role;
grant execute on function public.agenda_criar_bloqueio(uuid, timestamptz, timestamptz, text) to authenticated;

create function public.agenda_remover_bloqueio(p_id uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_papel text;
begin
  select r.organizacao_id into v_org from public.agenda_bloqueios b join public.agenda_recursos r on r.id = b.recurso_id where b.id = p_id;
  v_papel := case when v_org is null then null else public.papel_na_organizacao(v_org) end;
  if v_papel is null or v_papel not in ('dono', 'admin', 'editor') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  delete from public.agenda_bloqueios where id = p_id;
  return found;
end $$;
revoke all on function public.agenda_remover_bloqueio(uuid) from public, anon, service_role;
grant execute on function public.agenda_remover_bloqueio(uuid) to authenticated;

commit;
