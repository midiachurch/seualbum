-- =============================================================================
-- Migration 0024: CRM de retenção — alertas de fotógrafos parados
--
-- Duas regras, avaliadas uma vez por dia pelo pg_cron (09:00 de Brasília):
--   a) `sem_pedido_7d`: fotógrafo cadastrado há mais de 7 dias sem nenhum
--      pedido. Um alerta por fotógrafo (referência 'cadastro').
--   b) `assinante_sem_projeto_mes`: assinante ativo que chegou ao DIA 20 do
--      mês (horário de Brasília) sem enviar nenhum pedido no mês. Um alerta
--      por fotógrafo por mês (referência 'AAAA-MM').
--
-- Sem Edge Function por enquanto: a regra é SQL puro, sem HTTP nem segredo.
-- Quando conectarmos WhatsApp/e-mail, o disparo lê desta tabela.
--
-- Idempotente de ponta a ponta:
--   * unique (tipo, fotografo_id, referencia): rodar de novo não duplica, e um
--     alerta dispensado não "renasce" no dia seguinte;
--   * alerta aberto/contatado cuja condição sumiu (o fotógrafo fez um pedido)
--     é resolvido sozinho na rodada seguinte.
--
-- Acesso: só admin e gestor (dado comercial). Designer e operador não veem.
-- A gestão só muda o status pela função `marcar_alerta_crm` (sem UPDATE direto).
-- =============================================================================

create table if not exists public.notificacoes_crm (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('sem_pedido_7d', 'assinante_sem_projeto_mes')),
  fotografo_id  uuid not null references public.fotografos (id) on delete cascade,
  referencia    text not null,
  status        text not null default 'aberta' check (status in ('aberta', 'contatado', 'resolvida', 'dispensada')),
  dados         jsonb not null default '{}'::jsonb,
  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  resolvida_em  timestamptz,
  resolvida_por uuid references public.profiles (id) on delete set null,
  unique (tipo, fotografo_id, referencia)
);

create index if not exists idx_notificacoes_crm_abertas
  on public.notificacoes_crm (status, criada_em desc);

alter table public.notificacoes_crm enable row level security;
alter table public.notificacoes_crm force row level security;

drop policy if exists "notificacoes_crm_select_gestao" on public.notificacoes_crm;
create policy "notificacoes_crm_select_gestao" on public.notificacoes_crm for select to authenticated
  using (public.is_gestor_ou_admin());

-- -----------------------------------------------------------------------------
-- Detecção (roda no cron; a gestão também pode disparar pelo painel)
-- -----------------------------------------------------------------------------

create or replace function public.gerar_alertas_crm()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hoje        date := (now() at time zone 'America/Sao_Paulo')::date;
  v_mes         text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM');
  v_inicio_mes  timestamptz := date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  v_novos_a     integer := 0;
  v_novos_b     integer := 0;
  v_resolvidos  integer := 0;
  n             integer;
