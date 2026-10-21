-- =============================================================================
-- Migration 0042: reconhecimento facial ("Encontrar minhas fotos")
--
-- O cliente final, dentro do projeto, manda uma selfie e vê só as fotos em que
-- aparece. Os rostos das fotos do projeto ficam numa coleção do AWS
-- Rekognition (uma por projeto); aqui fica o índice FaceId → foto e o estado
-- de cada foto. A selfie nunca é gravada (nem no R2, nem no banco).
--
-- Rosto é dado biométrico — dado pessoal SENSÍVEL na LGPD (art. 11). Por isso:
--   - opt-in por projeto: nada é indexado até a equipe (ou o estúdio dono)
--     ligar (`definir_reconhecimento_facial`);
--   - retenção de 60 dias a partir da ativação (`expira_em`): o Cron
--     /api/cron/reconhecimento-facial apaga a coleção inteira no Rekognition e
--     as linhas daqui;
--   - foto apagada / projeto desligado: os FaceIds vão para a fila
--     `reconhecimento_rostos_remover` (gatilho) e o Cron os apaga no Rekognition.
--
--   1. `reconhecimento_projetos`  projetos com a busca ligada (e até quando).
--   2. `reconhecimento_fotos`     estado da indexação de cada foto.
--   3. `reconhecimento_rostos`    FaceId (Rekognition) → foto. Só service_role.
--   4. `reconhecimento_rostos_remover`  fila de FaceIds a apagar no Rekognition.
--   5. `fotos_para_indexar`       fila de fotos dos projetos ligados.
--   6. `favoritar_fotos`          "Destacar essas fotos no meu álbum" (e avisa
--                                 a equipe na linha do tempo do projeto).
--   7. `eventos_analiticos`       telemetria da feature.
--   8. `registrar_busca_facial`   limite de 5 buscas por minuto por usuário
--                                 (cada busca é cobrada pela AWS).
--
-- Idempotente: pode ser reexecutada com segurança. Aplicada em 21/10/2026.
-- =============================================================================

-- 1. Projetos com a busca ligada ------------------------------------------------
create table if not exists public.reconhecimento_projetos (
  projeto_id  uuid primary key references public.projetos (id) on delete cascade,
  ativado_por uuid references public.profiles (id) on delete set null,
  ativado_em  timestamptz not null default now(),
  expira_em   timestamptz not null default now() + interval '60 days'
);

create index if not exists idx_reconhecimento_projetos_expira on public.reconhecimento_projetos (expira_em);

comment on table public.reconhecimento_projetos is
  'Projetos com o reconhecimento facial ligado (0042). Retenção de 60 dias a partir da ativação (LGPD).';

alter table public.reconhecimento_projetos enable row level security;
revoke all on table public.reconhecimento_projetos from public, anon, authenticated;
grant select on table public.reconhecimento_projetos to authenticated;
grant all on table public.reconhecimento_projetos to service_role;

-- O cliente precisa saber se o botão aparece; escrita só pela função abaixo.
drop policy if exists "reconhecimento_projetos_select" on public.reconhecimento_projetos;
create policy "reconhecimento_projetos_select" on public.reconhecimento_projetos for select to authenticated
  using (public.pode_ver_projeto(projeto_id));

