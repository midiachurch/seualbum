-- =============================================================================
-- Migration 0036: travas das chaves do Cloudflare R2 no banco
--
-- No R2 não há policy por usuário: o servidor assina leitura/cópia de QUALQUER
-- chave com o token da conta. A única checagem de acesso é a linha do banco
-- que guarda a chave (`fotos`, lida pela RLS). Por isso a chave gravada
-- precisa ser do próprio projeto — e `fotos` aceita INSERT direto (PostgREST)
-- de quem enxerga o projeto, inclusive o cliente final.
--
--   1. `fotos` com `bucket = 'r2'`: pela sessão do usuário (authenticated),
--      só chaves na pasta do próprio projeto (projetos/{projeto_id}/fotos/…).
--      Chave de pedido (pedidos/…) só pela conversão pedido → projeto
--      (security definer) ou pelo service_role, e apenas se a chave estiver
--      em `pedidos_fotos_r2` do estúdio dono do projeto. Antes, a 0034 aceitava
--      `pedidos/%` de qualquer estúdio — e, sem a 0034, qualquer chave.
--   2. Foto de pedido já usada por um projeto não é mais "rascunho": se o
--      pedido for apagado (gestor/admin) ou perder a chave, nem a limpeza de
--      72h (`rascunhos_r2_expirados`) nem o estúdio (DELETE do índice) podem
--      apagar o arquivo que o projeto ainda usa.
--
-- Idempotente: pode ser reexecutada com segurança. NÃO aplicada.
-- =============================================================================

-- A chave do R2 está em uso por alguma foto de projeto? (ignora a RLS de `fotos`)
create or replace function public.chave_r2_em_uso_por_projeto(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.fotos f where f.bucket = 'r2' and f.storage_path = p_key);
$$;

revoke execute on function public.chave_r2_em_uso_por_projeto(text) from public, anon;
grant execute on function public.chave_r2_em_uso_por_projeto(text) to authenticated, service_role;

-- 1. Trava das chaves 'r2' em `fotos` ----------------------------------------
-- SECURITY INVOKER de propósito: `current_user` precisa ser quem gravou a
-- linha (com security definer seria sempre o dono da função).
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

-- 2a. Limpeza de 72h: nunca apagar foto que um projeto usa -------------------
create or replace function public.rascunhos_r2_expirados(p_horas integer default 72, p_limite integer default 1000)
returns table (r2_key text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with rascunhos as (
    select r.client_id, r.chave_idempotencia, max(r.created_at) as ultima_atividade
    from public.pedidos_fotos_r2 r
    group by 1, 2
  )
  select r.r2_key
  from public.pedidos_fotos_r2 r
  join rascunhos x using (client_id, chave_idempotencia)
  where x.ultima_atividade < now() - make_interval(hours => greatest(p_horas, 0))
    and not exists (
      select 1 from public.orders o where o.chave_idempotencia = r.chave_idempotencia
    )
    and not exists (
      select 1 from public.fotos f where f.bucket = 'r2' and f.storage_path = r.r2_key
    )
  order by r.r2_key
  limit greatest(least(p_limite, 1000), 1);
$$;

revoke execute on function public.rascunhos_r2_expirados(integer, integer) from public, anon, authenticated;
grant execute on function public.rascunhos_r2_expirados(integer, integer) to service_role;

-- 2b. O estúdio só tira do índice foto que nenhum projeto usa ----------------
drop policy if exists "pedidos_fotos_r2_delete_rascunho" on public.pedidos_fotos_r2;
create policy "pedidos_fotos_r2_delete_rascunho" on public.pedidos_fotos_r2 for delete to authenticated
  using (
    public.is_gestor_ou_admin()
    or (
      client_id = auth.uid()
      and not exists (
        select 1 from public.orders o where o.chave_idempotencia = pedidos_fotos_r2.chave_idempotencia
      )
      and not public.chave_r2_em_uso_por_projeto(pedidos_fotos_r2.r2_key)
    )
  );
