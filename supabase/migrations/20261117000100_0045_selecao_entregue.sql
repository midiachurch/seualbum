-- Snapshot de seleção independente dos favoritos e aprovação do álbum.
begin;
alter table public.fotos add column if not exists nome_original text;
alter table public.fotos add constraint fotos_nome_original_limite check (nome_original is null or length(nome_original) between 1 and 255);
create table public.selecoes_entregues (
 id uuid primary key default gen_random_uuid(), projeto_id uuid not null references public.projetos(id),
 revisao integer not null check(revisao>0), autor_id uuid references public.profiles(id), portal_id uuid,
 chave uuid not null, revisao_esperada integer not null, foto_ids uuid[] not null,
 created_at timestamptz not null default now(),
 check ((autor_id is null) <> (portal_id is null)), unique(projeto_id,revisao)
);
create unique index selecoes_entregues_idempotencia on public.selecoes_entregues(projeto_id,(autor_id is null),coalesce(autor_id,portal_id),chave);
create table public.selecao_entregue_fotos (
 selecao_id uuid not null references public.selecoes_entregues(id), foto_id uuid not null,
 bucket text not null, storage_path text not null, nome_original text,
 primary key(selecao_id,foto_id)
);
create table public.selecao_notificacoes (
 id uuid primary key default gen_random_uuid(), selecao_id uuid not null unique references public.selecoes_entregues(id),
 destinatario_id uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
alter table public.selecoes_entregues enable row level security;
alter table public.selecao_entregue_fotos enable row level security;
alter table public.selecao_notificacoes enable row level security;
revoke all on public.selecoes_entregues,public.selecao_entregue_fotos,public.selecao_notificacoes from anon,authenticated;
grant select on public.selecoes_entregues,public.selecao_entregue_fotos,public.selecao_notificacoes to authenticated;
create policy selecao_ler on public.selecoes_entregues for select to authenticated using(public.pode_ver_projeto(projeto_id));
create policy selecao_foto_ler on public.selecao_entregue_fotos for select to authenticated using(exists(select 1 from public.selecoes_entregues s where s.id=selecao_id));
create policy selecao_notificacao_ler on public.selecao_notificacoes for select to authenticated using(destinatario_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.status='ativo'));
create function private.selecao_imutavel() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin raise exception 'Seleção entregue é imutável.' using errcode='42501'; end $$;
create trigger selecao_imutavel before update or delete on public.selecoes_entregues for each row execute function private.selecao_imutavel();
create trigger selecao_foto_imutavel before update or delete on public.selecao_entregue_fotos for each row execute function private.selecao_imutavel();

