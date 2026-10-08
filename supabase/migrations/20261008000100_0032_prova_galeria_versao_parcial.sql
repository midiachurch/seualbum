-- =============================================================================
-- Migration 0032: prova em galeria, apontamento por área e versão parcial
--
-- 1. Lâminas no Cloudflare R2: `versoes_laminas.bucket` aceita 'r2' (a chave
--    fica em `storage_path`). Upload manual e "Publicar versão" do editor
--    passam a subir para o R2 (/api/uploads/lamina).
-- 2. Versão parcial: a nova versão pode trocar só algumas lâminas. As demais
--    são herdadas da versão-base — a linha é copiada (mesmo arquivo), com
--    `alterada = false` e `origem_lamina_id` apontando para a lâmina de onde
--    veio. Lâmina nova ou substituída: `alterada = true`.
--    `design_versions.base_versao_id` registra de qual versão a parcial partiu.
-- 3. Apontamento por área: além do ponto (posicao_x/y), o comentário pode
--    marcar um retângulo — `area_largura`/`area_altura` em % da lâmina, com o
--    canto superior esquerdo em posicao_x/y.
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

-- 1. Lâminas no R2 -------------------------------------------------------------
alter table public.versoes_laminas drop constraint if exists versoes_laminas_bucket_check;
alter table public.versoes_laminas
  add constraint versoes_laminas_bucket_check check (bucket in ('projetos_fotos', 'r2'));

-- 2. Versão parcial -----------------------------------------------------------
alter table public.versoes_laminas
  add column if not exists alterada boolean not null default true,
  add column if not exists origem_lamina_id uuid references public.versoes_laminas (id) on delete set null;

alter table public.design_versions
  add column if not exists base_versao_id uuid references public.design_versions (id) on delete set null;

-- 3. Apontamento por área -----------------------------------------------------
alter table public.prova_comentarios
  add column if not exists area_largura numeric(5, 2),
  add column if not exists area_altura numeric(5, 2);

do $$ begin
  alter table public.prova_comentarios
    add constraint prova_comentarios_area_check check (
      (area_largura is null and area_altura is null)
      or (
        posicao_x is not null and posicao_y is not null
        and area_largura > 0 and area_altura > 0
        and posicao_x + area_largura <= 100.01
        and posicao_y + area_altura <= 100.01
      )
    );
exception when duplicate_object then null; end $$;
