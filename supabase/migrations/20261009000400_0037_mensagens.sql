-- =============================================================================
-- Migration 0037: mensagens interligadas (estúdio ↔ equipe, cliente ↔ estúdio)
--
-- Até aqui só havia o histórico (`projeto_atividades`), a caixa de saída de
-- e-mails simulados (`comunicacoes_log`) e os alertas do CRM
-- (`notificacoes_crm`) — nenhuma conversa de verdade. Esta migration cria:
--
--   * `conversas`: um fio de mensagens, sempre de UM estúdio (`fotografo_id`).
--       - canal `estudio_equipe`: o estúdio (fotógrafo) ↔ equipe seualbum
--         (admin/gestor/operador/designer). Um fio GERAL por estúdio
--         (`projeto_id` null) + um fio por projeto.
--       - canal `cliente_estudio`: o cliente final ↔ o próprio estúdio, um por
--         projeto. A equipe LÊ para dar suporte (interno: o cliente não vê que
--         a equipe leu), mas não escreve.
--   * `mensagens`: texto ou mensagem de sistema, com vínculo opcional a uma
--     lâmina/versão da prova e exclusão lógica (`apagada_em`, o corpo some).
--     Entra na publicação `supabase_realtime` (postgres_changes com RLS).
--   * `conversa_leituras`: até onde cada participante leu — base do contador
--     de não lidas e do "visto".
--
-- Quem vê o quê (`pode_ver_conversa`):
--   * o estúdio dono (`conversas.fotografo_id`) — os dois canais;
--   * o cliente final do projeto (`clientes.user_id`) — só `cliente_estudio`;
--   * a operação (admin/gestor/operador, `is_operacao`) — tudo, só lendo o
--     `cliente_estudio`;
--   * o designer — só o fio `estudio_equipe` dos projetos atribuídos a ele
--     (`projetos.responsavel_id`, 0021). Nada de fio geral nem de cliente.
--
-- Fios só nascem por `abrir_conversa` (security definer, confere o acesso) e
-- pelo gatilho de status do projeto, que posta mensagens de sistema (prova
-- publicada, aprovada, ajustes solicitados) no fio do projeto com a equipe.
--
-- Anexos ficaram de fora nesta etapa.
--
-- Idempotente: pode ser reexecutada com segurança. NÃO aplicada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabelas
-- -----------------------------------------------------------------------------

create table if not exists public.conversas (
  id                     uuid primary key default gen_random_uuid(),
  canal                  text not null check (canal in ('estudio_equipe', 'cliente_estudio')),
  fotografo_id           uuid not null references public.fotografos (id) on delete cascade,
  projeto_id             uuid references public.projetos (id) on delete cascade,
  ultima_mensagem_em     timestamptz,
  ultima_mensagem_previa text,
  created_at             timestamptz not null default now(),
  constraint conversas_cliente_tem_projeto check (canal = 'estudio_equipe' or projeto_id is not null)
);

comment on table public.conversas is
  'Fios de mensagens (0037). estudio_equipe: estúdio ↔ equipe (geral ou por projeto). cliente_estudio: cliente final ↔ estúdio, por projeto.';

-- Um fio geral por estúdio e um fio por (projeto, canal).
create unique index if not exists uq_conversas_geral_estudio
  on public.conversas (fotografo_id) where canal = 'estudio_equipe' and projeto_id is null;
create unique index if not exists uq_conversas_projeto_canal
  on public.conversas (projeto_id, canal) where projeto_id is not null;
create index if not exists idx_conversas_recentes
  on public.conversas (fotografo_id, ultima_mensagem_em desc nulls last);

create table if not exists public.mensagens (
  id          uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  -- null = mensagem do sistema (ou autor removido).
  autor_id    uuid references public.profiles (id) on delete set null,
  -- Nome e lado gravados no envio: o estúdio aparece com o nome do estúdio
  -- (white-label para o cliente) e ninguém precisa ler `profiles` alheios.
  autor_nome  text not null default '',
  autor_papel text not null check (autor_papel in ('equipe', 'fotografo', 'cliente', 'sistema')),
  tipo        text not null default 'texto' check (tipo in ('texto', 'sistema')),
  corpo       text not null default '',
  lamina_id   uuid references public.versoes_laminas (id) on delete set null,
  versao_id   uuid references public.design_versions (id) on delete set null,
  -- clock_timestamp(): ordem e "lido até" corretos mesmo na mesma transação.
  created_at  timestamptz not null default clock_timestamp(),
  apagada_em  timestamptz,
  apagada_por uuid references public.profiles (id) on delete set null,
  constraint mensagens_corpo_check check (apagada_em is not null or char_length(btrim(corpo)) between 1 and 4000),
  constraint mensagens_sistema_check check ((tipo = 'sistema') = (autor_papel = 'sistema'))
);

