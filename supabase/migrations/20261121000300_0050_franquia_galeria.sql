-- Franquia de armazenamento da galeria digital no servidor (entitlements).
-- Mede o consumo real e registra o plano escolhido pelo fotógrafo. NÃO bloqueia
-- upload nem acesso: bloqueio é decisão comercial/contratual futura, sobre esta
-- mesma medição. Assinatura aqui é SIMULADA: não há cobrança nem gateway
-- (contexto financeiro da ADR-004 fica fora). Preços do seed são hipóteses de
-- trabalho, não preços definitivos. NÃO aplicada em ambiente remoto.
begin;

-- 1. Tamanho real do arquivo, gravado na confirmação do upload (HeadObject).
-- Nulo = foto anterior à medição; nunca é inventado nem estimado.
alter table public.fotos
  add column if not exists tamanho_bytes bigint check (tamanho_bytes is null or tamanho_bytes > 0);
comment on column public.fotos.tamanho_bytes is
  'Bytes do original no R2, vindos do HeadObject na confirmação (0050). Nulo em fotos anteriores à medição.';

-- 2. Catálogo de planos da galeria (leitura para autenticados; sem escrita direta).
create table public.planos_galeria (
  slug                  text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  nome                  text not null check (length(trim(nome)) between 2 and 60),
  preco_mensal_centavos integer not null check (preco_mensal_centavos >= 0),
  armazenamento_bytes   bigint not null check (armazenamento_bytes > 0),
  ativo                 boolean not null default true,
  ordem                 smallint not null default 0,
  created_at            timestamptz not null default now()
);
comment on table public.planos_galeria is
  'Hipóteses de oferta (0050): valores simulados, sujeitos a aprovação comercial. Capacidade em bytes decimais (1 GB = 10^9).';
alter table public.planos_galeria enable row level security;
revoke all on table public.planos_galeria from public, anon, authenticated;
grant select on table public.planos_galeria to authenticated;
grant all on table public.planos_galeria to service_role;
create policy planos_galeria_select on public.planos_galeria for select to authenticated using (ativo);

insert into public.planos_galeria(slug, nome, preco_mensal_centavos, armazenamento_bytes, ordem) values
  ('essencial',    'Essencial',    4900,  10000000000, 1),
  ('profissional', 'Profissional', 9900, 100000000000, 2),
  ('estudio',      'Estúdio',     19900, 500000000000, 3);

-- 3. Assinatura da galeria: snapshot do que foi escolhido, histórico preservado.
create table public.assinaturas_galeria (
  id                    uuid primary key default gen_random_uuid(),
  fotografo_id          uuid not null references public.fotografos (id) on delete cascade,
  chave                 uuid not null unique,
  plano_slug            text not null references public.planos_galeria (slug),
  plano_nome            text not null,
  preco_mensal_centavos integer not null check (preco_mensal_centavos >= 0),
  armazenamento_bytes   bigint not null check (armazenamento_bytes > 0),
  origem                text not null default 'simulada' check (origem = 'simulada'),
  status                text not null default 'ativa' check (status in ('ativa', 'substituida', 'cancelada')),
  iniciada_em           timestamptz not null default now(),
  encerrada_em          timestamptz,
  constraint assinaturas_galeria_encerramento check ((status = 'ativa') = (encerrada_em is null))
);
create unique index uq_assinatura_galeria_ativa on public.assinaturas_galeria (fotografo_id) where status = 'ativa';
create index idx_assinaturas_galeria_fotografo on public.assinaturas_galeria (fotografo_id, iniciada_em desc);
alter table public.assinaturas_galeria enable row level security;
revoke all on table public.assinaturas_galeria from public, anon, authenticated;
grant select on table public.assinaturas_galeria to authenticated;
grant all on table public.assinaturas_galeria to service_role;
create policy assinaturas_galeria_select on public.assinaturas_galeria for select to authenticated
  using (fotografo_id = auth.uid() or public.is_equipe());

-- 4. Escolher plano: idempotente por chave, troca encerra a anterior como 'substituida'.
create function public.escolher_plano_galeria(p_chave uuid, p_plano text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_plano public.planos_galeria; v_existente public.assinaturas_galeria; v_id uuid;
begin
  perform 1 from public.profiles where id = auth.uid() and role = 'fotografo' and status = 'ativo' for share;
  if not found then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  perform 1 from public.fotografos where id = auth.uid() and status = 'ativo' for share;
  if not found then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_chave is null or p_plano is null then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_chave::text, 50));
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 50));

  select * into v_existente from public.assinaturas_galeria where chave = p_chave;
  if found then
    if v_existente.fotografo_id <> auth.uid() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
    if v_existente.plano_slug <> p_plano then raise exception 'Chave já utilizada com outro plano.' using errcode = '22023'; end if;
    return v_existente.id;
  end if;

  select * into v_plano from public.planos_galeria where slug = p_plano and ativo;
  if not found then raise exception 'Plano indisponível.' using errcode = '22023'; end if;

  update public.assinaturas_galeria set status = 'substituida', encerrada_em = now()
   where fotografo_id = auth.uid() and status = 'ativa';
  insert into public.assinaturas_galeria(fotografo_id, chave, plano_slug, plano_nome, preco_mensal_centavos, armazenamento_bytes)
  values (auth.uid(), p_chave, v_plano.slug, v_plano.nome, v_plano.preco_mensal_centavos, v_plano.armazenamento_bytes)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.escolher_plano_galeria(uuid, text) from public, anon, service_role;
grant execute on function public.escolher_plano_galeria(uuid, text) to authenticated;

-- 5. Consumo do próprio fotógrafo. Só mede originais com tamanho conhecido e
-- informa quantas fotos ainda não têm medição, para não fingir exatidão.
create function public.consumo_franquia_galeria()
returns table (
  plano_slug text, capacidade_bytes bigint, usado_bytes bigint,
  fotos_total integer, fotos_sem_medicao integer, percentual integer, situacao text
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_ass public.assinaturas_galeria; v_usado bigint; v_total integer; v_sem integer; v_pct integer;
begin
  perform 1 from public.profiles where id = auth.uid() and role = 'fotografo' and status = 'ativo';
  if not found then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select * into v_ass from public.assinaturas_galeria where fotografo_id = auth.uid() and status = 'ativa';
  select coalesce(sum(f.tamanho_bytes), 0)::bigint, count(*)::integer, count(*) filter (where f.tamanho_bytes is null)::integer
    into v_usado, v_total, v_sem
    from public.fotos f join public.projetos p on p.id = f.projeto_id
   where p.fotografo_id = auth.uid() and f.bucket = 'r2';
  if v_ass.id is null then
    return query select null::text, null::bigint, v_usado, v_total, v_sem, null::integer, 'sem_plano'::text;
    return;
  end if;
  v_pct := least(1000000, (v_usado * 100 / v_ass.armazenamento_bytes)::integer);
  return query select v_ass.plano_slug, v_ass.armazenamento_bytes, v_usado, v_total, v_sem, v_pct,
    case when v_usado > v_ass.armazenamento_bytes then 'excedida' when v_pct >= 80 then 'alerta' else 'dentro' end;
end $$;
revoke all on function public.consumo_franquia_galeria() from public, anon, service_role;
grant execute on function public.consumo_franquia_galeria() to authenticated;

commit;
