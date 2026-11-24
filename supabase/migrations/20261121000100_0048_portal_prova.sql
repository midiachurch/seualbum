-- Prova guest: capacidade revalidada, origem distinta de Auth e nenhum fechamento financeiro.
begin;
create table public.portal_prova_acoes (
 id uuid primary key default gen_random_uuid(),
 acesso_id uuid not null references public.portal_acessos(id),
 projeto_id uuid not null references public.projetos(id),
 versao_id uuid not null references public.design_versions(id),
 lamina_id uuid references public.versoes_laminas(id),
 tipo text not null check(tipo in ('comentario','ajustes')),
 texto text not null check(char_length(texto) between 1 and 2000),
 chave uuid not null,
 comentario_id uuid references public.prova_comentarios(id),
 aprovacao_id uuid references public.aprovacoes(id),
 created_at timestamptz not null default now(),
 unique(acesso_id,chave)
);
create index portal_prova_acoes_projeto_versao on public.portal_prova_acoes(projeto_id,versao_id,created_at);
alter table public.portal_prova_acoes enable row level security;
revoke all on public.portal_prova_acoes from public,anon,authenticated,service_role;
-- A equipe continua usando as tabelas originais de comentários/aprovações.
create function public.portal_prova(p_sessao_hash text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.portal_acessos; d public.design_versions; v jsonb;
begin
 -- 0046: bloqueia projeto FOR UPDATE e então revalida sessão/concessão/ator.
 -- Essa ordem serializa escrita/retry/revogação antes de ler estado e chave.
 a:=private.portal_validar(p_sessao_hash);
 -- Mesmo critério de liberação da RLS 0018/painel autenticado; consulta histórica permitida.
 select * into d from public.design_versions where projeto_id=a.projeto_id and status='aprovada' order by numero desc limit 1;
 if not found then return null; end if;
 select jsonb_build_object('id',d.id,'numero',d.numero,'aberta',p.status='aguardando_aprovacao_cliente',
 'laminas',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'ordem',l.ordem) order by l.ordem) from public.versoes_laminas l where l.versao_id=d.id),'[]'::jsonb),
 'comentarios',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'lamina_id',x.lamina_id,'tipo',x.tipo,'texto',x.texto,'data',x.created_at) order by x.created_at) from (select * from public.portal_prova_acoes where projeto_id=a.projeto_id and versao_id=d.id order by created_at desc limit 200)x),'[]'::jsonb)) into v
 from public.projetos p where p.id=a.projeto_id;
 return v;
end $$;
create function public.portal_lamina(p_sessao_hash text,p_lamina_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.portal_acessos; v jsonb;
begin
 -- 0046: bloqueia projeto FOR UPDATE e então revalida sessão/concessão/ator.
 -- Essa ordem serializa escrita/retry/revogação antes de ler estado e chave.
 a:=private.portal_validar(p_sessao_hash);
 select jsonb_build_object('bucket',l.bucket,'path',l.storage_path) into v from public.versoes_laminas l join public.design_versions d on d.id=l.versao_id
 where l.id=p_lamina_id and d.projeto_id=a.projeto_id and d.status='aprovada'
 and d.numero=(select max(numero) from public.design_versions where projeto_id=a.projeto_id and status='aprovada');
 if v is null then raise exception 'Lâmina indisponível.' using errcode='42501'; end if;
 return v;
end $$;
create function public.portal_comentar_prova(p_sessao_hash text,p_versao_id uuid,p_lamina_id uuid,p_tipo text,p_texto text,p_chave uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.portal_acessos; d public.design_versions; anterior public.portal_prova_acoes; v_id uuid; v_comentario uuid; v_aprovacao uuid; v_ordem integer;
begin
 -- 0046: bloqueia projeto FOR UPDATE e então revalida sessão/concessão/ator.
 -- Essa ordem serializa escrita/retry/revogação antes de ler estado e chave.
 a:=private.portal_validar(p_sessao_hash);
 if p_tipo is null or p_tipo not in ('comentario','ajustes') or p_texto is null or char_length(btrim(p_texto)) not between 1 and 2000 or p_chave is null then raise exception 'Comentário inválido.' using errcode='22023'; end if;
 select * into anterior from public.portal_prova_acoes where acesso_id=a.id and chave=p_chave;
 if found then
  if anterior.versao_id is distinct from p_versao_id or anterior.lamina_id is distinct from p_lamina_id or anterior.tipo is distinct from p_tipo or anterior.texto is distinct from btrim(p_texto) then raise exception 'Chave já utilizada com outro conteúdo.' using errcode='22023'; end if;
  return anterior.id;
 end if;
 select * into d from public.design_versions where id=p_versao_id and projeto_id=a.projeto_id and status='aprovada'
 and numero=(select max(numero) from public.design_versions where projeto_id=a.projeto_id and status='aprovada');
 if not found or not exists(select 1 from public.projetos where id=a.projeto_id and status='aguardando_aprovacao_cliente') then raise exception 'Prova não está aberta para revisão.' using errcode='42501'; end if;
 if p_lamina_id is not null then
  select ordem into v_ordem from public.versoes_laminas where id=p_lamina_id and versao_id=d.id;
  if not found then raise exception 'Lâmina indisponível.' using errcode='42501'; end if;
 end if;
 if p_tipo='comentario' then
  if p_lamina_id is null then raise exception 'Escolha uma lâmina.' using errcode='22023'; end if;
  insert into public.prova_comentarios(projeto_id,page_index,versao,texto,autor_id,lamina_id)
  values(a.projeto_id,v_ordem-1,d.numero,btrim(p_texto),null,p_lamina_id) returning id into v_comentario;
 else
  -- Usa o trigger existente apenas no ramo de ajustes, que não cria cobrança.
  insert into public.aprovacoes(projeto_id,versao,usuario_id,status,comentario)
  values(a.projeto_id,d.numero,null,'alteracao_solicitada',btrim(p_texto)) returning id into v_aprovacao;
 end if;
 insert into public.portal_prova_acoes(acesso_id,projeto_id,versao_id,lamina_id,tipo,texto,chave,comentario_id,aprovacao_id)
 values(a.id,a.projeto_id,d.id,p_lamina_id,p_tipo,btrim(p_texto),p_chave,v_comentario,v_aprovacao) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.portal_prova(text),public.portal_lamina(text,uuid),public.portal_comentar_prova(text,uuid,uuid,text,text,uuid) from public,service_role;
grant execute on function public.portal_prova(text),public.portal_lamina(text,uuid),public.portal_comentar_prova(text,uuid,uuid,text,text,uuid) to anon,authenticated;
commit;
