-- STUDIO T04 — outbox mínima e automações simples. NENHUM ENVIO REAL.
-- ADITIVA. Mensagens a enviar ficam em studio_outbox com chave de idempotência,
-- status (pendente, enviando, enviada, falhou, cancelada), tentativas com
-- backoff exponencial e reserva exclusiva (FOR UPDATE SKIP LOCKED). O único
-- adaptador existente é o 'registro': grava o que SERIA enviado em
-- studio_outbox_registro e marca a linha como simulada. O envio externo está
-- desligado por constraint (studio_configuracao.envio_externo = false) e
-- por constraint na outbox (enviada ⇒ simulada); habilitá-lo exige migration
-- futura aprovada. Automações só geram itens na outbox, nunca enviam.
-- NÃO aplicada em ambiente remoto.
begin;

create table public.studio_configuracao (
  organizacao_id uuid primary key references public.organizacoes (id) on delete cascade,
  followup_dias  integer not null default 3 check (followup_dias between 1 and 60),
  -- Trava deliberada: não existe integração aprovada. Só uma migration nova libera.
  envio_externo  boolean not null default false check (envio_externo = false),
  updated_at     timestamptz not null default clock_timestamp()
);

-- Descadastro (LGPD): quem pediu para não receber não entra na outbox.
create table public.studio_optout (
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  cliente_id     uuid not null references public.clientes (id) on delete cascade,
  canal          text not null check (canal in ('email', 'whatsapp')),
  created_at     timestamptz not null default clock_timestamp(),
  primary key (organizacao_id, cliente_id, canal)
);

create table public.studio_outbox (
  id                  uuid primary key default gen_random_uuid(),
  organizacao_id      uuid not null references public.organizacoes (id) on delete cascade,
  destinatario_tipo   text not null check (destinatario_tipo in ('cliente', 'membro')),
  cliente_id          uuid references public.clientes (id) on delete set null,
  membro_id           uuid references public.profiles (id) on delete set null,
  negocio_id          uuid references public.studio_negocios (id) on delete set null,
  tarefa_id           uuid references public.studio_tarefas (id) on delete set null,
  modelo_id           uuid references public.studio_modelos (id) on delete set null,
  canal               text not null check (canal in ('email', 'whatsapp')),
  destinatario        text not null check (char_length(destinatario) between 3 and 254),
  assunto             text not null default '' check (char_length(assunto) <= 300),
  corpo               text not null check (char_length(btrim(corpo)) between 1 and 6000),
  origem              text not null default 'manual' check (origem in ('manual', 'automacao_tarefa_atrasada', 'automacao_followup_proposta')),
  chave_idem          text not null check (char_length(chave_idem) between 8 and 200),
  status              text not null default 'pendente' check (status in ('pendente', 'enviando', 'enviada', 'falhou', 'cancelada')),
  tentativas          integer not null default 0 check (tentativas >= 0),
  max_tentativas      integer not null default 5 check (max_tentativas between 1 and 10),
  proxima_tentativa_em timestamptz not null default clock_timestamp(),
  reservada_em        timestamptz,
  ultimo_erro         text check (char_length(ultimo_erro) <= 300),
  adaptador           text check (adaptador in ('registro')),
  simulada            boolean not null default false,
  enviada_em          timestamptz,
  criado_por          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default clock_timestamp(),
  updated_at          timestamptz not null default clock_timestamp(),
  constraint studio_outbox_enviada check ((status = 'enviada') = (enviada_em is not null)),
  -- Nenhuma linha pode virar "enviada" de verdade: só simulada pelo adaptador registro.
  constraint studio_outbox_so_simulada check (status <> 'enviada' or (simulada and adaptador = 'registro'))
);
comment on table public.studio_outbox is
  'Fila de comunicação (0083). Envio externo DESLIGADO: o adaptador registro só simula. Escrita só por RPC.';
