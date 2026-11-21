-- D01/D02: contrato seleção → documento de álbum (DESIGN).
-- ADITIVA: não altera tabela, função nem policy existente (as policies de
-- album_layouts continuam como estão; só se ACRESCENTA uma policy restritiva
-- que mantém o escopo do projeto em álbuns avulsos nascidos de uma seleção).
--
-- Contrato: o álbum criado a partir de uma seleção entregue guarda a REFERÊNCIA
-- ao snapshot (selecao_id + revisão) e os IDs de foto DAQUELE instante. O
-- vínculo é imutável. Novas revisões da seleção, favoritos e remoções de foto
-- NUNCA reescrevem o documento, a biblioteca nem o vínculo já criados; e uma
-- prova publicada (design_versions/versoes_laminas) não depende da seleção.
-- Nenhum original é duplicado: o álbum de projeto lê `fotos` do projeto (mesmos
-- IDs) e o avulso guarda REFERÊNCIAS às mesmas chaves do snapshot.
--
-- Papéis (decisão de mercado — Pixellu/Fundy/Pic-Time/Pixieset: o estúdio e a
-- equipe que produz criam o álbum; visualizador só consulta):
--   producao  = quem já produz o projeto hoje (0043: gestão/admin ou equipe atribuída)
--   dono      = fotógrafo dono do projeto / dono da organização
--   admin, editor = membros da organização (0051/0054) que produzem
--   visualizador  = só lê o resumo; não cria.
-- NÃO aplicada em ambiente remoto.
begin;

create table public.album_selecao_vinculos (
  id          uuid primary key default gen_random_uuid(),
  layout_id   uuid not null unique references public.album_layouts (id) on delete cascade,
  selecao_id  uuid not null references public.selecoes_entregues (id),
  projeto_id  uuid not null references public.projetos (id) on delete cascade,
  revisao     integer not null check (revisao > 0),
  destino     text not null check (destino in ('projeto', 'avulso')),
  foto_ids    uuid[] not null check (cardinality(foto_ids) between 1 and 1000),
  chave       uuid not null,
  criado_por  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint album_selecao_vinculos_idempotencia unique (selecao_id, criado_por, chave)
);
comment on table public.album_selecao_vinculos is
  'Vínculo imutável entre um álbum (album_layouts) e o snapshot de seleção que o originou (0090). Guarda a revisão e os IDs de foto do instante da criação.';
create index idx_album_selecao_vinculos_projeto on public.album_selecao_vinculos (projeto_id);
create index idx_album_selecao_vinculos_selecao on public.album_selecao_vinculos (selecao_id);

alter table public.album_selecao_vinculos enable row level security;
revoke all on table public.album_selecao_vinculos from public, anon, authenticated;
grant select on table public.album_selecao_vinculos to authenticated;
grant all on table public.album_selecao_vinculos to service_role;

-- Papel de quem chama no projeto, para o design (nulo: sem acesso). O cliente
-- final NÃO tem papel aqui: o documento de design é interno ao estúdio.
create function public.design_papel_no_projeto(p_projeto uuid) returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and status = 'ativo') then
    return null;
  end if;
  if public.pode_produzir_projeto(p_projeto) then return 'producao'; end if;
  if exists (select 1 from public.projetos p join public.profiles u on u.id = auth.uid()
              where p.id = p_projeto and p.fotografo_id = auth.uid() and u.role = 'fotografo') then
    return 'dono';
  end if;
  return public.papel_no_projeto_org(p_projeto);
end $$;
revoke all on function public.design_papel_no_projeto(uuid) from public, anon, service_role;
grant execute on function public.design_papel_no_projeto(uuid) to authenticated;

create policy album_selecao_vinculos_select on public.album_selecao_vinculos for select to authenticated
  using (public.design_papel_no_projeto(projeto_id) is not null);

-- Vínculo imutável para QUALQUER papel (inclusive service_role e o dono da
-- tabela). Só a exclusão em cascata (excluir o álbum avulso ou o projeto) passa:
-- ela dispara este gatilho dentro de outro gatilho (pg_trigger_depth() > 1).
create function public.album_selecao_vinculo_imutavel() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' or pg_trigger_depth() <= 1 then
    raise exception 'O vínculo com a seleção é imutável.' using errcode = '42501';
  end if;
  return old;
end $$;
revoke all on function public.album_selecao_vinculo_imutavel() from public, anon, authenticated, service_role;
create trigger trg_album_selecao_vinculo_imutavel before update or delete on public.album_selecao_vinculos
  for each row execute function public.album_selecao_vinculo_imutavel();

