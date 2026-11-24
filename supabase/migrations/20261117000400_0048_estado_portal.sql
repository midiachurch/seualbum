-- Consulta somente metadados; não revela links, hashes, códigos ou sessões.
-- Aditiva e compatível com o frontend anterior: sem alteração de dados/grants existentes.
begin;

create function public.estado_portal(p_projeto_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare a public.portal_acessos;
begin
 if not exists (select 1 from public.profiles where id=auth.uid() and role='fotografo' and status='ativo')
 or not exists (select 1 from public.projetos where id=p_projeto_id and fotografo_id=auth.uid()) then
  raise exception 'Sem permissão.' using errcode='42501';
 end if;
 select * into a from public.portal_acessos where projeto_id=p_projeto_id order by (revogado_em is null) desc,created_at desc,revogado_em desc,id desc limit 1;
 if not found then return jsonb_build_object('estado','nao_criado'); end if;
 return jsonb_build_object('estado',case when a.revogado_em is not null then 'revogado' when a.expira_em<=now() then 'expirado' else 'ativo' end,'expiraEm',a.expira_em);
end $$;

revoke all on function public.estado_portal(uuid) from public,anon,service_role;

grant execute on function public.estado_portal(uuid) to authenticated;

commit;
