-- =============================================================================
-- Migration 0023: Fase 5 — fechamento da aprovação e cobrança de lâminas extras
--
-- Regra de negócio:
--   * A unidade é a LÂMINA (1 lâmina = 2 páginas). A capa não conta.
--   * Cada plano tem uma franquia (`laminas_inclusas`) e um preço por lâmina
--     extra. Os dois são CONGELADOS no pedido (orders) no momento em que ele é
--     criado e copiados para o projeto — mudar o plano depois não afeta.
--   * Quem paga é sempre o FOTÓGRAFO (white label): o cliente final nunca vê
--     valor nem fatura.
--   * Ao aprovar (cliente ou fotógrafo), o BANCO conta as lâminas da versão
--     aprovada e decide: sem excedente → `aprovado` ("Aprovado para
--     impressão"); com excedente → fatura + `aprovado_aguardando_pagamento`.
--
-- Fecha a brecha da 0008: antes qualquer fotógrafo/cliente podia criar fatura
-- (com o valor que quisesse) e "pagar e aprovar" por uma função aberta. Agora
-- faturas só nascem aqui dentro, e o status do projeto só é mexido pela
-- produção ou pelas funções deste arquivo.
--
-- Pagamento: `pagar_fatura_simulada` enquanto o Stripe estiver congelado
-- (liga/desliga em private.app_config 'pagamento_simulado'); o webhook real
-- usará `confirmar_pagamento_fatura` (só service_role). Cortesia:
-- `dispensar_fatura` (admin/gestor).
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Franquia de lâminas por plano
-- -----------------------------------------------------------------------------

alter table public.planos
  add column if not exists laminas_inclusas   integer check (laminas_inclusas is null or laminas_inclusas >= 0),
  add column if not exists preco_lamina_extra numeric(10, 2) check (preco_lamina_extra is null or preco_lamina_extra >= 0);

-- Valores da diretoria (Fase 5). Avulsos por nível; assinatura: 25 lâminas, R$ 9.
update public.planos set laminas_inclusas = 15, preco_lamina_extra = 12 where slug = 'essencial-avulso';
update public.planos set laminas_inclusas = 20, preco_lamina_extra = 12 where slug = 'plus-avulso';
update public.planos set laminas_inclusas = 30, preco_lamina_extra = 12 where slug = 'studio-avulso';
update public.planos set laminas_inclusas = 25, preco_lamina_extra = 9  where tipo_cobranca = 'assinatura';

-- -----------------------------------------------------------------------------
-- 2. Congelamento no pedido e no projeto
-- -----------------------------------------------------------------------------

alter table public.orders
  add column if not exists laminas_inclusas   integer,
  add column if not exists preco_lamina_extra numeric(10, 2);

alter table public.projetos
  add column if not exists laminas_inclusas   integer check (laminas_inclusas is null or laminas_inclusas >= 0),
  add column if not exists preco_lamina_extra numeric(10, 2) check (preco_lamina_extra is null or preco_lamina_extra >= 0);

-- Pedido: a franquia vem SEMPRE do plano (o navegador não escolhe). Trocar de
-- plano recalcula; fora isso, o valor congelado não muda.
create or replace function public.fixar_franquia_pedido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' or new.plan_id is distinct from old.plan_id then
    select pl.laminas_inclusas, pl.preco_lamina_extra
      into new.laminas_inclusas, new.preco_lamina_extra
      from public.planos pl where pl.id = new.plan_id;
    if new.plan_id is null then
      new.laminas_inclusas := null;
      new.preco_lamina_extra := null;
    end if;
  elsif not public.is_gestor_ou_admin() and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and auth.uid() is not null then
    new.laminas_inclusas := old.laminas_inclusas;
    new.preco_lamina_extra := old.preco_lamina_extra;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fixar_franquia_pedido on public.orders;
create trigger trg_fixar_franquia_pedido
  before insert or update on public.orders
  for each row execute function public.fixar_franquia_pedido();

-- Projeto criado direto (admin, sem pedido): franquia do plano escolhido.
-- Quem não é gestão não escolhe a própria franquia.
create or replace function public.franquia_do_projeto()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.plano_id is not null and (
       new.laminas_inclusas is null
    or (auth.uid() is not null and not public.is_gestor_ou_admin())
  ) then
    select pl.laminas_inclusas, pl.preco_lamina_extra
      into new.laminas_inclusas, new.preco_lamina_extra
      from public.planos pl where pl.id = new.plano_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_franquia_do_projeto on public.projetos;
create trigger trg_franquia_do_projeto
  before insert on public.projetos
  for each row execute function public.franquia_do_projeto();

-- Pedido virou projeto (converter_pedido_em_projeto grava orders.projeto_id):
-- o projeto herda o valor congelado NO PEDIDO, não o preço do dia.
create or replace function public.projeto_herda_franquia_do_pedido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.projeto_id is not null and old.projeto_id is null then
    update public.projetos
      set laminas_inclusas = new.laminas_inclusas, preco_lamina_extra = new.preco_lamina_extra
      where id = new.projeto_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_projeto_herda_franquia on public.orders;
create trigger trg_projeto_herda_franquia
  after update of projeto_id on public.orders
  for each row execute function public.projeto_herda_franquia_do_pedido();

-- Retroativo: pedidos e projetos existentes com o valor do plano de hoje.
update public.orders o
  set laminas_inclusas = pl.laminas_inclusas, preco_lamina_extra = pl.preco_lamina_extra
  from public.planos pl
  where pl.id = o.plan_id and o.laminas_inclusas is null;

update public.projetos pr
  set laminas_inclusas = o.laminas_inclusas, preco_lamina_extra = o.preco_lamina_extra
  from public.orders o
  where o.projeto_id = pr.id and pr.laminas_inclusas is null and o.laminas_inclusas is not null;

update public.projetos pr
  set laminas_inclusas = pl.laminas_inclusas, preco_lamina_extra = pl.preco_lamina_extra
  from public.planos pl
  where pl.id = pr.plano_id and pr.laminas_inclusas is null;

-- -----------------------------------------------------------------------------
-- 3. Capa não conta: a equipe marca qual lâmina é a capa (no máximo uma)
-- -----------------------------------------------------------------------------

alter table public.versoes_laminas
  add column if not exists eh_capa boolean not null default false;

create unique index if not exists idx_versoes_laminas_uma_capa
  on public.versoes_laminas (versao_id) where eh_capa;

-- -----------------------------------------------------------------------------
-- 4. Status e franquia do projeto: só a produção e as funções do banco mexem
-- -----------------------------------------------------------------------------
-- A policy de UPDATE deixa o fotógrafo dono atualizar o projeto (dados do
-- evento/briefing). Sem esta guarda, ele podia se dar `status = 'aprovado'`
-- e pular a cobrança. Funções SECURITY DEFINER (aprovação, pagamento,
-- cortesia) rodam como dono da tabela e passam direto.

create or replace function public.guardar_campos_projeto()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if (new.laminas_inclusas is distinct from old.laminas_inclusas
      or new.preco_lamina_extra is distinct from old.preco_lamina_extra)
     and not public.is_gestor_ou_admin() then
    raise exception 'Só a gestão altera a franquia de lâminas do projeto.' using errcode = '42501';
  end if;

  if not public.is_equipe() and (
       new.status         is distinct from old.status
    or new.plano_id       is distinct from old.plano_id
    or new.responsavel_id is distinct from old.responsavel_id
    or new.fotografo_id   is distinct from old.fotografo_id
    or new.cliente_id     is distinct from old.cliente_id
  ) then
    raise exception 'Status e responsáveis do projeto são controlados pela produção.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'aprovado_aguardando_pagamento' or old.status = 'aprovado_aguardando_pagamento' then
      raise exception 'Este projeto está com lâminas extras a pagar: libere pelo pagamento ou pela cortesia.' using errcode = '42501';
    end if;
    if new.status = 'aprovado' and not public.is_gestor_ou_admin() then
      raise exception 'Só a gestão marca um projeto como aprovado para impressão.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guardar_campos_projeto on public.projetos;
create trigger trg_guardar_campos_projeto
  before update on public.projetos
  for each row execute function public.guardar_campos_projeto();

-- -----------------------------------------------------------------------------
-- 5. Faturas: só o banco cria; só fotógrafo dono e operação enxergam
-- -----------------------------------------------------------------------------

alter table public.faturas
  add column if not exists tipo              text not null default 'paginas_extras',
  add column if not exists laminas_versao    integer,
  add column if not exists laminas_inclusas  integer,
  add column if not exists dispensada_motivo text,
  add column if not exists dispensada_por    uuid references public.profiles (id) on delete set null,
  add column if not exists dispensada_em     timestamptz;

do $$ begin
  alter table public.faturas
    add constraint faturas_tipo_check check (tipo in ('paginas_extras', 'laminas_extras'));
exception when duplicate_object then null; end $$;

-- Uma cobrança em aberto por projeto (aprovar duas vezes não gera duas).
create unique index if not exists idx_faturas_uma_pendente_por_projeto
  on public.faturas (projeto_id) where status_pagamento = 'pendente';

drop policy if exists "faturas_insert_scope" on public.faturas;
drop policy if exists "faturas_update_equipe" on public.faturas;
drop policy if exists "faturas_select_scope" on public.faturas;
create policy "faturas_select_scope" on public.faturas for select to authenticated
  using (
    public.is_operacao()
    or exists (select 1 from public.projetos p where p.id = faturas.projeto_id and p.fotografo_id = auth.uid())
  );

-- A função antiga cobrava o CLIENTE e aprovava — e aceitava fatura criada
-- pelo próprio pagante. Sai de cena.
drop function if exists public.pagar_fatura_e_aprovar(uuid, public.forma_pagamento);

-- -----------------------------------------------------------------------------
-- 6. Cálculo do excedente (uma fonte só: aprovação, prévia e cobrança)
-- -----------------------------------------------------------------------------

create or replace function public._excedente_da_versao(p_projeto_id uuid, p_versao integer default null)
returns table (
  versao     integer,
  laminas    integer,
  tem_capa   boolean,
  inclusas   integer,
  excedente  integer,
  preco      numeric,
  valor      numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with v as (
    select dv.id, dv.numero
    from public.design_versions dv
    where dv.projeto_id = p_projeto_id
      and dv.status = 'aprovada'
      and (p_versao is null or dv.numero = p_versao)
    order by dv.numero desc
    limit 1
  ),
  l as (
    select count(*) filter (where not vl.eh_capa)::integer as n, coalesce(bool_or(vl.eh_capa), false) as capa
    from public.versoes_laminas vl
    join v on v.id = vl.versao_id
  )
  select
    v.numero,
    l.n,
    l.capa,
    pr.laminas_inclusas,
    case when pr.laminas_inclusas is null then 0 else greatest(0, l.n - pr.laminas_inclusas) end,
    coalesce(pr.preco_lamina_extra, 0),
    (case when pr.laminas_inclusas is null then 0 else greatest(0, l.n - pr.laminas_inclusas) end)
      * coalesce(pr.preco_lamina_extra, 0)
  from public.projetos pr
  cross join v
  cross join l
  where pr.id = p_projeto_id;
$$;

revoke execute on function public._excedente_da_versao(uuid, integer) from public, anon, authenticated;

-- Prévia para a tela (antes do clique em "Aprovar"): só o fotógrafo dono e a
-- operação. O cliente final não vê valores (white label).
create or replace function public.calcular_excedente(p_projeto_id uuid)
returns table (
  versao     integer,
  laminas    integer,
  tem_capa   boolean,
  inclusas   integer,
  excedente  integer,
  preco      numeric,
  valor      numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (
    public.is_operacao()
    or exists (select 1 from public.projetos p where p.id = p_projeto_id and p.fotografo_id = auth.uid())
  ) then
    raise exception 'Sem acesso à cobrança deste projeto.' using errcode = '42501';
  end if;
  return query select * from public._excedente_da_versao(p_projeto_id, null);
end;
$$;

revoke execute on function public.calcular_excedente(uuid) from public, anon;
grant execute on function public.calcular_excedente(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Bater o martelo: a aprovação decide entre impressão e cobrança
-- -----------------------------------------------------------------------------

create or replace function public.aplicar_aprovacao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quem   text;
  v_status public.project_status;
  v_ultima integer;
  v_versao_id uuid;
  e        record;
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

  select * into e from public._excedente_da_versao(new.projeto_id, new.versao);

  if found and e.excedente > 0 then
    select id into v_versao_id from public.design_versions where projeto_id = new.projeto_id and numero = new.versao;

    insert into public.faturas (
      projeto_id, design_version_id, valor_total, itens_json, tipo, laminas_versao, laminas_inclusas
    )
    values (
      new.projeto_id, v_versao_id, e.valor,
      jsonb_build_array(jsonb_build_object(
        'descricao', 'Lâminas extras', 'quantidade', e.excedente, 'valorUnitario', e.preco, 'valorTotal', e.valor
      )),
      'laminas_extras', e.laminas, e.inclusas
    )
    on conflict (projeto_id) where status_pagamento = 'pendente' do nothing;

    update public.projetos set status = 'aprovado_aguardando_pagamento' where id = new.projeto_id;
    insert into public.projeto_atividades (projeto_id, autor_id, mensagem)
    values (
      new.projeto_id, new.usuario_id,
      format('%s aprovou a versão %s — %s lâminas (plano cobre %s): %s %s aguardando pagamento do estúdio.',
        v_quem, new.versao, e.laminas, e.inclusas, e.excedente,
        case when e.excedente = 1 then 'lâmina extra' else 'lâminas extras' end)
    );
  else
    update public.projetos set status = 'aprovado' where id = new.projeto_id;
    insert into public.projeto_atividades (projeto_id, autor_id, mensagem)
    values (new.projeto_id, new.usuario_id, v_quem || ' aprovou a versão ' || new.versao || ' — liberado para impressão.');
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Liberação: pagamento (simulado ou real) e cortesia
-- -----------------------------------------------------------------------------

insert into private.app_config (key, value) values ('pagamento_simulado', 'true')
on conflict (key) do nothing;

create or replace function public._liberar_para_impressao(p_projeto_id uuid, p_autor uuid, p_mensagem text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.projetos set status = 'aprovado'
    where id = p_projeto_id and status = 'aprovado_aguardando_pagamento';
  if not found then
    raise exception 'O projeto não está aguardando o pagamento de lâminas extras.' using errcode = 'P0001';
  end if;
  insert into public.projeto_atividades (projeto_id, autor_id, mensagem) values (p_projeto_id, p_autor, p_mensagem);
end;
$$;

revoke execute on function public._liberar_para_impressao(uuid, uuid, text) from public, anon, authenticated;

-- Checkout simulado (Stripe congelado): o fotógrafo dono "paga" e libera.
create or replace function public.pagar_fatura_simulada(p_fatura_id uuid, p_forma public.forma_pagamento)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  f record;
begin
  if coalesce((select value from private.app_config where key = 'pagamento_simulado'), 'false') <> 'true' then
    raise exception 'Pagamento simulado desativado — use o checkout.' using errcode = '42501';
  end if;

  select fa.id, fa.projeto_id, fa.status_pagamento, fa.itens_json, p.fotografo_id
    into f
    from public.faturas fa join public.projetos p on p.id = fa.projeto_id
    where fa.id = p_fatura_id
    for update of fa;
  if not found or f.status_pagamento <> 'pendente' then
    raise exception 'Fatura não encontrada ou já processada.' using errcode = '42704';
  end if;
  if f.fotografo_id is distinct from auth.uid() then
    raise exception 'Só o estúdio dono do projeto paga esta fatura.' using errcode = '42501';
  end if;

  update public.faturas set status_pagamento = 'pago', forma_pagamento = p_forma, pago_em = now() where id = p_fatura_id;
  perform public._liberar_para_impressao(
    f.projeto_id, auth.uid(),
    format('Pagamento de %s lâmina(s) extra(s) confirmado (%s, simulado) — liberado para impressão.',
      f.itens_json -> 0 ->> 'quantidade', case p_forma when 'pix' then 'Pix' else 'cartão' end)
  );
end;
$$;

revoke execute on function public.pagar_fatura_simulada(uuid, public.forma_pagamento) from public, anon;
grant execute on function public.pagar_fatura_simulada(uuid, public.forma_pagamento) to authenticated;

-- Webhook real do Stripe (quando descongelar): só a service role confirma.
create or replace function public.confirmar_pagamento_fatura(p_fatura_id uuid, p_forma public.forma_pagamento)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  f record;
begin
  select fa.id, fa.projeto_id, fa.status_pagamento, fa.itens_json into f
    from public.faturas fa where fa.id = p_fatura_id for update;
  if not found then
    raise exception 'Fatura não encontrada.' using errcode = '42704';
  end if;
  if f.status_pagamento = 'pago' then
    return; -- webhook repetido: nada a fazer
  end if;
  if f.status_pagamento <> 'pendente' then
    raise exception 'Fatura já encerrada (%).', f.status_pagamento using errcode = 'P0001';
  end if;

  update public.faturas set status_pagamento = 'pago', forma_pagamento = p_forma, pago_em = now() where id = p_fatura_id;
  perform public._liberar_para_impressao(
    f.projeto_id, null,
    format('Pagamento de %s lâmina(s) extra(s) confirmado — liberado para impressão.', f.itens_json -> 0 ->> 'quantidade')
  );
end;
$$;

revoke execute on function public.confirmar_pagamento_fatura(uuid, public.forma_pagamento) from public, anon, authenticated;
grant execute on function public.confirmar_pagamento_fatura(uuid, public.forma_pagamento) to service_role;

-- Cortesia: a gestão dispensa a cobrança e libera para impressão.
create or replace function public.dispensar_fatura(p_fatura_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  f      record;
  v_nome text;
begin
  if not public.is_gestor_ou_admin() then
    raise exception 'Só a gestão pode dispensar a cobrança.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe o motivo da cortesia.' using errcode = '22023';
  end if;

  select fa.id, fa.projeto_id, fa.status_pagamento, fa.itens_json into f
    from public.faturas fa where fa.id = p_fatura_id for update;
  if not found or f.status_pagamento <> 'pendente' then
    raise exception 'Fatura não encontrada ou já processada.' using errcode = '42704';
  end if;

  update public.faturas
    set status_pagamento = 'dispensada', dispensada_motivo = left(trim(p_motivo), 500),
        dispensada_por = auth.uid(), dispensada_em = now()
    where id = p_fatura_id;

  select nome_completo into v_nome from public.profiles where id = auth.uid();
  perform public._liberar_para_impressao(
    f.projeto_id, auth.uid(),
    format('Cobrança de %s lâmina(s) extra(s) dispensada por %s (cortesia): "%s" — liberado para impressão.',
      f.itens_json -> 0 ->> 'quantidade', coalesce(v_nome, 'gestão'), left(trim(p_motivo), 500))
  );
end;
$$;

revoke execute on function public.dispensar_fatura(uuid, text) from public, anon;
grant execute on function public.dispensar_fatura(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 9. Caixa de saída: o aviso da cobrança vai só para o fotógrafo
-- -----------------------------------------------------------------------------

create or replace function public.registrar_comunicacao_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cliente   record;
  v_fotografo text;
  v_versao    integer;
  v_fatura    record;
  v_tipo      text;
  v_assunto   text;
  v_corpo     text;
  v_rodape    text := '<p style="color:#595959;font-size:12px">Este é um e-mail simulado — nenhuma mensagem real foi enviada (infraestrutura de e-mail ainda não conectada).</p>';
begin
  if new.status = old.status then
    return new;
  end if;

  v_tipo := case new.status
    when 'aguardando_fotos' then 'aguardando_fotos'
    when 'aguardando_aprovacao_cliente' then 'prova_pronta'
    when 'aprovado_aguardando_pagamento' then 'excedente_pendente'
    when 'aprovado' then 'aprovado'
    when 'enviado' then 'enviado'
    when 'finalizado' then 'finalizado'
    else null
  end;

  if v_tipo is null then
    return new;
  end if;

  if v_tipo = 'prova_pronta' then
    select max(numero) into v_versao
    from public.design_versions
    where projeto_id = new.id and status = 'aprovada';
    if coalesce(v_versao, 1) > 1 then
      v_tipo := 'nova_versao';
    end if;
  end if;

  if new.fotografo_id is not null then
    select coalesce(nullif(trim(f.estudio), ''), pr.nome_completo) into v_fotografo
    from public.profiles pr left join public.fotografos f on f.id = pr.id
    where pr.id = new.fotografo_id;
  end if;

  -- Cobrança de lâminas extras: assunto do estúdio. O cliente final não recebe
  -- nada agora — o aviso "aprovado, a caminho da gráfica" sai quando liberar.
  if v_tipo = 'excedente_pendente' then
    select fa.valor_total, fa.itens_json -> 0 ->> 'quantidade' as qtd, fa.laminas_versao, fa.laminas_inclusas
      into v_fatura
      from public.faturas fa where fa.projeto_id = new.id and fa.status_pagamento = 'pendente'
      order by fa.created_at desc limit 1;

    insert into public.comunicacoes_log (projeto_id, cliente_id, tipo_evento, assunto, corpo_html, status, destinatario)
    values (
      new.id, new.cliente_id, v_tipo,
      'Álbum aprovado — lâminas extras aguardando pagamento — ' || new.nome,
      '<div style="font-family:sans-serif;color:#171717;line-height:1.5">'
        || '<p>Olá, ' || coalesce(v_fotografo, 'estúdio') || '!</p>'
        || '<p>O álbum <strong>' || new.nome || '</strong> foi aprovado com ' || coalesce(v_fatura.laminas_versao::text, '?')
        || ' lâminas — o plano cobre ' || coalesce(v_fatura.laminas_inclusas::text, '?') || '. '
        || 'Há <strong>' || coalesce(v_fatura.qtd, '?') || ' lâmina(s) extra(s)</strong>, no total de <strong>R$ '
        || coalesce(replace(to_char(v_fatura.valor_total, 'FM999990.00'), '.', ','), '?') || '</strong>. '
        || 'Assim que o pagamento for confirmado no seu painel, em Meus álbuns, o arquivo segue para a gráfica.</p>'
        || v_rodape || '</div>',
      'simulado', 'fotografo'
    );
    return new;
  end if;

  select c.nome, c.email into v_cliente from public.clientes c where c.id = new.cliente_id;

  v_assunto := case v_tipo
    when 'aguardando_fotos' then 'Estamos esperando as fotos do seu evento — ' || new.nome
    when 'prova_pronta' then 'Sua prova digital está pronta! — ' || new.nome
    when 'nova_versao' then 'Nova versão disponível para aprovação — ' || new.nome || ' (versão ' || v_versao || ')'
    when 'aprovado' then 'Álbum aprovado — a caminho da gráfica! — ' || new.nome
    when 'enviado' then 'Seu álbum está a caminho! — ' || new.nome
    when 'finalizado' then 'Seu álbum foi finalizado! — ' || new.nome
  end;

  v_corpo := '<div style="font-family:sans-serif;color:#171717;line-height:1.5">'
    || '<p>Olá, ' || coalesce(v_cliente.nome, 'cliente') || '!</p>'
    || '<p>' || (case v_tipo
        when 'aguardando_fotos' then 'Recebemos seu pedido para o projeto <strong>' || new.nome || '</strong> e estamos aguardando o envio das fotos para começar a diagramação.'
        when 'prova_pronta' then 'A prova digital do seu álbum <strong>' || new.nome || '</strong> já está pronta. Acesse o portal para revisar e aprovar quando quiser.'
        when 'nova_versao' then 'Aplicamos os ajustes que você pediu. A versão ' || v_versao || ' do álbum <strong>' || new.nome || '</strong> já está disponível para aprovação no portal.'
        when 'aprovado' then 'Seu álbum <strong>' || new.nome || '</strong> foi aprovado e já seguiu para a produção gráfica. Em breve você recebe novidades sobre a entrega.'
        when 'enviado' then 'Seu álbum <strong>' || new.nome || '</strong> foi despachado!' ||
          case when new.codigo_rastreio is not null then ' Código de rastreio: <strong>' || new.codigo_rastreio || '</strong>.' else '' end
        when 'finalizado' then 'Seu álbum <strong>' || new.nome || '</strong> foi finalizado. Obrigado por confiar no nosso trabalho!'
      end) || '</p>'
    || v_rodape
    || '</div>';

  insert into public.comunicacoes_log (projeto_id, cliente_id, tipo_evento, assunto, corpo_html, status, destinatario)
  values (new.id, new.cliente_id, v_tipo, v_assunto, v_corpo, 'simulado', 'cliente');

  if v_tipo in ('prova_pronta', 'nova_versao') and new.fotografo_id is not null then
    insert into public.comunicacoes_log (projeto_id, cliente_id, tipo_evento, assunto, corpo_html, status, destinatario)
    values (
      new.id, new.cliente_id, v_tipo,
      case v_tipo
        when 'nova_versao' then 'Nova versão disponível para aprovação — ' || new.nome || ' (versão ' || v_versao || ')'
        else 'Prova digital pronta para revisão — ' || new.nome
      end,
      '<div style="font-family:sans-serif;color:#171717;line-height:1.5">'
        || '<p>Olá, ' || coalesce(v_fotografo, 'estúdio') || '!</p>'
        || '<p>' || (case v_tipo
            when 'nova_versao' then 'A equipe aplicou os ajustes da versão anterior. A versão ' || v_versao || ' do álbum <strong>' || new.nome || '</strong> está disponível para aprovação no seu painel, em Meus álbuns.'
            else 'A prova digital do álbum <strong>' || new.nome || '</strong> está pronta. Revise, marque os pontos de ajuste e aprove pelo seu painel, em Meus álbuns.'
          end) || '</p>'
        || v_rodape
        || '</div>',
      'simulado', 'fotografo'
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.registrar_comunicacao_status() from public, anon, authenticated;
