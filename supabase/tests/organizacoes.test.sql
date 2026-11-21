begin; create extension if not exists pgtap with schema extensions; select plan(37);
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f1000000-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','org-a@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('f1000000-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','org-b@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('f1000000-0000-4000-8000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','org-c@example.invalid','{"role":"designer"}','{}',now(),now()),
('f1000000-0000-4000-8000-00000000000d','00000000-0000-0000-0000-000000000000','authenticated','authenticated','org-d@example.invalid','{"role":"cliente"}','{}',now(),now()),
('f1000000-0000-4000-8000-00000000000e','00000000-0000-0000-0000-000000000000','authenticated','authenticated','org-e@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('f1000000-0000-4000-8000-00000000000f','00000000-0000-0000-0000-000000000000','authenticated','authenticated','org-f@example.invalid','{"role":"fotografo"}','{}',now(),now());

-- Criação automática e backfill-equivalente
select is((select count(*)::integer from public.organizacoes where dono_id='f1000000-0000-4000-8000-00000000000a'),1,'fotógrafo novo ganha uma organização');
select is((select papel from public.organizacao_membros m join public.organizacoes o on o.id=m.organizacao_id where o.dono_id='f1000000-0000-4000-8000-00000000000a' and m.user_id=o.dono_id),'dono','proprietário vira dono');
select is((select count(*)::integer from public.organizacoes where dono_id='f1000000-0000-4000-8000-00000000000d'),0,'cliente não ganha organização');
select throws_ok($$insert into public.organizacao_membros(organizacao_id,user_id,papel) select id,'f1000000-0000-4000-8000-00000000000b','dono' from public.organizacoes where dono_id='f1000000-0000-4000-8000-00000000000a'$$,'23505',null,'só um dono ativo por organização');

-- Dono monta a equipe
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
do $$ begin perform public.criar_galeria_digital('f2000000-0000-4000-8000-000000000001','Galeria Org','Cliente Org','org@example.invalid'); end $$;
select is((select organizacao_id from public.projetos where id='f2000000-0000-4000-8000-000000000001'),(select id from public.organizacoes where dono_id=auth.uid()),'projeto novo nasce vinculado à organização');
select is(public.papel_na_organizacao((select id from public.organizacoes where dono_id=auth.uid())),'dono','dono vê o próprio papel');
select is(public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'ORG-B@example.invalid','admin'),'f1000000-0000-4000-8000-00000000000b'::uuid,'dono adiciona admin (e-mail sem diferenciar caixa)');
select is(public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'org-c@example.invalid','editor'),'f1000000-0000-4000-8000-00000000000c'::uuid,'dono adiciona designer como editor');
select is(public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'org-e@example.invalid','admin'),'f1000000-0000-4000-8000-00000000000e'::uuid,'dono adiciona segundo admin');
select throws_ok($$select public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'org-d@example.invalid','editor')$$,'22023',null,'cliente final não vira membro interno');
select throws_ok($$select public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'org-f@example.invalid','dono')$$,'22023',null,'não se cria outro dono por esta via');
select throws_ok($$select public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'ninguem@example.invalid','editor')$$,'22023',null,'pessoa inexistente rejeitada');
select throws_ok($$select public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'org-f@example.invalid','superuser')$$,'22023',null,'papel inválido rejeitado');
select is((select count(*)::integer from public.organizacao_membros where organizacao_id=(select id from public.organizacoes where dono_id=auth.uid()) and status='ativo'),4,'equipe com quatro membros ativos');
select throws_ok($$insert into public.organizacao_membros(organizacao_id,user_id,papel) values ((select id from public.organizacoes where dono_id=auth.uid()),'f1000000-0000-4000-8000-00000000000f','editor')$$,'42501',null,'sem INSERT direto em membros');
select throws_ok($$update public.organizacao_membros set papel='dono'$$,'42501',null,'sem UPDATE direto em membros');

