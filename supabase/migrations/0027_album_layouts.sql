-- =============================================================================
-- Migration 0027: editor de álbum (diagramação nativa)
--
--   * `album_layouts`: o documento editável de um álbum — lâminas, quadros de
--     foto, textos, formas e recortes, tudo em milímetros (JSON em
--     `documento`). Com `projeto_id`, é a diagramação de um projeto da
--     esteira: "Publicar versão" gera um JPG por lâmina e cria uma versão
--     comum (revisão interna → prova com pins → aprovação). Sem `projeto_id`,
--     é um álbum avulso, com status próprio e link de aprovação sem login.
--   * `revisao`: trava otimista do salvamento automático. `salvar_album_layout`
--     só grava se ninguém salvou no meio do caminho (outra aba/pessoa) e se o
--     álbum não estiver travado (aprovado/finalizado, ou o projeto aprovado).
--   * `album_layout_versoes`: histórico (pontos de restauração).
--   * `album_aprovacoes` + `album_aprovacao_comentarios`: link de aprovação
--     dos álbuns avulsos. O cliente não tem conta: tudo passa por funções
--     SECURITY DEFINER que exigem o token do link. As lâminas da aprovação
--     ficam em `albuns_fotos/{layout}/aprovacoes/{aprovacao}/` e só esses
--     arquivos são legíveis sem login (o id da aprovação só sai pelo token).
--   * Bucket privado `albuns_fotos`: fotos dos álbuns avulsos.
--
-- Acesso da equipe: produção (`is_equipe`, inclui o designer — 0021).
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Documento do álbum
-- -----------------------------------------------------------------------------