create unique index uq_studio_outbox_chave on public.studio_outbox (organizacao_id, chave_idem);
create index idx_studio_outbox_fila on public.studio_outbox (organizacao_id, status, proxima_tentativa_em);
create index idx_studio_outbox_cliente on public.studio_outbox (cliente_id) where cliente_id is not null;

-- O que o adaptador registro "enviaria". Uma linha por item (UNIQUE) = sem duplicidade.
create table public.studio_outbox_registro (
  id             uuid primary key default gen_random_uuid(),
  outbox_id      uuid not null unique references public.studio_outbox (id) on delete cascade,
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  canal          text not null,
  destinatario   text not null,
  assunto        text not null,
  corpo          text not null,
  tentativa      integer not null,
  created_at     timestamptz not null default clock_timestamp()
);

alter table public.studio_configuracao enable row level security;
alter table public.studio_optout enable row level security;
alter table public.studio_outbox enable row level security;
alter table public.studio_outbox_registro enable row level security;
revoke all on table public.studio_configuracao, public.studio_optout, public.studio_outbox, public.studio_outbox_registro
  from public, anon, authenticated;
grant select on table public.studio_configuracao, public.studio_optout, public.studio_outbox, public.studio_outbox_registro
  to authenticated, service_role;
create policy studio_configuracao_select on public.studio_configuracao for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) is not null);
create policy studio_optout_select on public.studio_optout for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) is not null);
create policy studio_outbox_select on public.studio_outbox for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) is not null);
create policy studio_outbox_registro_select on public.studio_outbox_registro for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) is not null);

create function public.definir_followup_dias_studio(p_org uuid, p_dias integer) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.studio_exigir(p_org, 'gestao');
  if p_dias is null or p_dias not between 1 and 60 then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  insert into public.studio_configuracao (organizacao_id, followup_dias) values (p_org, p_dias)
    on conflict (organizacao_id) do update set followup_dias = excluded.followup_dias, updated_at = clock_timestamp();
  return p_dias;
end $$;
revoke all on function public.definir_followup_dias_studio(uuid, integer) from public, anon, service_role;
grant execute on function public.definir_followup_dias_studio(uuid, integer) to authenticated;

create function public.definir_optout_studio(p_org uuid, p_cliente uuid, p_canal text, p_ativo boolean) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_dono uuid;
begin
  perform public.studio_exigir(p_org, 'escrita');
  if p_canal is null or p_canal not in ('email', 'whatsapp') or p_ativo is null then
    raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  select dono_id into v_dono from public.organizacoes where id = p_org;
  if not exists (select 1 from public.clientes where id = p_cliente and fotografo_id = v_dono) then
    raise exception 'Cliente não encontrado.' using errcode = '22023'; end if;
  if p_ativo then
    insert into public.studio_optout (organizacao_id, cliente_id, canal) values (p_org, p_cliente, p_canal) on conflict do nothing;
    -- Quem saiu não recebe o que já estava na fila.
    update public.studio_outbox set status = 'cancelada', updated_at = clock_timestamp()
     where organizacao_id = p_org and cliente_id = p_cliente and canal = p_canal and status in ('pendente', 'falhou');
  else
    delete from public.studio_optout where organizacao_id = p_org and cliente_id = p_cliente and canal = p_canal;
  end if;
  return true;
end $$;
revoke all on function public.definir_optout_studio(uuid, uuid, text, boolean) from public, anon, service_role;
grant execute on function public.definir_optout_studio(uuid, uuid, text, boolean) to authenticated;

