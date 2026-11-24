-- STUDIO T03 (parte 1) — modelos de mensagem com variáveis e PRÉVIA.
-- ADITIVA. A prévia só renderiza texto: nada é enviado nem enfileirado.
-- Variáveis permitidas (lista fechada, validada no salvamento):
--   cliente_nome, cliente_primeiro_nome, estudio, titulo_negocio, valor,
--   projeto, responsavel_nome, tarefa, prazo_tarefa.
-- Escrita de modelos: dono/admin. Leitura/prévia: qualquer membro.
-- NÃO aplicada em ambiente remoto.
begin;

create table public.studio_modelos (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes (id) on delete cascade,
  nome           text not null check (char_length(btrim(nome)) between 2 and 80),
  finalidade     text not null default 'livre' check (finalidade in ('livre', 'followup_proposta', 'lembrete_tarefa')),
  canal          text not null default 'email' check (canal in ('email', 'whatsapp')),
  assunto        text not null default '' check (char_length(assunto) <= 200),
  corpo          text not null check (char_length(btrim(corpo)) between 1 and 4000),
  ativo          boolean not null default true,
  criado_por     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default clock_timestamp(),
  updated_at     timestamptz not null default clock_timestamp()
);
comment on table public.studio_modelos is
  'Modelos de comunicação do estúdio (0082) com variáveis {{nome}}. Escrita só por RPC; prévia não envia.';
create unique index uq_studio_modelos_nome on public.studio_modelos (organizacao_id, lower(btrim(nome)));
create index idx_studio_modelos_org on public.studio_modelos (organizacao_id, finalidade) where ativo;

alter table public.studio_modelos enable row level security;
revoke all on table public.studio_modelos from public, anon, authenticated;
grant select on table public.studio_modelos to authenticated, service_role;
create policy studio_modelos_select on public.studio_modelos for select to authenticated
  using (public.papel_na_organizacao(organizacao_id) is not null);

-- Lista fechada de variáveis; texto com {{ ... }} fora dela é inválido.
create function public.studio_variaveis_validas(p_texto text) returns boolean
language plpgsql immutable set search_path = public, pg_temp as $$
declare v_resto text;
begin
  v_resto := regexp_replace(coalesce(p_texto, ''),
    '\{\{\s*(cliente_nome|cliente_primeiro_nome|estudio|titulo_negocio|valor|projeto|responsavel_nome|tarefa|prazo_tarefa)\s*\}\}', '', 'g');
  return position('{{' in v_resto) = 0 and position('}}' in v_resto) = 0;
end $$;
revoke all on function public.studio_variaveis_validas(text) from public, anon, authenticated, service_role;

create function public.salvar_modelo_studio(
  p_org uuid, p_id uuid, p_nome text, p_finalidade text, p_canal text, p_assunto text, p_corpo text, p_ativo boolean default true)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform public.studio_exigir(p_org, 'gestao');
  if p_nome is null or char_length(btrim(p_nome)) not between 2 and 80
     or p_finalidade is null or p_finalidade not in ('livre', 'followup_proposta', 'lembrete_tarefa')
     or p_canal is null or p_canal not in ('email', 'whatsapp')
     or char_length(coalesce(p_assunto, '')) > 200
     or p_corpo is null or char_length(btrim(p_corpo)) not between 1 and 4000
     or p_ativo is null
     or not public.studio_variaveis_validas(p_assunto) or not public.studio_variaveis_validas(p_corpo) then
    raise exception 'Dados inválidos.' using errcode = '22023';
  end if;
  begin
    if p_id is null then
      insert into public.studio_modelos (organizacao_id, nome, finalidade, canal, assunto, corpo, ativo, criado_por)
        values (p_org, btrim(p_nome), p_finalidade, p_canal, coalesce(p_assunto, ''), p_corpo, p_ativo, auth.uid())
        returning id into v_id;
    else
      update public.studio_modelos set nome = btrim(p_nome), finalidade = p_finalidade, canal = p_canal,
        assunto = coalesce(p_assunto, ''), corpo = p_corpo, ativo = p_ativo, updated_at = clock_timestamp()
       where id = p_id and organizacao_id = p_org returning id into v_id;
      if v_id is null then raise exception 'Modelo não encontrado.' using errcode = '22023'; end if;
    end if;
  exception when unique_violation then
    raise exception 'Já existe um modelo com este nome.' using errcode = '22023';
  end;
  return v_id;
end $$;
revoke all on function public.salvar_modelo_studio(uuid, uuid, text, text, text, text, text, boolean) from public, anon, service_role;
grant execute on function public.salvar_modelo_studio(uuid, uuid, text, text, text, text, text, boolean) to authenticated;

-- Renderizador interno. Variável sem dado vira "[nome]" e entra em `faltando`.
-- Todos os vínculos são conferidos contra a organização (sem vazamento entre estúdios).
create function public.studio_renderizar(
  p_org uuid, p_assunto text, p_corpo text, p_cliente uuid, p_negocio uuid, p_tarefa uuid)
