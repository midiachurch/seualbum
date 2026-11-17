-- Portal por capacidade revogável; nenhuma leitura anon geral ou service role.
begin;
create table public.portal_acessos (
 id uuid primary key default gen_random_uuid(), projeto_id uuid not null references public.projetos(id),
 fotografo_id uuid not null references public.profiles(id), link_hash text not null unique check(link_hash ~ '^[a-f0-9]{64}$'),
 codigo_hash text not null, expira_em timestamptz not null default now()+interval '30 days', revogado_em timestamptz,
 tentativas integer not null default 0, janela_em timestamptz not null default now(), bloqueado_ate timestamptz,
 created_at timestamptz not null default now()
);
create table public.portal_sessoes (
 hash text primary key check(hash ~ '^[a-f0-9]{64}$'), acesso_id uuid not null references public.portal_acessos(id),
 expira_em timestamptz not null default now()+interval '8 hours'
);
create table public.portal_eventos (
 id uuid primary key default gen_random_uuid(), projeto_id uuid not null references public.projetos(id),
 acesso_id uuid not null references public.portal_acessos(id), selecao_id uuid not null unique references public.selecoes_entregues(id),
 tipo text not null check(tipo='selecao_entregue'), created_at timestamptz not null default now()
);
alter table public.portal_acessos enable row level security;
alter table public.portal_sessoes enable row level security;
alter table public.portal_eventos enable row level security;
revoke all on public.portal_acessos, public.portal_sessoes, public.portal_eventos from public, anon, authenticated, service_role;

create function public.gerir_portal(p_projeto_id uuid,p_link_hash text,p_codigo text,p_revogar boolean default false)
returns uuid language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_id uuid;
begin
 perform 1 from public.profiles where id=auth.uid() and role='fotografo' and status='ativo' for share;
 if not found then raise exception 'Sem permissão.' using errcode='42501'; end if;
 perform 1 from public.projetos where id=p_projeto_id and fotografo_id=auth.uid() for update;
 if not found then raise exception 'Sem permissão.' using errcode='42501'; end if;
 if p_revogar is not true and (p_link_hash is null or p_link_hash !~ '^[a-f0-9]{64}$' or p_codigo is null or char_length(p_codigo) not between 8 and 64) then
  raise exception 'Credencial inválida.' using errcode='22023';
 end if;
 update public.portal_acessos set revogado_em=now() where projeto_id=p_projeto_id and revogado_em is null;
 if p_revogar is true then return null; end if;
 insert into public.portal_acessos(projeto_id,fotografo_id,link_hash,codigo_hash)
 values(p_projeto_id,auth.uid(),p_link_hash,crypt(p_codigo,gen_salt('bf',10))) returning id into v_id;
 return v_id;
end $$;

-- Falha retorna false para que o contador de tentativas seja COMMITADO.
create function public.abrir_portal(p_link_hash text,p_codigo text,p_sessao_hash text)
returns boolean language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare a public.portal_acessos;
begin
 if p_sessao_hash is null or p_sessao_hash !~ '^[a-f0-9]{64}$' or p_codigo is null or char_length(p_codigo)>64 then return false; end if;
 select * into a from public.portal_acessos where link_hash=p_link_hash for update;
 if not found or a.revogado_em is not null or a.expira_em<=now() or a.bloqueado_ate>now() then return false; end if;
 if not exists(select 1 from public.profiles where id=a.fotografo_id and status='ativo' and role='fotografo') or not exists(select 1 from public.projetos where id=a.projeto_id and fotografo_id=a.fotografo_id) then return false; end if;
 if a.janela_em < now()-interval '15 minutes' then a.tentativas:=0; end if;
 if crypt(p_codigo,a.codigo_hash) is distinct from a.codigo_hash then
  update public.portal_acessos set tentativas=a.tentativas+1,janela_em=case when a.tentativas=0 then now() else janela_em end,
   bloqueado_ate=case when a.tentativas+1>=10 then now()+interval '15 minutes' else null end where id=a.id;
  return false;
 end if;
 update public.portal_acessos set tentativas=0,bloqueado_ate=null,janela_em=now() where id=a.id;
 insert into public.portal_sessoes(hash,acesso_id,expira_em) values(p_sessao_hash,a.id,least(a.expira_em,now()+interval '8 hours'));
 return true;
end $$;

