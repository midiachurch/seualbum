-- =============================================================================
-- Migration 0040: envios pendentes do R2 (dono de cada upload) e varredura de
-- órfãos
--
-- 1. Corrida na confirmação das fotos do projeto: a chave
--    projetos/{projeto}/fotos/{id}-{nome} não diz quem enviou. Quem enxerga o
--    projeto (inclusive o cliente final) lê as chaves e podia confirmar o
--    arquivo de outra pessoa antes dela: a linha em `fotos` saía com
--    `enviado_por` = quem confirmou, que então podia apagá-la. E, como o
--    objeto continuava no R2 depois de apagada a linha, qualquer um que
--    soubesse a chave podia "ressuscitar" a foto.
--
--    Agora a rota que assina o PUT reserva a chave para quem pediu
--    (`reservar_upload_r2`, 24h, só service_role). O INSERT em `fotos` pela sessão do usuário
--    só passa se a reserva for DELE, e a consome na mesma transação: cada
--    chave é confirmada uma vez, só por quem a enviou. Uma foto apagada não
--    volta: não há mais reserva (e a varredura tira o objeto do R2).
--
-- 2. `r2_chaves_sem_referencia`: para a varredura de órfãos do Cron
--    (/api/cron/limpar-fotos-r2). Diz quais chaves NENHUMA coluna de texto/JSON
--    do schema public cita — fotos, versoes_laminas, media_assets, logos,
--    caminhos nos JSON do editor, pedidos_fotos_r2, reservas pendentes e
--    qualquer coluna nova. Conservadora: chave fora do formato do app, ou
--    citada (ela ou uma pasta acima dela) em qualquer lugar, fica.
--
-- Idempotente: pode ser reexecutada com segurança. NÃO aplicada.
-- =============================================================================