-- 2. Estado de cada foto ----------------------------------------------------------
create table if not exists public.reconhecimento_fotos (
  foto_id       uuid primary key references public.fotos (id) on delete cascade,
  projeto_id    uuid not null references public.projetos (id) on delete cascade,
  status        text not null check (status in ('indexada', 'sem_rosto', 'nao_suportada', 'erro')),
  rostos        smallint not null default 0 check (rostos between 0 and 15),
  tentativas    smallint not null default 1,
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_reconhecimento_fotos_projeto on public.reconhecimento_fotos (projeto_id, status);

alter table public.reconhecimento_fotos enable row level security;
revoke all on table public.reconhecimento_fotos from public, anon, authenticated;
grant select on table public.reconhecimento_fotos to authenticated;
grant all on table public.reconhecimento_fotos to service_role;

drop policy if exists "reconhecimento_fotos_select" on public.reconhecimento_fotos;
create policy "reconhecimento_fotos_select" on public.reconhecimento_fotos for select to authenticated
  using (public.pode_ver_projeto(projeto_id));

-- 3. FaceId → foto ----------------------------------------------------------------
-- Não guarda a chave do R2 (só o id da foto): assim esta tabela não segura
-- objeto nenhum na varredura de órfãos (`r2_chaves_sem_referencia`, 0040).
create table if not exists public.reconhecimento_rostos (
  face_id    text primary key check (face_id ~ '^[0-9a-f-]{36}$'),
  foto_id    uuid not null references public.fotos (id) on delete cascade,
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  criado_em  timestamptz not null default now()
);

create index if not exists idx_reconhecimento_rostos_foto on public.reconhecimento_rostos (foto_id);
create index if not exists idx_reconhecimento_rostos_projeto on public.reconhecimento_rostos (projeto_id);

alter table public.reconhecimento_rostos enable row level security;
revoke all on table public.reconhecimento_rostos from public, anon, authenticated;
grant all on table public.reconhecimento_rostos to service_role;

-- 4. Fila de remoção no Rekognition -------------------------------------------------
-- Toda linha que sai de `reconhecimento_rostos` (foto apagada, projeto
-- excluído, busca desligada ou vencida) entra aqui; o Cron apaga o FaceId na
-- coleção e tira a linha. Coleção que já não existe = nada a apagar.
create table if not exists public.reconhecimento_rostos_remover (
  face_id    text primary key,
  projeto_id uuid not null,
  criado_em  timestamptz not null default now()
);

alter table public.reconhecimento_rostos_remover enable row level security;
revoke all on table public.reconhecimento_rostos_remover from public, anon, authenticated;
grant all on table public.reconhecimento_rostos_remover to service_role;

create or replace function public.reconhecimento_rosto_para_remover()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.reconhecimento_rostos_remover (face_id, projeto_id)
  values (old.face_id, old.projeto_id)
  on conflict (face_id) do nothing;
  return old;
end;
$$;

revoke execute on function public.reconhecimento_rosto_para_remover() from public, anon, authenticated;

drop trigger if exists trg_reconhecimento_rostos_remover on public.reconhecimento_rostos;
create trigger trg_reconhecimento_rostos_remover
  after delete on public.reconhecimento_rostos
  for each row execute function public.reconhecimento_rosto_para_remover();

-- Ligar / desligar ------------------------------------------------------------------
-- Equipe ou o estúdio dono do projeto. Desligar apaga o índice daqui (os
-- FaceIds caem na fila de remoção) — a rota também apaga a coleção na hora.
-- Religar recomeça a contagem dos 60 dias e reindexa tudo.
create or replace function public.definir_reconhecimento_facial(p_projeto_id uuid, p_ativo boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not (
    public.is_equipe()
    or exists (select 1 from public.projetos p where p.id = p_projeto_id and p.fotografo_id = auth.uid())
  ) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  if p_ativo then
    insert into public.reconhecimento_projetos (projeto_id, ativado_por)
    values (p_projeto_id, auth.uid())
    on conflict (projeto_id) do nothing;
  else
    delete from public.reconhecimento_rostos where projeto_id = p_projeto_id;
    delete from public.reconhecimento_fotos where projeto_id = p_projeto_id;
    delete from public.reconhecimento_projetos where projeto_id = p_projeto_id;
  end if;
  return p_ativo;
end;
$$;

revoke execute on function public.definir_reconhecimento_facial(uuid, boolean) from public, anon;
grant execute on function public.definir_reconhecimento_facial(uuid, boolean) to authenticated;

-- Vencidos (Cron) ---------------------------------------------------------------------
-- Mesma limpeza do "desligar", para quem passou dos 60 dias. Devolve os
-- projetos encerrados (a rota apaga a coleção de cada um).
create or replace function public.encerrar_reconhecimentos_vencidos(p_limite integer default 100)
returns setof uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[];
begin
  select coalesce(array_agg(projeto_id), '{}') into v_ids
    from (
      select projeto_id from public.reconhecimento_projetos
       where expira_em <= now()
       order by expira_em
       limit greatest(1, least(p_limite, 1000))
    ) v;

  delete from public.reconhecimento_rostos where projeto_id = any (v_ids);
  delete from public.reconhecimento_fotos where projeto_id = any (v_ids);
  delete from public.reconhecimento_projetos where projeto_id = any (v_ids);
  return query select unnest(v_ids);
end;
$$;

revoke execute on function public.encerrar_reconhecimentos_vencidos(integer) from public, anon, authenticated;
grant execute on function public.encerrar_reconhecimentos_vencidos(integer) to service_role;

-- 5. Fila de indexação ------------------------------------------------------------------
-- Fotos do R2 dos projetos ligados (e não vencidos) que ainda não foram lidas,
-- mais as que deram erro (até 3 tentativas). `p_projeto_id` null = todos.
create or replace function public.fotos_para_indexar(p_projeto_id uuid default null, p_limite integer default 50)
returns table (foto_id uuid, projeto_id uuid, storage_path text, tentativas smallint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select f.id, f.projeto_id, f.storage_path, coalesce(rf.tentativas, 0::smallint)
    from public.fotos f
    join public.reconhecimento_projetos rp on rp.projeto_id = f.projeto_id and rp.expira_em > now()
    left join public.reconhecimento_fotos rf on rf.foto_id = f.id
   where f.bucket = 'r2'
     and (p_projeto_id is null or f.projeto_id = p_projeto_id)
     and (rf.foto_id is null or (rf.status = 'erro' and rf.tentativas < 3))
   -- Fotos novas antes das novas tentativas: um erro persistente não trava a fila.
   order by rf.foto_id is not null, f.created_at
   limit greatest(1, least(p_limite, 500));
$$;

revoke execute on function public.fotos_para_indexar(uuid, integer) from public, anon, authenticated;
grant execute on function public.fotos_para_indexar(uuid, integer) to service_role;

-- 6. "Destacar no álbum" ------------------------------------------------------------------
-- `fotos` não tem UPDATE pela sessão; quem enxerga o projeto (o cliente) marca
-- como favoritas as fotos em que se encontrou. Só liga, nunca desliga.
create or replace function public.favoritar_fotos(p_projeto_id uuid, p_foto_ids uuid[])
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_linhas integer;
begin
  if auth.uid() is null or not public.pode_ver_projeto(p_projeto_id) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if coalesce(array_length(p_foto_ids, 1), 0) > 1000 then
    raise exception 'fotos demais' using errcode = '22023';
  end if;
  update public.fotos
     set favorita = true
   where projeto_id = p_projeto_id
     and id = any (p_foto_ids)
     and favorita = false;
  get diagnostics v_linhas = row_count;
  -- Sinal para o estúdio/diagramador no histórico do projeto.
  if v_linhas > 0 then
    insert into public.projeto_atividades (projeto_id, autor_id, mensagem)
    values (
      p_projeto_id,
      auth.uid(),
      format('Curadoria Inteligente: o cliente se encontrou por selfie e destacou %s foto%s para o álbum — prioridade na montagem.',
             v_linhas, case when v_linhas = 1 then '' else 's' end)
    );
  end if;
  return v_linhas;
end;
$$;

revoke execute on function public.favoritar_fotos(uuid, uuid[]) from public, anon;
grant execute on function public.favoritar_fotos(uuid, uuid[]) to authenticated;

-- 7. Telemetria ------------------------------------------------------------------------------
-- Eventos de produto, gravados pela sessão de quem age. Leitura só da
-- operação (painel/SQL); um `track()` no app pode repassar a GA/Mixpanel depois.
create table if not exists public.eventos_analiticos (
  id          bigint generated always as identity primary key,
  evento      text not null check (evento in (
                'facial_search_initiated',
                'facial_search_success',
                'checkout_from_ai_gallery'
              )),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  projeto_id  uuid references public.projetos (id) on delete set null,
  propriedades jsonb not null default '{}'::jsonb
                check (jsonb_typeof(propriedades) = 'object' and octet_length(propriedades::text) < 4000),
  criado_em   timestamptz not null default now()
);

create index if not exists idx_eventos_analiticos_evento on public.eventos_analiticos (evento, criado_em desc);

alter table public.eventos_analiticos enable row level security;
revoke all on table public.eventos_analiticos from public, anon, authenticated;
grant select, insert on table public.eventos_analiticos to authenticated;
grant all on table public.eventos_analiticos to service_role;

drop policy if exists "eventos_analiticos_insert_proprio" on public.eventos_analiticos;
create policy "eventos_analiticos_insert_proprio" on public.eventos_analiticos for insert to authenticated
  with check (user_id = auth.uid() and (projeto_id is null or public.pode_ver_projeto(projeto_id)));

drop policy if exists "eventos_analiticos_select_operacao" on public.eventos_analiticos;
create policy "eventos_analiticos_select_operacao" on public.eventos_analiticos for select to authenticated
  using (public.is_operacao());

-- 8. Limite de buscas --------------------------------------------------------------------------
-- Cada selfie é um SearchFacesByImage cobrado. A rota chama isto antes da AWS:
-- true = pode buscar (e a busca fica registrada); false = passou de 5 no último
-- minuto. Por usuário (a rota exige login); trava por usuário evita corrida
-- entre requisições paralelas.
create table if not exists public.reconhecimento_buscas (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

create index if not exists idx_reconhecimento_buscas_user on public.reconhecimento_buscas (user_id, criado_em desc);

alter table public.reconhecimento_buscas enable row level security;
revoke all on table public.reconhecimento_buscas from public, anon, authenticated;
grant all on table public.reconhecimento_buscas to service_role;

create or replace function public.registrar_busca_facial(p_limite integer default 5)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_recentes integer;
begin
  if v_uid is null then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('busca_facial:' || v_uid::text, 0));

  delete from public.reconhecimento_buscas where user_id = v_uid and criado_em < now() - interval '1 hour';
  select count(*) into v_recentes
    from public.reconhecimento_buscas
   where user_id = v_uid and criado_em > now() - interval '1 minute';
  if v_recentes >= least(greatest(p_limite, 1), 5) then
    return false;
  end if;

  insert into public.reconhecimento_buscas (user_id) values (v_uid);
  return true;
end;
$$;

revoke execute on function public.registrar_busca_facial(integer) from public, anon;
grant execute on function public.registrar_busca_facial(integer) to authenticated;
