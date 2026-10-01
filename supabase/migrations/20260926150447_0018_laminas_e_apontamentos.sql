-- =============================================================================
-- Migration 0018: Fase 3 — lâminas reais da prova + apontamento visual (pins)
--
-- 1. `versoes_laminas`: cada versão da diagramação (`design_versions`) passa a
--    ter N lâminas (imagens), em ordem. Guarda o CAMINHO no Storage, não uma
--    URL: link assinado vence (foi o bug dos 7 dias), então a URL é gerada na
--    leitura. `largura`/`altura` dão a proporção da lâmina para a tela não
--    pular ao carregar e para os pins (em %) caírem no lugar certo.
--    Arquivos: projetos_fotos/{projeto_id}/versoes/{lote}/{ordem}-{arquivo}
--    — a policy existente do bucket (pode_ver_projeto na 1ª pasta) já cobre.
--
-- 2. `prova_comentarios` ganha o apontamento: `lamina_id` + `posicao_x/y`
--    (0–100, % da largura/altura da lâmina — independe do tamanho da tela).
--    Comentário sem posição continua valendo (comentário geral da lâmina).
--
-- 3. Rascunho não vaza: fora da equipe, só se vê lâmina de versão aprovada
--    internamente (`design_versions.status = 'aprovada'`) — antes a prova do
--    cliente listava até versões ainda em revisão interna.
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

create table if not exists public.versoes_laminas (
  id           uuid primary key default gen_random_uuid(),
  versao_id    uuid not null references public.design_versions (id) on delete cascade,
  ordem        integer not null check (ordem >= 1),
  bucket       text not null default 'projetos_fotos' check (bucket in ('projetos_fotos')),
  storage_path text not null,
  largura      integer check (largura is null or largura > 0),
  altura       integer check (altura is null or altura > 0),
  created_at   timestamptz not null default now(),
  unique (versao_id, ordem)
);

create index if not exists idx_versoes_laminas_versao on public.versoes_laminas (versao_id, ordem);

alter table public.versoes_laminas enable row level security;
alter table public.versoes_laminas force row level security;

drop policy if exists "versoes_laminas_select" on public.versoes_laminas;
create policy "versoes_laminas_select"
  on public.versoes_laminas for select to authenticated
  using (
    exists (
      select 1 from public.design_versions dv
      where dv.id = versoes_laminas.versao_id
        and public.pode_ver_projeto(dv.projeto_id)
        and (public.is_equipe() or dv.status = 'aprovada')
    )
  );

drop policy if exists "versoes_laminas_write_equipe" on public.versoes_laminas;
create policy "versoes_laminas_write_equipe"
  on public.versoes_laminas for all to authenticated
  using (public.is_equipe())
  with check (
    public.is_equipe()
    and exists (select 1 from public.design_versions dv where dv.id = versoes_laminas.versao_id)
  );

-- -----------------------------------------------------------------------------
-- Apontamento visual nos comentários da prova
-- -----------------------------------------------------------------------------

alter table public.prova_comentarios
  add column if not exists lamina_id uuid references public.versoes_laminas (id) on delete cascade,
  add column if not exists posicao_x numeric(5, 2),
  add column if not exists posicao_y numeric(5, 2);

do $$ begin
  alter table public.prova_comentarios
    add constraint prova_comentarios_posicao_check check (
      (posicao_x is null and posicao_y is null)
      or (
        lamina_id is not null
        and posicao_x between 0 and 100
        and posicao_y between 0 and 100
      )
    );
exception when duplicate_object then null; end $$;

create index if not exists idx_prova_comentarios_lamina on public.prova_comentarios (lamina_id)
  where lamina_id is not null;
