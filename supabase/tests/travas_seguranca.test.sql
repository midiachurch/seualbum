-- =============================================================================
-- Migration 0041: travas de segurança. Rodar com `supabase start` +
-- `supabase test db` (LOCAL).
--
-- Cada ataque da auditoria é refeito pela sessão do usuário (role
-- `authenticated` + `request.jwt.claims`, como na API) e precisa falhar; ao
-- lado, o fluxo legítimo equivalente precisa continuar passando.
--
--   FA (estúdio A) e FB (estúdio B); CA = casal do estúdio A (portal);
--   E = conta de cliente qualquer; E2 = cliente que já tinha forjado a linha
--   em `fotografos` antes da 0041; F3 = fotógrafo sem a linha em `fotografos`.
--   P1: projeto de A (casal CA). P2: projeto de B.
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(70);

create function pg_temp.entrar(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.plano(p_slug text) returns uuid language sql as $$
  select id from public.planos where slug = p_slug;
$$;

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a0000000-0000-4000-8000-000000000041', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-41@teste.local',  '{"role":"admin"}',     '{}', now(), now()),
  ('b0000000-0000-4000-8000-000000000041', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gestor-41@teste.local', '{"role":"gestor"}',    '{}', now(), now()),
  ('d0000000-0000-4000-8000-000000000041', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'oper-41@teste.local',   '{"role":"operador"}',  '{}', now(), now()),
  ('f1000000-0000-4000-8000-000000000041', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fa-41@teste.local',     '{"role":"fotografo"}', '{"estudio":"Estúdio <b>A</b>"}', now(), now()),
  ('f2000000-0000-4000-8000-000000000041', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fb-41@teste.local',     '{"role":"fotografo"}', '{"estudio":"Estúdio B"}', now(), now()),
  ('f3000000-0000-4000-8000-000000000041', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f3-41@teste.local',     '{"role":"fotografo"}', '{"estudio":"Estúdio Três"}', now(), now()),
  ('c1000000-0000-4000-8000-000000000041', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ca-41@teste.local',     '{"role":"cliente"}',   '{}', now(), now()),
  ('e1000000-0000-4000-8000-000000000041', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e-41@teste.local',      '{"role":"cliente"}',   '{}', now(), now()),
  ('e2000000-0000-4000-8000-000000000041', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e2-41@teste.local',     '{"role":"cliente"}',   '{}', now(), now()),
  -- Cadastro com Google: sem papel em app_metadata, nasce cliente.
  ('90000000-0000-4000-8000-000000000041', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'google-41@teste.local', '{}', '{"full_name":"Estúdio Google"}', now(), now());

insert into public.clientes (id, user_id, fotografo_id, nome, email, observacoes_internas) values
  ('cc100000-0000-4000-8000-000000000041', 'c1000000-0000-4000-8000-000000000041', 'f1000000-0000-4000-8000-000000000041', 'Ana <script>x()</script> & Bruno', 'ca-41@teste.local', 'Nota interna: atrasa pagamento'),
  ('cc200000-0000-4000-8000-000000000041', null, 'f2000000-0000-4000-8000-000000000041', 'Carla e Davi', 'cd-41@teste.local', null);

insert into public.projetos (id, nome, cliente_id, fotografo_id, status, laminas_inclusas, preco_lamina_extra) values
  ('11000000-0000-4000-8000-000000000041', 'Projeto A', 'cc100000-0000-4000-8000-000000000041', 'f1000000-0000-4000-8000-000000000041', 'em_diagramacao', 20, 50),
  ('12000000-0000-4000-8000-000000000041', 'Projeto B', 'cc200000-0000-4000-8000-000000000041', 'f2000000-0000-4000-8000-000000000041', 'em_diagramacao', 20, 50);

-- E2 já tinha forjado a própria linha de estúdio com assinatura (antes da 0041).
insert into public.fotografos (id, estudio, plano_id, status)
values ('e2000000-0000-4000-8000-000000000041', 'Estúdio Forjado', pg_temp.plano('studio-mensal'), 'ativo');

-- F3: perfil de fotógrafo sem a linha em `fotografos`.
delete from public.fotografos where id = 'f3000000-0000-4000-8000-000000000041';

-- =============================================================================
-- 1. fotografos / assinatura
-- =============================================================================
select pg_temp.entrar('e1000000-0000-4000-8000-000000000041');

select throws_ok(
  $$ insert into public.fotografos (id, estudio, plano_id, status)
     values ('e1000000-0000-4000-8000-000000000041', 'Estúdio Falso', (select id from public.planos where slug = 'studio-mensal'), 'ativo') $$,
  '42501', null,
  'ataque: conta de cliente não se cadastra como estúdio assinante'
);
select is(public.minha_assinatura(), null::uuid, 'conta de cliente não tem assinatura');
select throws_ok(
  $$ insert into public.orders (client_id, plan_id, nome_projeto, link_fotos_brutas, estilo_design, status)
     values ('e1000000-0000-4000-8000-000000000041', null, 'Pedido do casal', 'https://x.teste/f', 'classico', 'pendente') $$,
  '42501', null,
  'conta de cliente não cria pedido de estúdio'
);

select pg_temp.entrar('e2000000-0000-4000-8000-000000000041');
select is(public.minha_assinatura(), null::uuid, 'linha forjada em fotografos não vale como assinatura para quem não é fotógrafo');
select throws_ok(
  $$ insert into public.orders (client_id, plan_id, nome_projeto, link_fotos_brutas, estilo_design, status)
     values ('e2000000-0000-4000-8000-000000000041', (select id from public.planos where slug = 'studio-mensal'),
             'Álbum grátis', 'https://x.teste/f', 'classico', 'na_fila_design') $$,
  '42501', null,
  'ataque: pedido já liberado (sem pagar) com assinatura forjada é barrado'
);

select pg_temp.entrar('f3000000-0000-4000-8000-000000000041');
select lives_ok(
  $$ insert into public.fotografos (id, estudio, plano_id, status)
     values ('f3000000-0000-4000-8000-000000000041', 'Estúdio Três', (select id from public.planos where slug = 'studio-mensal'), 'inativo') $$,
  'fotógrafo ainda cria a própria linha de estúdio'
);
select results_eq(
  $$ select plano_id, status from public.fotografos where id = 'f3000000-0000-4000-8000-000000000041' $$,
  $$ values (null::uuid, 'ativo'::text) $$,
  'mas plano e status nascem no padrão (só a gestão define)'
);
select is(public.minha_assinatura(), null::uuid, 'e não ganha assinatura com isso');

-- Gestão dá a assinatura ao estúdio A (fluxo legítimo).
select pg_temp.entrar('b0000000-0000-4000-8000-000000000041');
select lives_ok(
  $$ update public.fotografos set plano_id = (select id from public.planos where slug = 'essencial-mensal')
     where id = 'f1000000-0000-4000-8000-000000000041' $$,
  'gestão atribui a assinatura ao estúdio'
);
select lives_ok(
  $$ insert into public.fotografos (id, estudio, plano_id, status)
     values ('e1000000-0000-4000-8000-000000000041', 'Estúdio da Gestão', (select id from public.planos where slug = 'plus-mensal'), 'ativo') $$,
  'gestão ainda cria estúdio com plano'
);
reset role;
select is(
  (select plano_id from public.fotografos where id = 'e1000000-0000-4000-8000-000000000041'),
  pg_temp.plano('plus-mensal'),
  'plano escolhido pela gestão é mantido'
);

-- Assinante legítimo: pedido entra liberado e vira projeto.
select pg_temp.entrar('f1000000-0000-4000-8000-000000000041');
select is(public.minha_assinatura(), pg_temp.plano('essencial-mensal'), 'estúdio assinante enxerga a assinatura');
select lives_ok(
  $$ insert into public.orders (id, client_id, plan_id, nome_projeto, link_fotos_brutas, estilo_design, status, cliente_final_nome)
     values ('0a100000-0000-4000-8000-000000000041', 'f1000000-0000-4000-8000-000000000041',
             (select id from public.planos where slug = 'essencial-mensal'),
             'Casamento assinante', 'https://x.teste/f', 'classico', 'na_fila_design', 'Casal Assinante') $$,
  'assinante cria pedido já na fila de design'
);
reset role;
select results_eq(
  $$ select p.status::text, p.laminas_inclusas, p.preco_lamina_extra, p.fotografo_id
       from public.orders o join public.projetos p on p.id = o.projeto_id
      where o.id = '0a100000-0000-4000-8000-000000000041' $$,
  $$ values ('pronto_para_diagramacao'::text, 25, 9.00::numeric(10,2), 'f1000000-0000-4000-8000-000000000041'::uuid) $$,
  'conversão pedido → projeto segue funcionando (status de produção e franquia do plano)'
);
select is(
  (select count(*) from public.projeto_atividades a join public.orders o on o.projeto_id = a.projeto_id
    where o.id = '0a100000-0000-4000-8000-000000000041' and a.autor_id is null),
  1::bigint,
  'atividade da conversão segue como "sistema" (autor nulo)'
);

-- Cadastro com Google segue criando o estúdio.
select pg_temp.entrar('90000000-0000-4000-8000-000000000041');
select is(public.concluir_cadastro_google()::text, 'fotografo', 'cadastro com Google promove a fotógrafo');
reset role;
select ok(
  exists (select 1 from public.fotografos where id = '90000000-0000-4000-8000-000000000041' and plano_id is null),
  'e cria a linha em fotografos'
);
select ok(
  exists (select 1 from public.fotografos where id = 'f1000000-0000-4000-8000-000000000041'),
  'cadastro normal de fotógrafo (handle_new_user) segue criando a linha em fotografos'
);

-- =============================================================================
-- 2. projetos: INSERT pela sessão
-- =============================================================================
select pg_temp.entrar('f1000000-0000-4000-8000-000000000041');
select lives_ok(
  $$ insert into public.projetos (id, nome, cliente_id, fotografo_id, status, laminas_inclusas, preco_lamina_extra,
                                  responsavel_id, plano_id, codigo_rastreio, prioridade)
     values ('13000000-0000-4000-8000-000000000041', 'Direto aprovado', 'cc100000-0000-4000-8000-000000000041',
             'f1000000-0000-4000-8000-000000000041', 'aprovado', 999, 0, 'd0000000-0000-4000-8000-000000000041',
             (select id from public.planos where slug = 'studio-avulso'), 'XX123', 'urgente') $$,
  'fotógrafo insere projeto (campos de produção são ignorados)'
);
select results_eq(
  $$ select status::text, laminas_inclusas, preco_lamina_extra, responsavel_id, plano_id, codigo_rastreio, prioridade
       from public.projetos where id = '13000000-0000-4000-8000-000000000041' $$,
  $$ values ('projeto_criado'::text, null::integer, null::numeric(10,2), null::uuid, null::uuid, null::text, 'normal'::text) $$,
  'ataque: projeto nasce "projeto_criado", sem franquia, responsável, plano nem expedição'
);
select throws_ok(
  $$ insert into public.projetos (nome, cliente_id, fotografo_id)
     values ('Cliente alheio', 'cc200000-0000-4000-8000-000000000041', 'f1000000-0000-4000-8000-000000000041') $$,
  '42501', null,
  'ataque: projeto não aponta para cliente de outro estúdio'
);

select pg_temp.entrar('b0000000-0000-4000-8000-000000000041');
select lives_ok(
  $$ insert into public.projetos (id, nome, cliente_id, fotografo_id, status, responsavel_id, laminas_inclusas, preco_lamina_extra)
     values ('14000000-0000-4000-8000-000000000041', 'Pela gestão', 'cc100000-0000-4000-8000-000000000041',
             'f1000000-0000-4000-8000-000000000041', 'em_diagramacao', 'd0000000-0000-4000-8000-000000000041', 30, 10) $$,
  'gestão cria projeto com status e franquia'
);
select results_eq(
  $$ select status::text, responsavel_id, laminas_inclusas from public.projetos where id = '14000000-0000-4000-8000-000000000041' $$,
  $$ values ('em_diagramacao'::text, 'd0000000-0000-4000-8000-000000000041'::uuid, 30) $$,
  'gestão mantém o que escolheu'
);

-- =============================================================================
-- 3. orders: campos do pedido pela sessão do estúdio
-- =============================================================================
select pg_temp.entrar('f1000000-0000-4000-8000-000000000041');
select lives_ok(
  $$ insert into public.orders (id, client_id, plan_id, nome_projeto, link_fotos_brutas, estilo_design, status, chave_idempotencia)
     values ('0b100000-0000-4000-8000-000000000041', 'f1000000-0000-4000-8000-000000000041',
             (select id from public.planos where slug = 'essencial-avulso'), 'Avulso', 'https://x.teste/f', 'classico', 'pendente',
             '0c100000-0000-4000-8000-000000000041'),
            ('0b200000-0000-4000-8000-000000000041', 'f1000000-0000-4000-8000-000000000041',
             (select id from public.planos where slug = 'essencial-avulso'), 'Avulso 2', 'https://x.teste/f', 'classico', 'pendente', null) $$,
  'estúdio cria pedidos pendentes'
);
select lives_ok(
  $$ update public.orders set plan_id = (select id from public.planos where slug = 'plus-avulso')
     where id = '0b200000-0000-4000-8000-000000000041' $$,
  'antes do checkout o plano do pedido pendente ainda pode mudar'
);
select lives_ok(
  $$ update public.orders set stripe_checkout_session_id = 'cs_test_1' where id = '0b100000-0000-4000-8000-000000000041' $$,
  'app grava a sessão do checkout (iniciarPagamentoAction)'
);
select throws_ok(
  $$ update public.orders set plan_id = (select id from public.planos where slug = 'studio-avulso')
     where id = '0b100000-0000-4000-8000-000000000041' $$,
  '42501', null,
  'ataque: trocar o plano depois de abrir o checkout'
);
select throws_ok(
  $$ update public.orders set stripe_checkout_session_id = null where id = '0b100000-0000-4000-8000-000000000041' $$,
  '42501', null,
  'ataque: apagar a sessão do checkout para destravar o plano'
);
select lives_ok(
  $$ update public.orders set stripe_checkout_session_id = 'cs_test_2' where id = '0b100000-0000-4000-8000-000000000041' $$,
  'app ainda troca por uma sessão nova (a anterior expirou)'
);
select throws_ok(
  $$ update public.orders set projeto_id = '12000000-0000-4000-8000-000000000041' where id = '0b100000-0000-4000-8000-000000000041' $$,
  '42501', null,
  'ataque: ligar o pedido ao projeto de outro estúdio'
);
select throws_ok(
  $$ update public.orders set projeto_id = '13000000-0000-4000-8000-000000000041' where id = '0b100000-0000-4000-8000-000000000041' $$,
  '42501', null,
  'nem ao próprio projeto (o vínculo é da conversão)'
);
select throws_ok(
  $$ update public.orders set chave_idempotencia = gen_random_uuid() where id = '0b100000-0000-4000-8000-000000000041' $$,
  '42501', null,
  'ataque: trocar a chave de idempotência (fotos de outro rascunho)'
);
reset role;
select results_eq(
  $$ select laminas_inclusas, preco_lamina_extra from public.projetos where id = '12000000-0000-4000-8000-000000000041' $$,
  $$ values (20, 50.00::numeric(10,2)) $$,
  'franquia do projeto do estúdio B intacta'
);

-- Webhook (service_role) confirma o pagamento: pedido vira projeto.
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok(
  $$ update public.orders set status = 'na_fila_design', pago_em = now(), valor_pago = 249, stripe_checkout_session_id = 'cs_test_2'
     where id = '0b100000-0000-4000-8000-000000000041' $$,
  'webhook (service_role) confirma o pagamento'
);
reset role;
select ok(
  (select projeto_id is not null from public.orders where id = '0b100000-0000-4000-8000-000000000041'),
  'pedido pago vira projeto'
);

-- =============================================================================
-- 4. projeto_herda_franquia_do_pedido confere o dono
-- =============================================================================
-- Direto como dono do banco (passa por cima das travas da sessão): só a função
-- da franquia decide.
select lives_ok(
  $$ update public.orders set projeto_id = '12000000-0000-4000-8000-000000000041' where id = '0b200000-0000-4000-8000-000000000041' $$,
  'vínculo forçado com projeto de outro estúdio (sem as travas da sessão)'
);
select results_eq(
  $$ select laminas_inclusas, preco_lamina_extra from public.projetos where id = '12000000-0000-4000-8000-000000000041' $$,
  $$ values (20, 50.00::numeric(10,2)) $$,
  'a franquia do pedido não é copiada para projeto de outro estúdio'
);
update public.orders set projeto_id = null where id = '0b200000-0000-4000-8000-000000000041';
update public.orders set projeto_id = '13000000-0000-4000-8000-000000000041' where id = '0b200000-0000-4000-8000-000000000041';
select results_eq(
  $$ select laminas_inclusas, preco_lamina_extra from public.projetos where id = '13000000-0000-4000-8000-000000000041' $$,
  $$ values (20, 12.00::numeric(10,2)) $$,
  'no projeto do próprio estúdio a franquia (plano plus-avulso) é copiada'
);

-- =============================================================================
-- 5. clientes.observacoes_internas
-- =============================================================================
select pg_temp.entrar('c1000000-0000-4000-8000-000000000041');
select throws_ok(
  $$ select observacoes_internas from public.clientes $$,
  '42501', null,
  'ataque: casal não lê a anotação interna do estúdio'
);
select throws_ok(
  $$ select * from public.clientes $$,
  '42501', null,
  'nem por select *'
);
select results_eq(
  $$ select id, nome, email from public.clientes $$,
  $$ values ('cc100000-0000-4000-8000-000000000041'::uuid, 'Ana <script>x()</script> & Bruno'::text, 'ca-41@teste.local'::text) $$,
  'portal do cliente segue lendo o próprio cadastro (colunas explícitas)'
);
select is((select count(*) from public.listar_clientes_visiveis()), 0::bigint, 'casal não lista clientes pela função');
select is(
  (select count(*) from public.projetos where id = '11000000-0000-4000-8000-000000000041'),
  1::bigint,
  'casal segue vendo o próprio projeto (policies que consultam clientes)'
);

select pg_temp.entrar('f1000000-0000-4000-8000-000000000041');
select is(
  (select observacoes_internas from public.listar_clientes_visiveis() where id = 'cc100000-0000-4000-8000-000000000041'),
  'Nota interna: atrasa pagamento',
  'estúdio dono lê a anotação pela função'
);
select is(
  (select count(*) from public.listar_clientes_visiveis() where fotografo_id <> 'f1000000-0000-4000-8000-000000000041'),
  0::bigint,
  'estúdio só lista os próprios clientes'
);
select lives_ok(
  $$ update public.clientes set observacoes_internas = 'Nota revisada' where id = 'cc100000-0000-4000-8000-000000000041' $$,
  'estúdio ainda grava a anotação'
);
select lives_ok(
  $$ insert into public.clientes (fotografo_id, nome, email, observacoes_internas)
     values ('f1000000-0000-4000-8000-000000000041', 'Novo Casal', 'novo-41@teste.local', 'nota') returning id $$,
  'cadastro de cliente com anotação (insert ... returning id)'
);

select pg_temp.entrar('d0000000-0000-4000-8000-000000000041');
select ok(
  (select count(*) from public.listar_clientes_visiveis() where id in ('cc100000-0000-4000-8000-000000000041', 'cc200000-0000-4000-8000-000000000041')) = 2,
  'operação lista todos os clientes pela função'
);

-- =============================================================================
-- 6. projeto_atividades: autor é quem está logado
-- =============================================================================
select pg_temp.entrar('c1000000-0000-4000-8000-000000000041');
select lives_ok(
  $$ insert into public.projeto_atividades (id, projeto_id, autor_id, mensagem)
     values ('a6100000-0000-4000-8000-000000000041', '11000000-0000-4000-8000-000000000041',
             'f1000000-0000-4000-8000-000000000041', 'Fotógrafo autorizou cancelamento') $$,
  'casal registra atividade no próprio projeto'
);
select pg_temp.entrar('b0000000-0000-4000-8000-000000000041');
select lives_ok(
  $$ insert into public.projeto_atividades (id, projeto_id, mensagem)
     values ('a6200000-0000-4000-8000-000000000041', '11000000-0000-4000-8000-000000000041', 'Status alterado.') $$,
  'equipe registra atividade sem autor (como o app faz)'
);
reset role;
select results_eq(
  $$ select autor_id from public.projeto_atividades
      where id in ('a6100000-0000-4000-8000-000000000041', 'a6200000-0000-4000-8000-000000000041') order by id $$,
  $$ values ('c1000000-0000-4000-8000-000000000041'::uuid), ('b0000000-0000-4000-8000-000000000041'::uuid) $$,
  'ataque: autor forjado vira quem está logado; sem autor, também'
);

-- =============================================================================
-- 7. projetos: prazos, produto e expedição só pela equipe
-- =============================================================================
select pg_temp.entrar('f1000000-0000-4000-8000-000000000041');
select throws_ok(
  $$ update public.projetos set data_limite_producao = now() + interval '1 day' where id = '11000000-0000-4000-8000-000000000041' $$,
  '42501', null, 'ataque: estúdio não muda o SLA de produção'
);
select throws_ok(
  $$ update public.projetos set data_limite_aprovacao = now() + interval '90 days' where id = '11000000-0000-4000-8000-000000000041' $$,
  '42501', null, 'ataque: estúdio não estica o prazo de aprovação'
);
select throws_ok(
  $$ update public.projetos set codigo_rastreio = 'FALSO', enviado_em = now() where id = '11000000-0000-4000-8000-000000000041' $$,
  '42501', null, 'ataque: estúdio não forja a expedição'
);
select throws_ok(
  $$ update public.projetos set prazo = now() where id = '11000000-0000-4000-8000-000000000041' $$,
  '42501', null, 'ataque: estúdio não muda o prazo'
);
select throws_ok(
  $$ update public.projetos set produto_id = gen_random_uuid() where id = '11000000-0000-4000-8000-000000000041' $$,
  '42501', null, 'ataque: estúdio não troca o produto'
);
select lives_ok(
  $$ update public.projetos set nome = '<img src=x onerror=alert(1)>', briefing = '{"estilo":"classico"}'
     where id = '11000000-0000-4000-8000-000000000041' $$,
  'estúdio segue editando nome e briefing'
);

-- Expedição pela equipe (src/lib/actions/expedicao.ts).
select pg_temp.entrar('d0000000-0000-4000-8000-000000000041');
select lives_ok(
  $$ update public.projetos set status = 'enviado', codigo_rastreio = '<b>BR123</b>', enviado_em = now()
     where id = '11000000-0000-4000-8000-000000000041' $$,
  'equipe despacha o álbum com rastreio'
);

-- =============================================================================
-- 10. E-mail simulado com HTML escapado (do despacho acima)
-- =============================================================================
reset role;
select is(
  (select corpo_html from public.comunicacoes_log
    where projeto_id = '11000000-0000-4000-8000-000000000041' and tipo_evento = 'enviado' and destinatario = 'cliente'),
  '<div style="font-family:sans-serif;color:#171717;line-height:1.5">'
    || '<p>Olá, Ana &lt;script&gt;x()&lt;/script&gt; &amp; Bruno!</p>'
    || '<p>Seu álbum <strong>&lt;img src=x onerror=alert(1)&gt;</strong> foi despachado!'
    || ' Código de rastreio: <strong>&lt;b&gt;BR123&lt;/b&gt;</strong>.</p>'
    || '<p style="color:#595959;font-size:12px">Este é um e-mail simulado — nenhuma mensagem real foi enviada (infraestrutura de e-mail ainda não conectada).</p>'
    || '</div>',
  'ataque: nome do projeto, do cliente e rastreio entram escapados no corpo_html'
);
select is(
  (select assunto from public.comunicacoes_log
    where projeto_id = '11000000-0000-4000-8000-000000000041' and tipo_evento = 'enviado' and destinatario = 'cliente'),
  'Seu álbum está a caminho! — <img src=x onerror=alert(1)>',
  'assunto segue texto puro (igual à 0026b)'
);

-- Prova pronta: o aviso ao estúdio escapa o nome do estúdio.
select pg_temp.entrar('d0000000-0000-4000-8000-000000000041');
update public.projetos set status = 'aguardando_aprovacao_cliente' where id = '14000000-0000-4000-8000-000000000041';
reset role;
select ok(
  (select corpo_html like '<div style="font-family:sans-serif;color:#171717;line-height:1.5"><p>Olá, Estúdio &lt;b&gt;A&lt;/b&gt;!</p><p>A prova digital do álbum <strong>Pela gestão</strong> está pronta.%'
     from public.comunicacoes_log
    where projeto_id = '14000000-0000-4000-8000-000000000041' and destinatario = 'fotografo'),
  'nome do estúdio escapado no aviso de prova pronta'
);
select is(private.escapar_html($$<a href="x" onclick='y'>&</a>$$), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;', 'escapar_html cobre & < > " ''');
select is(private.escapar_html(null), null, 'escapar_html(null) é null');

-- =============================================================================
-- 8. fotos: só R2, em nome de quem envia
-- =============================================================================
insert into public.r2_uploads_pendentes (r2_key, user_id, expira_em)
values ('projetos/11000000-0000-4000-8000-000000000041/fotos/abc-foto.jpg', 'c1000000-0000-4000-8000-000000000041', now() + interval '1 hour');

select pg_temp.entrar('c1000000-0000-4000-8000-000000000041');
select throws_ok(
  $$ insert into public.fotos (projeto_id, storage_path, bucket, enviado_por)
     values ('11000000-0000-4000-8000-000000000041', '12000000-0000-4000-8000-000000000041/segredo.jpg', 'projetos_fotos',
             'c1000000-0000-4000-8000-000000000041') $$,
  '42501', null,
  'ataque: foto no bucket legado apontando para a pasta de outro projeto'
);
select throws_ok(
  $$ insert into public.fotos (projeto_id, storage_path, bucket, enviado_por)
     values ('11000000-0000-4000-8000-000000000041', 'qualquer/coisa.jpg', 'pedidos_fotos', 'c1000000-0000-4000-8000-000000000041') $$,
  '42501', null,
  'nem no bucket antigo de pedidos'
);
select lives_ok(
  $$ insert into public.fotos (projeto_id, storage_path, bucket, enviado_por)
     values ('11000000-0000-4000-8000-000000000041', 'projetos/11000000-0000-4000-8000-000000000041/fotos/abc-foto.jpg', 'r2',
             'c1000000-0000-4000-8000-000000000041') $$,
  'upload legítimo no R2 (rota de confirmação) segue funcionando'
);

-- =============================================================================
-- 9. Orçamento público e funções auxiliares
-- =============================================================================
reset role;
insert into public.orcamentos (fotografo_id, cliente_final_nome, hash_publico, status) values
  ('f1000000-0000-4000-8000-000000000041', 'Orçamento rascunho', 'hash-rascunho-41', 'rascunho'),
  ('f1000000-0000-4000-8000-000000000041', 'Orçamento enviado',  'hash-enviado-41',  'enviado');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*) from public.get_orcamento_publico('hash-rascunho-41')), 0::bigint, 'orçamento em rascunho não abre pelo link');
select is((select cliente_final_nome from public.get_orcamento_publico('hash-enviado-41')), 'Orçamento enviado', 'orçamento enviado abre pelo link');
reset role;

-- Mantido de propósito: a policy de conversa_leituras chama a função com o
-- papel de quem consulta.
select ok(
  has_function_privilege('authenticated', 'public._usuario_eh_equipe(uuid)', 'execute'),
  '_usuario_eh_equipe segue executável por authenticated (usada na policy)'
);
select ok(
  not has_function_privilege('authenticated', 'private.escapar_html(text)', 'execute'),
  'escapar_html não é exposta'
);

select * from finish();
rollback;
