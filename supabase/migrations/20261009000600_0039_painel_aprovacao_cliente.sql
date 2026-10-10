-- =============================================================================
-- Migration 0039: painel de aprovação do cliente final
--
-- 1. `prova_laminas_revisao`: o checklist do casal, lâmina a lâmina, na versão
--    que está aguardando a decisão. Uma linha por (lâmina, usuário):
--      - 'vista'    → abriu a lâmina na prova (gravado sozinho pelo app);
--      - 'aprovada' → tocou em "Esta lâmina está ok".
--    "Com comentários" não é guardado aqui: sai de `prova_comentarios`.
--    `projeto_id` e `versao` vêm SEMPRE da lâmina (trigger), nunca do
--    navegador; `aprovada_em` é carimbado pelo banco.
--
--    RLS: ler, quem enxerga o projeto (`pode_ver_projeto`: o casal, o estúdio e
--    a equipe acompanham o progresso). Gravar/apagar, só o cliente final dono
--    do projeto, só nas próprias linhas, só com a prova aguardando decisão e
--    só em lâmina da versão liberada mais recente (versão antiga e rascunho
--    interno ficam de fora).
--
-- 2. `marca_do_estudio_cliente()`: nome e logo dos estúdios dos projetos do
--    cliente logado (white label do portal). A policy de `fotografos` não
--    deixa o cliente ler a tabela — a função devolve só esses dois campos.
--
-- Idempotente: pode ser reexecutada com segurança. NÃO aplicada.
-- =============================================================================

-- 1. Checklist de lâminas ------------------------------------------------------
create table if not exists public.prova_laminas_revisao (
  id          uuid primary key default gen_random_uuid(),
  projeto_id  uuid not null references public.projetos (id) on delete cascade,
  lamina_id   uuid not null references public.versoes_laminas (id) on delete cascade,
  versao      integer not null check (versao >= 1),
  usuario_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  estado      text not null default 'vista' check (estado in ('vista', 'aprovada')),
  vista_em    timestamptz not null default now(),
  aprovada_em timestamptz,
  updated_at  timestamptz not null default now(),
  unique (lamina_id, usuario_id)
);

do $$ begin
  alter table public.prova_laminas_revisao
    add constraint prova_laminas_revisao_aprovada_check
      check ((estado = 'aprovada') = (aprovada_em is not null));
exception when duplicate_object then null; end $$;

create index if not exists idx_prova_laminas_revisao_projeto
  on public.prova_laminas_revisao (projeto_id, versao);

alter table public.prova_laminas_revisao enable row level security;
alter table public.prova_laminas_revisao force row level security;

-- Projeto e versão saem da lâmina; o carimbo de horário sai do banco.
-- SECURITY DEFINER só para ler `versoes_laminas`/`design_versions` sem
-- depender da RLS delas; quem pode gravar continua decidido pelas policies.
create or replace function public.preencher_revisao_lamina()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_projeto uuid;
  v_versao  integer;
begin
  select dv.projeto_id, dv.numero
    into v_projeto, v_versao
    from public.versoes_laminas vl
    join public.design_versions dv on dv.id = vl.versao_id
   where vl.id = new.lamina_id;
  if v_projeto is null then
    raise exception 'Lâmina não encontrada.' using errcode = 'P0002';
  end if;

  new.projeto_id := v_projeto;
  new.versao := v_versao;
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.vista_em := now();
    new.aprovada_em := case when new.estado = 'aprovada' then now() end;
  else
    new.usuario_id := old.usuario_id;
    new.vista_em := old.vista_em;
    new.aprovada_em := case
      when new.estado <> 'aprovada' then null
      when old.estado = 'aprovada' then old.aprovada_em
      else now()
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prova_laminas_revisao_preencher on public.prova_laminas_revisao;
create trigger trg_prova_laminas_revisao_preencher
  before insert or update on public.prova_laminas_revisao
  for each row execute function public.preencher_revisao_lamina();

-- O cliente final logado pode revisar esta lâmina agora?
create or replace function public.cliente_pode_revisar_lamina(p_projeto_id uuid, p_lamina_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.projetos p
      join public.clientes c on c.id = p.cliente_id
      join public.design_versions dv on dv.projeto_id = p.id and dv.status = 'aprovada'
      join public.versoes_laminas vl on vl.versao_id = dv.id
     where p.id = p_projeto_id
       and vl.id = p_lamina_id
       and c.user_id = auth.uid()
       and p.status = 'aguardando_aprovacao_cliente'
       and dv.numero = (
         select max(d2.numero) from public.design_versions d2
          where d2.projeto_id = p.id and d2.status = 'aprovada'
       )
  );
$$;

revoke execute on function public.cliente_pode_revisar_lamina(uuid, uuid) from public, anon;
grant execute on function public.cliente_pode_revisar_lamina(uuid, uuid) to authenticated;

drop policy if exists "prova_laminas_revisao_select" on public.prova_laminas_revisao;
create policy "prova_laminas_revisao_select"
  on public.prova_laminas_revisao for select to authenticated
  using (public.pode_ver_projeto(projeto_id));

drop policy if exists "prova_laminas_revisao_insert_cliente" on public.prova_laminas_revisao;
create policy "prova_laminas_revisao_insert_cliente"
  on public.prova_laminas_revisao for insert to authenticated
  with check (usuario_id = auth.uid() and public.cliente_pode_revisar_lamina(projeto_id, lamina_id));

drop policy if exists "prova_laminas_revisao_update_cliente" on public.prova_laminas_revisao;
create policy "prova_laminas_revisao_update_cliente"
  on public.prova_laminas_revisao for update to authenticated
  using (usuario_id = auth.uid() and public.cliente_pode_revisar_lamina(projeto_id, lamina_id))
  with check (usuario_id = auth.uid() and public.cliente_pode_revisar_lamina(projeto_id, lamina_id));

drop policy if exists "prova_laminas_revisao_delete_cliente" on public.prova_laminas_revisao;
create policy "prova_laminas_revisao_delete_cliente"
  on public.prova_laminas_revisao for delete to authenticated
  using (usuario_id = auth.uid() and public.cliente_pode_revisar_lamina(projeto_id, lamina_id));

revoke all on public.prova_laminas_revisao from anon;
grant select, insert, update, delete on public.prova_laminas_revisao to authenticated;

-- 2. Marca do estúdio no portal do cliente ------------------------------------
create or replace function public.marca_do_estudio_cliente()
returns table (fotografo_id uuid, estudio text, logo_url text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select f.id, f.estudio, f.logo_url
    from public.fotografos f
   where exists (
     select 1
       from public.projetos p
       join public.clientes c on c.id = p.cliente_id
      where p.fotografo_id = f.id
        and c.user_id = auth.uid()
   );
$$;

revoke execute on function public.marca_do_estudio_cliente() from public, anon;
grant execute on function public.marca_do_estudio_cliente() to authenticated;
