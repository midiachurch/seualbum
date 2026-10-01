-- =============================================================================
-- Migration 0019: Fase 4 — a equipe marca comentário/pin da prova como resolvido
--
-- 1. `prova_comentarios` ganha `resolvido` + `resolvido_em`. O horário é
--    carimbado pelo banco (trigger), não pelo navegador: marcou → now();
--    desmarcou → null. As duas colunas nunca se contradizem (check).
--
-- 2. Só a equipe altera comentário (policy de UPDATE; antes não havia nenhuma,
--    ninguém atualizava). E, mesmo para a equipe, o UPDATE só mexe no estado
--    de resolução — texto, autor, lâmina e posição do pin são do cliente/
--    fotógrafo e ficam intocados (trigger). O service_role passa livre.
--
-- 3. Versões nascem limpas: comentários pertencem a uma versão (`versao`) e a
--    uma lâmina daquela versão (`lamina_id`) — a V3 não herda os pins da V2.
--    Nada a migrar; a regra já decorre do modelo da 0018.
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

alter table public.prova_comentarios
  add column if not exists resolvido    boolean not null default false,
  add column if not exists resolvido_em timestamptz;

do $$ begin
  alter table public.prova_comentarios
    add constraint prova_comentarios_resolvido_check
      check (resolvido = (resolvido_em is not null));
exception when duplicate_object then null; end $$;

create or replace function public.guardar_resolucao_comentario()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and (
       new.projeto_id is distinct from old.projeto_id
    or new.page_index is distinct from old.page_index
    or new.versao     is distinct from old.versao
    or new.texto      is distinct from old.texto
    or new.autor_id   is distinct from old.autor_id
    or new.lamina_id  is distinct from old.lamina_id
    or new.posicao_x  is distinct from old.posicao_x
    or new.posicao_y  is distinct from old.posicao_y
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Só o estado de resolução do comentário pode ser alterado.'
      using errcode = '42501';
  end if;

  if new.resolvido and not old.resolvido then
    new.resolvido_em := now();
  elsif not new.resolvido then
    new.resolvido_em := null;
  else
    new.resolvido_em := old.resolvido_em;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prova_comentarios_resolucao on public.prova_comentarios;
create trigger trg_prova_comentarios_resolucao
  before update on public.prova_comentarios
  for each row execute function public.guardar_resolucao_comentario();

drop policy if exists "prova_comentarios_update_equipe" on public.prova_comentarios;
create policy "prova_comentarios_update_equipe"
  on public.prova_comentarios for update to authenticated
  using (public.is_equipe() and public.pode_ver_projeto(projeto_id))
  with check (public.is_equipe() and public.pode_ver_projeto(projeto_id));