-- Enfileirar (NÃO envia). Idempotente pela chave: repetir devolve o mesmo item.
-- Texto vem de um modelo ativo do mesmo canal OU de assunto/corpo informados;
-- as variáveis são renderizadas agora e a mensagem final fica congelada.
create function public.enfileirar_mensagem_studio(
  p_org uuid, p_chave text, p_canal text, p_cliente uuid, p_modelo uuid default null,
  p_assunto text default null, p_corpo text default null, p_negocio uuid default null, p_tarefa uuid default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid; v_dono uuid; v_cli public.clientes; v_mod public.studio_modelos; v_dest text;
  v_a text; v_c text; v_r record;
begin
  perform public.studio_exigir(p_org, 'escrita');
  if p_chave is null or char_length(p_chave) not between 8 and 200
     or p_canal is null or p_canal not in ('email', 'whatsapp') or p_cliente is null then
    raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 83));
  select id into v_id from public.studio_outbox where organizacao_id = p_org and chave_idem = p_chave;
  if found then return v_id; end if;
  select dono_id into v_dono from public.organizacoes where id = p_org;
  select * into v_cli from public.clientes where id = p_cliente and fotografo_id = v_dono;
  if not found then raise exception 'Cliente não encontrado.' using errcode = '22023'; end if;
  v_dest := nullif(btrim(case p_canal when 'email' then coalesce(v_cli.email, '') else coalesce(v_cli.telefone, '') end), '');
  if v_dest is null then raise exception 'O cliente não tem contato neste canal.' using errcode = '22023'; end if;
  if exists (select 1 from public.studio_optout where organizacao_id = p_org and cliente_id = p_cliente and canal = p_canal) then
    raise exception 'O cliente optou por não receber neste canal.' using errcode = '22023'; end if;
  if p_modelo is not null then
    select * into v_mod from public.studio_modelos where id = p_modelo and organizacao_id = p_org and ativo and canal = p_canal;
    if not found then raise exception 'Modelo indisponível.' using errcode = '22023'; end if;
    v_a := v_mod.assunto; v_c := v_mod.corpo;
  else
    v_a := coalesce(p_assunto, ''); v_c := p_corpo;
    if v_c is null or char_length(btrim(v_c)) not between 1 and 4000 or char_length(v_a) > 200
       or not public.studio_variaveis_validas(v_a) or not public.studio_variaveis_validas(v_c) then
      raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  end if;
  select * into v_r from public.studio_renderizar(p_org, v_a, v_c, p_cliente, p_negocio, p_tarefa);
  if cardinality(v_r.faltando) > 0 then
    raise exception 'Faltam dados para preencher o modelo.' using errcode = '22023'; end if;
  insert into public.studio_outbox (organizacao_id, destinatario_tipo, cliente_id, negocio_id, tarefa_id, modelo_id,
      canal, destinatario, assunto, corpo, origem, chave_idem, criado_por)
    values (p_org, 'cliente', p_cliente, p_negocio, p_tarefa, p_modelo, p_canal, v_dest, v_r.assunto, v_r.corpo,
      'manual', p_chave, auth.uid())
    returning id into v_id;
  return v_id;
end $$;
revoke all on function public.enfileirar_mensagem_studio(uuid, text, text, uuid, uuid, text, text, uuid, uuid) from public, anon, service_role;
grant execute on function public.enfileirar_mensagem_studio(uuid, text, text, uuid, uuid, text, text, uuid, uuid) to authenticated;

