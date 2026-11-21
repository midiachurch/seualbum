-- D03: publicação parcial e recuperação (DESIGN).
-- ADITIVA: não altera tabela, função nem policy existente; o fluxo atual de
-- salvar/publicar do editor e do projeto segue idêntico (as travas abaixo só
-- impedem por API o que o app nunca fez: reescrever histórico e lâmina).
--
--  1. Histórico do álbum imutável (album_layout_versoes): documento, tipo e
--     autoria não mudam; só o rótulo. Só a versão 'auto' pode ser podada
--     (poda de 40 do app); manual/restauração/aprovação/publicação ficam.
--  2. Lâmina publicada imutável (versoes_laminas): arquivo, ordem, bucket e
--     herança não mudam; lâmina herdada (alterada=false) tem de apontar para
--     a MESMA chave de uma lâmina do mesmo projeto. Nenhuma exclusão direta.
--  3. restaurar_versao_album: restaurar uma versão anterior cria NOVA versão
--     (e guarda o estado de antes); nunca sobrescreve o histórico. Idempotente
--     por chave; respeita o travamento por aprovação do salvar_album_layout.
--  4. Assinatura/histórico de versões da prova: prova de reprodutibilidade
--     (hash das lâminas) sem tocar em valores de cobrança.
-- NÃO aplicada em ambiente remoto.
begin;

-- 1. Histórico do álbum ------------------------------------------------------
create function public.album_versao_imutavel() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then
    if new.documento is distinct from old.documento or new.layout_id <> old.layout_id or new.tipo <> old.tipo
       or new.created_at <> old.created_at or new.criado_por is distinct from old.criado_por then
      raise exception 'A versão do histórico é imutável.' using errcode = '42501'; end if;
    return new;
  end if;
  -- Exclusão: só a poda de pontos automáticos ou a cascata (excluir o álbum).
  if old.tipo <> 'auto' and pg_trigger_depth() <= 1 then
    raise exception 'Só pontos de restauração automáticos podem ser descartados.' using errcode = '42501'; end if;
  return old;
end $$;
revoke all on function public.album_versao_imutavel() from public, anon, authenticated, service_role;
create trigger trg_album_versao_imutavel before update or delete on public.album_layout_versoes
  for each row execute function public.album_versao_imutavel();

-- 2. Lâmina publicada --------------------------------------------------------
create function public.versao_lamina_guardar() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_origem public.versoes_laminas; v_proj_origem uuid; v_proj_nova uuid;
begin
  if tg_op = 'INSERT' then
    if new.alterada = false then
      if new.origem_lamina_id is null then
        raise exception 'Lâmina herdada precisa apontar para a lâmina de origem.' using errcode = '23514'; end if;
      select * into v_origem from public.versoes_laminas where id = new.origem_lamina_id;
      if not found or v_origem.bucket <> new.bucket or v_origem.storage_path <> new.storage_path then
        raise exception 'Lâmina herdada precisa manter o mesmo arquivo da origem.' using errcode = '23514'; end if;
      select projeto_id into v_proj_origem from public.design_versions where id = v_origem.versao_id;
      select projeto_id into v_proj_nova from public.design_versions where id = new.versao_id;
      if v_proj_origem is distinct from v_proj_nova then
        raise exception 'Lâmina herdada precisa vir do mesmo projeto.' using errcode = '23514'; end if;
    end if;
    return new;
  end if;
  -- Ações de integridade (cascata, SET NULL da origem) rodam em gatilho aninhado.
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.versao_id <> old.versao_id or new.ordem <> old.ordem or new.bucket <> old.bucket
       or new.storage_path <> old.storage_path or new.largura is distinct from old.largura or new.altura is distinct from old.altura
       or new.alterada <> old.alterada or new.origem_lamina_id is distinct from old.origem_lamina_id or new.eh_capa <> old.eh_capa then
      raise exception 'A lâmina publicada é imutável.' using errcode = '42501'; end if;
    return new;
  end if;
  raise exception 'A lâmina publicada não pode ser apagada.' using errcode = '42501';
end $$;
revoke all on function public.versao_lamina_guardar() from public, anon, authenticated, service_role;
create trigger trg_versao_lamina_guardar before insert or update or delete on public.versoes_laminas
  for each row execute function public.versao_lamina_guardar();

-- 3. Restauração -------------------------------------------------------------
create table public.album_restauracoes (
  id                uuid primary key default gen_random_uuid(),
  layout_id         uuid not null references public.album_layouts (id) on delete cascade,
  versao_origem_id  uuid not null references public.album_layout_versoes (id) on delete cascade,
  versao_nova_id    uuid not null references public.album_layout_versoes (id) on delete cascade,
  versao_antes_id   uuid not null references public.album_layout_versoes (id) on delete cascade,
  chave             uuid not null,
  revisao           integer not null,
  criado_por        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (layout_id, chave)
);
alter table public.album_restauracoes enable row level security;
revoke all on table public.album_restauracoes from public, anon, authenticated;
grant select on table public.album_restauracoes to authenticated;
grant all on table public.album_restauracoes to service_role;
create policy album_restauracoes_select on public.album_restauracoes for select to authenticated
  using (public.is_equipe() and exists (select 1 from public.album_layouts a where a.id = layout_id));
create function public.album_restauracao_imutavel() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' or pg_trigger_depth() <= 1 then
    raise exception 'O registro de restauração é imutável.' using errcode = '42501'; end if;
  return old;
end $$;
revoke all on function public.album_restauracao_imutavel() from public, anon, authenticated, service_role;
create trigger trg_album_restauracao_imutavel before update or delete on public.album_restauracoes
  for each row execute function public.album_restauracao_imutavel();