create table if not exists public.album_layouts (
  id               uuid primary key default gen_random_uuid(),
  projeto_id       uuid unique references public.projetos (id) on delete cascade,
  nome             text not null check (char_length(trim(nome)) between 2 and 120),
  cliente_nome     text check (cliente_nome is null or char_length(cliente_nome) <= 120),
  tipo             text check (tipo is null or char_length(tipo) <= 40),
  modelo           text check (modelo is null or char_length(modelo) <= 60),
  fotos_estimadas  integer check (fotos_estimadas is null or fotos_estimadas between 0 and 10000),
  status           text not null default 'rascunho'
                     check (status in ('rascunho', 'em_edicao', 'enviado_aprovacao', 'alteracoes_solicitadas', 'em_revisao', 'aprovado', 'finalizado', 'em_producao')),
  arquivado        boolean not null default false,
  formato          text not null check (formato ~ '^[0-9]+(\.[0-9]+)?x[0-9]+(\.[0-9]+)?$'),
  orientacao       text not null check (orientacao in ('quadrado', 'horizontal', 'vertical')),
  sangria_mm       numeric(4, 1) not null default 3 check (sangria_mm between 0 and 20),
  margem_segura_mm numeric(4, 1) not null default 5 check (margem_segura_mm between 0 and 50),
  documento        jsonb not null default '{"laminas": []}'::jsonb
                     check (jsonb_typeof(documento) = 'object' and octet_length(documento::text) < 2000000),
  laminas_qtd      integer generated always as (
                     case when jsonb_typeof(documento -> 'laminas') = 'array' then jsonb_array_length(documento -> 'laminas') else 0 end
                   ) stored,
  -- Só álbuns avulsos: [{ id, path, nome, largura, altura }].
  fotos            jsonb not null default '[]'::jsonb check (jsonb_typeof(fotos) = 'array'),
  -- Organização da biblioteca: { pastas: [{id, nome}], fotos: { [fotoId]: { pasta, favorita, prioridade } } }.
  biblioteca       jsonb not null default '{}'::jsonb check (jsonb_typeof(biblioteca) = 'object' and octet_length(biblioteca::text) < 1000000),
  -- Versões leves de cada foto, geradas pelo editor: { [fotoId]: { mini, preview, largura, altura, estouro, fx, fy } }.
  -- O editor trabalha com elas; o original fica só para a exportação.
  derivados        jsonb not null default '{}'::jsonb check (jsonb_typeof(derivados) = 'object' and octet_length(derivados::text) < 2000000),
  -- Capa para a listagem: JPG pequeno em data URL, gerado pelo editor.
  miniatura        text check (miniatura is null or (miniatura like 'data:image/jpeg;base64,%' and octet_length(miniatura) < 300000)),
  revisao          integer not null default 0,
  criado_por       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_album_layouts_updated on public.album_layouts (updated_at desc);

alter table public.album_layouts enable row level security;
alter table public.album_layouts force row level security;

drop policy if exists "album_layouts_equipe" on public.album_layouts;
create policy "album_layouts_equipe" on public.album_layouts for all to authenticated
  using (public.is_equipe()) with check (public.is_equipe());

drop trigger if exists trg_album_layouts_updated_at on public.album_layouts;
create trigger trg_album_layouts_updated_at
  before update on public.album_layouts
  for each row execute function public.set_updated_at();

-- Salvamento automático com trava otimista. Devolve a nova revisão; null se o
-- documento mudou desde `p_revisao` (ou sem acesso — RLS); -1 se o álbum está
-- travado (aprovado/finalizado, ou o projeto dele já foi aprovado).
create or replace function public.salvar_album_layout(p_id uuid, p_documento jsonb, p_revisao integer)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_revisao integer;
begin
  if exists (
    select 1 from public.album_layouts a
     where a.id = p_id
       and (
         a.status in ('aprovado', 'finalizado', 'em_producao')
         or exists (
           select 1 from public.projetos p
            where p.id = a.projeto_id
              and p.status in ('aprovado_aguardando_pagamento', 'aprovado', 'enviado', 'finalizado', 'arquivado')
         )
       )
  ) then
    return -1;
  end if;

  -- Editar depois do pedido de alterações = "Em revisão".
  update public.album_layouts
     set documento = p_documento,
         revisao = revisao + 1,
         status = case status when 'rascunho' then 'em_edicao' when 'alteracoes_solicitadas' then 'em_revisao' else status end
   where id = p_id and revisao = p_revisao
  returning revisao into v_revisao;
  return v_revisao;
end;
$$;

revoke execute on function public.salvar_album_layout(uuid, jsonb, integer) from public, anon;
grant execute on function public.salvar_album_layout(uuid, jsonb, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Histórico de versões (pontos de restauração)
-- -----------------------------------------------------------------------------

create table if not exists public.album_layout_versoes (
  id          uuid primary key default gen_random_uuid(),
  layout_id   uuid not null references public.album_layouts (id) on delete cascade,
  documento   jsonb not null check (octet_length(documento::text) < 2000000),
  tipo        text not null default 'auto' check (tipo in ('auto', 'manual', 'restauracao', 'aprovacao', 'publicacao')),
  rotulo      text check (rotulo is null or char_length(rotulo) <= 80),
  criado_por  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_album_layout_versoes on public.album_layout_versoes (layout_id, created_at desc);

alter table public.album_layout_versoes enable row level security;
alter table public.album_layout_versoes force row level security;

drop policy if exists "album_layout_versoes_equipe" on public.album_layout_versoes;
create policy "album_layout_versoes_equipe" on public.album_layout_versoes for all to authenticated
  using (public.is_equipe()) with check (public.is_equipe());

-- -----------------------------------------------------------------------------
-- 3. Aprovação pelo cliente (álbuns avulsos, sem login)
-- -----------------------------------------------------------------------------

create table if not exists public.album_aprovacoes (
  id                 uuid primary key default gen_random_uuid(),
  layout_id          uuid not null references public.album_layouts (id) on delete cascade,
  numero             integer not null check (numero > 0),
  -- 256 bits aleatórios (dois UUID v4): é o que dá acesso ao link.
  token              text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  -- [{ path, largura, altura, rotulo }] na ordem das lâminas.
  laminas            jsonb not null check (jsonb_typeof(laminas) = 'array'),
  status             text not null default 'aguardando' check (status in ('aguardando', 'aprovado', 'alteracoes', 'cancelado')),
  mensagem_cliente   text check (mensagem_cliente is null or char_length(mensagem_cliente) <= 2000),
  decidido_por_nome  text check (decidido_por_nome is null or char_length(decidido_por_nome) <= 80),
  decidido_em        timestamptz,
  criado_por         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  unique (layout_id, numero)
);

create table if not exists public.album_aprovacao_comentarios (
  id            uuid primary key default gen_random_uuid(),
  aprovacao_id  uuid not null references public.album_aprovacoes (id) on delete cascade,
  lamina_indice integer not null check (lamina_indice >= 0),
  x             numeric(5, 2) check (x is null or x between 0 and 100),
  y             numeric(5, 2) check (y is null or y between 0 and 100),
  texto         text not null check (char_length(trim(texto)) between 1 and 1000),
  autor_nome    text not null check (char_length(trim(autor_nome)) between 1 and 80),
  origem        text not null default 'cliente' check (origem in ('cliente', 'equipe')),
  resolvido     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_album_aprovacao_comentarios on public.album_aprovacao_comentarios (aprovacao_id, lamina_indice);

alter table public.album_aprovacoes enable row level security;
alter table public.album_aprovacoes force row level security;
alter table public.album_aprovacao_comentarios enable row level security;
alter table public.album_aprovacao_comentarios force row level security;

drop policy if exists "album_aprovacoes_equipe" on public.album_aprovacoes;
create policy "album_aprovacoes_equipe" on public.album_aprovacoes for all to authenticated
  using (public.is_equipe()) with check (public.is_equipe());

drop policy if exists "album_aprovacao_comentarios_equipe" on public.album_aprovacao_comentarios;
create policy "album_aprovacao_comentarios_equipe" on public.album_aprovacao_comentarios for all to authenticated
  using (public.is_equipe()) with check (public.is_equipe());

-- O que o cliente vê pelo link: a aprovação, o nome do álbum e os comentários.
create or replace function public.album_aprovacao_publica(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', a.id,
    'layout_id', a.layout_id,
    'numero', a.numero,
    'status', a.status,
    'laminas', a.laminas,
    'mensagem_cliente', a.mensagem_cliente,
    'decidido_por_nome', a.decidido_por_nome,
    'decidido_em', a.decidido_em,
    'criado_em', a.created_at,
    'album', l.nome,
    'cliente', l.cliente_nome,
    'comentarios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'lamina_indice', c.lamina_indice, 'x', c.x, 'y', c.y, 'texto', c.texto,
               'autor_nome', c.autor_nome, 'origem', c.origem, 'resolvido', c.resolvido, 'criado_em', c.created_at)
             order by c.created_at)
        from public.album_aprovacao_comentarios c
       where c.aprovacao_id = a.id
    ), '[]'::jsonb)
  )
  from public.album_aprovacoes a
  join public.album_layouts l on l.id = a.layout_id
  where a.token = p_token and length(p_token) = 64 and a.status <> 'cancelado';