create index if not exists idx_mensagens_conversa on public.mensagens (conversa_id, created_at desc);

create table if not exists public.conversa_leituras (
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  usuario_id  uuid not null references public.profiles (id) on delete cascade,
  lida_ate    timestamptz not null default clock_timestamp(),
  primary key (conversa_id, usuario_id)
);

create index if not exists idx_conversa_leituras_usuario on public.conversa_leituras (usuario_id);

-- -----------------------------------------------------------------------------
-- 2. Quem vê / quem escreve
-- -----------------------------------------------------------------------------

create or replace function public.pode_ver_conversa(p_conversa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.conversas c
    left join public.projetos p on p.id = c.projeto_id
    left join public.clientes cl on cl.id = p.cliente_id
    where c.id = p_conversa_id
      and (
        c.fotografo_id = auth.uid()
        or (c.canal = 'cliente_estudio' and cl.user_id = auth.uid())
        or public.is_operacao()
        or (c.canal = 'estudio_equipe' and public.is_designer() and p.responsavel_id = auth.uid())
      )
  );
$$;

-- Igual, menos a equipe no fio do cliente (lá ela só lê, para suporte).
create or replace function public.pode_escrever_conversa(p_conversa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.conversas c
    left join public.projetos p on p.id = c.projeto_id
    left join public.clientes cl on cl.id = p.cliente_id
    where c.id = p_conversa_id
      and (
        c.fotografo_id = auth.uid()
        or (c.canal = 'cliente_estudio' and cl.user_id = auth.uid())
        or (c.canal = 'estudio_equipe' and public.is_operacao())
        or (c.canal = 'estudio_equipe' and public.is_designer() and p.responsavel_id = auth.uid())
      )
  );
$$;

-- O usuário é da equipe? (para esconder do cliente/estúdio que a equipe leu o fio do cliente)
create or replace function public._usuario_eh_equipe(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles where id = p_usuario and role in ('admin', 'gestor', 'operador', 'designer')
  );
$$;