-- Reserva itens prontos (pendente e vencidos) com exclusividade. Itens presos em
-- "enviando" há mais de 10 minutos voltam à fila (ou falham ao esgotar tentativas).
create function public.reservar_outbox_studio(p_org uuid, p_limite integer default 20)
returns table (id uuid, canal text, destinatario text, assunto text, corpo text, tentativas integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_agora timestamptz := clock_timestamp();
begin
  perform public.studio_exigir(p_org, 'gestao');
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  update public.studio_outbox o set updated_at = v_agora, reservada_em = null,
      status = case when o.tentativas >= o.max_tentativas then 'falhou' else 'pendente' end,
      ultimo_erro = 'Tempo esgotado na reserva.', proxima_tentativa_em = v_agora
   where o.organizacao_id = p_org and o.status = 'enviando' and o.reservada_em < v_agora - interval '10 minutes';
  return query
    with alvo as (
      select o.id from public.studio_outbox o
       where o.organizacao_id = p_org and o.status = 'pendente' and o.proxima_tentativa_em <= v_agora
       order by o.proxima_tentativa_em, o.created_at
       limit p_limite for update skip locked)
    update public.studio_outbox o set status = 'enviando', tentativas = o.tentativas + 1, reservada_em = v_agora, updated_at = v_agora
      from alvo where o.id = alvo.id
    returning o.id, o.canal, o.destinatario, o.assunto, o.corpo, o.tentativas;
end $$;
revoke all on function public.reservar_outbox_studio(uuid, integer) from public, anon, service_role;
grant execute on function public.reservar_outbox_studio(uuid, integer) to authenticated;

-- Conclui uma reserva. Só age em "enviando": repetir devolve o status atual sem
-- efeito (retry/idempotência). Sucesso só existe pelo adaptador registro (simulado).
create function public.concluir_outbox_studio(p_id uuid, p_ok boolean, p_adaptador text, p_erro text default null) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_o public.studio_outbox; v_agora timestamptz := clock_timestamp();
begin
  select * into v_o from public.studio_outbox where id = p_id for update;
  if not found then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  perform public.studio_exigir(v_o.organizacao_id, 'gestao');
  if p_ok is null or p_adaptador is distinct from 'registro' then
    raise exception 'Envio externo desligado: só o adaptador registro é aceito.' using errcode = '22023'; end if;
  if v_o.status <> 'enviando' then return v_o.status; end if;
  if p_ok then
    insert into public.studio_outbox_registro (outbox_id, organizacao_id, canal, destinatario, assunto, corpo, tentativa)
      values (v_o.id, v_o.organizacao_id, v_o.canal, v_o.destinatario, v_o.assunto, v_o.corpo, v_o.tentativas)
      on conflict (outbox_id) do nothing;
    update public.studio_outbox set status = 'enviada', adaptador = 'registro', simulada = true, enviada_em = v_agora,
      reservada_em = null, ultimo_erro = null, updated_at = v_agora where id = p_id;
    return 'enviada';
  end if;
  if v_o.tentativas >= v_o.max_tentativas then
    update public.studio_outbox set status = 'falhou', reservada_em = null, ultimo_erro = left(coalesce(p_erro, 'Falha.'), 300), updated_at = v_agora where id = p_id;
    return 'falhou';
  end if;
  -- Backoff exponencial: 1, 2, 4, 8 minutos... limitado a 60.
  update public.studio_outbox set status = 'pendente', reservada_em = null, ultimo_erro = left(coalesce(p_erro, 'Falha.'), 300),
    proxima_tentativa_em = v_agora + least(interval '60 minutes', interval '1 minute' * power(2, v_o.tentativas - 1)),
    updated_at = v_agora where id = p_id;
  return 'pendente';
end $$;
revoke all on function public.concluir_outbox_studio(uuid, boolean, text, text) from public, anon, service_role;
grant execute on function public.concluir_outbox_studio(uuid, boolean, text, text) to authenticated;

-- Processamento completo com o adaptador registro (simulação). Qualquer outro
-- adaptador é recusado enquanto o envio externo estiver desligado.
create function public.processar_outbox_studio(p_org uuid, p_limite integer default 20, p_adaptador text default 'registro') returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_item record; v_n integer := 0;
begin
  perform public.studio_exigir(p_org, 'gestao');
  if p_adaptador is distinct from 'registro' then
    raise exception 'Envio externo desligado: só o adaptador registro é aceito.' using errcode = '22023'; end if;
  for v_item in select * from public.reservar_outbox_studio(p_org, p_limite) loop
    perform public.concluir_outbox_studio(v_item.id, true, 'registro');
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('processadas', v_n, 'simuladas', v_n, 'envio_externo', false);
end $$;
revoke all on function public.processar_outbox_studio(uuid, integer, text) from public, anon, service_role;
grant execute on function public.processar_outbox_studio(uuid, integer, text) to authenticated;

create function public.cancelar_outbox_studio(p_id uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_o public.studio_outbox;
begin
  select * into v_o from public.studio_outbox where id = p_id for update;
  if not found then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  perform public.studio_exigir(v_o.organizacao_id, 'escrita');
  if v_o.status not in ('pendente', 'falhou') then return false; end if;
  update public.studio_outbox set status = 'cancelada', updated_at = clock_timestamp() where id = p_id;
  return true;
end $$;
revoke all on function public.cancelar_outbox_studio(uuid) from public, anon, service_role;
grant execute on function public.cancelar_outbox_studio(uuid) to authenticated;

-- Nova rodada manual para item que esgotou as tentativas.
create function public.reenfileirar_outbox_studio(p_id uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_o public.studio_outbox;
begin
  select * into v_o from public.studio_outbox where id = p_id for update;
  if not found then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  perform public.studio_exigir(v_o.organizacao_id, 'gestao');
  if v_o.status <> 'falhou' then return false; end if;
  update public.studio_outbox set status = 'pendente', tentativas = 0, ultimo_erro = null,
    proxima_tentativa_em = clock_timestamp(), updated_at = clock_timestamp() where id = p_id;
  return true;
end $$;
revoke all on function public.reenfileirar_outbox_studio(uuid) from public, anon, service_role;
grant execute on function public.reenfileirar_outbox_studio(uuid) to authenticated;

create function public.listar_outbox_studio(p_org uuid, p_status text default null, p_limite integer default 100)
returns table (
  id uuid, canal text, destinatario text, destinatario_tipo text, cliente_id uuid, cliente_nome text, assunto text, corpo text,
  origem text, status text, tentativas integer, max_tentativas integer, proxima_tentativa_em timestamptz,
  ultimo_erro text, simulada boolean, enviada_em timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.studio_exigir(p_org, 'leitura');
  if (p_status is not null and p_status not in ('pendente', 'enviando', 'enviada', 'falhou', 'cancelada'))
     or p_limite is null or p_limite not between 1 and 200 then
    raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  return query
    select o.id, o.canal, o.destinatario, o.destinatario_tipo, o.cliente_id, c.nome, o.assunto, o.corpo, o.origem,
           o.status, o.tentativas, o.max_tentativas, o.proxima_tentativa_em, o.ultimo_erro, o.simulada, o.enviada_em, o.created_at
      from public.studio_outbox o left join public.clientes c on c.id = o.cliente_id
     where o.organizacao_id = p_org and (p_status is null or o.status = p_status)
     order by o.created_at desc limit p_limite;
end $$;
revoke all on function public.listar_outbox_studio(uuid, text, integer) from public, anon, service_role;
grant execute on function public.listar_outbox_studio(uuid, text, integer) to authenticated;

-- Automações simples (manuais, sem cron): só GERAM itens na outbox.
--  1) lembrete interno de tarefa atrasada ao responsável (1x por tarefa/prazo);
--  2) follow-up de proposta sem resposta do cliente há N dias (1x por entrada na etapa).
create function public.rodar_automacoes_studio(p_org uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_agora timestamptz := clock_timestamp(); v_dias integer; v_dono uuid; v_t record; v_n record; v_r record;
  v_mod public.studio_modelos; v_a text; v_c text; v_linhas integer; v_tarefas integer := 0; v_follow integer := 0;
begin
  perform public.studio_exigir(p_org, 'gestao');
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 83));
  select dono_id into v_dono from public.organizacoes where id = p_org;
  select coalesce((select followup_dias from public.studio_configuracao where organizacao_id = p_org), 3) into v_dias;

  select * into v_mod from public.studio_modelos
   where organizacao_id = p_org and ativo and finalidade = 'lembrete_tarefa' and canal = 'email' order by updated_at desc limit 1;
  v_a := coalesce(nullif(v_mod.assunto, ''), 'Tarefa atrasada: {{tarefa}}');
  v_c := coalesce(v_mod.corpo, E'Olá, {{responsavel_nome}}. A tarefa "{{tarefa}}" venceu em {{prazo_tarefa}} e continua aberta.');
  for v_t in
    select t.id, t.prazo, pr.email from public.studio_tarefas t join public.profiles pr on pr.id = t.responsavel_id
     where t.organizacao_id = p_org and t.status = 'aberta' and t.prazo is not null and t.prazo < v_agora
       and public.studio_membro_ativo(p_org, t.responsavel_id) and pr.email is not null
  loop
    select * into v_r from public.studio_renderizar(p_org, v_a, v_c, null, null, v_t.id);
    if cardinality(v_r.faltando) > 0 then continue; end if;
    insert into public.studio_outbox (organizacao_id, destinatario_tipo, membro_id, tarefa_id, canal, destinatario,
        assunto, corpo, origem, chave_idem, criado_por, modelo_id)
      select p_org, 'membro', t.responsavel_id, t.id, 'email', v_t.email, v_r.assunto, v_r.corpo, 'automacao_tarefa_atrasada',
             'auto:tarefa_atrasada:' || t.id || ':' || extract(epoch from t.prazo)::bigint, auth.uid(), v_mod.id
        from public.studio_tarefas t where t.id = v_t.id
      on conflict (organizacao_id, chave_idem) do nothing;
    get diagnostics v_linhas = row_count;
    v_tarefas := v_tarefas + v_linhas;
  end loop;

  select * into v_mod from public.studio_modelos
   where organizacao_id = p_org and ativo and finalidade = 'followup_proposta' and canal = 'email' order by updated_at desc limit 1;
  v_a := coalesce(nullif(v_mod.assunto, ''), 'Sobre a proposta: {{titulo_negocio}}');
  v_c := coalesce(v_mod.corpo, E'Olá, {{cliente_primeiro_nome}}! Passando para saber se você conseguiu avaliar a proposta de {{valor}} para {{titulo_negocio}}. Fico à disposição.');
  for v_n in
    select n.id, n.cliente_id, n.etapa_em, c.email from public.studio_negocios n join public.clientes c on c.id = n.cliente_id
     where n.organizacao_id = p_org and n.etapa = 'proposta' and n.etapa_em <= v_agora - make_interval(days => v_dias)
       and nullif(btrim(coalesce(c.email, '')), '') is not null
       and not exists (select 1 from public.studio_optout o where o.organizacao_id = p_org and o.cliente_id = n.cliente_id and o.canal = 'email')
       -- "sem resposta": o cliente não escreveu no fio dos projetos dele depois da proposta.
       and not exists (
         select 1 from public.mensagens m join public.conversas cv on cv.id = m.conversa_id join public.projetos pj on pj.id = cv.projeto_id
          where pj.cliente_id = n.cliente_id and pj.fotografo_id = v_dono and m.autor_papel = 'cliente' and m.created_at > n.etapa_em)
  loop
    select * into v_r from public.studio_renderizar(p_org, v_a, v_c, v_n.cliente_id, v_n.id, null);
    if cardinality(v_r.faltando) > 0 then continue; end if;
    insert into public.studio_outbox (organizacao_id, destinatario_tipo, cliente_id, negocio_id, canal, destinatario,
        assunto, corpo, origem, chave_idem, criado_por, modelo_id)
      values (p_org, 'cliente', v_n.cliente_id, v_n.id, 'email', btrim(v_n.email), v_r.assunto, v_r.corpo,
        'automacao_followup_proposta', 'auto:followup:' || v_n.id || ':' || extract(epoch from v_n.etapa_em)::bigint, auth.uid(), v_mod.id)
      on conflict (organizacao_id, chave_idem) do nothing;
    get diagnostics v_linhas = row_count;
    v_follow := v_follow + v_linhas;
  end loop;
  return jsonb_build_object('lembretes_tarefa', v_tarefas, 'followups_proposta', v_follow);
end $$;
revoke all on function public.rodar_automacoes_studio(uuid) from public, anon, service_role;
grant execute on function public.rodar_automacoes_studio(uuid) to authenticated;

commit;
