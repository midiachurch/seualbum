-- C03: capacidades por organização no acesso a projetos (ADR-002).
-- ADITIVO: pode_ver_projeto e todas as policies existentes ficam intactas (os
-- atores atuais — fotógrafo dono, cliente, equipe atribuída — não mudam). Aqui
-- só se ACRESCENTAM policies permissivas para membros da organização do
-- projeto, com a regra do backlog: leitura NÃO implica escrita.
--   visualizador: lê.   editor/admin/dono: lê e produz (fotos, projeto, portal).
-- Financeiro (faturas) fica de fora: a policy restritiva `producao_escopo`
-- (0043) continua negando a membros, que só recebem acesso por decisão futura.
-- A organização do projeto é imutável e não pode apontar para outro estúdio.
-- NÃO aplicada em ambiente remoto.
begin;

-- Papel do usuário logado na organização DO PROJETO (nulo: sem acesso).
create function public.papel_no_projeto_org(p_projeto uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select m.papel
    from public.projetos p
    join public.organizacao_membros m on m.organizacao_id = p.organizacao_id
   where p.id = p_projeto and m.user_id = auth.uid() and m.status = 'ativo'
     and exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.status = 'ativo')
$$;
create function public.pode_ler_projeto_org(p_projeto uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.papel_no_projeto_org(p_projeto) is not null
$$;
create function public.pode_editar_projeto_org(p_projeto uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.papel_no_projeto_org(p_projeto) in ('dono', 'admin', 'editor'), false)
$$;
-- O estúdio (dono_id) cujo cadastro de clientes um membro ativo pode ler.
create function public.membro_do_estudio(p_fotografo uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.organizacoes o
      join public.organizacao_membros m on m.organizacao_id = o.id
     where o.dono_id = p_fotografo and m.user_id = auth.uid() and m.status = 'ativo'
       and exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.status = 'ativo'))
$$;
revoke all on function public.papel_no_projeto_org(uuid), public.pode_ler_projeto_org(uuid),
  public.pode_editar_projeto_org(uuid), public.membro_do_estudio(uuid) from public, anon, service_role;
grant execute on function public.papel_no_projeto_org(uuid), public.pode_ler_projeto_org(uuid),
  public.pode_editar_projeto_org(uuid), public.membro_do_estudio(uuid) to authenticated;

-- Leitura para qualquer membro ativo.
create policy projetos_select_org on public.projetos for select to authenticated using (public.pode_ler_projeto_org(id));
create policy fotos_select_org on public.fotos for select to authenticated using (public.pode_ler_projeto_org(projeto_id));
create policy projeto_atividades_select_org on public.projeto_atividades for select to authenticated using (public.pode_ler_projeto_org(projeto_id));
create policy design_versions_select_org on public.design_versions for select to authenticated using (public.pode_ler_projeto_org(projeto_id));
create policy versoes_laminas_select_org on public.versoes_laminas for select to authenticated
  using (exists (select 1 from public.design_versions dv where dv.id = versao_id and public.pode_ler_projeto_org(dv.projeto_id)));
create policy prova_comentarios_select_org on public.prova_comentarios for select to authenticated using (public.pode_ler_projeto_org(projeto_id));
create policy aprovacoes_select_org on public.aprovacoes for select to authenticated using (public.pode_ler_projeto_org(projeto_id));
create policy selecoes_entregues_select_org on public.selecoes_entregues for select to authenticated using (public.pode_ler_projeto_org(projeto_id));
create policy clientes_select_org on public.clientes for select to authenticated using (public.membro_do_estudio(fotografo_id));

-- Produção: só dono, admin e editor.
create policy projetos_update_org on public.projetos for update to authenticated
  using (public.pode_editar_projeto_org(id)) with check (public.pode_editar_projeto_org(id));
create policy fotos_insert_org on public.fotos for insert to authenticated
  with check (public.pode_editar_projeto_org(projeto_id) and bucket = 'r2' and enviado_por = auth.uid());