create function public.restaurar_versao_album(p_layout_id uuid, p_versao_id uuid, p_chave uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_layout public.album_layouts; v_versao public.album_layout_versoes; v_ex public.album_restauracoes;
  v_antes uuid; v_nova uuid; v_rev integer; v_projeto_status text;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and status = 'ativo') then
    raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_layout_id is null or p_versao_id is null or p_chave is null then
    raise exception 'Pedido inválido.' using errcode = '22023'; end if;
  select * into v_layout from public.album_layouts where id = p_layout_id for update;
  if not found or not public.is_equipe()
     or (v_layout.projeto_id is not null and not public.pode_produzir_projeto(v_layout.projeto_id))
     or not public.album_selecao_escopo_ok(v_layout.id) then
    raise exception 'Sem permissão.' using errcode = '42501'; end if;

  select * into v_ex from public.album_restauracoes where layout_id = p_layout_id and chave = p_chave;
  if found then
    if v_ex.versao_origem_id <> p_versao_id then raise exception 'Chave já usada com outra versão.' using errcode = '22023'; end if;
    return jsonb_build_object('versao_id', v_ex.versao_nova_id, 'versao_anterior_id', v_ex.versao_antes_id,
      'revisao', v_ex.revisao, 'restaurada_de', v_ex.versao_origem_id, 'repetida', true);
  end if;

  -- Mesma regra de travamento do salvar_album_layout: aprovado/finalizado não muda.
  if v_layout.status in ('aprovado', 'finalizado', 'em_producao') then
    raise exception 'Este álbum está travado para edição.' using errcode = '55000'; end if;
  if v_layout.projeto_id is not null then
    select status into v_projeto_status from public.projetos where id = v_layout.projeto_id;
    if v_projeto_status in ('aprovado_aguardando_pagamento', 'aprovado', 'enviado', 'finalizado', 'arquivado') then
      raise exception 'Este álbum está travado para edição.' using errcode = '55000'; end if;
  end if;

  select * into v_versao from public.album_layout_versoes where id = p_versao_id and layout_id = p_layout_id;
  if not found then raise exception 'Versão indisponível.' using errcode = '22023'; end if;

  -- 1) guarda o estado de agora; 2) aplica; 3) registra a restauração como NOVA versão.
  insert into public.album_layout_versoes (layout_id, documento, tipo, rotulo, criado_por)
  values (p_layout_id, v_layout.documento, 'restauracao', 'Antes de restaurar', auth.uid()) returning id into v_antes;
  update public.album_layouts
     set documento = v_versao.documento, revisao = revisao + 1,
         status = case status when 'rascunho' then 'em_edicao' when 'alteracoes_solicitadas' then 'em_revisao' else status end
   where id = p_layout_id returning revisao into v_rev;
  insert into public.album_layout_versoes (layout_id, documento, tipo, rotulo, criado_por)
  values (p_layout_id, v_versao.documento, 'manual',
          left('Restaurada de ' || coalesce(nullif(v_versao.rotulo, ''), to_char(v_versao.created_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')), 80), auth.uid())
  returning id into v_nova;
  insert into public.album_restauracoes (layout_id, versao_origem_id, versao_nova_id, versao_antes_id, chave, revisao, criado_por)
  values (p_layout_id, p_versao_id, v_nova, v_antes, p_chave, v_rev, auth.uid());
  return jsonb_build_object('versao_id', v_nova, 'versao_anterior_id', v_antes, 'revisao', v_rev,
    'restaurada_de', p_versao_id, 'repetida', false);
end $$;
revoke all on function public.restaurar_versao_album(uuid, uuid, uuid) from public, anon, service_role;
grant execute on function public.restaurar_versao_album(uuid, uuid, uuid) to authenticated;

-- 4. Reprodutibilidade da prova ------------------------------------------------
-- Hash estável das lâminas de uma versão (ordem, arquivo, capa). Quem pode ver
-- o projeto na produção (ou ler pela organização) consulta; não expõe cobrança.
create function public.design_versao_assinatura(p_versao uuid) returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_projeto uuid;
begin
  select projeto_id into v_projeto from public.design_versions where id = p_versao;
  if not found or public.design_papel_no_projeto(v_projeto) is null then
    raise exception 'Sem permissão.' using errcode = '42501'; end if;
  return coalesce((select md5(string_agg(format('%s|%s|%s|%s', l.ordem, l.bucket, l.storage_path, l.eh_capa), ';' order by l.ordem))
                     from public.versoes_laminas l where l.versao_id = p_versao), md5(''));
end $$;
revoke all on function public.design_versao_assinatura(uuid) from public, anon, service_role;
grant execute on function public.design_versao_assinatura(uuid) to authenticated;

create function public.design_historico_versoes(p_projeto uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if public.design_papel_no_projeto(p_projeto) is null then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'versao_id', dv.id, 'numero', dv.numero, 'status', dv.status, 'base_versao_id', dv.base_versao_id,
      'laminas', (select count(*) from public.versoes_laminas l where l.versao_id = dv.id),
      'herdadas', (select count(*) from public.versoes_laminas l where l.versao_id = dv.id and not l.alterada),
      'alteradas', (select count(*) from public.versoes_laminas l where l.versao_id = dv.id and l.alterada),
      'assinatura', public.design_versao_assinatura(dv.id), 'criada_em', dv.created_at) order by dv.numero)
    from public.design_versions dv where dv.projeto_id = p_projeto), '[]'::jsonb);
end $$;
revoke all on function public.design_historico_versoes(uuid) from public, anon, service_role;
grant execute on function public.design_historico_versoes(uuid) to authenticated;

commit;
