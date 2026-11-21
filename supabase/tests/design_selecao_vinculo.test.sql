-- D01/D02 (migration 0090): contrato seleção -> documento de álbum, banco sintético isolado.
-- Cada papel age como na API (role authenticated + request.jwt.claims).
begin;
create extension if not exists pgtap with schema extensions;
select plan(61);

create function pg_temp.entrar(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('d1000000-0000-4000-8000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dsg-a@example.invalid','{"role":"fotografo"}','{"estudio":"Design A"}',now(),now()),
 ('d1000000-0000-4000-8000-0000000000e1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dsg-ed@example.invalid','{"role":"fotografo"}','{"estudio":"Design Ed"}',now(),now()),
 ('d1000000-0000-4000-8000-0000000000b1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dsg-vi@example.invalid','{"role":"fotografo"}','{"estudio":"Design Vi"}',now(),now()),
 ('d1000000-0000-4000-8000-0000000000a2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dsg-b@example.invalid','{"role":"fotografo"}','{"estudio":"Design B"}',now(),now()),
 ('d1000000-0000-4000-8000-0000000000d1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dsg-ds@example.invalid','{"role":"designer"}','{}',now(),now()),
 ('d1000000-0000-4000-8000-0000000000d2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dsg-dn@example.invalid','{"role":"designer"}','{}',now(),now()),
 ('d1000000-0000-4000-8000-0000000000c1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dsg-cl@example.invalid','{"role":"cliente"}','{}',now(),now());

insert into public.clientes (id, user_id, fotografo_id, nome, email) values
 ('d2000000-0000-4000-8000-0000000000c1','d1000000-0000-4000-8000-0000000000c1','d1000000-0000-4000-8000-0000000000a1','Cliente D','dsg-cl@example.invalid'),
 ('d2000000-0000-4000-8000-0000000000c2',null,'d1000000-0000-4000-8000-0000000000a2','Cliente B','dsg-cb@example.invalid');
insert into public.projetos (id, nome, cliente_id, fotografo_id, responsavel_id) values
 ('d3000000-0000-4000-8000-000000000001','Projeto D1','d2000000-0000-4000-8000-0000000000c1','d1000000-0000-4000-8000-0000000000a1','d1000000-0000-4000-8000-0000000000d1'),
 ('d3000000-0000-4000-8000-000000000002','Projeto D2','d2000000-0000-4000-8000-0000000000c2','d1000000-0000-4000-8000-0000000000a2',null);
insert into public.fotos (id, projeto_id, storage_path, bucket, nome_original) values
 ('d4000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','projetos/d3000000-0000-4000-8000-000000000001/fotos/f1.jpg','r2','IMG_001.jpg'),
 ('d4000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000001','projetos/d3000000-0000-4000-8000-000000000001/fotos/f2.jpg','r2',null),
 ('d4000000-0000-4000-8000-000000000003','d3000000-0000-4000-8000-000000000001','projetos/d3000000-0000-4000-8000-000000000001/fotos/f3.jpg','r2','IMG_003.jpg'),
 ('d4000000-0000-4000-8000-000000000004','d3000000-0000-4000-8000-000000000001','projetos/d3000000-0000-4000-8000-000000000001/fotos/f4.jpg','r2',null),
 ('d4000000-0000-4000-8000-000000000005','d3000000-0000-4000-8000-000000000001','projetos/d3000000-0000-4000-8000-000000000001/fotos/f5.jpg','r2',null),
 ('d4000000-0000-4000-8000-0000000000b1','d3000000-0000-4000-8000-000000000002','projetos/d3000000-0000-4000-8000-000000000002/fotos/g1.jpg','r2',null);
-- Álbum avulso comum (sem seleção): continua visível a toda a equipe.
insert into public.album_layouts (id, nome, formato, orientacao) values ('d5000000-0000-4000-8000-000000000001','Avulso comum','30x30','quadrado');

-- Equipe da organização: editor e visualizador.
select pg_temp.entrar('d1000000-0000-4000-8000-0000000000a1');
do $$ begin perform public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id = auth.uid()), 'dsg-ed@example.invalid', 'editor'); end $$;
do $$ begin perform public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id = auth.uid()), 'dsg-vi@example.invalid', 'visualizador'); end $$;
-- Seleção revisão 1 entregue pelo fotógrafo.
do $$ begin perform public.entregar_selecao('d3000000-0000-4000-8000-000000000001', array['d4000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000002','d4000000-0000-4000-8000-000000000003']::uuid[], 0, 'd6000000-0000-4000-8000-000000000001'); end $$;
reset role;
create temp table ids as select id as sel1 from public.selecoes_entregues where projeto_id = 'd3000000-0000-4000-8000-000000000001' and revisao = 1;
grant select on ids to authenticated;

