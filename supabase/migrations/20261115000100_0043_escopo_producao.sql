-- 0043 — Escopo de produção por atribuição (ADR-002).
-- Consolidação local; resultados em docs/sprints/CONSOLIDACAO.md. Rollout remoto exige revisão de baseline.
-- Não altera is_equipe/is_operacao globalmente nem cria tenancy nova.
begin;

create or replace function public.pode_produzir_projeto(p_projeto_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select auth.uid() is not null
    and exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.status = 'ativo')
    and exists (
    select 1 from public.projetos p where p.id = p_projeto_id
      and (public.is_gestor_ou_admin()
        or (public.is_equipe() and p.responsavel_id = auth.uid()))
  );
$$;
revoke all on function public.pode_produzir_projeto(uuid) from public, anon;
grant execute on function public.pode_produzir_projeto(uuid) to authenticated, service_role;

create or replace function public.pode_ver_projeto(p_projeto_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select auth.uid() is not null
    and exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.status = 'ativo')
    and exists (
    select 1 from public.projetos p
    left join public.clientes c on c.id = p.cliente_id
    where p.id = p_projeto_id and (
      p.fotografo_id = auth.uid() or c.user_id = auth.uid()
      or public.pode_produzir_projeto(p.id)
    )
  );
$$;
revoke all on function public.pode_ver_projeto(uuid) from public, anon;
grant execute on function public.pode_ver_projeto(uuid) to authenticated, service_role;

-- Policies permissivas ALL também concedem SELECT; precisam do mesmo escopo.
alter policy projetos_select_scope on public.projetos
  using (public.pode_ver_projeto(id));
alter policy projetos_update_fotografo_ou_equipe on public.projetos
  using (fotografo_id = auth.uid() or public.pode_produzir_projeto(id))
  with check (fotografo_id = auth.uid() or public.pode_produzir_projeto(id));
alter policy design_versions_write_equipe on public.design_versions
  using (public.pode_produzir_projeto(projeto_id))
  with check (public.pode_produzir_projeto(projeto_id));
alter policy versoes_laminas_write_equipe on public.versoes_laminas
  using (exists (select 1 from public.design_versions dv where dv.id = versao_id and public.pode_produzir_projeto(dv.projeto_id)))
  with check (exists (select 1 from public.design_versions dv where dv.id = versao_id and public.pode_produzir_projeto(dv.projeto_id)));

-- Equipe atribuída não pode transferir projeto para outro estúdio/cliente,
-- autoatribuir-se ou retirar o vínculo de um layout para escapar do escopo.
create or replace function public.guardar_vinculos_producao()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_gestor_ou_admin() then
    return new;
  end if;
  if tg_table_name = 'projetos' then
    if new.fotografo_id is distinct from old.fotografo_id
      or new.cliente_id is distinct from old.cliente_id
      or new.responsavel_id is distinct from old.responsavel_id then
      raise exception 'Só a gestão altera os vínculos e a atribuição do projeto.' using errcode = '42501';
    end if;
  elsif new.projeto_id is distinct from old.projeto_id then
    raise exception 'Só a gestão altera o vínculo do layout com o projeto.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guardar_vinculos_producao() from public, anon, authenticated;
drop trigger if exists trg_guardar_vinculos_producao on public.projetos;
create trigger trg_guardar_vinculos_producao before update on public.projetos
  for each row execute function public.guardar_vinculos_producao();
drop trigger if exists trg_guardar_vinculos_producao on public.album_layouts;
create trigger trg_guardar_vinculos_producao before update on public.album_layouts
  for each row execute function public.guardar_vinculos_producao();

-- Álbuns avulsos conservam a regra anterior; layouts de projeto herdam escopo.
alter policy album_layouts_equipe on public.album_layouts
  using (public.is_equipe() and (projeto_id is null or public.pode_produzir_projeto(projeto_id)))
  with check (public.is_equipe() and (projeto_id is null or public.pode_produzir_projeto(projeto_id)));
alter policy album_layout_versoes_equipe on public.album_layout_versoes
  using (public.is_equipe() and exists (select 1 from public.album_layouts a where a.id = layout_id))
  with check (public.is_equipe() and exists (select 1 from public.album_layouts a where a.id = layout_id));