returns table (assunto text, corpo text, faltando text[])
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_dono uuid; v_estudio text; v_valores jsonb := '{}'::jsonb; v_cli public.clientes; v_neg public.studio_negocios;
  v_tar public.studio_tarefas; v_proj text; v_resp text; v_var text; v_val text; v_a text; v_c text; v_falta text[] := '{}';
  v_int text;
begin
  select o.dono_id, o.nome into v_dono, v_estudio from public.organizacoes o where o.id = p_org;
  v_valores := jsonb_build_object('estudio', v_estudio);
  if p_negocio is not null then
    select * into v_neg from public.studio_negocios where id = p_negocio and organizacao_id = p_org;
    if not found then raise exception 'Negócio não encontrado.' using errcode = '22023'; end if;
    if p_cliente is null then p_cliente := v_neg.cliente_id; end if;
  end if;
  if p_cliente is not null then
    select * into v_cli from public.clientes where id = p_cliente and fotografo_id = v_dono;
    if not found then raise exception 'Cliente não encontrado.' using errcode = '22023'; end if;
    v_valores := v_valores || jsonb_build_object('cliente_nome', v_cli.nome,
      'cliente_primeiro_nome', split_part(btrim(v_cli.nome), ' ', 1));
  end if;
  if v_neg.id is not null then
    v_int := regexp_replace(to_char(trunc(v_neg.valor_estimado), 'FM999999990'), '(\d)(?=(\d{3})+$)', '\1.', 'g');
    v_valores := v_valores || jsonb_build_object('titulo_negocio', v_neg.titulo,
      'valor', 'R$ ' || v_int || ',' || to_char(round((v_neg.valor_estimado - trunc(v_neg.valor_estimado)) * 100), 'FM00'));
    if v_neg.projeto_id is not null then
      select nome into v_proj from public.projetos where id = v_neg.projeto_id;
      if v_proj is not null then v_valores := v_valores || jsonb_build_object('projeto', v_proj); end if;
    end if;
    if v_neg.responsavel_id is not null then
      select nome_completo into v_resp from public.profiles where id = v_neg.responsavel_id;
    end if;
  end if;
  if p_tarefa is not null then
    select * into v_tar from public.studio_tarefas where id = p_tarefa and organizacao_id = p_org;
    if not found then raise exception 'Tarefa não encontrada.' using errcode = '22023'; end if;
    v_valores := v_valores || jsonb_build_object('tarefa', v_tar.titulo);
    if v_tar.prazo is not null then
      v_valores := v_valores || jsonb_build_object('prazo_tarefa', to_char(v_tar.prazo at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'));
    end if;
    if v_tar.responsavel_id is not null then
      select nome_completo into v_resp from public.profiles where id = v_tar.responsavel_id;
    end if;
  end if;
  if v_resp is not null then v_valores := v_valores || jsonb_build_object('responsavel_nome', v_resp); end if;

  v_a := coalesce(p_assunto, ''); v_c := coalesce(p_corpo, '');
  for v_var in
    select distinct m[1] from regexp_matches(v_a || ' ' || v_c, '\{\{\s*([a-z_]+)\s*\}\}', 'g') as m
  loop
    v_val := v_valores ->> v_var;
    if v_val is null then v_falta := v_falta || v_var; v_val := '[' || v_var || ']'; end if;
    -- '\' é especial no texto de substituição do regexp_replace.
    v_val := replace(v_val, '\', '\\');
    v_a := regexp_replace(v_a, '\{\{\s*' || v_var || '\s*\}\}', v_val, 'g');
    v_c := regexp_replace(v_c, '\{\{\s*' || v_var || '\s*\}\}', v_val, 'g');
  end loop;
  return query select v_a, v_c, v_falta;
end $$;
revoke all on function public.studio_renderizar(uuid, text, text, uuid, uuid, uuid) from public, anon, authenticated, service_role;

-- PRÉVIA: devolve texto renderizado e as variáveis sem dado. NÃO envia nem grava nada.
create function public.renderizar_modelo_studio(
  p_org uuid, p_modelo uuid, p_cliente uuid default null, p_negocio uuid default null, p_tarefa uuid default null)
returns table (assunto text, corpo text, faltando text[])
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_m public.studio_modelos;
begin
  perform public.studio_exigir(p_org, 'leitura');
  select * into v_m from public.studio_modelos where id = p_modelo and organizacao_id = p_org;
  if not found then raise exception 'Modelo não encontrado.' using errcode = '22023'; end if;
  return query select * from public.studio_renderizar(p_org, v_m.assunto, v_m.corpo, p_cliente, p_negocio, p_tarefa);
end $$;
revoke all on function public.renderizar_modelo_studio(uuid, uuid, uuid, uuid, uuid) from public, anon, service_role;
grant execute on function public.renderizar_modelo_studio(uuid, uuid, uuid, uuid, uuid) to authenticated;

commit;