create function private.portal_validar(p_hash text) returns public.portal_acessos
language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.portal_acessos;
begin
 select pa.* into a from public.portal_acessos pa join public.portal_sessoes s on s.acesso_id=pa.id where s.hash=p_hash and s.expira_em>now();
 if not found then raise exception 'Acesso expirado ou revogado.' using errcode='42501'; end if;
 -- Ordem de locks: projeto antes de concessão, igual à rotação/revogação.
 perform 1 from public.projetos where id=a.projeto_id for update;
 select pa.* into a from public.portal_acessos pa join public.portal_sessoes s on s.acesso_id=pa.id
 join public.projetos p on p.id=pa.projeto_id and p.fotografo_id=pa.fotografo_id
 join public.profiles pr on pr.id=pa.fotografo_id and pr.status='ativo' and pr.role='fotografo'
 where s.hash=p_hash and s.expira_em>now() and pa.expira_em>now() and pa.revogado_em is null for share of pa,pr;
 if not found then raise exception 'Acesso expirado ou revogado.' using errcode='42501'; end if;
 return a;
end $$;

create function public.portal_projeto(p_sessao_hash text,p_apos uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.portal_acessos; v jsonb;
begin
 a:=private.portal_validar(p_sessao_hash);
 select jsonb_build_object('id',p.id,'nome',p.nome,'estudio',f.estudio,'logo',f.logo_url,
 'revisao',coalesce((select max(revisao) from public.selecoes_entregues where projeto_id=p.id),0),
 'total',(select count(*) from public.fotos where projeto_id=p.id),
 'favoritas',(select count(*) from public.fotos where projeto_id=p.id and favorita),
 'favorita_ids',coalesce((select jsonb_agg(id) from (select id from public.fotos where projeto_id=p.id and favorita order by id limit 1000) selecionadas),'[]'::jsonb),
 'fotos',coalesce((select jsonb_agg(x) from (select id,grupo,favorita,nome_original from public.fotos where projeto_id=p.id and (p_apos is null or id>p_apos) order by id limit 100)x),'[]'::jsonb),
 'eventos',jsonb_build_array(jsonb_build_object('tipo','projeto_criado','data',p.created_at,'responsavel','Não registrado no evento de origem')) || coalesce((select jsonb_agg(jsonb_build_object('tipo',e.tipo,'data',e.created_at,'responsavel','Cliente pelo portal') order by e.created_at) from public.portal_eventos e where e.projeto_id=p.id),'[]'::jsonb)) into v
 from public.projetos p left join public.fotografos f on f.id=p.fotografo_id where p.id=a.projeto_id;
 return v;
end $$;
create function public.portal_foto(p_sessao_hash text,p_foto_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.portal_acessos; v jsonb;
begin
 a:=private.portal_validar(p_sessao_hash);
 select jsonb_build_object('bucket',bucket,'path',storage_path,'nome',nome_original) into v from public.fotos where projeto_id=a.projeto_id and id=p_foto_id;
 if v is null then raise exception 'Foto indisponível.' using errcode='42501'; end if;
 return v;
end $$;
create function public.portal_favorito(p_sessao_hash text,p_foto_id uuid,p_favorita boolean) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.portal_acessos; v boolean;
begin
 a:=private.portal_validar(p_sessao_hash);
 if p_favorita is null then raise exception 'Favorito inválido.' using errcode='22023'; end if;
 select favorita into v from public.fotos where projeto_id=a.projeto_id and id=p_foto_id for update;
 if not found then raise exception 'Foto indisponível.' using errcode='42501'; end if;
 if v is distinct from p_favorita then
  update public.fotos set favorita=p_favorita where id=p_foto_id;
  insert into public.projeto_atividades(projeto_id,mensagem) values(a.projeto_id,'Favorito manual pelo portal: rascunho atualizado.');
 end if;
 return true;
end $$;
create function public.portal_entregar(p_sessao_hash text,p_foto_ids uuid[],p_revisao integer,p_chave uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.portal_acessos; v jsonb;
begin
 a:=private.portal_validar(p_sessao_hash);
 -- Entrega exatamente os IDs confirmados; mudanças simultâneas do rascunho não alteram o payload.
 v:=private.entregar_selecao_core(a.projeto_id,null,a.id,p_foto_ids,p_revisao,p_chave);
 insert into public.portal_eventos(projeto_id,acesso_id,selecao_id,tipo) values(a.projeto_id,a.id,(v->>'id')::uuid,'selecao_entregue') on conflict(selecao_id) do nothing;
 return v;
end $$;
revoke all on function private.portal_validar(text) from public,anon,authenticated,service_role;
revoke all on function public.gerir_portal(uuid,text,text,boolean) from public,anon,service_role;
grant execute on function public.gerir_portal(uuid,text,text,boolean) to authenticated;
revoke all on function public.abrir_portal(text,text,text), public.portal_projeto(text,uuid), public.portal_foto(text,uuid), public.portal_favorito(text,uuid,boolean), public.portal_entregar(text,uuid[],integer,uuid) from public,service_role;
grant execute on function public.abrir_portal(text,text,text), public.portal_projeto(text,uuid), public.portal_foto(text,uuid), public.portal_favorito(text,uuid,boolean), public.portal_entregar(text,uuid[],integer,uuid) to anon,authenticated;
commit;
