-- =============================================================================
-- Checkout real da fatura de fechamento (migration 0035) contra o banco LOCAL:
-- `supabase start` + `supabase test db`.
--
--   * `preparar_checkout_fatura`: só o estúdio dono, fatura pendente, nada
--     aguardando o estúdio — e devolve o valor que o servidor cobra.
--   * `registrar_checkout_fatura`: guarda a Checkout Session na fatura.
--   * `pagamento_simulado_ativo`: a tela sabe qual botão mostrar.
--   * Depois do webhook (`confirmar_pagamento_fatura`), nada mais abre checkout.
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

create function pg_temp.entrar(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('f1000000-0000-4000-8000-000000000035', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f1-35@teste.local',    '{"role":"fotografo"}', '{"estudio":"Estúdio Um"}', now(), now()),
  ('f2000000-0000-4000-8000-000000000035', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f2-35@teste.local',    '{"role":"fotografo"}', '{"estudio":"Estúdio Dois"}', now(), now()),
  ('c1000000-0000-4000-8000-000000000035', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'casal-35@teste.local', '{"role":"cliente"}',   '{}', now(), now());

insert into public.clientes (id, user_id, fotografo_id, nome, email)
values ('cc000000-0000-4000-8000-000000000035', 'c1000000-0000-4000-8000-000000000035',
        'f1000000-0000-4000-8000-000000000035', 'Ana e Bruno', 'casal-35@teste.local');

insert into public.projetos (id, nome, cliente_id, fotografo_id, status, laminas_inclusas, preco_lamina_extra)
values ('e1000000-0000-4000-8000-000000000035', 'Projeto 35', 'cc000000-0000-4000-8000-000000000035',
        'f1000000-0000-4000-8000-000000000035', 'aguardando_aprovacao_cliente', 15, 12);

insert into public.design_versions (id, projeto_id, numero, status)
values ('e1100000-0000-4000-8000-000000000035', 'e1000000-0000-4000-8000-000000000035', 1, 'aprovada');

-- Capa + 17 lâminas: 2 extras (R$ 24).
insert into public.versoes_laminas (versao_id, ordem, storage_path, eh_capa)
select 'e1100000-0000-4000-8000-000000000035', o, 'x/' || o || '.jpg', o = 1 from generate_series(1, 18) o;

insert into public.adicionais_estudio (fotografo_id, adicional_id, preco_revenda, oferecer_ao_cliente)
select 'f1000000-0000-4000-8000-000000000035', id, 400, true
from public.adicionais where slug = 'copia-pais-20x20';

-- O casal não lê o catálogo (custo é segredo): o id vai numa tabela temporária.
create temp table copia as select id from public.adicionais where slug = 'copia-pais-20x20';
grant select on copia to authenticated;

-- O casal aprova e pede uma cópia para os pais (custo R$ 150) → aguardando o estúdio.
select pg_temp.entrar('c1000000-0000-4000-8000-000000000035');
select is(
  public.aprovar_prova('e1000000-0000-4000-8000-000000000035', 1,
    jsonb_build_array(jsonb_build_object('adicional_id', (select id from copia), 'quantidade', 1))),
  'aprovado_aguardando_pagamento', 'cenário: fechamento pendente com pedido do casal'
);
reset role;

create temp table fat as select id from public.faturas where projeto_id = 'e1000000-0000-4000-8000-000000000035';
grant select on fat to authenticated, anon, service_role;

-- -----------------------------------------------------------------------------
-- Modo simulado visível
-- -----------------------------------------------------------------------------

select pg_temp.entrar('f1000000-0000-4000-8000-000000000035');
select is(public.pagamento_simulado_ativo(), true, 'modo simulado ligado (padrão da 0023)');
reset role;
update private.app_config set value = 'false' where key = 'pagamento_simulado';
select pg_temp.entrar('f1000000-0000-4000-8000-000000000035');
select is(public.pagamento_simulado_ativo(), false, 'desligado em private.app_config → checkout real');
reset role;

set local role anon;
select throws_ok($$ select public.pagamento_simulado_ativo() $$, '42501', null, 'anon não consulta o modo de pagamento');
select throws_ok($$ select * from public.preparar_checkout_fatura((select id from fat)) $$, '42501', null, 'anon não prepara checkout');
reset role;

-- -----------------------------------------------------------------------------
-- Travas do checkout (as mesmas do pagamento simulado)
-- -----------------------------------------------------------------------------

select pg_temp.entrar('f1000000-0000-4000-8000-000000000035');
select throws_ok(
  $$ select * from public.preparar_checkout_fatura((select id from fat)) $$,
  'P0001', 'Confirme ou recuse os adicionais pedidos pelo cliente antes de pagar.',
  'não abre checkout com adicional do casal aguardando o estúdio'
);
select is(
  public.decidir_adicional((select i.id from public.fatura_itens i where i.fatura_id = (select id from fat) and i.tipo = 'adicional'), true),
  'pendente', 'estúdio aceita a cópia'
);
select results_eq(
  $$ select projeto_nome, projeto_numero is not null, valor_total, stripe_checkout_session_id
     from public.preparar_checkout_fatura((select id from fat)) $$,
  $$ values ('Projeto 35'::text, true, 174::numeric, null::text) $$,
  'estúdio dono: o banco devolve o valor a cobrar (2×12 + 150 = R$ 174)'
);
reset role;

select pg_temp.entrar('f2000000-0000-4000-8000-000000000035');
select throws_ok(
  $$ select * from public.preparar_checkout_fatura((select id from fat)) $$,
  '42501', 'Só o estúdio dono do projeto paga esta fatura.', 'outro estúdio não abre checkout'
);
select throws_ok(
  $$ select public.registrar_checkout_fatura((select id from fat), 'cs_test_intruso') $$,
  '42704', null, 'outro estúdio não grava sessão na fatura'
);
reset role;

select pg_temp.entrar('c1000000-0000-4000-8000-000000000035');
select throws_ok(
  $$ select * from public.preparar_checkout_fatura((select id from fat)) $$,
  '42501', null, 'o casal não paga (white label)'
);
reset role;

-- -----------------------------------------------------------------------------
-- Sessão registrada
-- -----------------------------------------------------------------------------

select pg_temp.entrar('f1000000-0000-4000-8000-000000000035');
select throws_ok(
  $$ select public.registrar_checkout_fatura((select id from fat), 'qualquer coisa') $$,
  '22023', 'Sessão de pagamento inválida.', 'só aceita id de Checkout Session'
);
select lives_ok(
  $$ select public.registrar_checkout_fatura((select id from fat), 'cs_test_abc123') $$,
  'estúdio dono grava a sessão aberta'
);
select is(
  (select stripe_checkout_session_id from public.preparar_checkout_fatura((select id from fat))),
  'cs_test_abc123', 'a próxima tentativa enxerga a sessão para reaproveitar'
);
reset role;

-- -----------------------------------------------------------------------------
-- Webhook confirma; depois disso nada abre checkout
-- -----------------------------------------------------------------------------

set local role service_role;
select lives_ok(
  $$ select public.confirmar_pagamento_fatura((select id from fat), 'pix') $$,
  'webhook (service_role) confirma a fatura paga por Pix'
);
reset role;
select results_eq(
  $$ select f.status_pagamento::text, f.forma_pagamento::text, p.status::text
     from public.faturas f join public.projetos p on p.id = f.projeto_id where f.id = (select id from fat) $$,
  $$ values ('pago'::text, 'pix'::text, 'aprovado'::text) $$,
  'fatura paga e álbum liberado para impressão'
);

select pg_temp.entrar('f1000000-0000-4000-8000-000000000035');
select throws_ok(
  $$ select * from public.preparar_checkout_fatura((select id from fat)) $$,
  '42704', 'Fatura não encontrada ou já processada.', 'fatura paga não abre outro checkout'
);
select throws_ok(
  $$ select public.registrar_checkout_fatura((select id from fat), 'cs_test_depois') $$,
  '42704', null, 'nem grava sessão nova'
);
reset role;

select * from finish();
rollback;