begin
  -- a) cadastrado há mais de 7 dias, nenhum pedido (nem cancelado conta como "tentou").
  insert into public.notificacoes_crm (tipo, fotografo_id, referencia, dados)
  select
    'sem_pedido_7d', f.id, 'cadastro',
    jsonb_build_object(
      'dias_cadastrado', v_hoje - (p.created_at at time zone 'America/Sao_Paulo')::date,
      'cadastrado_em', p.created_at,
      'plano', pl.nome_plano,
      'tipo_cobranca', pl.tipo_cobranca
    )
  from public.fotografos f
  join public.profiles p on p.id = f.id
  left join public.planos pl on pl.id = f.plano_id
  where p.role = 'fotografo'
    and coalesce(f.status, 'ativo') = 'ativo'
    and p.created_at < now() - interval '7 days'
    and not exists (select 1 from public.orders o where o.client_id = f.id)
  on conflict (tipo, fotografo_id, referencia) do nothing;
  get diagnostics v_novos_a = row_count;

  -- b) assinante ativo, dia 20 em diante (Brasília), nenhum pedido no mês.
  if extract(day from v_hoje) >= 20 then
    insert into public.notificacoes_crm (tipo, fotografo_id, referencia, dados)
    select
      'assinante_sem_projeto_mes', f.id, v_mes,
      jsonb_build_object(
        'plano', pl.nome_plano,
        'albuns_inclusos', pl.albuns_inclusos,
        'albuns_usados', 0,
        'dias_para_fim_do_mes', (date_trunc('month', v_hoje) + interval '1 month')::date - v_hoje,
        'ultimo_pedido_em', (select max(o.created_at) from public.orders o where o.client_id = f.id)
      )
    from public.fotografos f
    join public.profiles p on p.id = f.id
    join public.planos pl on pl.id = f.plano_id
    where p.role = 'fotografo'
      and coalesce(f.status, 'ativo') = 'ativo'
      and pl.tipo_cobranca = 'assinatura'
      and not exists (
        select 1 from public.orders o
        where o.client_id = f.id and o.created_at >= v_inicio_mes and o.status <> 'cancelado'
      )
    on conflict (tipo, fotografo_id, referencia) do nothing;
    get diagnostics v_novos_b = row_count;
  end if;

  -- Resolve sozinho o que deixou de valer (o fotógrafo voltou a pedir).
  update public.notificacoes_crm c
    set status = 'resolvida', resolvida_em = now(), atualizada_em = now(),
        dados = c.dados || jsonb_build_object('resolvida_automaticamente', true)
  where c.status in ('aberta', 'contatado')
    and (
      (c.tipo = 'sem_pedido_7d'
        and exists (select 1 from public.orders o where o.client_id = c.fotografo_id))
      or
      (c.tipo = 'assinante_sem_projeto_mes'
        and exists (
          select 1 from public.orders o
          where o.client_id = c.fotografo_id
            and o.status <> 'cancelado'
            and to_char(o.created_at at time zone 'America/Sao_Paulo', 'YYYY-MM') = c.referencia
        ))
    );
  get diagnostics n = row_count;
  v_resolvidos := n;

  return jsonb_build_object(
    'executado_em', now(),
    'novos_sem_pedido_7d', v_novos_a,
    'novos_assinante_sem_projeto_mes', v_novos_b,
    'resolvidos_automaticamente', v_resolvidos
  );
end;
$$;

revoke execute on function public.gerar_alertas_crm() from public, anon, authenticated;

-- A gestão pode rodar a detecção na hora ("Atualizar agora" no painel).
create or replace function public.rodar_alertas_crm()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_gestor_ou_admin() then
    raise exception 'Só a gestão acessa o CRM.' using errcode = '42501';
  end if;
  return public.gerar_alertas_crm();
end;
$$;

revoke execute on function public.rodar_alertas_crm() from public, anon;
grant execute on function public.rodar_alertas_crm() to authenticated;

-- -----------------------------------------------------------------------------
-- Ação da gestão sobre um alerta
-- -----------------------------------------------------------------------------

create or replace function public.marcar_alerta_crm(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_gestor_ou_admin() then
    raise exception 'Só a gestão acessa o CRM.' using errcode = '42501';
  end if;
  if p_status not in ('aberta', 'contatado', 'resolvida', 'dispensada') then
    raise exception 'Status inválido.' using errcode = '22023';
  end if;

  update public.notificacoes_crm
    set status = p_status,
        atualizada_em = now(),
        resolvida_em = case when p_status in ('resolvida', 'dispensada') then now() else null end,
        resolvida_por = case when p_status = 'aberta' then null else auth.uid() end
  where id = p_id;
  if not found then
    raise exception 'Alerta não encontrado.' using errcode = '42704';
  end if;
end;
$$;

revoke execute on function public.marcar_alerta_crm(uuid, text) from public, anon;
grant execute on function public.marcar_alerta_crm(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Agendamento: todo dia às 12:00 UTC = 09:00 de Brasília
-- -----------------------------------------------------------------------------

do $$ begin
  perform cron.unschedule('crm-retencao-diario');
exception when others then null; end $$;

select cron.schedule('crm-retencao-diario', '0 12 * * *', $$select public.gerar_alertas_crm()$$);
