-- =============================================================================
-- Migration 0038: controle do diagramador no admin principal
--
-- O dashboard (/admin) ganha a seção "Diagramação" e o admin ganha o centro de
-- controle /admin/diagramacao: todos os álbuns em diagramação (projetos da
-- esteira e álbuns avulsos do editor), com responsável, prazo, prioridade,
-- versão da prova, apontamentos abertos e última atividade.
--
--   1. `projetos` ganha `prioridade` e "em espera" (`em_espera`, motivo e
--      desde quando). O prazo da diagramação continua sendo
--      `data_limite_producao` (0007) e o responsável `responsavel_id` (0002).
--   2. `album_layouts` (avulsos) ganha o mesmo controle: `responsavel_id`,
--      `prazo`, `prioridade` e "em espera" — antes o avulso não tinha dono.
--   3. Só admin/gestor mexem nesses campos (trigger): a policy de UPDATE de
--      `projetos`/`album_layouts` é aberta à equipe (inclui o designer), então
--      a trava fica no banco, não só na tela. O service_role passa livre.
--   4. `album_templates.ativo`: a gestão desativa um template sem apagá-lo
--      (some do editor, volta quando reativado).
--   5. View `diagramacao_itens` (security_invoker: vale a RLS de quem lê, e só
--      a equipe enxerga linhas) e RPC `diagramacao_resumo()` com os KPIs, a
--      carga por diagramador e os itens mais urgentes — agregados no banco,
--      numa ida só.
--
-- Idempotente: pode ser reexecutada com segurança. NÃO aplicada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Projetos: prioridade e "em espera"
-- -----------------------------------------------------------------------------

alter table public.projetos
  add column if not exists prioridade       text not null default 'normal',
  add column if not exists em_espera        boolean not null default false,
  add column if not exists em_espera_motivo text,
  add column if not exists em_espera_desde  timestamptz;