-- Escopo: álbum avulso nascido de uma seleção só é visível/editável por quem
-- produz o projeto de origem (sem isto, qualquer equipe leria as fotos de
-- outro estúdio pelo avulso). Álbuns sem vínculo não mudam em nada.
create function public.album_selecao_escopo_ok(p_layout uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select not exists (select 1 from public.album_selecao_vinculos v where v.layout_id = p_layout and v.destino = 'avulso')
      or exists (select 1 from public.album_selecao_vinculos v
                  where v.layout_id = p_layout and v.destino = 'avulso' and public.pode_produzir_projeto(v.projeto_id))
$$;
revoke all on function public.album_selecao_escopo_ok(uuid) from public, anon, service_role;
grant execute on function public.album_selecao_escopo_ok(uuid) to authenticated;
create policy album_layouts_selecao_escopo on public.album_layouts as restrictive for all to authenticated
  using (public.album_selecao_escopo_ok(id)) with check (public.album_selecao_escopo_ok(id));

-- Cria o documento de álbum a partir de um snapshot. Idempotente por chave.
--   'projeto': o documento do projeto (um por projeto, 0027); o editor lê as
--              fotos do próprio projeto (mesmos IDs de `fotos`).
--   'avulso' : álbum independente cujas fotos são REFERÊNCIAS às chaves do
--              snapshot (campo `referencia`): apagar o álbum ou a foto dele
--              jamais apaga o original.
-- A seleção vira a pasta "Seleção · revisão N" (favoritas) da biblioteca do
-- álbum — o editor já filtra por pasta e preenche automaticamente a partir dela.
create function public.criar_album_da_selecao(
  p_selecao_id uuid, p_destino text, p_chave uuid,
  p_nome text, p_formato text, p_orientacao text, p_documento jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_sel public.selecoes_entregues; v_proj public.projetos; v_papel text; v_ex public.album_selecao_vinculos;
  v_nome text; v_doc jsonb; v_fotos jsonb := '[]'::jsonb; v_bib jsonb; v_pasta text; v_cliente text;
  v_layout uuid; v_vinc uuid; v_outro uuid;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and status = 'ativo') then
    raise exception 'Sem permissão para criar álbum.' using errcode = '42501'; end if;
  if p_selecao_id is null or p_chave is null or p_destino is null or p_destino not in ('projeto', 'avulso') then
    raise exception 'Pedido inválido.' using errcode = '22023'; end if;
  select * into v_sel from public.selecoes_entregues where id = p_selecao_id;
  if not found then raise exception 'Sem permissão para criar álbum.' using errcode = '42501'; end if;
  v_papel := public.design_papel_no_projeto(v_sel.projeto_id);
  if v_papel is null or v_papel not in ('producao', 'dono', 'admin', 'editor') then
    raise exception 'Sem permissão para criar álbum.' using errcode = '42501'; end if;
  if p_formato is null or p_formato !~ '^[0-9]+(\.[0-9]+)?x[0-9]+(\.[0-9]+)?$' or length(p_formato) > 20
     or p_orientacao is null or p_orientacao not in ('quadrado', 'horizontal', 'vertical') then
    raise exception 'Formato inválido.' using errcode = '22023'; end if;
  v_nome := left(regexp_replace(trim(coalesce(p_nome, '')), '\s+', ' ', 'g'), 120);
  if char_length(v_nome) < 2 then raise exception 'Nome inválido.' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_sel.projeto_id::text, 90));
  select * into v_proj from public.projetos where id = v_sel.projeto_id for share;

  -- Repetição com a mesma chave devolve o que já foi criado.
  select * into v_ex from public.album_selecao_vinculos
   where selecao_id = p_selecao_id and criado_por = auth.uid() and chave = p_chave;
  if found then
    if v_ex.destino <> p_destino then raise exception 'Chave já usada com outro destino.' using errcode = '22023'; end if;
    return jsonb_build_object('layout_id', v_ex.layout_id, 'vinculo_id', v_ex.id, 'revisao', v_ex.revisao,
      'total', cardinality(v_ex.foto_ids), 'destino', v_ex.destino, 'criado', false);
  end if;

  if p_destino = 'projeto' then
    select a.id into v_outro from public.album_layouts a where a.projeto_id = v_sel.projeto_id;
    if found then
      -- Já nasceu desta mesma seleção (outra aba, outra chave): é o mesmo álbum.
      select * into v_ex from public.album_selecao_vinculos where layout_id = v_outro and selecao_id = p_selecao_id;
      if found then
        return jsonb_build_object('layout_id', v_ex.layout_id, 'vinculo_id', v_ex.id, 'revisao', v_ex.revisao,
          'total', cardinality(v_ex.foto_ids), 'destino', v_ex.destino, 'criado', false);
      end if;
      raise exception 'Este projeto já tem um álbum.' using errcode = '22023';
    end if;
  end if;

  -- O documento só pode citar fotos do snapshot (nunca de outro projeto).
  v_doc := coalesce(p_documento, jsonb_build_object('versao', 1, 'primeiraEhCapa', false, 'laminas', jsonb_build_array(
    jsonb_build_object('id', 'l1', 'fundo', '#ffffff', 'fundoGradiente', null, 'textura', null, 'fundoImagem', null,
      'quadros', '[]'::jsonb, 'textos', '[]'::jsonb, 'formas', '[]'::jsonb))));
  if jsonb_typeof(v_doc) <> 'object' or jsonb_typeof(v_doc -> 'laminas') <> 'array'
     or jsonb_array_length(v_doc -> 'laminas') not between 1 and 200 or octet_length(v_doc::text) >= 2000000 then
    raise exception 'Documento inválido.' using errcode = '22023'; end if;
  if exists (
    select 1 from jsonb_array_elements(v_doc -> 'laminas') l
      cross join lateral (
        select q ->> 'fotoId' as foto from jsonb_array_elements(coalesce(l -> 'quadros', '[]'::jsonb)) q
        union all select l #>> '{fundoImagem,fotoId}'
      ) r
     where r.foto is not null and (r.foto !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or not (r.foto::uuid = any (v_sel.foto_ids)))
  ) then
    raise exception 'O documento cita foto fora da seleção.' using errcode = '22023'; end if;

  v_pasta := 'selecao-' || v_sel.revisao;
  select jsonb_build_object(
      'pastas', jsonb_build_array(jsonb_build_object('id', v_pasta, 'nome', format('Seleção · revisão %s', v_sel.revisao))),
      'fotos', coalesce(jsonb_object_agg(f.foto_id::text, jsonb_build_object('pasta', v_pasta, 'favorita', true, 'prioridade', null, 'foco', null)), '{}'::jsonb))
    into v_bib from public.selecao_entregue_fotos f where f.selecao_id = v_sel.id;

  if p_destino = 'avulso' then
    select coalesce(jsonb_agg(jsonb_build_object('id', f.foto_id, 'path', f.storage_path,
        'nome', left(coalesce(nullif(f.nome_original, ''), regexp_replace(f.storage_path, '^.*/', '')), 120),
        'largura', null, 'altura', null, 'bucket', f.bucket, 'referencia', true) order by f.foto_id), '[]'::jsonb)
      into v_fotos from public.selecao_entregue_fotos f where f.selecao_id = v_sel.id;
    select left(c.nome, 120) into v_cliente from public.clientes c where c.id = v_proj.cliente_id;
  end if;

  insert into public.album_layouts (projeto_id, nome, cliente_nome, formato, orientacao, documento, fotos, biblioteca, criado_por)
  values (case when p_destino = 'projeto' then v_sel.projeto_id end, v_nome, v_cliente, p_formato, p_orientacao,
          v_doc, v_fotos, v_bib, auth.uid())
  returning id into v_layout;
  insert into public.album_selecao_vinculos (layout_id, selecao_id, projeto_id, revisao, destino, foto_ids, chave, criado_por)
  values (v_layout, v_sel.id, v_sel.projeto_id, v_sel.revisao, p_destino, v_sel.foto_ids, p_chave, auth.uid())
  returning id into v_vinc;
  insert into public.projeto_atividades (projeto_id, autor_id, mensagem)
  values (v_sel.projeto_id, auth.uid(), format('Álbum criado a partir da seleção: revisão %s com %s fotos (%s).',
    v_sel.revisao, cardinality(v_sel.foto_ids), case p_destino when 'projeto' then 'álbum do projeto' else 'álbum avulso' end));

  return jsonb_build_object('layout_id', v_layout, 'vinculo_id', v_vinc, 'revisao', v_sel.revisao,
    'total', cardinality(v_sel.foto_ids), 'destino', p_destino, 'criado', true);
