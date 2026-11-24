-- D03 (migration 0091): publicação parcial imutável, versão reproduzível, histórico e
-- restauração que cria NOVA versão; regressão de fechamento/extras. Banco sintético isolado.
begin;
create extension if not exists pgtap with schema extensions;
select plan(63);

create function pg_temp.entrar(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('e1000000-0000-4000-8000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rec-a@example.invalid','{"role":"fotografo"}','{"estudio":"Rec A"}',now(),now()),
 ('e1000000-0000-4000-8000-0000000000a2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rec-b@example.invalid','{"role":"fotografo"}','{"estudio":"Rec B"}',now(),now()),
 ('e1000000-0000-4000-8000-0000000000d1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rec-ds@example.invalid','{"role":"designer"}','{}',now(),now()),
 ('e1000000-0000-4000-8000-0000000000d2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rec-dn@example.invalid','{"role":"designer"}','{}',now(),now());
insert into public.clientes (id, fotografo_id, nome, email) values
 ('e2000000-0000-4000-8000-0000000000c1','e1000000-0000-4000-8000-0000000000a1','Cliente R','rec-c@example.invalid');
insert into public.projetos (id, nome, cliente_id, fotografo_id, responsavel_id, laminas_inclusas, preco_lamina_extra) values
 ('e3000000-0000-4000-8000-000000000001','Projeto R1','e2000000-0000-4000-8000-0000000000c1','e1000000-0000-4000-8000-0000000000a1','e1000000-0000-4000-8000-0000000000d1',5,10),
 ('e3000000-0000-4000-8000-000000000002','Projeto R2','e2000000-0000-4000-8000-0000000000c1','e1000000-0000-4000-8000-0000000000a1','e1000000-0000-4000-8000-0000000000d1',5,10),
 ('e3000000-0000-4000-8000-000000000003','Projeto R3','e2000000-0000-4000-8000-0000000000c1','e1000000-0000-4000-8000-0000000000a1','e1000000-0000-4000-8000-0000000000d1',5,10);

-- Versão 1 aprovada (capa + 7 lâminas) do projeto R1; uma lâmina do projeto R2.
insert into public.design_versions (id, projeto_id, numero, status) values
 ('e4000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',1,'aprovada'),
 ('e4000000-0000-4000-8000-000000000002','e3000000-0000-4000-8000-000000000002',1,'aprovada');
insert into public.versoes_laminas (id, versao_id, ordem, storage_path, bucket, eh_capa)
select ('e5000000-0000-4000-8000-00000000000' || o)::uuid, 'e4000000-0000-4000-8000-000000000001', o, 'projetos/r1/v1/' || o || '.jpg', 'r2', o = 1 from generate_series(1, 8) o;
insert into public.versoes_laminas (id, versao_id, ordem, storage_path, bucket)
values ('e5000000-0000-4000-8000-0000000000f1','e4000000-0000-4000-8000-000000000002',1,'projetos/r2/v1/1.jpg','r2');

create temp table base as
 select md5(string_agg(format('%s|%s|%s|%s', ordem, bucket, storage_path, eh_capa), ';' order by ordem)) as h1
   from public.versoes_laminas where versao_id = 'e4000000-0000-4000-8000-000000000001';
create temp table cobranca as
 select * from public._excedente_da_versao('e3000000-0000-4000-8000-000000000001');
grant select on base, cobranca to authenticated;
select results_eq($$select versao, laminas, inclusas, excedente, valor from cobranca$$, $$values (1, 7, 5, 2, 20::numeric)$$, 'linha de base do fechamento: 7 lâminas (capa não conta), 2 extras = R$ 20');

-- ===== Publicação parcial: v2 herda 7 lâminas e troca a 8ª =====
select lives_ok($$
  insert into public.design_versions (id, projeto_id, numero, status, base_versao_id)
  values ('e4000000-0000-4000-8000-000000000003','e3000000-0000-4000-8000-000000000001',2,'enviada','e4000000-0000-4000-8000-000000000001');
  insert into public.versoes_laminas (versao_id, ordem, storage_path, bucket, eh_capa, alterada, origem_lamina_id)
  select 'e4000000-0000-4000-8000-000000000003', o, 'projetos/r1/v1/' || o || '.jpg', 'r2', o = 1, false, ('e5000000-0000-4000-8000-00000000000' || o)::uuid from generate_series(1, 7) o;
  insert into public.versoes_laminas (versao_id, ordem, storage_path, bucket, alterada, origem_lamina_id)
  values ('e4000000-0000-4000-8000-000000000003', 8, 'projetos/r1/v2/8-nova.jpg', 'r2', true, 'e5000000-0000-4000-8000-000000000008')$$,
  'versão parcial válida: herdadas mantêm o arquivo, a trocada aponta a origem');
select throws_ok($$insert into public.versoes_laminas (versao_id, ordem, storage_path, bucket, alterada, origem_lamina_id)
  values ('e4000000-0000-4000-8000-000000000003', 9, 'projetos/r1/outro.jpg', 'r2', false, 'e5000000-0000-4000-8000-000000000002')$$,
  '23514', null, 'lâmina herdada com outro arquivo é recusada');
select throws_ok($$insert into public.versoes_laminas (versao_id, ordem, storage_path, bucket, alterada)
  values ('e4000000-0000-4000-8000-000000000003', 9, 'projetos/r1/v1/2.jpg', 'r2', false)$$,
  '23514', null, 'lâmina herdada sem origem é recusada');
select throws_ok($$insert into public.versoes_laminas (versao_id, ordem, storage_path, bucket, alterada, origem_lamina_id)
  values ('e4000000-0000-4000-8000-000000000003', 9, 'projetos/r2/v1/1.jpg', 'r2', false, 'e5000000-0000-4000-8000-0000000000f1')$$,
  '23514', null, 'lâmina herdada de outro projeto é recusada');
select is((select count(*)::int from public.versoes_laminas where versao_id = 'e4000000-0000-4000-8000-000000000003'), 8, 'a versão 2 tem exatamente as 8 lâminas válidas');
select is((select count(*)::int from public.versoes_laminas n join public.versoes_laminas o on o.id = n.origem_lamina_id
            where n.versao_id = 'e4000000-0000-4000-8000-000000000003' and not n.alterada and n.storage_path = o.storage_path and n.bucket = o.bucket), 7, 'as 7 herdadas apontam o MESMO arquivo da versão 1');

-- ===== Imutabilidade: versão 1 não muda por causa da 2 =====
select is((select md5(string_agg(format('%s|%s|%s|%s', ordem, bucket, storage_path, eh_capa), ';' order by ordem)) from public.versoes_laminas where versao_id = 'e4000000-0000-4000-8000-000000000001'), (select h1 from base), 'versão 1 reproduzível: mesmas lâminas depois de publicar a 2');
select pg_temp.entrar('e1000000-0000-4000-8000-0000000000d1');
select is(public.design_versao_assinatura('e4000000-0000-4000-8000-000000000001'), (select h1 from base), 'assinatura da versão 1 bate com o hash independente');
select throws_ok($$update public.versoes_laminas set storage_path = 'projetos/r1/hack.jpg' where id = 'e5000000-0000-4000-8000-000000000002'$$, '42501', null, 'designer não troca o arquivo de lâmina publicada');
select throws_ok($$update public.versoes_laminas set ordem = 20 where id = 'e5000000-0000-4000-8000-000000000002'$$, '42501', null, 'designer não reordena lâmina publicada');
select throws_ok($$update public.versoes_laminas set alterada = true where versao_id = 'e4000000-0000-4000-8000-000000000003' and ordem = 2$$, '42501', null, 'lâmina herdada não vira "alterada" depois de publicada');
select throws_ok($$delete from public.versoes_laminas where id = 'e5000000-0000-4000-8000-000000000002'$$, '42501', null, 'designer não apaga lâmina publicada');
select is((select count(*)::int from public.versoes_laminas where versao_id in ('e4000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000003')), 16, 'nenhuma lâmina sumiu');
reset role;
select throws_ok($$update public.versoes_laminas set storage_path = 'x' where id = 'e5000000-0000-4000-8000-000000000002'$$, '42501', null, 'nem o dono da tabela reescreve lâmina publicada');
select throws_ok($$delete from public.versoes_laminas where id = 'e5000000-0000-4000-8000-000000000002'$$, '42501', null, 'nem o dono da tabela apaga lâmina publicada');

-- ===== Histórico da prova =====
select pg_temp.entrar('e1000000-0000-4000-8000-0000000000d1');
select is(jsonb_array_length(public.design_historico_versoes('e3000000-0000-4000-8000-000000000001')), 2, 'histórico lista as 2 versões');
select is(public.design_historico_versoes('e3000000-0000-4000-8000-000000000001')#>>'{1,herdadas}', '7', 'versão 2: 7 herdadas');
select is(public.design_historico_versoes('e3000000-0000-4000-8000-000000000001')#>>'{1,alteradas}', '1', 'versão 2: 1 alterada');
select is(public.design_historico_versoes('e3000000-0000-4000-8000-000000000001')#>>'{1,base_versao_id}', 'e4000000-0000-4000-8000-000000000001', 'versão 2 registra a base');
select isnt(public.design_historico_versoes('e3000000-0000-4000-8000-000000000001')#>>'{0,assinatura}', public.design_historico_versoes('e3000000-0000-4000-8000-000000000001')#>>'{1,assinatura}', 'assinaturas distintas: a 2 trocou uma lâmina');
reset role;
select pg_temp.entrar('e1000000-0000-4000-8000-0000000000a2');
select throws_ok($$select public.design_historico_versoes('e3000000-0000-4000-8000-000000000001')$$, '42501', null, 'outro estúdio não lê o histórico');
select throws_ok($$select public.design_versao_assinatura('e4000000-0000-4000-8000-000000000001')$$, '42501', null, 'outro estúdio não lê a assinatura');
reset role;
select pg_temp.entrar('e1000000-0000-4000-8000-0000000000d2');
select throws_ok($$select public.design_historico_versoes('e3000000-0000-4000-8000-000000000001')$$, '42501', null, 'designer não atribuído não lê o histórico');
reset role;
select pg_temp.entrar('e1000000-0000-4000-8000-0000000000a1');
select is(jsonb_array_length(public.design_historico_versoes('e3000000-0000-4000-8000-000000000001')), 2, 'fotógrafo dono lê o histórico');
reset role;

-- ===== Fechamento e extras: publicar parcial e aprovar não muda valores =====
select results_eq($$select versao, laminas, inclusas, excedente, valor from public._excedente_da_versao('e3000000-0000-4000-8000-000000000001')$$, $$select versao, laminas, inclusas, excedente, valor from cobranca$$, 'versão parcial ainda "enviada": o fechamento segue calculado pela versão aprovada');
update public.design_versions set status = 'aprovada' where id = 'e4000000-0000-4000-8000-000000000003';
select results_eq($$select laminas, inclusas, excedente, valor from public._excedente_da_versao('e3000000-0000-4000-8000-000000000001')$$, $$values (7, 5, 2, 20::numeric)$$, 'versão parcial aprovada: mesmas 7 lâminas, mesmos 2 extras, mesmo valor');
select is((select versao from public._excedente_da_versao('e3000000-0000-4000-8000-000000000001')), 2, 'o fechamento passa a olhar a versão 2 aprovada');
select is((select count(*)::int from public.faturas where projeto_id = 'e3000000-0000-4000-8000-000000000001'), 0, 'nenhuma fatura nasceu da publicação parcial');

-- ===== Cascata e SET NULL continuam funcionando (rollback da publicação, exclusão de base) =====
insert into public.design_versions (id, projeto_id, numero, status) values ('e4000000-0000-4000-8000-0000000000a1','e3000000-0000-4000-8000-000000000003',1,'enviada');
insert into public.versoes_laminas (id, versao_id, ordem, storage_path, bucket) values ('e5000000-0000-4000-8000-0000000000a1','e4000000-0000-4000-8000-0000000000a1',1,'projetos/r3/v1/1.jpg','r2');
insert into public.design_versions (id, projeto_id, numero, status, base_versao_id) values ('e4000000-0000-4000-8000-0000000000a2','e3000000-0000-4000-8000-000000000003',2,'enviada','e4000000-0000-4000-8000-0000000000a1');
insert into public.versoes_laminas (id, versao_id, ordem, storage_path, bucket, alterada, origem_lamina_id) values ('e5000000-0000-4000-8000-0000000000a2','e4000000-0000-4000-8000-0000000000a2',1,'projetos/r3/v1/1.jpg','r2',false,'e5000000-0000-4000-8000-0000000000a1');
select lives_ok($$delete from public.design_versions where id = 'e4000000-0000-4000-8000-0000000000a1'$$, 'excluir a versão-base (cascata) não é barrado pelas travas');
select is((select origem_lamina_id from public.versoes_laminas where id = 'e5000000-0000-4000-8000-0000000000a2'), null, 'a herdada perde só o ponteiro (SET NULL) e mantém o arquivo');
select is((select storage_path from public.versoes_laminas where id = 'e5000000-0000-4000-8000-0000000000a2'), 'projetos/r3/v1/1.jpg', 'arquivo da herdada preservado');

-- ===== Histórico e restauração do álbum =====
insert into public.album_layouts (id, projeto_id, nome, formato, orientacao, documento, revisao, status) values
 ('e6000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','Álbum R1','30x30','quadrado','{"versao":1,"primeiraEhCapa":false,"laminas":[{"id":"x1"},{"id":"x2"}]}',3,'em_edicao'),
 ('e6000000-0000-4000-8000-000000000002',null,'Avulso R','30x30','quadrado','{"versao":1,"primeiraEhCapa":false,"laminas":[{"id":"y1"}]}',0,'rascunho');
insert into public.album_layout_versoes (id, layout_id, documento, tipo, rotulo) values
 ('e7000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001','{"versao":1,"primeiraEhCapa":false,"laminas":[{"id":"a1"}]}','manual','Base'),
 ('e7000000-0000-4000-8000-000000000002','e6000000-0000-4000-8000-000000000001','{"versao":1,"primeiraEhCapa":false,"laminas":[{"id":"b1"},{"id":"b2"},{"id":"b3"}]}','auto',null),
 ('e7000000-0000-4000-8000-000000000003','e6000000-0000-4000-8000-000000000002','{"versao":1,"primeiraEhCapa":false,"laminas":[{"id":"o1"}]}','manual','De outro álbum');

select pg_temp.entrar('e1000000-0000-4000-8000-0000000000d1');
select is(public.restaurar_versao_album('e6000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001','e8000000-0000-4000-8000-000000000001')->>'repetida', 'false', 'designer atribuído restaura a versão "Base"');
reset role;
select is((select documento from public.album_layouts where id = 'e6000000-0000-4000-8000-000000000001'), '{"versao":1,"primeiraEhCapa":false,"laminas":[{"id":"a1"}]}'::jsonb, 'o documento atual passa a ser o da versão restaurada');
select is((select revisao from public.album_layouts where id = 'e6000000-0000-4000-8000-000000000001'), 4, 'a revisão do álbum avança (trava otimista continua válida)');
select is((select count(*)::int from public.album_layout_versoes where layout_id = 'e6000000-0000-4000-8000-000000000001'), 4, 'restaurar CRIA versões (2 antigas + antes + nova); nada é apagado');
select is((select documento from public.album_layout_versoes where id = 'e7000000-0000-4000-8000-000000000001'), '{"versao":1,"primeiraEhCapa":false,"laminas":[{"id":"a1"}]}'::jsonb, 'a versão restaurada segue idêntica no histórico');
select is((select documento from public.album_layout_versoes where layout_id = 'e6000000-0000-4000-8000-000000000001' and tipo = 'restauracao'), '{"versao":1,"primeiraEhCapa":false,"laminas":[{"id":"x1"},{"id":"x2"}]}'::jsonb, 'o estado de ANTES da restauração ficou guardado');
select is((select rotulo from public.album_layout_versoes where layout_id = 'e6000000-0000-4000-8000-000000000001' and tipo = 'manual' and id <> 'e7000000-0000-4000-8000-000000000001'), 'Restaurada de Base', 'a nova versão registra a origem');
select is((select count(*)::int from public.album_restauracoes where layout_id = 'e6000000-0000-4000-8000-000000000001'), 1, 'restauração registrada');
select pg_temp.entrar('e1000000-0000-4000-8000-0000000000d1');
select is(public.restaurar_versao_album('e6000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001','e8000000-0000-4000-8000-000000000001')->>'repetida', 'true', 'repetir a mesma chave é idempotente');
select throws_ok($$select public.restaurar_versao_album('e6000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000002','e8000000-0000-4000-8000-000000000001')$$, '22023', null, 'chave reutilizada com outra versão é recusada');
select throws_ok($$select public.restaurar_versao_album('e6000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000003','e8000000-0000-4000-8000-000000000002')$$, '22023', null, 'versão de outro álbum não restaura');
select is(public.restaurar_versao_album('e6000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000002','e8000000-0000-4000-8000-000000000003')->>'revisao', '5', 'segunda restauração (versão automática) avança a revisão');
reset role;
select is((select count(*)::int from public.album_layout_versoes where layout_id = 'e6000000-0000-4000-8000-000000000001'), 6, 'duas restaurações = quatro versões novas, histórico só cresce');
select is((select count(*)::int from public.album_layout_versoes where layout_id = 'e6000000-0000-4000-8000-000000000001' and id in ('e7000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000002')), 2, 'as versões antigas continuam todas lá');

-- Salvar existente (editor) segue igual, e o travamento por aprovação vale para a restauração.
select pg_temp.entrar('e1000000-0000-4000-8000-0000000000d1');
select is(public.salvar_album_layout('e6000000-0000-4000-8000-000000000001', '{"versao":1,"primeiraEhCapa":false,"laminas":[{"id":"z1"}]}', 5), 6, 'salvar_album_layout do editor continua igual (revisão 5 -> 6)');
reset role;
update public.album_layouts set status = 'aprovado' where id = 'e6000000-0000-4000-8000-000000000001';
select pg_temp.entrar('e1000000-0000-4000-8000-0000000000d1');
select throws_ok($$select public.restaurar_versao_album('e6000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001','e8000000-0000-4000-8000-000000000004')$$, '55000', null, 'álbum aprovado não aceita restauração');
select is(public.salvar_album_layout('e6000000-0000-4000-8000-000000000001', '{"versao":1,"laminas":[]}', 6), -1, 'paridade: salvar também recusa álbum aprovado');
reset role;
update public.album_layouts set status = 'em_edicao' where id = 'e6000000-0000-4000-8000-000000000001';

-- Quem não produz não restaura.
select pg_temp.entrar('e1000000-0000-4000-8000-0000000000d2');
select throws_ok($$select public.restaurar_versao_album('e6000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001','e8000000-0000-4000-8000-000000000005')$$, '42501', null, 'designer não atribuído não restaura');
reset role;
select pg_temp.entrar('e1000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.restaurar_versao_album('e6000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001','e8000000-0000-4000-8000-000000000006')$$, '42501', null, 'fotógrafo (fora da produção) não restaura');
reset role;
select pg_temp.entrar('e1000000-0000-4000-8000-0000000000a2');
select throws_ok($$select public.restaurar_versao_album('e6000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001','e8000000-0000-4000-8000-000000000007')$$, '42501', null, 'outro estúdio não restaura');
reset role;
set local role anon;
select throws_ok($$select public.restaurar_versao_album('e6000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001','e8000000-0000-4000-8000-000000000008')$$, '42501', null, 'anon não executa');
reset role;

-- Histórico do álbum imutável.
select pg_temp.entrar('e1000000-0000-4000-8000-0000000000d1');
select throws_ok($$update public.album_layout_versoes set documento = '{}' where id = 'e7000000-0000-4000-8000-000000000001'$$, '42501', null, 'documento de versão salva não é reescrito');
update public.album_layout_versoes set rotulo = 'Base renomeada' where id = 'e7000000-0000-4000-8000-000000000001';
select is((select rotulo from public.album_layout_versoes where id = 'e7000000-0000-4000-8000-000000000001'), 'Base renomeada', 'só o rótulo pode mudar');
select throws_ok($$delete from public.album_layout_versoes where id = 'e7000000-0000-4000-8000-000000000001'$$, '42501', null, 'versão salva não é apagada');
select lives_ok($$delete from public.album_layout_versoes where id = 'e7000000-0000-4000-8000-000000000002'$$, 'a poda de pontos automáticos continua permitida');
select is((select count(*)::int from public.album_restauracoes where layout_id = 'e6000000-0000-4000-8000-000000000001'), 1, 'o registro de restauração da versão podada se foi junto; o outro permanece');
reset role;
select throws_ok($$update public.album_restauracoes set revisao = 99$$, '42501', null, 'registro de restauração é imutável');
select throws_ok($$delete from public.album_restauracoes$$, '42501', null, 'registro de restauração não é apagável diretamente');
select lives_ok($$delete from public.album_layouts where id = 'e6000000-0000-4000-8000-000000000001'$$, 'excluir o álbum leva histórico e restaurações (cascata)');
select is((select count(*)::int from public.album_restauracoes), 0, 'nada ficou órfão');
select is((select count(*)::int from public.faturas where projeto_id = 'e3000000-0000-4000-8000-000000000001'), 0, 'restaurar álbum nunca gera cobrança');
select finish();
rollback;