-- Admin: poderes limitados
reset role;select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id='f1000000-0000-4000-8000-00000000000a'),'org-c@example.invalid','admin')$$,'42501',null,'admin não promove outro admin');
select throws_ok($$select public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id='f1000000-0000-4000-8000-00000000000a'),'org-e@example.invalid','editor')$$,'42501',null,'admin não rebaixa outro admin');
select throws_ok($$select public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id='f1000000-0000-4000-8000-00000000000a'),'org-a@example.invalid','editor')$$,'42501',null,'admin não altera o dono');
select throws_ok($$select public.remover_membro_organizacao((select id from public.organizacoes where dono_id='f1000000-0000-4000-8000-00000000000a'),'f1000000-0000-4000-8000-00000000000e')$$,'42501',null,'admin não remove outro admin');
select throws_ok($$select public.remover_membro_organizacao((select id from public.organizacoes where dono_id='f1000000-0000-4000-8000-00000000000a'),'f1000000-0000-4000-8000-00000000000a')$$,'42501',null,'ninguém remove o dono');
select is(public.remover_membro_organizacao((select id from public.organizacoes where dono_id='f1000000-0000-4000-8000-00000000000a'),'f1000000-0000-4000-8000-00000000000c'),true,'admin remove editor');
select is(public.remover_membro_organizacao((select id from public.organizacoes where dono_id='f1000000-0000-4000-8000-00000000000a'),'f1000000-0000-4000-8000-00000000000c'),false,'remover de novo é inofensivo');

-- Removido perde tudo
reset role;select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-00000000000c","role":"authenticated"}',true);set local role authenticated;
select is(public.papel_na_organizacao((select id from public.organizacoes where dono_id='f1000000-0000-4000-8000-00000000000a')),null,'removido não tem papel');
select is((select count(*)::integer from public.organizacoes),0,'removido não enxerga a organização');
select is((select count(*)::integer from public.organizacao_membros),0,'removido não enxerga a equipe');

-- Admin que sai por conta própria
reset role;select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-00000000000e","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.organizacoes),2,'membro enxerga a própria organização e a do estúdio onde atua');
select is(public.remover_membro_organizacao((select id from public.organizacoes where dono_id='f1000000-0000-4000-8000-00000000000a'),auth.uid()),true,'membro pode sair por conta própria');

-- Fora da organização
reset role;select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-00000000000f","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.organizacoes where dono_id='f1000000-0000-4000-8000-00000000000a'),0,'outro estúdio não enxerga esta organização');
select throws_ok($$select public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id='f1000000-0000-4000-8000-00000000000a'),'org-f@example.invalid','editor')$$,'42501',null,'estranho não se adiciona');
select throws_ok($$select public.remover_membro_organizacao((select id from public.organizacoes where dono_id='f1000000-0000-4000-8000-00000000000a'),'f1000000-0000-4000-8000-00000000000b')$$,'42501',null,'estranho não remove ninguém');

-- Dono reativa quem saiu
reset role;select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is(public.adicionar_membro_organizacao((select id from public.organizacoes where dono_id=auth.uid()),'org-c@example.invalid','visualizador'),'f1000000-0000-4000-8000-00000000000c'::uuid,'dono reativa membro removido com novo papel');
select is((select papel||'/'||status from public.organizacao_membros where user_id='f1000000-0000-4000-8000-00000000000c'),'visualizador/ativo','reativação aplica papel e status');

-- Listagem da equipe
select is((select count(*)::integer from public.listar_equipe_organizacao((select id from public.organizacoes where dono_id=auth.uid()))),3,'membro vê só a equipe ativa: dono, admin e o visualizador reativado');
select is((select papel from public.listar_equipe_organizacao((select id from public.organizacoes where dono_id=auth.uid())) limit 1),'dono','dono vem primeiro na listagem');
reset role;select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-00000000000f","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select * from public.listar_equipe_organizacao((select id from public.organizacoes where dono_id='f1000000-0000-4000-8000-00000000000a'))$$,'42501',null,'estranho não lista a equipe alheia');
reset role;
-- Anônimo
reset role; set local role anon;
select throws_ok($$select public.adicionar_membro_organizacao(gen_random_uuid(),'x@example.invalid','editor')$$,'42501',null,'anon não gerencia equipe');
reset role;
select finish(); rollback;