create function private.entregar_selecao_core(p_projeto_id uuid,p_autor_id uuid,p_portal_id uuid,p_foto_ids uuid[],p_revisao_esperada integer,p_chave uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_ids uuid[]; v_existente public.selecoes_entregues; v_id uuid; v_revisao integer; v_fotografo uuid;
begin
 if p_projeto_id is null or p_chave is null or p_revisao_esperada is null or p_revisao_esperada<0 or (p_autor_id is null)=(p_portal_id is null)
  or cardinality(p_foto_ids) is null or cardinality(p_foto_ids) not between 1 and 1000 or array_position(p_foto_ids,null) is not null then
  raise exception 'Seleção inválida.' using errcode='22023'; end if;
 select array_agg(distinct id order by id) into v_ids from unnest(p_foto_ids) id;
 if cardinality(v_ids)<>cardinality(p_foto_ids) then raise exception 'Fotos repetidas.' using errcode='22023'; end if;
 select fotografo_id into v_fotografo from public.projetos where id=p_projeto_id for update;
 if not found then raise exception 'Projeto indisponível.' using errcode='42501'; end if;
 select * into v_existente from public.selecoes_entregues where projeto_id=p_projeto_id and (autor_id is null)=(p_autor_id is null) and coalesce(autor_id,portal_id)=coalesce(p_autor_id,p_portal_id) and chave=p_chave;
 if found then
  if v_existente.foto_ids<>v_ids or v_existente.revisao_esperada<>p_revisao_esperada then raise exception 'Chave já usada com outra seleção.' using errcode='22023'; end if;
  return jsonb_build_object('id',v_existente.id,'revisao',v_existente.revisao,'total',cardinality(v_ids));
 end if;
 select coalesce(max(revisao),0) into v_revisao from public.selecoes_entregues where projeto_id=p_projeto_id;
 if v_revisao<>p_revisao_esperada then raise exception 'A seleção foi atualizada. Recarregue antes de entregar.' using errcode='40001'; end if;
 -- Bloqueia metadados até copiá-los; a lista deve pertencer integralmente ao projeto.
 perform 1 from public.fotos where projeto_id=p_projeto_id and id=any(v_ids) order by id for share;
 if (select count(*) from public.fotos where projeto_id=p_projeto_id and id=any(v_ids))<>cardinality(v_ids) then raise exception 'Foto fora do projeto.' using errcode='42501'; end if;
 insert into public.selecoes_entregues(projeto_id,revisao,autor_id,portal_id,chave,revisao_esperada,foto_ids)
 values(p_projeto_id,v_revisao+1,p_autor_id,p_portal_id,p_chave,p_revisao_esperada,v_ids) returning id into v_id;
 insert into public.selecao_entregue_fotos(selecao_id,foto_id,bucket,storage_path,nome_original)
 select v_id,id,bucket,storage_path,nome_original from public.fotos where projeto_id=p_projeto_id and id=any(v_ids);
 insert into public.projeto_atividades(projeto_id,autor_id,mensagem) values(p_projeto_id,p_autor_id,
 format('Seleção entregue: revisão %s com %s fotos%s.',v_revisao+1,cardinality(v_ids),case when p_portal_id is null then '' else format(' pelo portal %s',p_portal_id) end));
 if v_fotografo is not null then insert into public.selecao_notificacoes(selecao_id,destinatario_id) values(v_id,v_fotografo); end if;
 return jsonb_build_object('id',v_id,'revisao',v_revisao+1,'total',cardinality(v_ids));
end $$;
revoke all on function private.entregar_selecao_core(uuid,uuid,uuid,uuid[],integer,uuid) from public,anon,authenticated,service_role;
revoke all on function private.selecao_imutavel() from public,anon,authenticated,service_role;

create function public.entregar_selecao(p_projeto_id uuid,p_foto_ids uuid[],p_revisao_esperada integer,p_chave uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_ativo boolean; v_permitido boolean;
begin
 select true into v_ativo from public.profiles where id=auth.uid() and status='ativo' for share;
 if v_ativo is distinct from true then raise exception 'Sem permissão para entregar seleção.' using errcode='42501'; end if;
 -- Mesmo lock do core, antes de autorizar: transferência de projeto não atravessa a decisão.
 perform 1 from public.projetos where id=p_projeto_id for update;
 perform 1 from public.clientes where id=(select cliente_id from public.projetos where id=p_projeto_id) for share;
 select ((p.fotografo_id=auth.uid() and exists(select 1 from public.profiles u where u.id=auth.uid() and u.role='fotografo'))
 or exists(select 1 from public.clientes c where c.id=p.cliente_id and c.user_id=auth.uid() and exists(select 1 from public.profiles u where u.id=auth.uid() and u.role='cliente')))
 into v_permitido from public.projetos p where p.id=p_projeto_id;
 if v_permitido is distinct from true then raise exception 'Sem permissão para entregar seleção.' using errcode='42501'; end if;
 return private.entregar_selecao_core(p_projeto_id,auth.uid(),null,p_foto_ids,p_revisao_esperada,p_chave);
end $$;
revoke all on function public.entregar_selecao(uuid,uuid[],integer,uuid) from public,anon,service_role;
grant execute on function public.entregar_selecao(uuid,uuid[],integer,uuid) to authenticated;
commit;
