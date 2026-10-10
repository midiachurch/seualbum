-- =============================================================================
-- Migration 0034: demais buckets do Storage no Cloudflare R2
--
-- Depois das fotos do pedido (0030/0031) e das lâminas da prova (0032), os
-- uploads novos de todos os outros arquivos vão para o R2. O banco guarda só
-- a chave e uma marca de onde o arquivo está; o que já está no Supabase
-- Storage continua sendo lido de lá (leitura dupla), sem migração forçada:
--
--   1. Fotos do projeto (antes `projetos_fotos`): `fotos.bucket = 'r2'` já
--      existe (0031); a chave é projetos/{projeto_id}/fotos/{id}-{nome}
--      (/api/uploads/projeto-foto). Aqui só uma trava para linhas novas.
--   2. Editor de álbum (antes `albuns_fotos`): os caminhos ficam em JSON
--      (`album_layouts.fotos`/`derivados`, `album_aprovacoes.laminas`). Sem
--      coluna nova: o prefixo `albuns/` na chave É a marca de "está no R2" —
--      os caminhos antigos começam pelo UUID do álbum (/api/uploads/album).
--   3. Biblioteca de mídia (antes `midia_vitrine`, público): `media_assets.bucket`
--      ('midia_vitrine' | 'r2'); a chave é vitrine/{id}-{nome} no bucket
--      PÚBLICO do R2 (R2_PUBLIC_BUCKET), lida por R2_PUBLIC_URL.
--   4. Logo do estúdio (antes `fotografo_logos`, 0009): `fotografos.logo_path`
--      e `logo_bucket` ('fotografo_logos' | 'r2'); chave logos/{id}/{id}-{nome}
--      no bucket público. `logo_url` continua sendo o endereço público que a
--      tela do orçamento lê (`get_orcamento_publico`, sem mudança).
--
-- Nenhum bucket do Supabase é apagado nem perde policy: os arquivos antigos
-- continuam acessíveis. Copiar o que já existe para o R2 é opcional e manual
-- (scripts/copiar-storage-para-r2.mjs).
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

-- 1. Fotos do projeto ----------------------------------------------------------
-- Linha nova com `bucket = 'r2'` só com chave de pedido (conversão, 0031) ou
-- na pasta de fotos do próprio projeto. NOT VALID: não reavalia o que existe.
do $$ begin
  alter table public.fotos
    add constraint fotos_chave_r2_check check (
      bucket <> 'r2'
      or storage_path like 'pedidos/%'
      or storage_path like 'projetos/' || projeto_id::text || '/fotos/%'
    ) not valid;
exception when duplicate_object then null; end $$;

-- 2. Editor de álbum -----------------------------------------------------------
comment on column public.album_layouts.fotos is
  'Fotos do álbum avulso: [{ id, path, nome, largura, altura }]. path com prefixo albuns/ = chave no Cloudflare R2; sem ele = bucket albuns_fotos (antigo).';
comment on column public.album_layouts.derivados is
  'Versões leves: { [fotoId]: { mini, preview, ... } }. Caminhos albuns/... no R2; os demais no bucket albuns_fotos (antigo).';

-- 3. Biblioteca de mídia --------------------------------------------------------
alter table public.media_assets
  add column if not exists bucket text not null default 'midia_vitrine';

alter table public.media_assets drop constraint if exists media_assets_bucket_check;
alter table public.media_assets
  add constraint media_assets_bucket_check check (
    bucket = 'midia_vitrine'
    or (bucket = 'r2' and storage_path like 'vitrine/%')
  );

-- 4. Logo do estúdio ------------------------------------------------------------
alter table public.fotografos
  add column if not exists logo_path text,
  add column if not exists logo_bucket text;

alter table public.fotografos drop constraint if exists fotografos_logo_bucket_check;
alter table public.fotografos
  add constraint fotografos_logo_bucket_check check (
    (logo_bucket is null and logo_path is null)
    or (logo_bucket = 'fotografo_logos' and logo_path is not null)
    or (logo_bucket = 'r2' and logo_path like 'logos/' || id::text || '/%')
  );