-- ===== Fotógrafo dono: cria o álbum do projeto =====
select pg_temp.entrar('d1000000-0000-4000-8000-0000000000a1');
select is(public.design_selecao_resumo('d3000000-0000-4000-8000-000000000001')->>'pode_criar', 'true', 'dono pode criar álbum');
select is(public.design_selecao_resumo('d3000000-0000-4000-8000-000000000001')->>'papel', 'dono', 'papel do fotógrafo dono');
select is(public.design_selecao_resumo('d3000000-0000-4000-8000-000000000001')->>'pode_abrir_editor', 'false', 'fotógrafo não abre o editor (perfil não é de produção)');
select is(public.criar_album_da_selecao((select sel1 from ids), 'projeto', 'd7000000-0000-4000-8000-000000000001', 'Álbum D1', '30x30', 'quadrado')->>'criado', 'true', 'cria o álbum do projeto');
reset role;
select is((select count(*)::int from public.album_layouts where projeto_id = 'd3000000-0000-4000-8000-000000000001'), 1, 'um documento no projeto');
select is((select foto_ids from public.album_selecao_vinculos where destino = 'projeto'), array['d4000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000002','d4000000-0000-4000-8000-000000000003']::uuid[], 'vínculo guarda os IDs do instante');
select is((select revisao from public.album_selecao_vinculos where destino = 'projeto'), 1, 'vínculo guarda a revisão');
select is((select count(*)::int from public.album_selecao_vinculos v join public.selecoes_entregues s on s.id = v.selecao_id and s.revisao = v.revisao and s.foto_ids = v.foto_ids), 1, 'vínculo bate com o snapshot de origem');
select is((select count(*)::int from jsonb_object_keys((select biblioteca->'fotos' from public.album_layouts where projeto_id = 'd3000000-0000-4000-8000-000000000001'))), 3, 'biblioteca marca as 3 fotos da seleção');
select is((select biblioteca#>>'{pastas,0,nome}' from public.album_layouts where projeto_id = 'd3000000-0000-4000-8000-000000000001'), 'Seleção · revisão 1', 'pasta da seleção na biblioteca');
select is((select jsonb_array_length(documento->'laminas') from public.album_layouts where projeto_id = 'd3000000-0000-4000-8000-000000000001'), 1, 'documento nasce com uma lâmina vazia (convenção do editor)');
select is((select count(*)::int from public.projeto_atividades where mensagem like 'Álbum criado a partir da seleção: revisão 1 com 3 fotos%'), 1, 'linha do tempo registra a criação');
select is((select nome from public.album_layouts where projeto_id = 'd3000000-0000-4000-8000-000000000001'), 'Álbum D1', 'nome gravado');

-- ===== Idempotência =====
select pg_temp.entrar('d1000000-0000-4000-8000-0000000000a1');
select is(public.criar_album_da_selecao((select sel1 from ids), 'projeto', 'd7000000-0000-4000-8000-000000000001', 'Álbum D1', '30x30', 'quadrado')->>'criado', 'false', 'mesma chave devolve o mesmo álbum');
select is(public.criar_album_da_selecao((select sel1 from ids), 'projeto', 'd7000000-0000-4000-8000-000000000099', 'Outro nome', '30x30', 'quadrado')->>'criado', 'false', 'outra chave, mesma seleção, mesmo destino: não duplica');
select throws_ok($$select public.criar_album_da_selecao((select sel1 from ids), 'avulso', 'd7000000-0000-4000-8000-000000000001', 'Álbum D1', '30x30', 'quadrado')$$, '22023', null, 'chave reutilizada com outro destino é recusada');
-- Revisão 2 da seleção: o projeto já tem álbum.
do $$ begin perform public.entregar_selecao('d3000000-0000-4000-8000-000000000001', array['d4000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000004']::uuid[], 1, 'd6000000-0000-4000-8000-000000000002'); end $$;
reset role;
alter table ids add column sel2 uuid;
update ids set sel2 = (select id from public.selecoes_entregues where projeto_id = 'd3000000-0000-4000-8000-000000000001' and revisao = 2);
create temp table antes as select md5(documento::text || biblioteca::text) as h from public.album_layouts where projeto_id = 'd3000000-0000-4000-8000-000000000001';
select pg_temp.entrar('d1000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.criar_album_da_selecao((select sel2 from ids), 'projeto', 'd7000000-0000-4000-8000-000000000002', 'Rev 2', '30x30', 'quadrado')$$, '22023', null, 'projeto já tem álbum: outra revisão não o sobrescreve');
-- Avulso a partir da revisão 2, sem duplicar originais.
select is(public.criar_album_da_selecao((select sel2 from ids), 'avulso', 'd7000000-0000-4000-8000-000000000003', 'Avulso rev 2', '30x30', 'quadrado')->>'criado', 'true', 'cria álbum avulso da revisão 2');
reset role;
select is((select jsonb_array_length(fotos) from public.album_layouts where nome = 'Avulso rev 2'), 2, 'avulso lista as 2 fotos do snapshot');
select is((select projeto_id from public.album_layouts where nome = 'Avulso rev 2'), null, 'avulso não ocupa o álbum do projeto');
select is((select count(*)::int from public.album_layouts a cross join lateral jsonb_array_elements(a.fotos) e join public.fotos f on f.id = (e->>'id')::uuid
            where a.nome = 'Avulso rev 2' and e->>'path' = f.storage_path and e->>'bucket' = f.bucket and (e->>'referencia')::boolean), 2, 'avulso referencia as MESMAS chaves de fotos (sem cópia)');
select is((select count(*)::int from public.fotos where projeto_id = 'd3000000-0000-4000-8000-000000000001'), 5, 'nenhum original novo foi criado');
select is((select cliente_nome from public.album_layouts where nome = 'Avulso rev 2'), 'Cliente D', 'avulso herda o nome do cliente');
select is((select v.revisao from public.album_selecao_vinculos v join public.album_layouts a on a.id = v.layout_id where a.nome = 'Avulso rev 2'), 2, 'vínculo do avulso aponta a revisão 2');

-- ===== Mudanças posteriores não alteram o álbum já criado =====
select pg_temp.entrar('d1000000-0000-4000-8000-0000000000a1');
do $$ begin perform public.entregar_selecao('d3000000-0000-4000-8000-000000000001', array['d4000000-0000-4000-8000-000000000005']::uuid[], 2, 'd6000000-0000-4000-8000-000000000003'); end $$;
reset role;
update public.fotos set favorita = true where id = 'd4000000-0000-4000-8000-000000000005';
update public.fotos set favorita = false where id = 'd4000000-0000-4000-8000-000000000001';
delete from public.fotos where id = 'd4000000-0000-4000-8000-000000000002';
select is((select md5(documento::text || biblioteca::text) from public.album_layouts where projeto_id = 'd3000000-0000-4000-8000-000000000001'), (select h from antes), 'documento e biblioteca intactos após nova revisão, favoritos e remoção de foto');
select is((select cardinality(foto_ids) from public.album_selecao_vinculos where destino = 'projeto'), 3, 'vínculo continua com os 3 IDs de antes');
select is((select count(*)::int from public.selecao_entregue_fotos s join public.selecoes_entregues e on e.id = s.selecao_id where e.revisao = 1), 3, 'snapshot da revisão 1 intacto');
select is((select jsonb_array_length(fotos) from public.album_layouts where nome = 'Avulso rev 2'), 2, 'avulso mantém as referências do instante');

-- ===== Imutabilidade do vínculo =====
select throws_ok($$update public.album_selecao_vinculos set revisao = 9$$, '42501', null, 'vínculo não é atualizável nem pelo dono da tabela');
select throws_ok($$delete from public.album_selecao_vinculos$$, '42501', null, 'vínculo não é apagável diretamente');
select pg_temp.entrar('d1000000-0000-4000-8000-0000000000a1');
select throws_ok($$update public.album_selecao_vinculos set foto_ids = array[]::uuid[]$$, '42501', null, 'API não atualiza o vínculo');
select throws_ok($$insert into public.album_selecao_vinculos(layout_id,selecao_id,projeto_id,revisao,destino,foto_ids,chave) values (gen_random_uuid(),(select sel1 from ids),'d3000000-0000-4000-8000-000000000001',1,'avulso',array[gen_random_uuid()],gen_random_uuid())$$, '42501', null, 'API não insere vínculo direto (só pela RPC)');
reset role;

-- ===== Papéis =====
select pg_temp.entrar('d1000000-0000-4000-8000-0000000000e1');
select is(public.design_selecao_resumo('d3000000-0000-4000-8000-000000000001')->>'papel', 'editor', 'editor da organização tem papel editor');
select is(public.criar_album_da_selecao((select sel1 from ids), 'avulso', 'd7000000-0000-4000-8000-000000000004', 'Avulso do editor', '30x30', 'quadrado')->>'criado', 'true', 'editor da organização cria o álbum');
reset role;
select pg_temp.entrar('d1000000-0000-4000-8000-0000000000b1');
select is(public.design_selecao_resumo('d3000000-0000-4000-8000-000000000001')->>'pode_criar', 'false', 'visualizador só consulta');
select throws_ok($$select public.criar_album_da_selecao((select sel1 from ids), 'avulso', 'd7000000-0000-4000-8000-000000000005', 'Visual', '30x30', 'quadrado')$$, '42501', null, 'visualizador não cria');
reset role;
select pg_temp.entrar('d1000000-0000-4000-8000-0000000000a2');
select throws_ok($$select public.design_selecao_resumo('d3000000-0000-4000-8000-000000000001')$$, '42501', null, 'outro estúdio não consulta');
select throws_ok($$select public.criar_album_da_selecao((select sel1 from ids), 'avulso', 'd7000000-0000-4000-8000-000000000006', 'Intruso', '30x30', 'quadrado')$$, '42501', null, 'outro estúdio não cria');
select is((select count(*)::int from public.album_selecao_vinculos), 0, 'outro estúdio não vê vínculos');
reset role;
select pg_temp.entrar('d1000000-0000-4000-8000-0000000000c1');
select throws_ok($$select public.design_selecao_resumo('d3000000-0000-4000-8000-000000000001')$$, '42501', null, 'cliente final não consulta o design');
select throws_ok($$select public.criar_album_da_selecao((select sel1 from ids), 'avulso', 'd7000000-0000-4000-8000-000000000007', 'Cliente', '30x30', 'quadrado')$$, '42501', null, 'cliente final não cria');
reset role;
select pg_temp.entrar('d1000000-0000-4000-8000-0000000000d2');
select throws_ok($$select public.criar_album_da_selecao((select sel1 from ids), 'avulso', 'd7000000-0000-4000-8000-000000000008', 'Designer fora', '30x30', 'quadrado')$$, '42501', null, 'designer não atribuído não cria');
select is((select count(*)::int from public.album_layouts where nome in ('Álbum D1','Avulso rev 2','Avulso do editor')), 0, 'designer não atribuído não vê o álbum do projeto nem os avulsos nascidos de seleção');
select is((select count(*)::int from public.album_layouts where id = 'd5000000-0000-4000-8000-000000000001'), 1, 'avulso comum continua visível à equipe (sem regressão)');
reset role;
select pg_temp.entrar('d1000000-0000-4000-8000-0000000000d1');
select is(public.design_selecao_resumo('d3000000-0000-4000-8000-000000000001')->>'papel', 'producao', 'designer atribuído tem papel de produção');
select is(public.design_selecao_resumo('d3000000-0000-4000-8000-000000000001')->>'pode_abrir_editor', 'true', 'designer atribuído abre o editor');
select is(public.criar_album_da_selecao((select sel1 from ids), 'avulso', 'd7000000-0000-4000-8000-000000000009', 'Avulso do designer', '30x30', 'quadrado')->>'criado', 'true', 'designer atribuído cria o álbum');
select is((select count(*)::int from public.album_selecao_vinculos), 4, 'designer atribuído vê os 4 vínculos do projeto');
update public.album_layouts set nome = 'Avulso rev 2 editado' where nome = 'Avulso rev 2';
select is((select count(*)::int from public.album_layouts where nome = 'Avulso rev 2 editado'), 1, 'designer atribuído edita o avulso da seleção');
delete from public.album_layouts where nome = 'Avulso do designer';
select is((select count(*)::int from public.album_selecao_vinculos), 3, 'excluir o álbum avulso leva o vínculo junto (cascata permitida)');
reset role;
set local role anon;
select throws_ok($$select public.criar_album_da_selecao(gen_random_uuid(), 'avulso', gen_random_uuid(), 'Anon', '30x30', 'quadrado')$$, '42501', null, 'anon não executa a RPC');
reset role;

-- ===== Validação de entrada e de documento =====
select pg_temp.entrar('d1000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.criar_album_da_selecao((select sel1 from ids), 'avulso', 'd7000000-0000-4000-8000-000000000010', 'Formato ruim', 'grande', 'quadrado')$$, '22023', null, 'formato inválido');
select throws_ok($$select public.criar_album_da_selecao((select sel1 from ids), 'avulso', 'd7000000-0000-4000-8000-000000000011', ' ', '30x30', 'quadrado')$$, '22023', null, 'nome vazio');
select throws_ok($$select public.criar_album_da_selecao((select sel1 from ids), 'avulso', 'd7000000-0000-4000-8000-000000000012', 'Orient', '30x30', 'diagonal')$$, '22023', null, 'orientação inválida');
select throws_ok($$select public.criar_album_da_selecao((select sel1 from ids), 'avulso', 'd7000000-0000-4000-8000-000000000013', 'Doc fora', '30x30', 'quadrado', jsonb_build_object('laminas', jsonb_build_array(jsonb_build_object('quadros', jsonb_build_array(jsonb_build_object('fotoId','d4000000-0000-4000-8000-000000000005'))))))$$, '22023', null, 'documento não cita foto fora da seleção');
select throws_ok($$select public.criar_album_da_selecao((select sel1 from ids), 'avulso', 'd7000000-0000-4000-8000-000000000014', 'Doc lixo', '30x30', 'quadrado', jsonb_build_object('laminas', jsonb_build_array(jsonb_build_object('quadros', jsonb_build_array(jsonb_build_object('fotoId','nao-e-uuid'))))))$$, '22023', null, 'fotoId malformado é recusado sem erro de cast');
select throws_ok($$select public.criar_album_da_selecao((select sel1 from ids), 'avulso', 'd7000000-0000-4000-8000-000000000015', 'Sem laminas', '30x30', 'quadrado', '{"laminas":[]}'::jsonb)$$, '22023', null, 'documento sem lâmina');
select is(public.criar_album_da_selecao((select sel1 from ids), 'avulso', 'd7000000-0000-4000-8000-000000000016', 'Doc válido', '30x30', 'quadrado', jsonb_build_object('laminas', jsonb_build_array(jsonb_build_object('quadros', jsonb_build_array(jsonb_build_object('fotoId','d4000000-0000-4000-8000-000000000001')))))) ->>'criado', 'true', 'documento citando foto do snapshot é aceito');
select throws_ok($$select public.criar_album_da_selecao(gen_random_uuid(), 'avulso', gen_random_uuid(), 'Sem seleção', '30x30', 'quadrado')$$, '42501', null, 'seleção inexistente não revela nada');
select throws_ok($$select public.criar_album_da_selecao((select sel1 from ids), 'inexistente', gen_random_uuid(), 'Destino', '30x30', 'quadrado')$$, '22023', null, 'destino inválido');
reset role;

-- Exclusão do álbum do projeto (cascata do projeto) também passa pelo gatilho aninhado.
select lives_ok($$delete from public.album_layouts where projeto_id = 'd3000000-0000-4000-8000-000000000001'$$, 'excluir o documento do projeto leva o vínculo (cascata)');
select finish();
rollback;