alter policy album_aprovacoes_equipe on public.album_aprovacoes
  using (public.is_equipe() and exists (select 1 from public.album_layouts a where a.id = layout_id))
  with check (public.is_equipe() and exists (select 1 from public.album_layouts a where a.id = layout_id));
alter policy album_aprovacao_comentarios_equipe on public.album_aprovacao_comentarios
  using (public.is_equipe() and exists (select 1 from public.album_aprovacoes a where a.id = aprovacao_id))
  with check (public.is_equipe() and exists (select 1 from public.album_aprovacoes a where a.id = aprovacao_id));

-- Dados financeiros/comunicações com projeto: restringir alcance sem conceder
-- novas ações nem incluir designer no financeiro.
drop policy if exists producao_escopo on public.faturas;
create policy producao_escopo on public.faturas as restrictive for all to authenticated
  using (public.pode_ver_projeto(projeto_id))
  with check (public.pode_ver_projeto(projeto_id));
drop policy if exists producao_escopo on public.comunicacoes_log;
create policy producao_escopo on public.comunicacoes_log as restrictive for select to authenticated
  using (public.pode_ver_projeto(projeto_id));
drop policy if exists producao_escopo on public.fatura_itens;
create policy producao_escopo on public.fatura_itens as restrictive for select to authenticated
  using (exists (select 1 from public.faturas f where f.id = fatura_id));

alter policy albuns_fotos_equipe_select on storage.objects using (bucket_id = 'albuns_fotos' and public.is_equipe() and exists (select 1 from public.album_layouts a where a.id::text = (storage.foldername(name))[1]));
alter policy albuns_fotos_equipe_update on storage.objects using (bucket_id = 'albuns_fotos' and public.is_equipe() and exists (select 1 from public.album_layouts a where a.id::text = (storage.foldername(name))[1])) with check (bucket_id = 'albuns_fotos' and public.is_equipe() and exists (select 1 from public.album_layouts a where a.id::text = (storage.foldername(name))[1]));
alter policy albuns_fotos_equipe_delete on storage.objects using (bucket_id = 'albuns_fotos' and public.is_equipe() and exists (select 1 from public.album_layouts a where a.id::text = (storage.foldername(name))[1]));

