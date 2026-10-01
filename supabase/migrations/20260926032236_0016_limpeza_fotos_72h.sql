-- =============================================================================
-- Migration 0016: SLA da limpeza de fotos órfãs passa de 24h para 72h
--
-- 24h apagava as fotos de quem sobe tudo na noite do evento e só termina o
-- briefing dias depois. A edge function `limpar-fotos-orfas` (HORAS_MINIMAS)
-- foi alinhada para o mesmo valor; aqui muda o default da função de seleção.
-- A regra em si é a da 0015: só pastas cuja chave nunca virou pedido.
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

create or replace function public.fotos_orfas_pedidos(p_horas integer default 72, p_limite integer default 1000)
returns table (nome text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with pastas as (
    select
      (storage.foldername(o.name))[1] as dono,
      (storage.foldername(o.name))[2] as chave,
      max(o.created_at) as ultima_atividade
    from storage.objects o
    where o.bucket_id = 'pedidos_fotos'
    group by 1, 2
  )
  select o.name
  from storage.objects o
  join pastas p
    on (storage.foldername(o.name))[1] = p.dono
   and (storage.foldername(o.name))[2] = p.chave
  where o.bucket_id = 'pedidos_fotos'
    and p.dono is not null
    and p.chave ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and p.ultima_atividade < now() - make_interval(hours => greatest(p_horas, 0))
    and not exists (
      select 1 from public.orders ord where ord.chave_idempotencia::text = p.chave
    )
  limit greatest(least(p_limite, 1000), 1);
$$;

revoke execute on function public.fotos_orfas_pedidos(integer, integer) from public, anon, authenticated;
grant execute on function public.fotos_orfas_pedidos(integer, integer) to service_role;