-- 1a. Reservas -----------------------------------------------------------------
create table if not exists public.r2_uploads_pendentes (
  r2_key     text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  expira_em  timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_r2_uploads_pendentes_expira on public.r2_uploads_pendentes (expira_em);

comment on table public.r2_uploads_pendentes is
  'Envios ao R2 assinados e ainda não confirmados (0040): a chave só vira linha em `fotos` pela mesma pessoa que pediu o envio.';

alter table public.r2_uploads_pendentes enable row level security;

-- Escrita só pelas funções abaixo (security definer) e pelo service_role.
revoke all on table public.r2_uploads_pendentes from public, anon, authenticated;
grant select on table public.r2_uploads_pendentes to authenticated;
grant all on table public.r2_uploads_pendentes to service_role;

drop policy if exists "r2_uploads_pendentes_select_proprio" on public.r2_uploads_pendentes;
create policy "r2_uploads_pendentes_select_proprio" on public.r2_uploads_pendentes for select to authenticated
  using (user_id = auth.uid());

-- 1b. Reservar (passo 1, ao assinar o PUT) -------------------------------------
-- Só pelo servidor (service_role), DEPOIS de a rota conferir a sessão e o
-- acesso ao projeto (`projetoParaUpload`) e de o HeadObject dizer que a chave
-- ainda não existe no R2. Pela sessão do usuário não dá: quem enxerga o
-- projeto poderia reservar a chave de uma foto apagada cujo objeto ainda está
-- no R2 e confirmá-la em seu nome.
-- true = a chave é de p_user_id pelas próximas 24h. false = já é de outra
-- pessoa, já está em `fotos` ou está fora do formato.
drop function if exists public.reservar_upload_r2(text);
create or replace function public.reservar_upload_r2(p_key text, p_user_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_linhas integer;
begin
  if p_user_id is null then
    return false;
  end if;
  -- Só fotos do projeto, no formato de `chaveFotoProjeto` (src/lib/r2/chaves.ts).
  if p_key is null
     or p_key like '%..%'
     or p_key !~ '^projetos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/fotos/[0-9a-fA-F-]{36}-[A-Za-z0-9._-]{1,80}$' then
    return false;
  end if;
  if exists (select 1 from public.fotos f where f.bucket = 'r2' and f.storage_path = p_key) then
    return false;
  end if;

  delete from public.r2_uploads_pendentes where r2_key = p_key and expira_em <= now();

  insert into public.r2_uploads_pendentes as p (r2_key, user_id, expira_em)
  values (p_key, p_user_id, now() + interval '24 hours')
  on conflict (r2_key) do update
    set expira_em = excluded.expira_em
    where p.user_id = p_user_id;
  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$$;

revoke execute on function public.reservar_upload_r2(text, uuid) from public, anon, authenticated;
grant execute on function public.reservar_upload_r2(text, uuid) to service_role;

-- 1c. Consumir (passo 3, dentro do INSERT em `fotos`) ---------------------------
-- Apaga a reserva DE QUEM CHAMOU, se ainda valer. Chamar à toa só apaga a
-- própria reserva.
create or replace function public.consumir_upload_r2(p_key text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_linhas integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  delete from public.r2_uploads_pendentes
   where r2_key = p_key and user_id = auth.uid() and expira_em > now();
  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$$;

revoke execute on function public.consumir_upload_r2(text) from public, anon;
grant execute on function public.consumir_upload_r2(text) to authenticated, service_role;

-- 1d. Trava das chaves 'r2' em `fotos` (substitui a da 0036) -------------------
-- Igual à 0036, mais: pela sessão do usuário, a chave da pasta do projeto só
-- entra com a reserva de quem grava e com `enviado_por` = quem grava.
-- SECURITY INVOKER de propósito: `current_user` precisa ser quem gravou.
create or replace function public.fotos_validar_chave_r2()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_fotografo uuid;
begin
  if new.bucket is distinct from 'r2' then
    return new;
  end if;

  if new.storage_path is null or new.storage_path like '%..%' or new.storage_path like '%//%' then
    raise exception 'Chave do R2 inválida em fotos' using errcode = 'check_violation';
  end if;

  -- Pasta de fotos do próprio projeto (/api/uploads/projeto-foto, script de cópia).
  if new.storage_path like 'projetos/' || new.projeto_id::text || '/fotos/%' then
    if current_user in ('authenticated', 'anon')
       and (
         tg_op = 'INSERT'
         or new.storage_path is distinct from old.storage_path
         or old.bucket is distinct from 'r2'
         or new.projeto_id is distinct from old.projeto_id
       ) then
      if auth.uid() is null or new.enviado_por is distinct from auth.uid() then
        raise exception 'Foto do R2 registrada em nome de outra pessoa' using errcode = 'check_violation';
      end if;
      if not public.consumir_upload_r2(new.storage_path) then
        raise exception 'Envio do R2 não reconhecido: a chave não foi reservada por quem confirma (ou expirou)'
          using errcode = 'check_violation';
      end if;
    end if;
    return new;
  end if;

  -- Chave de pedido: nunca pela sessão do usuário (PostgREST). `current_user`
  -- aqui é quem chamou — dentro de uma função security definer (conversão) é
  -- o dono dela, não `authenticated`.
  if current_user in ('authenticated', 'anon') then
    raise exception 'Foto do R2 fora da pasta do projeto' using errcode = 'check_violation';
  end if;

  select p.fotografo_id into v_fotografo from public.projetos p where p.id = new.projeto_id;
  if v_fotografo is not null
     and new.storage_path like 'pedidos/' || v_fotografo::text || '/%'
     and exists (
       select 1 from public.pedidos_fotos_r2 r
       where r.r2_key = new.storage_path and r.client_id = v_fotografo
     ) then
    return new;
  end if;

  raise exception 'Foto do R2 fora da pasta do projeto' using errcode = 'check_violation';
end;
$$;

revoke execute on function public.fotos_validar_chave_r2() from public, anon, authenticated;

drop trigger if exists trg_fotos_validar_chave_r2 on public.fotos;
create trigger trg_fotos_validar_chave_r2
  before insert or update of bucket, storage_path, projeto_id on public.fotos
  for each row execute function public.fotos_validar_chave_r2();

-- 2. Varredura de órfãos: quais destas chaves ninguém cita? ---------------------
-- Lê o TEXTO de todas as colunas text/varchar/json/jsonb (e arrays de texto)
-- de todas as tabelas do schema public e extrai tudo que parece chave do app
-- (pedidos/, projetos/, albuns/, vitrine/, logos/), inclusive dentro de JSON e
-- de URLs. Uma chave é "sem referência" só se nem ela nem nenhuma pasta acima
-- dela (a partir do 3º nível, ex.: projetos/{id}/fotos) aparece. Chave fora do formato seguro nunca sai (fica no R2).
-- Uma leitura completa por chamada: o Cron manda as chaves em lotes grandes.
create or replace function public.r2_chaves_sem_referencia(p_keys text[])
returns setof text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_partes text[] := '{}';
  r record;
begin
  if p_keys is null or cardinality(p_keys) = 0 then
    return;
  end if;
  if cardinality(p_keys) > 10000 then
    raise exception 'No máximo 10000 chaves por chamada' using errcode = 'program_limit_exceeded';
  end if;

  for r in
    select n.nspname, c.relname, a.attname
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and a.attnum > 0
      and not a.attisdropped
      and a.atttypid in (
        'text'::regtype, 'varchar'::regtype, 'bpchar'::regtype, 'json'::regtype, 'jsonb'::regtype,
        'text[]'::regtype, 'varchar[]'::regtype
      )
  loop
    v_partes := v_partes || format(
      'select %1$I::text as t from %2$I.%3$I where %1$I is not null and %1$I::text ~ ''(pedidos|projetos|albuns|vitrine|logos)/''',
      r.attname, r.nspname, r.relname
    );
  end loop;

  if cardinality(v_partes) = 0 then
    return;
  end if;

  return query execute format(
    $q$
    with textos as (%s),
    citadas as (
      select distinct rtrim(m[1], '/') as k
      from textos, regexp_matches(textos.t, '((?:pedidos|projetos|albuns|vitrine|logos)/[A-Za-z0-9._/-]+)', 'g') as m
    ),
    candidatas as (
      select distinct c as key
      from unnest($1) as c
      where c ~ '^(pedidos|projetos|albuns|vitrine|logos)(/[A-Za-z0-9._-]+)+$'
        and position('..' in c) = 0
    ),
    -- a própria chave e cada pasta acima dela, a partir de "prefixo/x/y"
    -- ("projetos/{id}" sozinho aparece em links de tela, como /admin/projetos/{id})
    ancestrais as (
      select ca.key, array_to_string((string_to_array(ca.key, '/'))[1:n], '/') as a
      from candidatas ca,
           generate_series(least(3, cardinality(string_to_array(ca.key, '/'))), cardinality(string_to_array(ca.key, '/'))) as n
    )
    select ca.key
    from candidatas ca
    where not exists (
      select 1 from ancestrais an join citadas ci on ci.k = an.a where an.key = ca.key
    )
    order by ca.key
    $q$,
    array_to_string(v_partes, ' union all ')
  ) using p_keys;
end;
$$;

revoke execute on function public.r2_chaves_sem_referencia(text[]) from public, anon, authenticated;
grant execute on function public.r2_chaves_sem_referencia(text[]) to service_role;
