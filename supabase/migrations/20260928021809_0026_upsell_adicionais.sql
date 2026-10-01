-- =============================================================================
-- Migration 0026: Máquina de Upsell B2B2C — adicionais na aprovação da prova
--
--   * `adicionais`: catálogo (custo = o que o ESTÚDIO paga; sugerido = preço de
--     revenda padrão ao casal). O cliente final nunca lê esta tabela — o custo
--     é segredo do white label; ele recebe as ofertas por `ofertas_da_prova`.
--   * `adicionais_estudio`: preço de revenda do fotógrafo e se ele oferece o
--     item aos clientes dele (sem linha = sugerido e oferece).
--   * `fatura_itens`: itens da fatura com tipos mistos (lâminas extras ×
--     adicionais), origem (sistema/cliente/fotógrafo) e situação
--     (confirmado / aguardando_estudio / removido). Um gatilho mantém
--     `faturas.valor_total` e o `itens_json` legado sincronizados.
--   * `aprovar_prova`: aprovação + adicionais numa operação só. O gatilho de
--     aprovação decide: sem cobrança → "Aprovado para impressão"; com lâminas
--     extras e/ou adicionais → fatura + `aprovado_aguardando_pagamento`.
--   * Adicional pedido pelo CASAL entra `aguardando_estudio`: o fotógrafo aceita
--     ou recusa (`decidir_adicional`); pagamento e cortesia são recusados
--     enquanto houver item aguardando. Recusou tudo e não há lâminas extras →
--     a fatura é cancelada e o álbum vai para impressão sem cobrança.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Catálogo
-- -----------------------------------------------------------------------------