-- RPCs SECURITY DEFINER: conferir escopo explicitamente (RLS é contornada).
CREATE OR REPLACE FUNCTION public.definir_reconhecimento_facial(p_projeto_id uuid, p_ativo boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.pode_ver_projeto(p_projeto_id) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if auth.uid() is null or not (
    public.pode_produzir_projeto(p_projeto_id)
    or exists (select 1 from public.projetos p where p.id = p_projeto_id and p.fotografo_id = auth.uid())
  ) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  if p_ativo then
    insert into public.reconhecimento_projetos (projeto_id, ativado_por)
    values (p_projeto_id, auth.uid())
    on conflict (projeto_id) do nothing;
  else
    delete from public.reconhecimento_rostos where projeto_id = p_projeto_id;
    delete from public.reconhecimento_fotos where projeto_id = p_projeto_id;
    delete from public.reconhecimento_projetos where projeto_id = p_projeto_id;
  end if;
  return p_ativo;
end;
$function$;
CREATE OR REPLACE FUNCTION public.calcular_excedente(p_projeto_id uuid)
 RETURNS TABLE(versao integer, laminas integer, tem_capa boolean, inclusas integer, excedente integer, preco numeric, valor numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.pode_ver_projeto(p_projeto_id) then
    raise exception 'Sem acesso à cobrança deste projeto.' using errcode = '42501';
  end if;
  if not coalesce((
    (public.is_operacao() and public.pode_ver_projeto(p_projeto_id))
    or exists (select 1 from public.projetos p where p.id = p_projeto_id and p.fotografo_id = auth.uid())
  ), false) then
    raise exception 'Sem acesso à cobrança deste projeto.' using errcode = '42501';
  end if;
  return query select * from public._excedente_da_versao(p_projeto_id, null);
end;
$function$;
CREATE OR REPLACE FUNCTION public.pode_ver_conversa(p_conversa_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select auth.uid() is not null
    and exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.status = 'ativo')
    and exists (
    select 1
    from public.conversas c
    left join public.projetos p on p.id = c.projeto_id
    left join public.clientes cl on cl.id = p.cliente_id
    where c.id = p_conversa_id
      and (
        c.fotografo_id = auth.uid()
        or (c.canal = 'cliente_estudio' and cl.user_id = auth.uid())
        or public.is_gestor_ou_admin()
        or (public.current_role_v() = 'operador' and public.pode_produzir_projeto(c.projeto_id))
        or (c.canal = 'estudio_equipe' and public.is_designer() and p.responsavel_id = auth.uid())
      )
  );
$function$;
CREATE OR REPLACE FUNCTION public.pode_escrever_conversa(p_conversa_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select auth.uid() is not null
    and exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.status = 'ativo')
    and exists (
    select 1
    from public.conversas c
    left join public.projetos p on p.id = c.projeto_id
    left join public.clientes cl on cl.id = p.cliente_id
    where c.id = p_conversa_id
      and (
        c.fotografo_id = auth.uid()
        or (c.canal = 'cliente_estudio' and cl.user_id = auth.uid())
        or (c.canal = 'estudio_equipe' and (public.is_gestor_ou_admin() or public.pode_produzir_projeto(c.projeto_id)))
        or (c.canal = 'estudio_equipe' and public.is_designer() and p.responsavel_id = auth.uid())
      )
  );
$function$;
CREATE OR REPLACE FUNCTION public.abrir_conversa(p_canal text, p_fotografo_id uuid DEFAULT NULL::uuid, p_projeto_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_fotografo   uuid;
  v_responsavel uuid;
  v_cliente     uuid;
  v_id          uuid;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles pr where pr.id=auth.uid() and pr.status='ativo') then
    raise exception 'Sessão obrigatória' using errcode = '42501';
  end if;
  if p_canal is null or p_canal not in ('estudio_equipe', 'cliente_estudio') then
    raise exception 'Canal inválido' using errcode = '22023';
  end if;

  if p_projeto_id is not null then
    select p.fotografo_id, p.responsavel_id, cl.user_id
      into v_fotografo, v_responsavel, v_cliente
    from public.projetos p
    left join public.clientes cl on cl.id = p.cliente_id
    where p.id = p_projeto_id;
    if v_fotografo is null or (p_fotografo_id is not null and p_fotografo_id <> v_fotografo) then
      raise exception 'Projeto não encontrado' using errcode = '42501';
    end if;

    if not (
      v_fotografo = auth.uid()
      or (p_canal = 'cliente_estudio' and v_cliente = auth.uid())
      or (p_canal = 'estudio_equipe' and public.pode_produzir_projeto(p_projeto_id))
      or (p_canal = 'estudio_equipe' and public.is_designer() and v_responsavel = auth.uid())
    ) then
      raise exception 'Sem acesso a esta conversa' using errcode = '42501';
    end if;
  else
    if p_canal <> 'estudio_equipe' then
      raise exception 'Conversa com o cliente é sempre de um projeto' using errcode = '22023';
    end if;
    v_fotografo := coalesce(p_fotografo_id, auth.uid());
    if not (v_fotografo = auth.uid() or public.is_gestor_ou_admin()) then
      raise exception 'Sem acesso a esta conversa' using errcode = '42501';
    end if;
    if not exists (select 1 from public.fotografos f where f.id = v_fotografo) then
      raise exception 'Estúdio não encontrado' using errcode = '42501';
    end if;
  end if;

  select c.id into v_id from public.conversas c
  where c.canal = p_canal and c.fotografo_id = v_fotografo and c.projeto_id is not distinct from p_projeto_id;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.conversas (canal, fotografo_id, projeto_id)
  values (p_canal, v_fotografo, p_projeto_id)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select c.id into v_id from public.conversas c
    where c.canal = p_canal and c.fotografo_id = v_fotografo and c.projeto_id is not distinct from p_projeto_id;
  end if;
  return v_id;
end;
$function$;

commit;