end $$;
revoke all on function public.criar_album_da_selecao(uuid, text, uuid, text, text, text, jsonb) from public, anon, service_role;
grant execute on function public.criar_album_da_selecao(uuid, text, uuid, text, text, text, jsonb) to authenticated;

-- Resumo para a tela da seleção: quem pode criar, os álbuns já nascidos de
-- seleções do projeto e se quem chama pode abrir o editor.
create function public.design_selecao_resumo(p_projeto uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_papel text;
begin
  v_papel := public.design_papel_no_projeto(p_projeto);
  if v_papel is null then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'papel', v_papel,
    'pode_criar', v_papel in ('producao', 'dono', 'admin', 'editor'),
    'pode_abrir_editor', public.is_equipe() and public.pode_produzir_projeto(p_projeto),
    'tem_album_projeto', exists (select 1 from public.album_layouts a where a.projeto_id = p_projeto),
    'albuns', coalesce((select jsonb_agg(jsonb_build_object('layout_id', v.layout_id, 'selecao_id', v.selecao_id,
        'revisao', v.revisao, 'destino', v.destino, 'total', cardinality(v.foto_ids), 'criado_em', v.created_at)
        order by v.created_at desc) from public.album_selecao_vinculos v where v.projeto_id = p_projeto), '[]'::jsonb));
end $$;
revoke all on function public.design_selecao_resumo(uuid) from public, anon, service_role;
grant execute on function public.design_selecao_resumo(uuid) to authenticated;

commit;
