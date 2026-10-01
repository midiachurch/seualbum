-- =============================================================================
-- Migration 0007: motor de comunicação (outbox), SLA de prazos, comentários
-- por versão da prova, e CMS no-code de páginas do site.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. MOTOR DE COMUNICAÇÃO — padrão Outbox (comunicacoes_log)
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.comunicacao_status as enum ('simulado', 'enviado', 'falhou');
exception when duplicate_object then null; end $$;

create table if not exists public.comunicacoes_log (
  id            uuid primary key default gen_random_uuid(),
  projeto_id    uuid not null references public.projetos (id) on delete cascade,
  cliente_id    uuid references public.clientes (id) on delete set null,
  tipo_evento   text not null,
  assunto       text not null,
  corpo_html    text not null,
  status        public.comunicacao_status not null default 'simulado',
  data_criacao  timestamptz not null default now()
);

create index if not exists idx_comunicacoes_log_projeto on public.comunicacoes_log (projeto_id, data_criacao desc);

alter table public.comunicacoes_log enable row level security;
alter table public.comunicacoes_log force row level security;

-- Só a equipe interna e o fotógrafo dono enxergam a caixa de saída — é um
-- registro de auditoria operacional, não algo exposto ao cliente final.
drop policy if exists "comunicacoes_log_select_equipe_ou_fotografo" on public.comunicacoes_log;
create policy "comunicacoes_log_select_equipe_ou_fotografo"
  on public.comunicacoes_log for select to authenticated
  using (
    public.is_equipe()
    or exists (select 1 from public.projetos p where p.id = projeto_id and p.fotografo_id = auth.uid())
  );

-- Só o gatilho do banco (SECURITY DEFINER) escreve aqui — nenhuma role de
-- API grava direto, então não existe policy de insert/update para
-- anon/authenticated (a tabela fica de fato somente leitura pela API).

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
    when 'finalizado' then 'Seu álbum foi finalizado! — ' || new.nome
  end;

  v_corpo := '<div style="font-family:sans-serif;color:#171717;line-height:1.5">'
    || '<p>Olá, ' || coalesce(v_cliente.nome, 'cliente') || '!</p>'
    || '<p>' || (case v_tipo
        when 'aguardando_fotos' then 'Recebemos seu pedido para o projeto <strong>' || new.nome || '</strong> e estamos aguardando o envio das fotos para começar a diagramação.'
        when 'prova_pronta' then 'A prova digital do seu álbum <strong>' || new.nome || '</strong> já está pronta. Acesse o portal para revisar e aprovar quando quiser.'
        when 'aprovado' then 'Seu álbum <strong>' || new.nome || '</strong> foi aprovado e já seguiu para a produção gráfica. Em breve você recebe novidades sobre a entrega.'
        when 'finalizado' then 'Seu álbum <strong>' || new.nome || '</strong> foi finalizado. Obrigado por confiar no nosso trabalho!'
      end) || '</p>'
    || '<p style="color:#777777;font-size:12px">Este é um e-mail simulado — nenhuma mensagem real foi enviada (infraestrutura de e-mail ainda não conectada).</p>'
    || '</div>';

  insert into public.comunicacoes_log (projeto_id, cliente_id, tipo_evento, assunto, corpo_html, status)
  values (new.id, new.cliente_id, v_tipo, v_assunto, v_corpo, 'simulado');

  return new;
end;
$$;

revoke execute on function public.registrar_comunicacao_status() from public, anon, authenticated;

drop trigger if exists trg_registrar_comunicacao_status on public.projetos;
create trigger trg_registrar_comunicacao_status
  after update on public.projetos
  for each row execute function public.registrar_comunicacao_status();

-- -----------------------------------------------------------------------------
-- 2. GESTÃO DE SLA — prazos de produção e de aprovação
-- -----------------------------------------------------------------------------

alter table public.projetos
  add column if not exists data_limite_producao timestamptz not null default (now() + interval '7 days'),
  add column if not exists data_limite_aprovacao timestamptz;

comment on column public.projetos.data_limite_producao is 'SLA interno: prazo para a equipe terminar a diagramação.';
comment on column public.projetos.data_limite_aprovacao is 'SLA do cliente: prazo para aprovar a prova, contado a partir de quando ela é liberada.';

-- Sempre que o projeto entra em "aguardando aprovação do cliente", abre (ou
-- reabre, se veio de um ciclo de ajustes) uma janela de 5 dias para o cliente
-- responder — sem isso, data_limite_aprovacao ficaria null para sempre.
create or replace function public.definir_prazo_aprovacao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'aguardando_aprovacao_cliente' and old.status is distinct from 'aguardando_aprovacao_cliente' then
    new.data_limite_aprovacao := now() + interval '5 days';
  end if;
  return new;
end;
$$;

revoke execute on function public.definir_prazo_aprovacao() from public, anon, authenticated;

drop trigger if exists trg_definir_prazo_aprovacao on public.projetos;
create trigger trg_definir_prazo_aprovacao
  before update on public.projetos
  for each row execute function public.definir_prazo_aprovacao();

-- -----------------------------------------------------------------------------
-- 3. COMENTÁRIOS DA PROVA POR VERSÃO
-- -----------------------------------------------------------------------------

alter table public.prova_comentarios add column if not exists versao integer not null default 1;
create index if not exists idx_prova_comentarios_versao on public.prova_comentarios (projeto_id, versao);

-- -----------------------------------------------------------------------------
-- 4. CMS NO-CODE — páginas dinâmicas do site público
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.pagina_status as enum ('publicado', 'rascunho');
exception when duplicate_object then null; end $$;

create table if not exists public.paginas_conteudo (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  titulo           text not null,
  conteudo_html    text not null default '',
  seo_description  text,
  status           public.pagina_status not null default 'rascunho',
  criado_por       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists trg_paginas_conteudo_updated_at on public.paginas_conteudo;
create trigger trg_paginas_conteudo_updated_at
  before update on public.paginas_conteudo
  for each row execute function public.set_updated_at();

alter table public.paginas_conteudo enable row level security;
alter table public.paginas_conteudo force row level security;

drop policy if exists "paginas_conteudo_select_publico_ou_equipe" on public.paginas_conteudo;
create policy "paginas_conteudo_select_publico_ou_equipe"
  on public.paginas_conteudo for select to anon, authenticated
  using (status = 'publicado' or public.is_gestor_ou_admin());

drop policy if exists "paginas_conteudo_write_equipe" on public.paginas_conteudo;
create policy "paginas_conteudo_write_equipe"
  on public.paginas_conteudo for all to authenticated
  using (public.is_gestor_ou_admin()) with check (public.is_gestor_ou_admin());