-- Nome e lado de quem está escrevendo agora.
create or replace function public._autor_da_mensagem()
returns table (papel text, nome text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    case
      when pr.role in ('admin', 'gestor', 'operador', 'designer') then 'equipe'
      when pr.role = 'fotografo' then 'fotografo'
      else 'cliente'
    end,
    case
      when pr.role = 'fotografo' then coalesce(nullif(btrim(f.estudio), ''), pr.nome_completo)
      when pr.role = 'cliente' then coalesce(
        (select nullif(btrim(c.nome), '') from public.clientes c where c.user_id = pr.id limit 1),
        pr.nome_completo
      )
      else pr.nome_completo
    end
  from public.profiles pr
  left join public.fotografos f on f.id = pr.id
  where pr.id = auth.uid();
$$;

revoke execute on function public.pode_ver_conversa(uuid) from public, anon;
revoke execute on function public.pode_escrever_conversa(uuid) from public, anon;
revoke execute on function public._usuario_eh_equipe(uuid) from public, anon;
revoke execute on function public._autor_da_mensagem() from public, anon;
grant execute on function public.pode_ver_conversa(uuid) to authenticated, service_role;
grant execute on function public.pode_escrever_conversa(uuid) to authenticated, service_role;
grant execute on function public._usuario_eh_equipe(uuid) to authenticated, service_role;
grant execute on function public._autor_da_mensagem() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Gatilhos
-- -----------------------------------------------------------------------------

-- Fio de projeto é sempre do estúdio dono do projeto; canal/estúdio/projeto
-- não mudam depois de criado.
create or replace function public.conversas_validar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and (new.canal is distinct from old.canal
          or new.fotografo_id is distinct from old.fotografo_id
          or new.projeto_id is distinct from old.projeto_id) then
    raise exception 'O fio da conversa não pode mudar de canal, estúdio ou projeto' using errcode = 'check_violation';
  end if;

  if new.projeto_id is not null and not exists (
    select 1 from public.projetos p where p.id = new.projeto_id and p.fotografo_id = new.fotografo_id
  ) then
    raise exception 'O projeto não é deste estúdio' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.conversas_validar() from public, anon, authenticated;

drop trigger if exists trg_conversas_validar on public.conversas;
create trigger trg_conversas_validar
  before insert or update on public.conversas
  for each row execute function public.conversas_validar();

-- Antes de gravar a mensagem. SECURITY INVOKER de propósito (como na 0036):
-- `current_user` diz se veio da sessão do usuário (PostgREST) — aí autor,
-- tipo, data e nome são do servidor, nunca do navegador — e a lâmina citada
-- passa pela RLS de quem escreve (o cliente só cita lâmina de versão liberada).
create or replace function public.mensagens_preparar()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_projeto uuid;
  v_lamina  record;
  v_autor   record;
begin
  if current_user in ('authenticated', 'anon') then
    select a.papel, a.nome into v_autor from public._autor_da_mensagem() a;
    if v_autor.papel is null then
      raise exception 'Sessão sem perfil' using errcode = '42501';
    end if;
    new.autor_id    := auth.uid();
    new.autor_papel := v_autor.papel;
    new.autor_nome  := left(coalesce(v_autor.nome, ''), 120);
    new.tipo        := 'texto';
    new.created_at  := clock_timestamp();
    new.apagada_em  := null;
    new.apagada_por := null;
  end if;

  new.corpo := btrim(coalesce(new.corpo, ''));

  if new.lamina_id is not null or new.versao_id is not null then
    select c.projeto_id into v_projeto from public.conversas c where c.id = new.conversa_id;
    if v_projeto is null then
      raise exception 'Só fios de projeto citam lâminas' using errcode = 'check_violation';
    end if;

    if new.lamina_id is not null then
      select dv.id as versao_id, dv.projeto_id into v_lamina
      from public.versoes_laminas vl
      join public.design_versions dv on dv.id = vl.versao_id
      where vl.id = new.lamina_id;
      if v_lamina.projeto_id is distinct from v_projeto then
        raise exception 'Lâmina fora deste projeto' using errcode = 'check_violation';
      end if;
      new.versao_id := v_lamina.versao_id;
    elsif not exists (
      select 1 from public.design_versions dv where dv.id = new.versao_id and dv.projeto_id = v_projeto
    ) then
      raise exception 'Versão fora deste projeto' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.mensagens_preparar() from public, anon, authenticated;

drop trigger if exists trg_mensagens_preparar on public.mensagens;
create trigger trg_mensagens_preparar
  before insert on public.mensagens
  for each row execute function public.mensagens_preparar();

-- Pela sessão do usuário, a única edição é apagar (exclusão lógica): o corpo
-- e a lâmina somem, a linha fica ("Mensagem apagada").
create or replace function public.mensagens_guardar_edicao()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if old.apagada_em is not null then
    raise exception 'Mensagem já apagada' using errcode = 'check_violation';
  end if;
  if new.apagada_em is null
     or new.conversa_id is distinct from old.conversa_id
     or new.autor_id is distinct from old.autor_id
     or new.autor_nome is distinct from old.autor_nome
     or new.autor_papel is distinct from old.autor_papel
     or new.tipo is distinct from old.tipo
     or new.created_at is distinct from old.created_at then
    raise exception 'Só é possível apagar a mensagem' using errcode = 'check_violation';
  end if;

  new.apagada_em  := clock_timestamp();
  new.apagada_por := auth.uid();
  new.corpo       := '';
  new.lamina_id   := null;
  new.versao_id   := null;
  return new;
end;
$$;

revoke execute on function public.mensagens_guardar_edicao() from public, anon, authenticated;

drop trigger if exists trg_mensagens_guardar_edicao on public.mensagens;
create trigger trg_mensagens_guardar_edicao
  before update on public.mensagens
  for each row execute function public.mensagens_guardar_edicao();

-- Depois de gravar: prévia do fio e "lido até aqui" para quem escreveu.
create or replace function public.mensagens_atualizar_conversa()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.conversas
       set ultima_mensagem_em = new.created_at,
           ultima_mensagem_previa = left(new.corpo, 140)
     where id = new.conversa_id
       and (ultima_mensagem_em is null or ultima_mensagem_em <= new.created_at);

    if new.autor_id is not null then
      insert into public.conversa_leituras (conversa_id, usuario_id, lida_ate)
      values (new.conversa_id, new.autor_id, new.created_at)
      on conflict (conversa_id, usuario_id)
      do update set lida_ate = greatest(public.conversa_leituras.lida_ate, excluded.lida_ate);
    end if;
  elsif new.apagada_em is not null and old.apagada_em is null then
    update public.conversas
       set ultima_mensagem_previa = 'Mensagem apagada'
     where id = new.conversa_id and ultima_mensagem_em = new.created_at;
  end if;
  return null;
end;
$$;

revoke execute on function public.mensagens_atualizar_conversa() from public, anon, authenticated;

drop trigger if exists trg_mensagens_atualizar_conversa on public.mensagens;
create trigger trg_mensagens_atualizar_conversa
  after insert or update of apagada_em on public.mensagens
  for each row execute function public.mensagens_atualizar_conversa();

-- -----------------------------------------------------------------------------
-- 4. RLS
-- -----------------------------------------------------------------------------

alter table public.conversas         enable row level security;
alter table public.mensagens         enable row level security;
alter table public.conversa_leituras enable row level security;

-- Nada de anônimo; fio e leitura só se escrevem pelas funções abaixo.
revoke all on public.conversas, public.mensagens, public.conversa_leituras from anon;
revoke insert, update, delete, truncate on public.conversas, public.conversa_leituras from authenticated;
revoke delete, truncate on public.mensagens from authenticated;
grant select on public.conversas, public.conversa_leituras to authenticated;
grant select, insert, update on public.mensagens to authenticated;

drop policy if exists "conversas_select" on public.conversas;
create policy "conversas_select" on public.conversas for select to authenticated
  using (public.pode_ver_conversa(id));

drop policy if exists "mensagens_select" on public.mensagens;
create policy "mensagens_select" on public.mensagens for select to authenticated
  using (public.pode_ver_conversa(conversa_id));

drop policy if exists "mensagens_insert" on public.mensagens;
create policy "mensagens_insert" on public.mensagens for insert to authenticated
  with check (
    autor_id = auth.uid()
    and tipo = 'texto'
    and public.pode_escrever_conversa(conversa_id)
  );

-- Apagar (exclusão lógica) só a própria mensagem; o gatilho barra o resto.
drop policy if exists "mensagens_update_autor" on public.mensagens;
create policy "mensagens_update_autor" on public.mensagens for update to authenticated
  using (autor_id = auth.uid() and public.pode_ver_conversa(conversa_id))
  with check (autor_id = auth.uid() and public.pode_ver_conversa(conversa_id));

-- A própria leitura sempre; a dos outros só no que a pessoa vê — e a leitura
-- da equipe no fio do cliente fica interna (nem o casal nem o estúdio veem).
drop policy if exists "conversa_leituras_select" on public.conversa_leituras;
create policy "conversa_leituras_select" on public.conversa_leituras for select to authenticated
  using (
    usuario_id = auth.uid()
    or (
      public.pode_ver_conversa(conversa_id)
      and (
        public.is_equipe()
        or not public._usuario_eh_equipe(usuario_id)
        or exists (select 1 from public.conversas c where c.id = conversa_leituras.conversa_id and c.canal = 'estudio_equipe')
      )
    )
  );

-- -----------------------------------------------------------------------------
-- 5. Funções chamadas pelo app
-- -----------------------------------------------------------------------------

-- Busca ou cria o fio (idempotente). Projeto: o estúdio vem do projeto.
-- Sem projeto: só `estudio_equipe` (fio geral); o estúdio é o próprio
-- fotógrafo logado ou, para a operação, `p_fotografo_id`.
create or replace function public.abrir_conversa(
  p_canal        text,
  p_fotografo_id uuid default null,
  p_projeto_id   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fotografo   uuid;
  v_responsavel uuid;
  v_cliente     uuid;
  v_id          uuid;
begin
  if auth.uid() is null then
    raise exception 'Sessão obrigatória' using errcode = '42501';
  end if;
  if p_canal is null or p_canal not in ('estudio_equipe', 'cliente_estudio') then
    raise exception 'Canal inválido' using errcode = '22023';
  end if;

  if p_projeto_id is not null then
    select p.fotografo_id, p.responsavel_id, cl.user_id
      into v_fotografo, v_responsavel, v_cliente
    from public.projetos p
    left join public.clientes cl on cl.id = p.cliente_id
    where p.id = p_projeto_id;
    if v_fotografo is null or (p_fotografo_id is not null and p_fotografo_id <> v_fotografo) then
      raise exception 'Projeto não encontrado' using errcode = '42501';
    end if;

    if not (
      v_fotografo = auth.uid()
      or (p_canal = 'cliente_estudio' and v_cliente = auth.uid())
      or (p_canal = 'estudio_equipe' and public.is_operacao())
      or (p_canal = 'estudio_equipe' and public.is_designer() and v_responsavel = auth.uid())
    ) then
      raise exception 'Sem acesso a esta conversa' using errcode = '42501';
    end if;
  else
    if p_canal <> 'estudio_equipe' then
      raise exception 'Conversa com o cliente é sempre de um projeto' using errcode = '22023';
    end if;
    v_fotografo := coalesce(p_fotografo_id, auth.uid());
    if not (v_fotografo = auth.uid() or public.is_operacao()) then
      raise exception 'Sem acesso a esta conversa' using errcode = '42501';
    end if;
    if not exists (select 1 from public.fotografos f where f.id = v_fotografo) then
      raise exception 'Estúdio não encontrado' using errcode = '42501';
    end if;
  end if;

  select c.id into v_id from public.conversas c
  where c.canal = p_canal and c.fotografo_id = v_fotografo and c.projeto_id is not distinct from p_projeto_id;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.conversas (canal, fotografo_id, projeto_id)
  values (p_canal, v_fotografo, p_projeto_id)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select c.id into v_id from public.conversas c
    where c.canal = p_canal and c.fotografo_id = v_fotografo and c.projeto_id is not distinct from p_projeto_id;
  end if;
  return v_id;
end;
$$;

-- "Li até agora."
create or replace function public.marcar_conversa_lida(p_conversa_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_agora timestamptz := clock_timestamp();
begin
  if not public.pode_ver_conversa(p_conversa_id) then
    raise exception 'Sem acesso a esta conversa' using errcode = '42501';
  end if;

  insert into public.conversa_leituras (conversa_id, usuario_id, lida_ate)
  values (p_conversa_id, auth.uid(), v_agora)
  on conflict (conversa_id, usuario_id)
  do update set lida_ate = greatest(public.conversa_leituras.lida_ate, excluded.lida_ate);
  return v_agora;
end;
$$;

-- Não lidas por fio, de quem está logado. Conta mensagens de outras pessoas
-- (e do sistema) depois do "lido até". Para a equipe, só o que o ESTÚDIO
-- escreveu nos fios com a equipe — o fio do cliente é só leitura de suporte,
-- e o que um colega mandou não é "novo" para o time.
create or replace function public.contar_mensagens_nao_lidas()
returns table (conversa_id uuid, nao_lidas integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, count(m.id)::integer
  from public.conversas c
  join public.mensagens m on m.conversa_id = c.id
  left join public.conversa_leituras l on l.conversa_id = c.id and l.usuario_id = auth.uid()
  where public.pode_ver_conversa(c.id)
    and m.apagada_em is null
    and m.autor_id is distinct from auth.uid()
    and m.created_at > coalesce(l.lida_ate, '-infinity'::timestamptz)
    and (
      not public.is_equipe()
      or (c.canal = 'estudio_equipe' and m.autor_papel = 'fotografo')
    )
  group by c.id;
$$;

create or replace function public.total_mensagens_nao_lidas()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(n.nao_lidas), 0)::integer from public.contar_mensagens_nao_lidas() n;
$$;

-- Lista de fios para as caixas de entrada, com o nome do estúdio (marca do
-- estúdio para o cliente), o projeto e as não lidas. O nome do cliente final
-- não vai para o designer (fora dos dados de clientes, 0021).
create or replace function public.listar_conversas(
  p_canal             text default null,
  p_fotografo_id      uuid default null,
  p_projeto_id        uuid default null,
  p_somente_nao_lidas boolean default false,
  p_limite            integer default 50
)
returns table (
  id                     uuid,
  canal                  text,
  fotografo_id           uuid,
  estudio                text,
  estudio_logo_url       text,
  projeto_id             uuid,
  projeto_nome           text,
  projeto_numero         bigint,
  cliente_nome           text,
  ultima_mensagem_em     timestamptz,
  ultima_mensagem_previa text,
  nao_lidas              integer,
  created_at             timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with nl as (select * from public.contar_mensagens_nao_lidas())
  select
    c.id, c.canal, c.fotografo_id, f.estudio, f.logo_url,
    c.projeto_id, p.nome, p.numero,
    case when public.is_designer() then null else cl.nome end,
    c.ultima_mensagem_em, c.ultima_mensagem_previa,
    coalesce(nl.nao_lidas, 0), c.created_at
  from public.conversas c
  join public.fotografos f on f.id = c.fotografo_id
  left join public.projetos p on p.id = c.projeto_id
  left join public.clientes cl on cl.id = p.cliente_id
  left join nl on nl.conversa_id = c.id
  where public.pode_ver_conversa(c.id)
    and (p_canal is null or c.canal = p_canal)
    and (p_fotografo_id is null or c.fotografo_id = p_fotografo_id)
    and (p_projeto_id is null or c.projeto_id = p_projeto_id)
    and (not coalesce(p_somente_nao_lidas, false) or coalesce(nl.nao_lidas, 0) > 0)
  order by coalesce(c.ultima_mensagem_em, c.created_at) desc
  limit greatest(least(coalesce(p_limite, 50), 200), 1);
$$;

revoke execute on function public.abrir_conversa(text, uuid, uuid) from public, anon;
revoke execute on function public.marcar_conversa_lida(uuid) from public, anon;
revoke execute on function public.contar_mensagens_nao_lidas() from public, anon;
revoke execute on function public.total_mensagens_nao_lidas() from public, anon;
revoke execute on function public.listar_conversas(text, uuid, uuid, boolean, integer) from public, anon;
grant execute on function public.abrir_conversa(text, uuid, uuid) to authenticated;
grant execute on function public.marcar_conversa_lida(uuid) to authenticated;
grant execute on function public.contar_mensagens_nao_lidas() to authenticated;
grant execute on function public.total_mensagens_nao_lidas() to authenticated;
grant execute on function public.listar_conversas(text, uuid, uuid, boolean, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Mensagens de sistema nos marcos da prova
-- -----------------------------------------------------------------------------
-- Gatilho próprio (não mexe em `registrar_comunicacao_status`). Posta no fio
-- do projeto com a equipe. Nunca derruba a mudança de status: se falhar,
-- só avisa no log.
create or replace function public.mensagem_sistema_status_projeto()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_versao    integer;
  v_versao_id uuid;
  v_texto     text;
  v_conversa  uuid;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select dv.numero, dv.id into v_versao, v_versao_id
  from public.design_versions dv
  where dv.projeto_id = new.id and dv.status = 'aprovada'
  order by dv.numero desc
  limit 1;

  v_texto := case
    when new.status = 'aguardando_aprovacao_cliente' then
      'Prova publicada' || coalesce(' — versão ' || v_versao, '') || '. Aguardando a aprovação.'
    when new.status in ('aprovado', 'aprovado_aguardando_pagamento') and old.status = 'aguardando_aprovacao_cliente' then
      'Prova aprovada' || coalesce(' — versão ' || v_versao, '') || '.'
    when new.status = 'alteracoes_solicitadas' then
      'Ajustes solicitados na prova' || coalesce(' — versão ' || v_versao, '') || '.'
    else null
  end;
  if v_texto is null then
    return new;
  end if;

  begin
    insert into public.conversas (canal, fotografo_id, projeto_id)
    values ('estudio_equipe', new.fotografo_id, new.id)
    on conflict do nothing;
    select c.id into v_conversa from public.conversas c
    where c.canal = 'estudio_equipe' and c.projeto_id = new.id;

    insert into public.mensagens (conversa_id, autor_id, autor_nome, autor_papel, tipo, corpo, versao_id)
    values (v_conversa, null, 'seualbum', 'sistema', 'sistema', v_texto, v_versao_id);
  exception when others then
    raise warning 'mensagem de sistema não registrada (projeto %): %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke execute on function public.mensagem_sistema_status_projeto() from public, anon, authenticated;

drop trigger if exists trg_mensagem_sistema_status_projeto on public.projetos;
create trigger trg_mensagem_sistema_status_projeto
  after update of status on public.projetos
  for each row execute function public.mensagem_sistema_status_projeto();

-- -----------------------------------------------------------------------------
-- 7. Realtime (postgres_changes respeita a RLS de `mensagens`)
-- -----------------------------------------------------------------------------

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mensagens'
     ) then
    alter publication supabase_realtime add table public.mensagens;
  end if;
end $$;