create policy fotos_delete_org on public.fotos for delete to authenticated using (public.pode_editar_projeto_org(projeto_id));
create policy projeto_atividades_insert_org on public.projeto_atividades for insert to authenticated
  with check (public.pode_editar_projeto_org(projeto_id));

-- A trava abaixo roda com os privilégios de quem grava (current_user precisa ser o
-- chamador) e a RLS esconde `organizacoes` de quem não é membro — p.ex. a gestão
-- que cria projeto para um fotógrafo. Por isso a pergunta vai por função de
-- definição segura, que só devolve um booleano.
create function public.organizacao_e_do_estudio(p_org uuid, p_fotografo uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.organizacoes o where o.id = p_org and o.dono_id = p_fotografo)
$$;
revoke all on function public.organizacao_e_do_estudio(uuid, uuid) from public, anon, service_role;
grant execute on function public.organizacao_e_do_estudio(uuid, uuid) to authenticated;

-- A organização do projeto é imutável e sempre a do estúdio dono: sem associação cross-org.
create function public.projetos_guardar_organizacao() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'UPDATE' and new.organizacao_id is distinct from old.organizacao_id then
      raise exception 'A organização do projeto não pode ser alterada.' using errcode = '42501'; end if;
    if tg_op = 'INSERT' and new.organizacao_id is not null
       and not public.organizacao_e_do_estudio(new.organizacao_id, new.fotografo_id) then
      raise exception 'Organização não pertence ao estúdio do projeto.' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
revoke all on function public.projetos_guardar_organizacao() from public, anon, authenticated, service_role;
create trigger trg_projetos_guardar_organizacao before insert or update of organizacao_id on public.projetos
  for each row execute function public.projetos_guardar_organizacao();

-- Portal: editor da organização também gere o link; o acesso fica ligado ao DONO do projeto.
create or replace function public.gerir_portal(p_projeto_id uuid, p_link_hash text, p_codigo text, p_revogar boolean default false)
returns uuid language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_id uuid; v_dono uuid;
begin
 perform 1 from public.profiles where id = auth.uid() and role = 'fotografo' and status = 'ativo' for share;
 if not found then raise exception 'Sem permissão.' using errcode = '42501'; end if;
 select fotografo_id into v_dono from public.projetos where id = p_projeto_id for update;
 if not found or (v_dono <> auth.uid() and not public.pode_editar_projeto_org(p_projeto_id)) then
  raise exception 'Sem permissão.' using errcode = '42501';
 end if;
 if p_revogar is not true and (p_link_hash is null or p_link_hash !~ '^[a-f0-9]{64}$' or p_codigo is null or char_length(p_codigo) not between 8 and 64) then
  raise exception 'Credencial inválida.' using errcode = '22023';
 end if;
 update public.portal_acessos set revogado_em = now() where projeto_id = p_projeto_id and revogado_em is null;
 if p_revogar is true then return null; end if;
 insert into public.portal_acessos(projeto_id, fotografo_id, link_hash, codigo_hash)
 values (p_projeto_id, v_dono, p_link_hash, crypt(p_codigo, gen_salt('bf', 10))) returning id into v_id;
 return v_id;
end $$;

-- Franquia (0052): quem produz pela organização também pergunta se o envio cabe.
create or replace function public.franquia_permite_envio(p_projeto uuid, p_bytes bigint) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_dono uuid; v_cap bigint; v_usado bigint;
begin
  if auth.uid() is null or not (public.pode_ver_projeto(p_projeto) or public.pode_editar_projeto_org(p_projeto)) then
    raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_bytes is null or p_bytes <= 0 then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  select p.fotografo_id into v_dono from public.projetos p where p.id = p_projeto;
  if v_dono is null then return true; end if;
  select a.armazenamento_bytes into v_cap from public.assinaturas_galeria a where a.fotografo_id = v_dono and a.status = 'ativa';
  if v_cap is null then return true; end if;
  select coalesce(sum(f.tamanho_bytes), 0) into v_usado
    from public.fotos f join public.projetos p on p.id = f.projeto_id
   where p.fotografo_id = v_dono and f.bucket = 'r2';
  return v_usado + p_bytes <= v_cap;
end $$;

commit;
