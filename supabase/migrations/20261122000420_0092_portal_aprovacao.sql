-- Aprovação pelo cliente convidado: usa a capacidade e o fechamento financeiro existentes.
begin;
create table public.portal_prova_aprovacoes (
 id uuid primary key default gen_random_uuid(),
 acesso_id uuid not null references public.portal_acessos(id) on delete cascade,
 projeto_id uuid not null references public.projetos(id) on delete cascade,
 versao_id uuid not null unique references public.design_versions(id) on delete cascade,
 aprovacao_id uuid not null unique references public.aprovacoes(id) on delete cascade,
 chave uuid not null,
 status_apos_aprovacao public.project_status not null,
 created_at timestamptz not null default now(),
 unique(acesso_id,chave)
);
alter table public.portal_prova_aprovacoes enable row level security;
revoke all on public.portal_prova_aprovacoes from public,anon,authenticated,service_role;
create function private.portal_aprovacao_imutavel() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' and pg_trigger_depth()>1 then return old; end if;
 raise exception 'Registro de aprovação é imutável.' using errcode='42501';
end $$;
revoke all on function private.portal_aprovacao_imutavel() from public,anon,authenticated,service_role;
create trigger portal_aprovacao_imutavel before update or delete on public.portal_prova_aprovacoes
for each row execute function private.portal_aprovacao_imutavel();

create function public.portal_aprovar_prova(p_sessao_hash text,p_versao_id uuid,p_chave uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.portal_acessos; d public.design_versions; anterior public.portal_prova_aprovacoes;
 v_aprovacao uuid; v_id uuid; v_status public.project_status;
begin
 -- Revalida expiração/revogação/proprietário ativo e serializa por projeto (0046).
 a:=private.portal_validar(p_sessao_hash);
 if p_versao_id is null or p_chave is null then raise exception 'Aprovação inválida.' using errcode='22023'; end if;
 select * into anterior from public.portal_prova_aprovacoes where acesso_id=a.id and chave=p_chave;
 if found then
  if anterior.versao_id is distinct from p_versao_id then raise exception 'Chave usada para outra versão.' using errcode='22023'; end if;
  return jsonb_build_object('id',anterior.id,'status',anterior.status_apos_aprovacao);
 end if;
 select * into d from public.design_versions where id=p_versao_id and projeto_id=a.projeto_id and status='aprovada'
 and numero=(select max(numero) from public.design_versions where projeto_id=a.projeto_id and status='aprovada');
 if not found or not exists(select 1 from public.projetos where id=a.projeto_id and status='aguardando_aprovacao_cliente')
 or not exists(select 1 from public.versoes_laminas where versao_id=p_versao_id) then
  raise exception 'Esta versão não está aberta para aprovação.' using errcode='42501';
 end if;
 -- Sem identidade Auth fictícia. O gatilho aplicar_aprovacao da 0026 calcula
 -- excedentes e conserva aprovado_aguardando_pagamento quando há fechamento.
 -- Este comando não contrata upsells e não aceita preços, status ou totais do navegador.
 perform set_config('seualbum.adicionais','[]',true);
 insert into public.aprovacoes(projeto_id,versao,usuario_id,status)
 values(a.projeto_id,d.numero,null,'aprovado') returning id into v_aprovacao;
 perform set_config('seualbum.adicionais','',true);
 select status into v_status from public.projetos where id=a.projeto_id;
 insert into public.portal_prova_aprovacoes(acesso_id,projeto_id,versao_id,aprovacao_id,chave,status_apos_aprovacao)
 values(a.id,a.projeto_id,d.id,v_aprovacao,p_chave,v_status) returning id into v_id;
 return jsonb_build_object('id',v_id,'status',v_status);
end $$;
revoke all on function public.portal_aprovar_prova(text,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.portal_aprovar_prova(text,uuid,uuid) to anon,authenticated;

-- Reutiliza a leitura anterior, sem duplicar as regras de versão/comentários.
alter function public.portal_prova(text) set schema private;
alter function private.portal_prova(text) rename to portal_prova_base;
revoke all on function private.portal_prova_base(text) from public,anon,authenticated,service_role;
create function public.portal_prova(p_sessao_hash text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.portal_acessos; v jsonb; decisao jsonb;
begin
 a:=private.portal_validar(p_sessao_hash);
 v:=private.portal_prova_base(p_sessao_hash);
 if v is null then return null; end if;
 select jsonb_build_object('data',x.created_at,'aguardaFechamento',p.status='aprovado_aguardando_pagamento') into decisao
 from public.portal_prova_aprovacoes x join public.projetos p on p.id=x.projeto_id
 where x.projeto_id=a.projeto_id and x.versao_id=(v->>'id')::uuid;
 return v || jsonb_build_object('aprovacao',decisao);
end $$;
revoke all on function public.portal_prova(text) from public,anon,authenticated,service_role;
grant execute on function public.portal_prova(text) to anon,authenticated;
commit;