$$;

create or replace function public.album_aprovacao_comentar(
  p_token text, p_lamina integer, p_x numeric, p_y numeric, p_texto text, p_autor text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_aprovacao public.album_aprovacoes;
  v_id uuid;
begin
  select * into v_aprovacao from public.album_aprovacoes where token = p_token and length(p_token) = 64;
  if not found or v_aprovacao.status <> 'aguardando' then
    raise exception 'Este link não aceita mais comentários.';
  end if;
  if p_lamina < 0 or p_lamina >= jsonb_array_length(v_aprovacao.laminas) then
    raise exception 'Página inválida.';
  end if;
  if (select count(*) from public.album_aprovacao_comentarios where aprovacao_id = v_aprovacao.id) >= 500 then
    raise exception 'Limite de comentários atingido.';
  end if;
  insert into public.album_aprovacao_comentarios (aprovacao_id, lamina_indice, x, y, texto, autor_nome)
  values (v_aprovacao.id, p_lamina, p_x, p_y, trim(p_texto), trim(p_autor))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.album_aprovacao_decidir(p_token text, p_decisao text, p_autor text, p_mensagem text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_aprovacao public.album_aprovacoes;
begin
  if p_decisao not in ('aprovado', 'alteracoes') then
    raise exception 'Decisão inválida.';
  end if;
  if char_length(trim(coalesce(p_autor, ''))) not between 1 and 80 then
    raise exception 'Informe seu nome.';
  end if;
  select * into v_aprovacao from public.album_aprovacoes where token = p_token and length(p_token) = 64 for update;
  if not found or v_aprovacao.status <> 'aguardando' then
    raise exception 'Este álbum já foi respondido.';
  end if;

  update public.album_aprovacoes
     set status = p_decisao,
         decidido_por_nome = trim(p_autor),
         decidido_em = now(),
         mensagem_cliente = nullif(trim(coalesce(p_mensagem, '')), '')
   where id = v_aprovacao.id;

  update public.album_layouts
     set status = case when p_decisao = 'aprovado' then 'aprovado' else 'alteracoes_solicitadas' end
   where id = v_aprovacao.layout_id;

  return p_decisao;
end;
$$;

revoke execute on function public.album_aprovacao_publica(text) from public;
revoke execute on function public.album_aprovacao_comentar(text, integer, numeric, numeric, text, text) from public;
revoke execute on function public.album_aprovacao_decidir(text, text, text, text) from public;
grant execute on function public.album_aprovacao_publica(text) to anon, authenticated;
grant execute on function public.album_aprovacao_comentar(text, integer, numeric, numeric, text, text) to anon, authenticated;
grant execute on function public.album_aprovacao_decidir(text, text, text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Storage: fotos dos álbuns avulsos + lâminas das aprovações
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('albuns_fotos', 'albuns_fotos', false, 52428800, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "albuns_fotos_equipe_select" on storage.objects;
create policy "albuns_fotos_equipe_select" on storage.objects for select to authenticated
  using (bucket_id = 'albuns_fotos' and public.is_equipe());

-- Sem login: só as lâminas de uma aprovação ativa, e só para quem sabe o id
-- dela (que só a função `album_aprovacao_publica`, com o token, revela). A
-- checagem roda como definer: o visitante não lê `album_aprovacoes` (RLS).
create or replace function public.aprovacao_de_album_ativa(p_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.album_aprovacoes a where a.id::text = p_id and a.status <> 'cancelado');
$$;

revoke execute on function public.aprovacao_de_album_ativa(text) from public;
grant execute on function public.aprovacao_de_album_ativa(text) to anon, authenticated;

drop policy if exists "albuns_fotos_aprovacao_publica" on storage.objects;
create policy "albuns_fotos_aprovacao_publica" on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'albuns_fotos'
    and (storage.foldername(name))[2] = 'aprovacoes'
    and public.aprovacao_de_album_ativa((storage.foldername(name))[3])
  );

-- Avulso: qualquer arquivo na pasta do álbum. De projeto: só as versões
-- leves (`{layout}/derivados/…`) — as fotos em si ficam no bucket do projeto.
drop policy if exists "albuns_fotos_equipe_insert" on storage.objects;
create policy "albuns_fotos_equipe_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'albuns_fotos'
    and public.is_equipe()
    and exists (
      select 1 from public.album_layouts a
      where a.id::text = (storage.foldername(name))[1]
        and (a.projeto_id is null or (storage.foldername(name))[2] = 'derivados')
    )
  );

drop policy if exists "albuns_fotos_equipe_update" on storage.objects;
create policy "albuns_fotos_equipe_update" on storage.objects for update to authenticated
  using (bucket_id = 'albuns_fotos' and public.is_equipe())
  with check (bucket_id = 'albuns_fotos' and public.is_equipe());

drop policy if exists "albuns_fotos_equipe_delete" on storage.objects;
create policy "albuns_fotos_equipe_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'albuns_fotos' and public.is_equipe());
