-- =============================================================================
-- Migration 0008: motor de precificação/upsell, fila de expedição física,
-- CRM de orçamentos do fotógrafo (B2B) e suporte a versões geradas por
-- algoritmo (Smart Layout).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. STATUS "ENVIADO" — pipeline ganha a etapa de expedição física
-- -----------------------------------------------------------------------------

alter type public.project_status add value if not exists 'enviado';

-- -----------------------------------------------------------------------------
-- 2. CATÁLOGO DE PRODUTOS COM PREÇO (upsell de páginas extras)
-- -----------------------------------------------------------------------------

create table if not exists public.produtos (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  formato             text not null unique,
  descricao           text,
  imagem_url          text,
  preco_base          numeric(10, 2) not null default 0 check (preco_base >= 0),
  paginas_inclusas    integer not null default 20 check (paginas_inclusas > 0),
  preco_pagina_extra  numeric(10, 2) not null default 15 check (preco_pagina_extra >= 0),
  ativo               boolean not null default true,
  ordem               integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists trg_produtos_updated_at on public.produtos;
create trigger trg_produtos_updated_at
  before update on public.produtos
  for each row execute function public.set_updated_at();

alter table public.produtos enable row level security;

drop policy if exists "produtos_select_publico_ou_equipe" on public.produtos;
create policy "produtos_select_publico_ou_equipe"
  on public.produtos for select to anon, authenticated
  using (ativo = true or public.is_gestor_ou_admin());

drop policy if exists "produtos_write_equipe" on public.produtos;
create policy "produtos_write_equipe"
  on public.produtos for all to authenticated
  using (public.is_gestor_ou_admin()) with check (public.is_gestor_ou_admin());

insert into public.produtos (nome, formato, descricao, preco_base, paginas_inclusas, preco_pagina_extra, ordem) values
  ('Álbum 20×20', '20x20', 'Compacto e versátil.', 390, 20, 12, 1),
  ('Álbum 25×25', '25x25', 'Equilíbrio entre presença e portabilidade.', 490, 20, 14, 2),
  ('Álbum 30×30', '30x30', 'O mais escolhido para celebrações grandes.', 590, 20, 15, 3),
  ('Álbum 30×40', '30x40', 'Mais espaço e impacto por lâmina.', 790, 20, 18, 4)
on conflict (formato) do nothing;

-- -----------------------------------------------------------------------------
-- 3. PROJETOS — vínculo com produto, expedição física
-- -----------------------------------------------------------------------------

alter table public.projetos
  add column if not exists produto_id uuid references public.produtos (id) on delete set null,
  add column if not exists codigo_rastreio text,
  add column if not exists enviado_em timestamptz;

-- -----------------------------------------------------------------------------
-- 4. VERSÕES DE DIAGRAMAÇÃO — contagem de páginas e origem automática (Smart Layout)
-- -----------------------------------------------------------------------------

alter table public.design_versions
  add column if not exists quantidade_paginas integer,
  add column if not exists layout_json jsonb,
  add column if not exists gerado_automaticamente boolean not null default false;

-- -----------------------------------------------------------------------------
-- 5. FATURAS — upsell de páginas extras, pagamento simulado
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.fatura_status as enum ('pendente', 'pago', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.forma_pagamento as enum ('cartao', 'pix');
exception when duplicate_object then null; end $$;

create table if not exists public.faturas (
  id                uuid primary key default gen_random_uuid(),
  projeto_id        uuid not null references public.projetos (id) on delete cascade,
  design_version_id uuid references public.design_versions (id) on delete set null,
  valor_total       numeric(10, 2) not null check (valor_total >= 0),
  itens_json        jsonb not null default '[]'::jsonb,
  status_pagamento  public.fatura_status not null default 'pendente',
  forma_pagamento   public.forma_pagamento,
  created_at        timestamptz not null default now(),
  pago_em           timestamptz
);

create index if not exists idx_faturas_projeto on public.faturas (projeto_id, created_at desc);

alter table public.faturas enable row level security;
alter table public.faturas force row level security;

-- Mesmo círculo de visibilidade de `pode_ver_projeto`: equipe, fotógrafo dono,
-- cliente dono do projeto — e mais ninguém enxerga faturamento.
drop policy if exists "faturas_select_scope" on public.faturas;
create policy "faturas_select_scope"
  on public.faturas for select to authenticated
  using (public.pode_ver_projeto(projeto_id));

drop policy if exists "faturas_insert_scope" on public.faturas;
create policy "faturas_insert_scope"
  on public.faturas for insert to authenticated
  with check (public.pode_ver_projeto(projeto_id));

-- Só equipe atualiza livremente; o pagamento do cliente passa pela função
-- `pagar_fatura_e_aprovar` (SECURITY DEFINER), não por UPDATE direto.
drop policy if exists "faturas_update_equipe" on public.faturas;
create policy "faturas_update_equipe"
  on public.faturas for update to authenticated
  using (public.is_equipe()) with check (public.is_equipe());

-- -----------------------------------------------------------------------------
-- 6. CHECKOUT SIMULADO — paga a fatura e aprova o álbum na mesma operação
-- -----------------------------------------------------------------------------

create or replace function public.pagar_fatura_e_aprovar(p_fatura_id uuid, p_forma public.forma_pagamento)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_projeto_id uuid;
  v_versao     integer;
  v_dono       boolean;
begin
  select f.projeto_id into v_projeto_id from public.faturas f where f.id = p_fatura_id and f.status_pagamento = 'pendente';
  if v_projeto_id is null then
    raise exception 'Fatura não encontrada ou já processada' using errcode = '42704';
  end if;

  select exists (
    select 1 from public.projetos p
    join public.clientes c on c.id = p.cliente_id
    where p.id = v_projeto_id and c.user_id = auth.uid()
  ) into v_dono;

  if not v_dono then
    raise exception 'Só o cliente dono do projeto pode pagar esta fatura' using errcode = '42501';
  end if;

  update public.faturas
    set status_pagamento = 'pago', forma_pagamento = p_forma, pago_em = now()
    where id = p_fatura_id;

  select max(numero) into v_versao from public.design_versions where projeto_id = v_projeto_id;

  insert into public.aprovacoes (projeto_id, versao, usuario_id, status)
  values (v_projeto_id, coalesce(v_versao, 1), auth.uid(), 'aprovado');
  -- `trg_aplicar_aprovacao` já move projetos.status para 'aprovado' e registra
  -- a atividade; `trg_registrar_comunicacao_status` já dispara o outbox e,
  -- por extensão, o webhook da Fase 8 continua funcionando sem duplicar lógica.
end;
$$;

revoke execute on function public.pagar_fatura_e_aprovar(uuid, public.forma_pagamento) from public, anon;
grant execute on function public.pagar_fatura_e_aprovar(uuid, public.forma_pagamento) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. NOTIFICAÇÃO DE ENVIO — evolui o outbox da Fase 8 pro novo status
-- -----------------------------------------------------------------------------

create or replace function public.registrar_comunicacao_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cliente record;
  v_tipo    text;
  v_assunto text;
  v_corpo   text;
begin
  if new.status = old.status then
    return new;
  end if;

  v_tipo := case new.status
    when 'aguardando_fotos' then 'aguardando_fotos'
    when 'aguardando_aprovacao_cliente' then 'prova_pronta'
    when 'aprovado' then 'aprovado'
    when 'enviado' then 'enviado'
    when 'finalizado' then 'finalizado'
    else null
  end;

  if v_tipo is null then
    return new;
  end if;

  select c.nome, c.email into v_cliente from public.clientes c where c.id = new.cliente_id;

  v_assunto := case v_tipo
    when 'aguardando_fotos' then 'Estamos esperando as fotos do seu evento — ' || new.nome
    when 'prova_pronta' then 'Sua prova digital está pronta! — ' || new.nome
    when 'aprovado' then 'Álbum aprovado — a caminho da gráfica! — ' || new.nome
    when 'enviado' then 'Seu álbum está a caminho! — ' || new.nome
    when 'finalizado' then 'Seu álbum foi finalizado! — ' || new.nome
  end;

  v_corpo := '<div style="font-family:sans-serif;color:#171717;line-height:1.5">'
    || '<p>Olá, ' || coalesce(v_cliente.nome, 'cliente') || '!</p>'
    || '<p>' || (case v_tipo
        when 'aguardando_fotos' then 'Recebemos seu pedido para o projeto <strong>' || new.nome || '</strong> e estamos aguardando o envio das fotos para começar a diagramação.'
        when 'prova_pronta' then 'A prova digital do seu álbum <strong>' || new.nome || '</strong> já está pronta. Acesse o portal para revisar e aprovar quando quiser.'
        when 'aprovado' then 'Seu álbum <strong>' || new.nome || '</strong> foi aprovado e já seguiu para a produção gráfica. Em breve você recebe novidades sobre a entrega.'
        when 'enviado' then 'Seu álbum <strong>' || new.nome || '</strong> foi despachado!' ||
          case when new.codigo_rastreio is not null then ' Código de rastreio: <strong>' || new.codigo_rastreio || '</strong>.' else '' end
        when 'finalizado' then 'Seu álbum <strong>' || new.nome || '</strong> foi finalizado. Obrigado por confiar no nosso trabalho!'
      end) || '</p>'
    || '<p style="color:#777777;font-size:12px">Este é um e-mail simulado — nenhuma mensagem real foi enviada (infraestrutura de e-mail ainda não conectada).</p>'
    || '</div>';

  insert into public.comunicacoes_log (projeto_id, cliente_id, tipo_evento, assunto, corpo_html, status)
  values (new.id, new.cliente_id, v_tipo, v_assunto, v_corpo, 'simulado');

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. B2B — CRM de orçamentos do fotógrafo
-- -----------------------------------------------------------------------------

alter table public.fotografos add column if not exists logo_url text;

do $$ begin
  create type public.orcamento_status as enum ('rascunho', 'enviado');
exception when duplicate_object then null; end $$;

create table if not exists public.orcamentos (
  id                    uuid primary key default gen_random_uuid(),
  fotografo_id          uuid not null references public.fotografos (id) on delete cascade,
  cliente_final_nome    text not null check (char_length(trim(cliente_final_nome)) between 2 and 120),
  cliente_final_contato text,
  itens_json            jsonb not null default '[]'::jsonb,
  valor_total           numeric(10, 2) not null default 0 check (valor_total >= 0),
  hash_publico          text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  status                public.orcamento_status not null default 'rascunho',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_orcamentos_fotografo on public.orcamentos (fotografo_id, created_at desc);

drop trigger if exists trg_orcamentos_updated_at on public.orcamentos;
create trigger trg_orcamentos_updated_at
  before update on public.orcamentos
  for each row execute function public.set_updated_at();

alter table public.orcamentos enable row level security;
alter table public.orcamentos force row level security;

-- Regra inegociável: o fotógrafo só vê os próprios orçamentos. Não há policy
-- de select para `anon` — a leitura pública passa só pela função abaixo, que
-- devolve um recorte controlado (nunca a tabela inteira) e evita enumeração.
drop policy if exists "orcamentos_select_dono_ou_equipe" on public.orcamentos;
create policy "orcamentos_select_dono_ou_equipe"
  on public.orcamentos for select to authenticated
  using (fotografo_id = auth.uid() or public.is_equipe());

drop policy if exists "orcamentos_write_dono" on public.orcamentos;
create policy "orcamentos_write_dono"
  on public.orcamentos for all to authenticated
  using (fotografo_id = auth.uid() or public.is_admin())
  with check (fotografo_id = auth.uid() or public.is_admin());

-- Leitura pública controlada (link de WhatsApp) — só os campos necessários
-- pra tela de orçamento, nunca a lista completa nem dados de outros orçamentos.
create or replace function public.get_orcamento_publico(p_hash text)
returns table (
  cliente_final_nome text,
  itens_json jsonb,
  valor_total numeric,
  estudio text,
  logo_url text,
  criado_em timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select o.cliente_final_nome, o.itens_json, o.valor_total, f.estudio, f.logo_url, o.created_at
  from public.orcamentos o
  join public.fotografos f on f.id = o.fotografo_id
  where o.hash_publico = p_hash;
$$;

revoke execute on function public.get_orcamento_publico(text) from public;
grant execute on function public.get_orcamento_publico(text) to anon, authenticated;
