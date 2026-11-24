-- Somente registro de leitura. Não concede UPDATE direto nem amplia SELECT.
alter table public.selecao_notificacoes add column lida_em timestamptz;

create function public.marcar_notificacao_selecao_lida(p_id uuid)
returns boolean language plpgsql security definer
set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not exists (
  select 1 from public.profiles p where p.id=auth.uid() and p.status='ativo'
 ) then
  raise exception 'Notificação indisponível.' using errcode='42501';
 end if;
 update public.selecao_notificacoes
 set lida_em=coalesce(lida_em,now())
 where id=p_id and destinatario_id=auth.uid();
 return found;
end $$;
revoke all on function public.marcar_notificacao_selecao_lida(uuid) from public,anon,authenticated,service_role;
grant execute on function public.marcar_notificacao_selecao_lida(uuid) to authenticated;