create table if not exists public.adicionais (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  nome           text not null check (char_length(trim(nome)) between 2 and 80),
  descricao      text,
  imagem_url     text,
  preco_custo    numeric(10, 2) not null check (preco_custo >= 0),
  preco_sugerido numeric(10, 2) not null check (preco_sugerido >= 0),
  ativo          boolean not null default true,
  ordem          smallint not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.adicionais enable row level security;
alter table public.adicionais force row level security;

-- Custo é assunto do estúdio (quem paga) e da operação. Cliente e designer não leem.
drop policy if exists "adicionais_select_estudio_ou_operacao" on public.adicionais;
create policy "adicionais_select_estudio_ou_operacao" on public.adicionais for select to authenticated
  using (public.is_operacao() or (ativo and public.current_role_v() = 'fotografo'));

drop policy if exists "adicionais_write_gestao" on public.adicionais;
create policy "adicionais_write_gestao" on public.adicionais for all to authenticated
  using (public.is_gestor_ou_admin()) with check (public.is_gestor_ou_admin());

insert into public.adicionais (slug, nome, descricao, preco_custo, preco_sugerido, ordem) values
  ('copia-pais-20x20', 'Cópia para os pais (20×20)', 'Uma versão reduzida do álbum, com as mesmas lâminas, para presentear os pais.', 150, 350, 1),
  ('caixa-acrilica-premium', 'Caixa acrílica premium', 'Caixa em acrílico para guardar e expor o álbum.', 90, 190, 2)
on conflict (slug) do nothing;

create table if not exists public.adicionais_estudio (
  fotografo_id        uuid not null references public.fotografos (id) on delete cascade,
  adicional_id        uuid not null references public.adicionais (id) on delete cascade,
  preco_revenda       numeric(10, 2) check (preco_revenda is null or preco_revenda >= 0),
  oferecer_ao_cliente boolean not null default true,
  updated_at          timestamptz not null default now(),
  primary key (fotografo_id, adicional_id)
);

alter table public.adicionais_estudio enable row level security;
alter table public.adicionais_estudio force row level security;

drop policy if exists "adicionais_estudio_dono" on public.adicionais_estudio;
create policy "adicionais_estudio_dono" on public.adicionais_estudio for all to authenticated
  using (fotografo_id = auth.uid() or public.is_operacao())
  with check (fotografo_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 2. Itens da fatura (tipos mistos, origem e situação)
-- -----------------------------------------------------------------------------

create table if not exists public.fatura_itens (
  id                      uuid primary key default gen_random_uuid(),
  fatura_id               uuid not null references public.faturas (id) on delete cascade,
  tipo                    text not null check (tipo in ('laminas_extras', 'paginas_extras', 'adicional')),
  adicional_id            uuid references public.adicionais (id) on delete set null,
  descricao               text not null,
  quantidade              integer not null check (quantidade > 0),
  valor_unitario          numeric(10, 2) not null check (valor_unitario >= 0),
  valor_total             numeric(10, 2) generated always as (quantidade * valor_unitario) stored,
  -- O que o casal paga ao estúdio (só adicionais): a margem do fotógrafo é
  -- (preco_revenda_unitario − valor_unitario) × quantidade.
  preco_revenda_unitario  numeric(10, 2) check (preco_revenda_unitario is null or preco_revenda_unitario >= 0),
  origem                  text not null default 'sistema' check (origem in ('sistema', 'cliente', 'fotografo')),
  situacao                text not null default 'confirmado' check (situacao in ('confirmado', 'aguardando_estudio', 'removido')),
  decidido_em             timestamptz,
  decidido_por            uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now()
);

create index if not exists idx_fatura_itens_fatura on public.fatura_itens (fatura_id);

-- Fatura de fechamento da aprovação: lâminas extras e/ou adicionais.
alter table public.faturas drop constraint if exists faturas_tipo_check;
alter table public.faturas
  add constraint faturas_tipo_check check (tipo in ('paginas_extras', 'laminas_extras', 'fechamento'));

alter table public.fatura_itens enable row level security;
alter table public.fatura_itens force row level security;

-- Mesmo círculo das faturas: operação e o fotógrafo dono. Escrita só pelas funções.
drop policy if exists "fatura_itens_select_scope" on public.fatura_itens;
create policy "fatura_itens_select_scope" on public.fatura_itens for select to authenticated
  using (
    public.is_operacao()
    or exists (
      select 1 from public.faturas f join public.projetos p on p.id = f.projeto_id
      where f.id = fatura_itens.fatura_id and p.fotografo_id = auth.uid()
    )
  );

-- Total e `itens_json` (legado, lido pelas telas antigas) seguem os itens ativos.
create or replace function public.sincronizar_total_fatura()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fatura uuid := coalesce(new.fatura_id, old.fatura_id);
begin
  update public.faturas f
    set valor_total = coalesce((
          select sum(i.valor_total) from public.fatura_itens i
          where i.fatura_id = v_fatura and i.situacao <> 'removido'), 0),
        itens_json = coalesce((
          select jsonb_agg(jsonb_build_object(
                   'descricao', i.descricao, 'quantidade', i.quantidade,
                   'valorUnitario', i.valor_unitario, 'valorTotal', i.valor_total)
                 order by i.created_at)
          from public.fatura_itens i
          where i.fatura_id = v_fatura and i.situacao <> 'removido'), '[]'::jsonb)
    where f.id = v_fatura;
  return null;
end;
$$;

drop trigger if exists trg_sincronizar_total_fatura on public.fatura_itens;
create trigger trg_sincronizar_total_fatura
  after insert or update or delete on public.fatura_itens
  for each row execute function public.sincronizar_total_fatura();

-- Retroativo: faturas existentes viram itens (a primeira linha de itens_json).
insert into public.fatura_itens (fatura_id, tipo, descricao, quantidade, valor_unitario, origem, situacao)
select
  f.id,
  case when f.tipo = 'laminas_extras' then 'laminas_extras' else 'paginas_extras' end,
  coalesce(item ->> 'descricao', 'Extras'),
  greatest(1, coalesce((item ->> 'quantidade')::integer, 1)),
  coalesce((item ->> 'valorUnitario')::numeric, f.valor_total),
  'sistema', 'confirmado'
from public.faturas f
cross join lateral jsonb_array_elements(case when jsonb_typeof(f.itens_json) = 'array' then f.itens_json else '[]'::jsonb end) item
where not exists (select 1 from public.fatura_itens i where i.fatura_id = f.id);

-- -----------------------------------------------------------------------------
-- 3. Ofertas para a tela de aprovação
-- -----------------------------------------------------------------------------
-- Casal: só o que o estúdio oferece, pelo preço de revenda (sem custo).
-- Fotógrafo dono: tudo o que está ativo, com o custo (é ele quem paga) e a revenda.

create or replace function public.ofertas_da_prova(p_projeto_id uuid)
returns table (
  adicional_id  uuid,
  nome          text,
  descricao     text,
  imagem_url    text,
  preco         numeric,
  preco_revenda numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_fotografo uuid;
  v_cliente   boolean;
begin
  select p.fotografo_id, exists (select 1 from public.clientes c where c.id = p.cliente_id and c.user_id = auth.uid())
    into v_fotografo, v_cliente
    from public.projetos p where p.id = p_projeto_id;

  if v_fotografo is null or (v_fotografo <> auth.uid() and not v_cliente) then
    raise exception 'Sem acesso a este projeto.' using errcode = '42501';
  end if;

  return query
    select a.id, a.nome, a.descricao, a.imagem_url,
           case when v_fotografo = auth.uid() then a.preco_custo else coalesce(ae.preco_revenda, a.preco_sugerido) end,
           coalesce(ae.preco_revenda, a.preco_sugerido)
    from public.adicionais a
    left join public.adicionais_estudio ae on ae.adicional_id = a.id and ae.fotografo_id = v_fotografo
    where a.ativo
      and (v_fotografo = auth.uid() or coalesce(ae.oferecer_ao_cliente, true))
    order by a.ordem, a.nome;
end;
$$;

revoke execute on function public.ofertas_da_prova(uuid) from public, anon;
grant execute on function public.ofertas_da_prova(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Aprovar com adicionais (uma operação só)
-- -----------------------------------------------------------------------------

create or replace function public.aprovar_prova(p_projeto_id uuid, p_versao integer, p_adicionais jsonb default '[]'::jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fotografo uuid;
  v_eh_fotografo boolean;
  v_eh_cliente boolean;
  v_itens jsonb := '[]'::jsonb;
  v_status public.project_status;
begin
  select p.fotografo_id,
         p.fotografo_id = auth.uid(),
         exists (select 1 from public.clientes c where c.id = p.cliente_id and c.user_id = auth.uid())
    into v_fotografo, v_eh_fotografo, v_eh_cliente
    from public.projetos p where p.id = p_projeto_id;
  if v_fotografo is null or not (v_eh_fotografo or v_eh_cliente) then
    raise exception 'Só o cliente ou o estúdio dono do projeto aprova a prova.' using errcode = '42501';
  end if;

  if p_adicionais is not null and jsonb_typeof(p_adicionais) = 'array' and jsonb_array_length(p_adicionais) > 0 then
    if jsonb_array_length(p_adicionais) > 10 then
      raise exception 'Adicionais demais.' using errcode = '22023';
    end if;
    -- Preços SEMPRE do banco; do navegador só vem qual item e quantos.
    select coalesce(jsonb_agg(jsonb_build_object(
             'adicional_id', a.id,
             'descricao', a.nome,
             'quantidade', q.quantidade,
             'custo', a.preco_custo,
             'revenda', coalesce(ae.preco_revenda, a.preco_sugerido),
             'origem', case when v_eh_fotografo then 'fotografo' else 'cliente' end,
             'situacao', case when v_eh_fotografo then 'confirmado' else 'aguardando_estudio' end
           ) order by a.ordem), '[]'::jsonb)
      into v_itens
      from (
        select (e ->> 'adicional_id')::uuid as adicional_id,
               max(least(10, greatest(1, coalesce((e ->> 'quantidade')::integer, 1)))) as quantidade
        from jsonb_array_elements(p_adicionais) e
        where (e ->> 'adicional_id') ~ '^[0-9a-f-]{36}$'
        group by 1
      ) q
      join public.adicionais a on a.id = q.adicional_id and a.ativo
      left join public.adicionais_estudio ae on ae.adicional_id = a.id and ae.fotografo_id = v_fotografo
      where v_eh_fotografo or coalesce(ae.oferecer_ao_cliente, true);
  end if;

  -- O gatilho de aprovação (mesma transação) lê os adicionais daqui.
  perform set_config('seualbum.adicionais', v_itens::text, true);
  insert into public.aprovacoes (projeto_id, versao, usuario_id, status)
  values (p_projeto_id, p_versao, auth.uid(), 'aprovado');
  perform set_config('seualbum.adicionais', '', true);

  select status into v_status from public.projetos where id = p_projeto_id;
  return v_status::text;
end;
$$;

revoke execute on function public.aprovar_prova(uuid, integer, jsonb) from public, anon;
grant execute on function public.aprovar_prova(uuid, integer, jsonb) to authenticated;

create or replace function public.aplicar_aprovacao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quem      text;
  v_status    public.project_status;
  v_ultima    integer;
  v_versao_id uuid;
  v_fatura    uuid;
  v_adicionais jsonb;
  v_n_adic    integer;
  v_aguardando integer;
  v_exc       integer;
  e           record;
begin
  select status into v_status from public.projetos where id = new.projeto_id for update;
  if v_status is distinct from 'aguardando_aprovacao_cliente' then
    raise exception 'A prova não está aguardando aprovação no momento.' using errcode = 'P0001';
  end if;

  v_quem := case
    when exists (select 1 from public.projetos p where p.id = new.projeto_id and p.fotografo_id = new.usuario_id)
      then 'Fotógrafo'
    else 'Cliente'
  end;

  if new.status <> 'aprovado' then
    update public.projetos set status = 'alteracoes_solicitadas' where id = new.projeto_id;
    insert into public.projeto_atividades (projeto_id, autor_id, mensagem)
    values (new.projeto_id, new.usuario_id, v_quem || ' solicitou alterações na versão ' || new.versao);
    return new;
  end if;

  select max(numero) into v_ultima from public.design_versions where projeto_id = new.projeto_id and status = 'aprovada';
  if v_ultima is not null and new.versao <> v_ultima then
    raise exception 'Aprove a versão mais recente (versão %).', v_ultima using errcode = 'P0001';
  end if;

  -- Adicionais validados por `aprovar_prova` (vazio numa aprovação direta).
  v_adicionais := coalesce(nullif(current_setting('seualbum.adicionais', true), '')::jsonb, '[]'::jsonb);
  v_n_adic := jsonb_array_length(v_adicionais);

  select * into e from public._excedente_da_versao(new.projeto_id, new.versao);
  -- FOUND muda a cada comando: guarda o excedente agora.
  v_exc := case when found then coalesce(e.excedente, 0) else 0 end;

  if v_exc > 0 or v_n_adic > 0 then
    select id into v_versao_id from public.design_versions where projeto_id = new.projeto_id and numero = new.versao;

    insert into public.faturas (projeto_id, design_version_id, valor_total, itens_json, tipo, laminas_versao, laminas_inclusas)
    values (new.projeto_id, v_versao_id, 0, '[]'::jsonb, 'fechamento', e.laminas, e.inclusas)
    on conflict (projeto_id) where status_pagamento = 'pendente' do nothing
    returning id into v_fatura;
    if v_fatura is null then
      select id into v_fatura from public.faturas where projeto_id = new.projeto_id and status_pagamento = 'pendente';
    end if;

    if v_exc > 0 then
      insert into public.fatura_itens (fatura_id, tipo, descricao, quantidade, valor_unitario, origem, situacao)
      values (v_fatura, 'laminas_extras', 'Lâminas extras', e.excedente, e.preco, 'sistema', 'confirmado');
    end if;

    insert into public.fatura_itens (fatura_id, tipo, adicional_id, descricao, quantidade, valor_unitario,
                                     preco_revenda_unitario, origem, situacao)
    select v_fatura, 'adicional', (i ->> 'adicional_id')::uuid, i ->> 'descricao', (i ->> 'quantidade')::integer,
           (i ->> 'custo')::numeric, (i ->> 'revenda')::numeric, i ->> 'origem', i ->> 'situacao'
    from jsonb_array_elements(v_adicionais) i;

    select count(*) into v_aguardando from public.fatura_itens where fatura_id = v_fatura and situacao = 'aguardando_estudio';

    update public.projetos set status = 'aprovado_aguardando_pagamento' where id = new.projeto_id;
    insert into public.projeto_atividades (projeto_id, autor_id, mensagem)
    values (
      new.projeto_id, new.usuario_id,
      v_quem || ' aprovou a versão ' || new.versao
        || case when v_exc > 0
             then format(' — %s lâminas (plano cobre %s): %s %s', e.laminas, e.inclusas, e.excedente,
                         case when e.excedente = 1 then 'lâmina extra' else 'lâminas extras' end)
             else '' end
        || case when v_n_adic > 0
             then format(' — %s %s', v_n_adic, case when v_n_adic = 1 then 'adicional escolhido' else 'adicionais escolhidos' end)
                  || case when v_aguardando > 0 then ' (aguardando o estúdio confirmar)' else '' end
             else '' end
        || '. Aguardando o fechamento do estúdio.'
    );
  else
    update public.projetos set status = 'aprovado' where id = new.projeto_id;
    insert into public.projeto_atividades (projeto_id, autor_id, mensagem)
    values (new.projeto_id, new.usuario_id, v_quem || ' aprovou a versão ' || new.versao || ' — liberado para impressão.');
  end if;

  return new;
end;
$$;
