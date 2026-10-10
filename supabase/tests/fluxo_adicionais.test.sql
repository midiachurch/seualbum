-- =============================================================================
-- Teste ponta a ponta do fluxo de adicionais (migrations 0023, 0026, 0026b)
-- contra o banco LOCAL: `supabase start` + `supabase test db`.
--
-- Cada papel age como na API (role `authenticated` + `request.jwt.claims`),
-- então as policies de RLS e as checagens de `auth.uid()` valem de verdade.
--
--   P1: 17 lâminas (franquia 15, R$ 12) + adicional pedido pelo casal →
--       fatura de fechamento → estúdio aceita → paga (simulado) → aprovado.
--   P2: só adicional do casal, estúdio recusa → fatura cancelada → aprovado.
--   P3: estúdio aprova com adicional próprio; pagamento simulado desligado
--       recusa; webhook (service_role) confirma; reentrega é idempotente.
--   P4: sem excedente e sem adicionais → aprovado direto, sem fatura.
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(54);

-- -----------------------------------------------------------------------------
-- Cenário
-- -----------------------------------------------------------------------------

create function pg_temp.entrar(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@teste.local',  '{"role":"admin"}',     '{}', now(), now()),
  ('0b000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'oper@teste.local',   '{"role":"operador"}',  '{}', now(), now()),
  ('d0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'design@teste.local', '{"role":"designer"}',  '{}', now(), now()),
  ('f1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f1@teste.local',     '{"role":"fotografo"}', '{"estudio":"Estúdio Um"}', now(), now()),
  ('f2000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f2@teste.local',     '{"role":"fotografo"}', '{"estudio":"Estúdio Dois"}', now(), now()),
  ('c1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'casal@teste.local',  '{"role":"cliente"}',   '{}', now(), now());

insert into public.clientes (id, user_id, fotografo_id, nome, email)
values ('cc000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
        'f1000000-0000-4000-8000-000000000001', 'Ana e Bruno', 'casal@teste.local');

insert into public.projetos (id, nome, cliente_id, fotografo_id, status, laminas_inclusas, preco_lamina_extra)
select ('e' || n || '000000-0000-4000-8000-000000000001')::uuid, 'Projeto ' || n,
       'cc000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001',
       'aguardando_aprovacao_cliente', 15, 12
from generate_series(1, 4) n;

-- Versão 1 aprovada internamente: P1 com capa + 17 lâminas; os demais com 10.
insert into public.design_versions (id, projeto_id, numero, status)
select ('e' || n || '100000-0000-4000-8000-000000000001')::uuid, ('e' || n || '000000-0000-4000-8000-000000000001')::uuid, 1, 'aprovada'
from generate_series(1, 4) n;

insert into public.versoes_laminas (versao_id, ordem, storage_path, eh_capa)
select 'e1100000-0000-4000-8000-000000000001', o, 'x/' || o || '.jpg', o = 1 from generate_series(1, 18) o;
insert into public.versoes_laminas (versao_id, ordem, storage_path)
select ('e' || n || '100000-0000-4000-8000-000000000001')::uuid, o, 'x/' || o || '.jpg'
from generate_series(2, 4) n, generate_series(1, 10) o;

-- O estúdio vende a cópia para os pais por R$ 400 e NÃO oferece a caixa ao casal.
insert into public.adicionais_estudio (fotografo_id, adicional_id, preco_revenda, oferecer_ao_cliente)
select 'f1000000-0000-4000-8000-000000000001', id, case slug when 'copia-pais-20x20' then 400 end, slug = 'copia-pais-20x20'
from public.adicionais;

create temp table ids as
select (select id from public.adicionais where slug = 'copia-pais-20x20') as copia,
       (select id from public.adicionais where slug = 'caixa-acrilica-premium') as caixa;
grant select on ids to authenticated;

-- =============================================================================
-- P1 — casal pede adicional + lâminas extras
-- =============================================================================

-- 1. Ofertas: o casal vê só o que o estúdio oferece, pelo preço de revenda.
select pg_temp.entrar('c1000000-0000-4000-8000-000000000001');
select results_eq(
  $$ select nome, preco, preco_revenda from public.ofertas_da_prova('e1000000-0000-4000-8000-000000000001') $$,
  $$ values ('Cópia para os pais (20×20)'::text, 400::numeric, 400::numeric) $$,
  'casal: só a cópia (a caixa foi desligada), pela revenda — sem custo'
);
select is_empty($$ select 1 from public.adicionais $$, 'casal não lê o catálogo (custo é segredo)');
reset role;

select pg_temp.entrar('f1000000-0000-4000-8000-000000000001');
select results_eq(
  $$ select nome, preco, preco_revenda from public.ofertas_da_prova('e1000000-0000-4000-8000-000000000001') $$,
  $$ values ('Cópia para os pais (20×20)'::text, 150::numeric, 400::numeric),
            ('Caixa acrílica premium'::text, 90::numeric, 190::numeric) $$,
  'estúdio dono: tudo o que está ativo, pelo custo, com a revenda'
);
select results_eq(
  $$ select laminas, inclusas, excedente, valor from public.calcular_excedente('e1000000-0000-4000-8000-000000000001') $$,
  $$ values (17, 15, 2, 24::numeric) $$,
  'prévia do estúdio: 17 lâminas (capa não conta), 2 extras = R$ 24'
);
reset role;

select pg_temp.entrar('f2000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select * from public.ofertas_da_prova('e1000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'outro estúdio não vê as ofertas do projeto'
);
reset role;

-- 2. O casal aprova com a cópia (×2) e tenta enfiar a caixa desligada e um preço.
select pg_temp.entrar('c1000000-0000-4000-8000-000000000001');
select is(
  public.aprovar_prova('e1000000-0000-4000-8000-000000000001', 1,
    jsonb_build_array(
      jsonb_build_object('adicional_id', (select copia from ids), 'quantidade', 2, 'preco', 0.01),
      jsonb_build_object('adicional_id', (select caixa from ids), 'quantidade', 1))),
  'aprovado_aguardando_pagamento',
  'aprovação com adicional → fechamento pendente'
);
select is_empty($$ select 1 from public.faturas $$, 'casal não vê fatura (white label)');
select is_empty($$ select 1 from public.fatura_itens $$, 'casal não vê itens da fatura');
reset role;

-- 3. O que o banco gravou.
select results_eq(
  $$ select f.tipo, f.status_pagamento::text, f.valor_total, f.laminas_versao, f.laminas_inclusas
     from public.faturas f where f.projeto_id = 'e1000000-0000-4000-8000-000000000001' $$,
  $$ values ('fechamento'::text, 'pendente'::text, 324::numeric, 17, 15) $$,
  'fatura de fechamento: 2×12 (lâminas) + 2×150 (custo da cópia) = R$ 324'
);
select results_eq(
  $$ select i.tipo, i.quantidade, i.valor_unitario, i.preco_revenda_unitario, i.origem, i.situacao
     from public.fatura_itens i join public.faturas f on f.id = i.fatura_id
     where f.projeto_id = 'e1000000-0000-4000-8000-000000000001' order by i.tipo desc $$,
  $$ values ('laminas_extras'::text, 2, 12::numeric, null::numeric, 'sistema'::text, 'confirmado'::text),
            ('adicional'::text, 2, 150::numeric, 400::numeric, 'cliente'::text, 'aguardando_estudio'::text) $$,
  'itens: lâminas confirmadas; cópia do casal aguardando o estúdio (a caixa desligada foi descartada)'
);
select is(
  (select jsonb_array_length(itens_json) from public.faturas where projeto_id = 'e1000000-0000-4000-8000-000000000001'),
  2, 'itens_json legado sincronizado'
);
select ok(
  exists (select 1 from public.comunicacoes_log
          where projeto_id = 'e1000000-0000-4000-8000-000000000001' and destinatario = 'fotografo'
            and tipo_evento = 'excedente_pendente' and assunto like 'Seu cliente pediu adicionais%'
            and corpo_html like '%aguarda sua confirmação%'),
  'estúdio recebe o aviso "Seu cliente pediu adicionais"'
);
select ok(
  exists (select 1 from public.projeto_atividades
          where projeto_id = 'e1000000-0000-4000-8000-000000000001'
            and mensagem like 'Cliente aprovou a versão 1 — 17 lâminas (plano cobre 15): 2 lâminas extras — 1 adicional escolhido (aguardando o estúdio confirmar)%'),
  'histórico registra a aprovação com extras e adicional'
);

-- 4. Ninguém fecha com item aguardando.
select pg_temp.entrar('f1000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.pagar_fatura_simulada((select id from public.faturas where projeto_id = 'e1000000-0000-4000-8000-000000000001'), 'pix') $$,
  'P0001', 'Confirme ou recuse os adicionais pedidos pelo cliente antes de pagar.',
  'estúdio não paga com adicional aguardando decisão'
);
select throws_ok(
  $$ update public.projetos set status = 'aprovado' where id = 'e1000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'estúdio não pula a cobrança mudando o status na mão'
);
reset role;

select pg_temp.entrar('a0000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.dispensar_fatura((select id from public.faturas where projeto_id = 'e1000000-0000-4000-8000-000000000001'), 'cortesia teste') $$,
  'P0001', null, 'gestão não dá cortesia com adicional aguardando o estúdio'
);
reset role;

select throws_ok(
  $$ select public.confirmar_pagamento_fatura((select id from public.faturas where projeto_id = 'e1000000-0000-4000-8000-000000000001'), 'cartao') $$,
  'P0001', 'Fatura com adicionais aguardando o estúdio.',
  'webhook (service_role) também recusa com adicional aguardando'
);

-- 5. Decisão: só o estúdio dono.
select pg_temp.entrar('f2000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.decidir_adicional((select id from public.fatura_itens where tipo = 'adicional' and situacao = 'aguardando_estudio' limit 1), true) $$,
  null, null, 'outro estúdio não decide (nem enxerga o item)'
);
reset role;

select pg_temp.entrar('c1000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.decidir_adicional('00000000-0000-4000-8000-000000000000', true) $$,
  '42704', null, 'casal não decide'
);
reset role;

select pg_temp.entrar('f1000000-0000-4000-8000-000000000001');
create temp table item_p1 as
  select i.id from public.fatura_itens i join public.faturas f on f.id = i.fatura_id
  where f.projeto_id = 'e1000000-0000-4000-8000-000000000001' and i.tipo = 'adicional';
select is(public.decidir_adicional((select id from item_p1), true), 'pendente', 'estúdio aceita a cópia → segue pendente de pagamento');
select throws_ok(
  $$ select public.decidir_adicional((select id from item_p1), false) $$,
  'P0001', 'Este adicional já foi decidido.', 'não dá para decidir duas vezes'
);
select results_eq(
  $$ select situacao, decidido_por from public.fatura_itens where id = (select id from item_p1) $$,
  $$ values ('confirmado'::text, 'f1000000-0000-4000-8000-000000000001'::uuid) $$,
  'item confirmado, com quem decidiu'
);
select is((select valor_total from public.faturas where projeto_id = 'e1000000-0000-4000-8000-000000000001'), 324::numeric, 'total mantido ao aceitar');

-- 6. Pagamento simulado (Pix).
select lives_ok(
  $$ select public.pagar_fatura_simulada((select id from public.faturas where projeto_id = 'e1000000-0000-4000-8000-000000000001'), 'pix') $$,
  'estúdio paga o fechamento (simulado)'
);
select results_eq(
  $$ select status_pagamento::text, forma_pagamento::text, pago_em is not null from public.faturas where projeto_id = 'e1000000-0000-4000-8000-000000000001' $$,
  $$ values ('pago'::text, 'pix'::text, true) $$,
  'fatura paga, Pix, com data'
);
select is((select status::text from public.projetos where id = 'e1000000-0000-4000-8000-000000000001'), 'aprovado', 'projeto liberado para impressão');
select throws_ok(
  $$ select public.pagar_fatura_simulada((select id from public.faturas where projeto_id = 'e1000000-0000-4000-8000-000000000001'), 'pix') $$,
  '42704', null, 'pagar de novo é recusado'
);
reset role;

select ok(
  exists (select 1 from public.projeto_atividades where projeto_id = 'e1000000-0000-4000-8000-000000000001'
          and mensagem = 'Pagamento de R$ 324,00 confirmado (Pix, simulado) — liberado para impressão.'),
  'histórico do pagamento simulado'
);
select ok(
  exists (select 1 from public.comunicacoes_log where projeto_id = 'e1000000-0000-4000-8000-000000000001'
          and destinatario = 'cliente' and tipo_evento = 'aprovado'),
  'casal recebe "Álbum aprovado — a caminho da gráfica"'
);

-- 7. Quem vê o que depois de pago (gráfica / admin / designer).
select pg_temp.entrar('0b000000-0000-4000-8000-000000000001');
select results_eq(
  $$ select i.descricao, i.quantidade from public.fatura_itens i join public.faturas f on f.id = i.fatura_id
     where f.projeto_id = 'e1000000-0000-4000-8000-000000000001' and f.status_pagamento in ('pago', 'dispensada')
       and i.tipo = 'adicional' and i.situacao = 'confirmado' $$,
  $$ values ('Cópia para os pais (20×20)'::text, 2) $$,
  'operação (gráfica) vê o adicional pago para produzir'
);
reset role;

select pg_temp.entrar('a0000000-0000-4000-8000-000000000001');
select is(
  (select sum(i.quantidade)::int from public.fatura_itens i join public.faturas f on f.id = i.fatura_id
   where i.adicional_id = (select copia from ids) and i.situacao = 'confirmado'
     and f.projeto_id = 'e1000000-0000-4000-8000-000000000001'),
  2, 'admin conta as unidades vendidas da cópia'
);
reset role;

select pg_temp.entrar('d0000000-0000-4000-8000-000000000001');
select is_empty($$ select 1 from public.faturas $$, 'designer não vê faturas');
select is((select status::text from public.projetos where id = 'e1000000-0000-4000-8000-000000000001'), 'aprovado', 'designer vê o projeto aprovado');
reset role;

-- =============================================================================
-- P2 — casal pede, estúdio recusa e não há lâmina extra → libera sem cobrança
-- =============================================================================

select pg_temp.entrar('c1000000-0000-4000-8000-000000000001');
select is(
  public.aprovar_prova('e2000000-0000-4000-8000-000000000001', 1,
    jsonb_build_array(jsonb_build_object('adicional_id', (select copia from ids), 'quantidade', 1))),
  'aprovado_aguardando_pagamento', 'P2: só adicional do casal → fechamento pendente'
);
reset role;
select is((select valor_total from public.faturas where projeto_id = 'e2000000-0000-4000-8000-000000000001'), 150::numeric, 'P2: fatura de R$ 150 (custo)');

select pg_temp.entrar('f1000000-0000-4000-8000-000000000001');
select is(
  public.decidir_adicional((select i.id from public.fatura_itens i join public.faturas f on f.id = i.fatura_id
                            where f.projeto_id = 'e2000000-0000-4000-8000-000000000001'), false),
  'liberado', 'P2: estúdio recusa → liberado'
);
reset role;
select results_eq(
  $$ select status_pagamento::text, valor_total from public.faturas where projeto_id = 'e2000000-0000-4000-8000-000000000001' $$,
  $$ values ('cancelado'::text, 0::numeric) $$,
  'P2: fatura cancelada, total zerado'
);
select is((select status::text from public.projetos where id = 'e2000000-0000-4000-8000-000000000001'), 'aprovado', 'P2: projeto aprovado para impressão');
select ok(
  exists (select 1 from public.projeto_atividades where projeto_id = 'e2000000-0000-4000-8000-000000000001'
          and mensagem like 'Estúdio recusou o adicional pedido pelo cliente: Cópia%'),
  'P2: histórico da recusa'
);

-- =============================================================================
-- P3 — estúdio aprova com adicional próprio; pagamento via webhook
-- =============================================================================

select pg_temp.entrar('f1000000-0000-4000-8000-000000000001');
select is(
  public.aprovar_prova('e3000000-0000-4000-8000-000000000001', 1,
    jsonb_build_array(jsonb_build_object('adicional_id', (select caixa from ids), 'quantidade', 50))),
  'aprovado_aguardando_pagamento', 'P3: estúdio escolhe a caixa (que ele não oferece ao casal)'
);
select results_eq(
  $$ select i.quantidade, i.valor_unitario, i.origem, i.situacao from public.fatura_itens i join public.faturas f on f.id = i.fatura_id
     where f.projeto_id = 'e3000000-0000-4000-8000-000000000001' $$,
  $$ values (10, 90::numeric, 'fotografo'::text, 'confirmado'::text) $$,
  'P3: entra confirmada, pelo custo, quantidade limitada a 10'
);
select is(
  (select assunto from public.comunicacoes_log where projeto_id = 'e3000000-0000-4000-8000-000000000001' and tipo_evento = 'excedente_pendente'),
  'Álbum aprovado — fechamento pendente — Projeto 3', 'P3: aviso de fechamento pendente (sem pedido do casal)'
);
reset role;

update private.app_config set value = 'false' where key = 'pagamento_simulado';
select pg_temp.entrar('f1000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.pagar_fatura_simulada((select id from public.faturas where projeto_id = 'e3000000-0000-4000-8000-000000000001'), 'cartao') $$,
  '42501', 'Pagamento simulado desativado — use o checkout.', 'P3: com o modo simulado desligado, o banco recusa'
);
select throws_ok(
  $$ select public.confirmar_pagamento_fatura((select id from public.faturas where projeto_id = 'e3000000-0000-4000-8000-000000000001'), 'cartao') $$,
  '42501', null, 'P3: estúdio não chama a confirmação do webhook'
);
reset role;

set local role service_role;
select lives_ok(
  $$ select public.confirmar_pagamento_fatura((select id from public.faturas where projeto_id = 'e3000000-0000-4000-8000-000000000001'), 'cartao') $$,
  'P3: webhook (service_role) confirma o pagamento'
);
select lives_ok(
  $$ select public.confirmar_pagamento_fatura((select id from public.faturas where projeto_id = 'e3000000-0000-4000-8000-000000000001'), 'cartao') $$,
  'P3: reentrega do webhook é idempotente'
);
reset role;
select results_eq(
  $$ select f.status_pagamento::text, f.valor_total, p.status::text from public.faturas f join public.projetos p on p.id = f.projeto_id
     where f.projeto_id = 'e3000000-0000-4000-8000-000000000001' $$,
  $$ values ('pago'::text, 900::numeric, 'aprovado'::text) $$,
  'P3: pago R$ 900 e liberado'
);
select is(
  (select count(*)::int from public.projeto_atividades where projeto_id = 'e3000000-0000-4000-8000-000000000001' and mensagem like 'Pagamento de R$ 900,00 confirmado%'),
  1, 'P3: um único registro de pagamento'
);
update private.app_config set value = 'true' where key = 'pagamento_simulado';

-- =============================================================================
-- P4 — sem extras e sem adicionais: impressão direta
-- =============================================================================

select pg_temp.entrar('c1000000-0000-4000-8000-000000000001');
select is(public.aprovar_prova('e4000000-0000-4000-8000-000000000001', 1, '[]'::jsonb), 'aprovado', 'P4: aprovado direto');
select throws_ok(
  $$ select public.aprovar_prova('e4000000-0000-4000-8000-000000000001', 1, '[]'::jsonb) $$,
  'P0001', 'A prova não está aguardando aprovação no momento.', 'P4: aprovar de novo é recusado'
);
reset role;
select is_empty($$ select 1 from public.faturas where projeto_id = 'e4000000-0000-4000-8000-000000000001' $$, 'P4: nenhuma fatura');

-- Acesso anônimo às funções do fluxo.
set local role anon;
select throws_ok($$ select public.aprovar_prova('e4000000-0000-4000-8000-000000000001', 1, '[]'::jsonb) $$, '42501', null, 'anon não aprova');
select throws_ok($$ select * from public.ofertas_da_prova('e4000000-0000-4000-8000-000000000001') $$, '42501', null, 'anon não vê ofertas');
reset role;

select pg_temp.entrar('c1000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.pagar_fatura_simulada((select id from public.faturas limit 1), 'pix') $$,
  '42704', null, 'casal não paga fatura (nem a enxerga)'
);
reset role;

select * from finish();
rollback;