do $$ begin
  alter table public.projetos
    add constraint projetos_prioridade_check check (prioridade in ('baixa', 'normal', 'alta', 'urgente'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.projetos
    add constraint projetos_em_espera_motivo_check check (em_espera_motivo is null or char_length(em_espera_motivo) <= 300);
exception when duplicate_object then null; end $$;

comment on column public.projetos.prioridade is 'Prioridade na fila de diagramação (0038): baixa, normal, alta ou urgente. Só admin/gestor.';
comment on column public.projetos.em_espera is 'Diagramação pausada pela gestão (0038): não conta como atrasada enquanto estiver em espera.';

-- -----------------------------------------------------------------------------
-- 2. Álbuns avulsos: responsável, prazo, prioridade e "em espera"
-- -----------------------------------------------------------------------------

alter table public.album_layouts
  add column if not exists responsavel_id   uuid references public.profiles (id) on delete set null,
  add column if not exists prazo            timestamptz,
  add column if not exists prioridade       text not null default 'normal',
  add column if not exists em_espera        boolean not null default false,
  add column if not exists em_espera_motivo text,
  add column if not exists em_espera_desde  timestamptz;

do $$ begin
  alter table public.album_layouts
    add constraint album_layouts_prioridade_check check (prioridade in ('baixa', 'normal', 'alta', 'urgente'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.album_layouts
    add constraint album_layouts_em_espera_motivo_check check (em_espera_motivo is null or char_length(em_espera_motivo) <= 300);
exception when duplicate_object then null; end $$;

create index if not exists idx_album_layouts_responsavel on public.album_layouts (responsavel_id) where responsavel_id is not null;

-- -----------------------------------------------------------------------------
-- 3. Trava: só admin/gestor atribuem, priorizam, mudam prazo do avulso e pausam
-- -----------------------------------------------------------------------------

create or replace function public.guardar_controle_diagramacao()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_mudou boolean;
begin
  v_mudou := new.prioridade is distinct from old.prioridade
          or new.em_espera is distinct from old.em_espera
          or new.em_espera_motivo is distinct from old.em_espera_motivo
          or new.em_espera_desde is distinct from old.em_espera_desde;

  -- No avulso, responsável e prazo também são colunas novas desta migration.
  -- Em `projetos`, `responsavel_id`/`data_limite_producao` seguem como antes.
  if tg_table_name = 'album_layouts' then
    v_mudou := v_mudou
            or new.responsavel_id is distinct from old.responsavel_id
            or new.prazo is distinct from old.prazo;
  end if;

  if v_mudou
     and auth.uid() is not null
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and not public.is_gestor_ou_admin() then
    raise exception 'Só admin ou gestor atribuem, priorizam ou pausam a diagramação.' using errcode = '42501';
  end if;

  -- O "desde quando" é carimbado pelo banco; retomar limpa motivo e data.
  if new.em_espera and not old.em_espera then
    new.em_espera_desde := now();
  elsif not new.em_espera then
    new.em_espera_desde := null;
    new.em_espera_motivo := null;
  else
    new.em_espera_desde := old.em_espera_desde;
  end if;

  return new;
end;
$$;

revoke execute on function public.guardar_controle_diagramacao() from public, anon, authenticated;

drop trigger if exists trg_projetos_controle_diagramacao on public.projetos;
create trigger trg_projetos_controle_diagramacao
  before update on public.projetos
  for each row execute function public.guardar_controle_diagramacao();

drop trigger if exists trg_album_layouts_controle_diagramacao on public.album_layouts;
create trigger trg_album_layouts_controle_diagramacao
  before update on public.album_layouts
  for each row execute function public.guardar_controle_diagramacao();

-- -----------------------------------------------------------------------------
-- 4. Templates: desativar sem apagar
-- -----------------------------------------------------------------------------

alter table public.album_templates
  add column if not exists ativo boolean not null default true;

-- -----------------------------------------------------------------------------
-- 5. View do centro de controle
--
-- Uma linha por álbum em diagramação:
--   * projetos de fotos_recebidas até aprovado (o mesmo recorte da fila de
--     design, mais os aprovados);
--   * álbuns avulsos não arquivados, de rascunho até aprovado.
-- Aprovados só entram nos últimos 30 dias (o KPI "aprovados" é do mês).
--
-- `etapa` normaliza os dois mundos: a_diagramar, em_diagramacao,
-- revisao_interna, aguardando_cliente, alteracoes, aprovado.
-- `atrasado` = prazo da diagramação vencido numa etapa que depende da equipe
-- (e fora de espera). `cliente_atrasado` = prova parada com o cliente além do
-- prazo de aprovação (0007) — não pesa na carga do diagramador.
-- -----------------------------------------------------------------------------

drop view if exists public.diagramacao_itens;
create view public.diagramacao_itens
with (security_invoker = true)
as
with projeto as (
  select
    'projeto'::text                         as tipo,
    p.id                                    as id,
    p.id                                    as projeto_id,
    l.id                                    as layout_id,
    p.numero                                as numero,
    p.nome                                  as nome,
    p.status::text                          as status,
    case
      when p.status in ('fotos_recebidas', 'pronto_para_diagramacao') then 'a_diagramar'
      when p.status = 'em_diagramacao' then 'em_diagramacao'
      when p.status = 'em_revisao_interna' then 'revisao_interna'
      when p.status = 'aguardando_aprovacao_cliente' then 'aguardando_cliente'
      when p.status in ('alteracoes_solicitadas', 'em_ajustes') then 'alteracoes'
      else 'aprovado'
    end                                     as etapa,
    p.responsavel_id                        as responsavel_id,
    p.fotografo_id                          as fotografo_id,
    f.estudio                               as estudio,
    null::text                              as cliente_nome,
    p.data_limite_producao                  as prazo,
    p.data_limite_aprovacao                 as prazo_cliente,
    p.prioridade                            as prioridade,
    p.em_espera                             as em_espera,
    p.em_espera_motivo                      as em_espera_motivo,
    p.em_espera_desde                       as em_espera_desde,
    v.numero                                as versao_atual,
    v.status::text                          as versao_status,
    coalesce(c.abertos, 0)::integer         as apontamentos_abertos,
    null::text                              as aprovacao_token,
    null::text                              as aprovacao_status,
    ap.aprovado_em                          as aprovado_em,
    greatest(p.updated_at, l.updated_at, a.ultima, v.created_at, c.ultimo) as ultima_atividade,
    p.created_at                            as created_at
  from public.projetos p
  left join public.fotografos f on f.id = p.fotografo_id
  left join public.album_layouts l on l.projeto_id = p.id
  left join lateral (
    select dv.numero, dv.status, dv.created_at
      from public.design_versions dv
     where dv.projeto_id = p.id
     order by dv.numero desc
     limit 1
  ) v on true
  -- Apontamentos abertos da última versão que o cliente viu (liberada = 'aprovada').
  left join lateral (
    select count(*) filter (
             where not pc.resolvido
               and pc.versao = (select max(d2.numero) from public.design_versions d2 where d2.projeto_id = p.id and d2.status = 'aprovada')
           ) as abertos,
           max(pc.created_at) as ultimo
      from public.prova_comentarios pc
     where pc.projeto_id = p.id
  ) c on true
  left join lateral (
    select max(pa.created_at) as ultima from public.projeto_atividades pa where pa.projeto_id = p.id
  ) a on true
  left join lateral (
    select max(ap.created_at) as aprovado_em from public.aprovacoes ap where ap.projeto_id = p.id and ap.status = 'aprovado'
  ) ap on true
  where p.status in (
    'fotos_recebidas', 'pronto_para_diagramacao', 'em_diagramacao', 'em_revisao_interna',
    'aguardando_aprovacao_cliente', 'alteracoes_solicitadas', 'em_ajustes',
    'aprovado_aguardando_pagamento', 'aprovado'
  )
),
avulso as (
  select
    'avulso'::text                          as tipo,
    l.id                                    as id,
    null::uuid                              as projeto_id,
    l.id                                    as layout_id,
    null::bigint                            as numero,
    l.nome                                  as nome,
    l.status                                as status,
    case l.status
      when 'rascunho' then 'a_diagramar'
      when 'em_edicao' then 'em_diagramacao'
      when 'enviado_aprovacao' then 'aguardando_cliente'
      when 'alteracoes_solicitadas' then 'alteracoes'
      when 'em_revisao' then 'alteracoes'
      else 'aprovado'
    end                                     as etapa,
    l.responsavel_id                        as responsavel_id,
    null::uuid                              as fotografo_id,
    null::text                              as estudio,
    l.cliente_nome                          as cliente_nome,
    l.prazo                                 as prazo,
    null::timestamptz                       as prazo_cliente,
    l.prioridade                            as prioridade,
    l.em_espera                             as em_espera,
    l.em_espera_motivo                      as em_espera_motivo,
    l.em_espera_desde                       as em_espera_desde,
    ap.numero                               as versao_atual,
    ap.status                               as versao_status,
    coalesce(c.abertos, 0)::integer         as apontamentos_abertos,
    ap.token                                as aprovacao_token,
    ap.status                               as aprovacao_status,
    case when ap.status = 'aprovado' then ap.decidido_em end as aprovado_em,
    greatest(l.updated_at, ap.created_at, ap.decidido_em, c.ultimo) as ultima_atividade,
    l.created_at                            as created_at
  from public.album_layouts l
  left join lateral (
    select a.id, a.numero, a.status, a.token, a.created_at, a.decidido_em
      from public.album_aprovacoes a
     where a.layout_id = l.id and a.status <> 'cancelado'
     order by a.numero desc
     limit 1
  ) ap on true
  left join lateral (
    select count(*) filter (where not ac.resolvido) as abertos, max(ac.created_at) as ultimo
      from public.album_aprovacao_comentarios ac
     where ac.aprovacao_id = ap.id
  ) c on true
  where l.projeto_id is null
    and not l.arquivado
    and l.status in ('rascunho', 'em_edicao', 'enviado_aprovacao', 'alteracoes_solicitadas', 'em_revisao', 'aprovado')
),
todos as (
  select * from projeto
  union all
  select * from avulso
)
select
  t.tipo,
  t.id,
  t.projeto_id,
  t.layout_id,
  t.numero,
  t.nome,
  t.status,
  t.etapa,
  t.responsavel_id,
  r.nome_completo as responsavel_nome,
  t.fotografo_id,
  t.estudio,
  t.cliente_nome,
  t.prazo,
  t.prazo_cliente,
  t.prioridade,
  t.em_espera,
  t.em_espera_motivo,
  t.em_espera_desde,
  t.versao_atual,
  t.versao_status,
  t.apontamentos_abertos,
  t.aprovacao_token,
  t.aprovacao_status,
  t.aprovado_em,
  t.ultima_atividade,
  t.created_at,
  (t.etapa in ('a_diagramar', 'em_diagramacao', 'revisao_interna', 'alteracoes')
    and not t.em_espera and t.prazo is not null and t.prazo < now())          as atrasado,
  (t.etapa = 'aguardando_cliente' and t.prazo_cliente is not null and t.prazo_cliente < now()) as cliente_atrasado
from todos t
left join public.profiles r on r.id = t.responsavel_id
where public.is_equipe()
  and (t.etapa <> 'aprovado' or coalesce(t.aprovado_em, t.ultima_atividade) >= now() - interval '30 days');

comment on view public.diagramacao_itens is 'Centro de controle da diagramação (0038): projetos e álbuns avulsos em diagramação. security_invoker — só a equipe vê linhas.';

revoke all on public.diagramacao_itens from public, anon;
grant select on public.diagramacao_itens to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. Resumo para o dashboard: KPIs, carga por diagramador e os mais urgentes
--
-- Tempo médio de entrega (90 dias): da entrada do álbum — ou do pedido de
-- ajustes da versão anterior — até cada versão enviada (projeto: nova
-- `design_versions`; avulso: novo link de aprovação), por responsável ATUAL.
-- -----------------------------------------------------------------------------

create or replace function public.diagramacao_resumo(p_urgentes integer default 6)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_resultado jsonb;
begin
  if not public.is_equipe() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;

  with itens as (
    select * from public.diagramacao_itens
  ),
  entregas as (
    select p.responsavel_id,
           greatest(0, extract(epoch from dv.created_at - coalesce(
             (select max(a.created_at) from public.aprovacoes a
               where a.projeto_id = dv.projeto_id and a.versao = dv.numero - 1 and a.status = 'alteracao_solicitada'),
             (select max(d2.created_at) from public.design_versions d2
               where d2.projeto_id = dv.projeto_id and d2.numero = dv.numero - 1),
             p.created_at
           ))) / 3600.0 as horas
      from public.design_versions dv
      join public.projetos p on p.id = dv.projeto_id
     where dv.created_at >= now() - interval '90 days'
       and p.responsavel_id is not null
    union all
    select l.responsavel_id,
           greatest(0, extract(epoch from ap.created_at - coalesce(
             (select max(a2.decidido_em) from public.album_aprovacoes a2
               where a2.layout_id = ap.layout_id and a2.numero = ap.numero - 1),
             l.created_at
           ))) / 3600.0 as horas
      from public.album_aprovacoes ap
      join public.album_layouts l on l.id = ap.layout_id
     where ap.created_at >= now() - interval '90 days'
       and l.projeto_id is null
       and l.responsavel_id is not null
  ),
  pessoas as (
    select pr.id, pr.nome_completo, pr.role::text as papel
      from public.profiles pr
     where (pr.role in ('designer', 'operador') and pr.status = 'ativo')
        or pr.id in (select i.responsavel_id from itens i where i.responsavel_id is not null and i.etapa <> 'aprovado')
  ),
  carga as (
    select pe.id,
           pe.nome_completo,
           pe.papel,
           count(i.id) filter (where i.etapa <> 'aprovado')                                              as atribuidos,
           count(i.id) filter (where i.etapa in ('em_diagramacao', 'revisao_interna', 'alteracoes'))      as em_andamento,
           count(i.id) filter (where i.etapa = 'a_diagramar')                                             as a_diagramar,
           count(i.id) filter (where i.etapa = 'aguardando_cliente')                                      as com_cliente,
           count(i.id) filter (where i.atrasado)                                                          as atrasados,
           count(i.id) filter (where i.em_espera and i.etapa <> 'aprovado')                               as em_espera,
           (select round(avg(e.horas)::numeric, 1) from entregas e where e.responsavel_id = pe.id)        as horas_medias,
           (select count(*) from entregas e where e.responsavel_id = pe.id)                               as entregas_90d
      from pessoas pe
      left join itens i on i.responsavel_id = pe.id
     group by pe.id, pe.nome_completo, pe.papel
  ),
  ordenados as (
    select i.*,
           row_number() over (
             order by i.atrasado desc,
                      i.cliente_atrasado desc,
                      case i.prioridade when 'urgente' then 3 when 'alta' then 2 when 'normal' then 1 else 0 end desc,
                      i.prazo asc nulls last,
                      i.created_at asc
           ) as ordem
      from itens i
     where i.etapa <> 'aprovado' and not i.em_espera
  ),
  urgentes as (
    select * from ordenados where ordem <= greatest(0, least(coalesce(p_urgentes, 6), 50))
  )
  select jsonb_build_object(
    'kpis', (
      select jsonb_build_object(
        'em_diagramacao',     count(*) filter (where etapa in ('a_diagramar', 'em_diagramacao', 'revisao_interna')),
        'a_diagramar',        count(*) filter (where etapa = 'a_diagramar'),
        'aguardando_cliente', count(*) filter (where etapa = 'aguardando_cliente'),
        'alteracoes',         count(*) filter (where etapa = 'alteracoes'),
        'aprovados_30d',      count(*) filter (where etapa = 'aprovado'),
        'atrasados',          count(*) filter (where atrasado),
        'cliente_atrasado',   count(*) filter (where cliente_atrasado),
        'sem_responsavel',    count(*) filter (where responsavel_id is null and etapa <> 'aprovado'),
        'em_espera',          count(*) filter (where em_espera and etapa <> 'aprovado')
      )
      from itens
    ),
    'designers', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.atrasados desc, c.atribuidos desc, c.nome_completo)
        from carga c
    ), '[]'::jsonb),
    'urgentes', coalesce((select jsonb_agg(to_jsonb(u) - 'ordem' order by u.ordem) from urgentes u), '[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke execute on function public.diagramacao_resumo(integer) from public, anon;
grant execute on function public.diagramacao_resumo(integer) to authenticated, service_role;
