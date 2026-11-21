begin; create extension if not exists pgtap with schema extensions; select plan(37);
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('d8000000-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pub-a@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('d8000000-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pub-b@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('d8000000-0000-4000-8000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pub-c@example.invalid','{"role":"designer"}','{}',now(),now()),
('d8000000-0000-4000-8000-00000000000e','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pub-e@example.invalid','{"role":"fotografo"}','{}',now(),now());
create function public.zz_doc(p_titulo text, p_extra jsonb default '[]') returns jsonb language sql as $$
  select jsonb_build_object('v',1,'tema',jsonb_build_object('cor','#112233'),'seo',jsonb_build_object('titulo','T'),
    'paginas',jsonb_build_array(jsonb_build_object('slug','inicio','titulo','Início','blocos',
      jsonb_build_array(jsonb_build_object('id','hero-1','tipo','hero','dados',jsonb_build_object('titulo',p_titulo))) || p_extra))) $$;
select set_config('t.orga',(select id::text from public.organizacoes where dono_id='d8000000-0000-4000-8000-00000000000a'),true);
select set_config('t.orgb',(select id::text from public.organizacoes where dono_id='d8000000-0000-4000-8000-00000000000b'),true);

select set_config('request.jwt.claims','{"sub":"d8000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select public.adicionar_membro_organizacao(current_setting('t.orga')::uuid,'pub-c@example.invalid','editor');
select public.adicionar_membro_organizacao(current_setting('t.orga')::uuid,'pub-e@example.invalid','admin');
select set_config('t.sa',public.criar_site(current_setting('t.orga')::uuid,'Estúdio Pub','estudio-pub')::text,true);
select set_config('t.chave',public.registrar_site_midia(current_setting('t.orga')::uuid,'sites/'||current_setting('t.orga')||'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-foto.webp','foto.webp',1200,800,300)::text,true);
select public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('Versão um',format('[{"id":"g1","tipo":"galeria","dados":{"itens":[{"midia_id":"%s","alt":"Foto"}]}}]',current_setting('t.chave'))::jsonb),1);
reset role;select set_config('request.jwt.claims','{"sub":"d8000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select set_config('t.sb',public.criar_site(current_setting('t.orgb')::uuid,'Estúdio B','estudio-b-pub')::text,true);
select public.publicar_site(current_setting('t.sb')::uuid,'11111111-1111-4111-8111-111111111111');
select set_config('t.vb',(select id::text from public.site_versoes where site_id=current_setting('t.sb')::uuid),true);

-- Antes de publicar: nada público
reset role; set local role anon;
select is(public.obter_site_publicado('estudio-pub'),null,'site em rascunho não é público');
select throws_ok($$select * from public.sites$$,'42501',null,'anon não lê a tabela de sites');
select throws_ok($$select * from public.site_versoes$$,'42501',null,'anon não lê versões');
select throws_ok($$select public.publicar_site(current_setting('t.sa')::uuid,gen_random_uuid())$$,'42501',null,'anon não publica');
select isnt(public.obter_site_publicado('estudio-b-pub'),null,'site publicado de B é público');

-- Editor não publica; admin publica
reset role;select set_config('request.jwt.claims','{"sub":"d8000000-0000-4000-8000-00000000000c","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.publicar_site(current_setting('t.sa')::uuid,'22222222-2222-4222-8222-222222222222')$$,'42501',null,'editor não publica');
reset role;select set_config('request.jwt.claims','{"sub":"d8000000-0000-4000-8000-00000000000e","role":"authenticated"}',true);set local role authenticated;
select set_config('t.v1',public.publicar_site(current_setting('t.sa')::uuid,'22222222-2222-4222-8222-222222222222','Primeira')::text,true);
select is(public.publicar_site(current_setting('t.sa')::uuid,'22222222-2222-4222-8222-222222222222','Primeira'),current_setting('t.v1')::uuid,'repetir a publicação com a mesma chave é idempotente');
select is((select count(*)::integer from public.site_versoes where site_id=current_setting('t.sa')::uuid),1,'retry não cria versão duplicada');
select is((select status from public.sites where id=current_setting('t.sa')::uuid),'publicado','site fica publicado');
select throws_ok($$select public.publicar_site(current_setting('t.sa')::uuid,null)$$,'22023',null,'chave de idempotência obrigatória');

-- Anônimo vê só o publicado
reset role; set local role anon;
select is(public.obter_site_publicado('ESTUDIO-PUB')->'conteudo'->'paginas'->0->'blocos'->0->'dados'->>'titulo','Versão um','anon lê a versão publicada (slug sem diferenciar caixa)');
select is((public.obter_site_publicado('estudio-pub')->>'versao')::integer,1,'resposta traz o número da versão');
select is(public.obter_site_publicado('estudio-pub')->'midias'->(current_setting('t.chave'))->>'chave','sites/'||current_setting('t.orga')||'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-foto.webp','snapshot traz a chave pública da mídia usada');
reset role;select set_config('request.jwt.claims','{"sub":"d8000000-0000-4000-8000-00000000000c","role":"authenticated"}',true);set local role authenticated;
select is(public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('Versão dois (rascunho)'),2),3,'editor altera o rascunho depois de publicado');
reset role; set local role anon;
select is(public.obter_site_publicado('estudio-pub')->'conteudo'->'paginas'->0->'blocos'->0->'dados'->>'titulo','Versão um','rascunho novo não vaza para o público');

-- Segunda versão
reset role;select set_config('request.jwt.claims','{"sub":"d8000000-0000-4000-8000-00000000000e","role":"authenticated"}',true);set local role authenticated;
select set_config('t.v2',public.publicar_site(current_setting('t.sa')::uuid,'33333333-3333-4333-8333-333333333333')::text,true);
select is((select numero from public.site_versoes where id=current_setting('t.v2')::uuid),2,'segunda publicação vira versão 2');
reset role; set local role anon;
select is(public.obter_site_publicado('estudio-pub')->'conteudo'->'paginas'->0->'blocos'->0->'dados'->>'titulo','Versão dois (rascunho)','público passa a ver a versão 2');

-- Imutabilidade
reset role;
select throws_ok($$update public.site_versoes set conteudo='{}' where id=current_setting('t.v1')::uuid$$,'42501','Versões publicadas são imutáveis.','versão não pode ser alterada, nem pelo dono do banco');
select throws_ok($$delete from public.site_versoes where id=current_setting('t.v1')::uuid$$,'42501','Versões publicadas são imutáveis.','versão não pode ser apagada');
select lives_ok($$update public.site_versoes set criado_por=null where id=current_setting('t.v1')::uuid$$,'exclusão de conta pode anonimizar criado_por');
select is((select count(*)::integer from public.site_versoes where site_id=current_setting('t.sa')::uuid and conteudo->'paginas'->0->'blocos'->0->'dados'->>'titulo'='Versão um'),1,'conteúdo da versão 1 permanece intacto');

-- Rollback
reset role;select set_config('request.jwt.claims','{"sub":"d8000000-0000-4000-8000-00000000000c","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.reverter_site_versao(current_setting('t.sa')::uuid,current_setting('t.v1')::uuid)$$,'42501',null,'editor não faz rollback');
reset role;select set_config('request.jwt.claims','{"sub":"d8000000-0000-4000-8000-00000000000e","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.reverter_site_versao(current_setting('t.sa')::uuid,current_setting('t.vb')::uuid)$$,'22023',null,'rollback para versão de outro site é rejeitado');
select is(public.reverter_site_versao(current_setting('t.sa')::uuid,current_setting('t.v1')::uuid),current_setting('t.v1')::uuid,'admin volta para a versão 1');
select is(public.reverter_site_versao(current_setting('t.sa')::uuid,current_setting('t.v1')::uuid),current_setting('t.v1')::uuid,'rollback repetido é inofensivo');
reset role; set local role anon;
select is(public.obter_site_publicado('estudio-pub')->'conteudo'->'paginas'->0->'blocos'->0->'dados'->>'titulo','Versão um','público volta a ver a versão 1');
reset role;select set_config('request.jwt.claims','{"sub":"d8000000-0000-4000-8000-00000000000e","role":"authenticated"}',true);set local role authenticated;
select is(public.restaurar_site_versao_no_rascunho(current_setting('t.sa')::uuid,current_setting('t.v1')::uuid),4,'versão antiga pode voltar ao rascunho');
select is((select rascunho->'paginas'->0->'blocos'->0->'dados'->>'titulo' from public.sites where id=current_setting('t.sa')::uuid),'Versão um','rascunho recebeu o conteúdo da versão 1');

-- Retirada
select is(public.despublicar_site(current_setting('t.sa')::uuid),true,'admin retira o site do ar');
select is(public.despublicar_site(current_setting('t.sa')::uuid),false,'retirar de novo não faz nada');
reset role; set local role anon;
select is(public.obter_site_publicado('estudio-pub'),null,'site retirado não é mais público');
reset role;select set_config('request.jwt.claims','{"sub":"d8000000-0000-4000-8000-00000000000e","role":"authenticated"}',true);set local role authenticated;
select is(public.reverter_site_versao(current_setting('t.sa')::uuid,current_setting('t.v2')::uuid),current_setting('t.v2')::uuid,'rollback também recoloca no ar um site retirado');
select is((select count(*)::integer from public.site_eventos where site_id=current_setting('t.sa')::uuid and acao in ('publicado','revertido','despublicado')),5,'auditoria registra publicações, rollbacks e retirada');

-- Isolamento
reset role;select set_config('request.jwt.claims','{"sub":"d8000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.site_versoes where site_id=current_setting('t.sa')::uuid),0,'B não enxerga versões de A');
select is((select count(*)::integer from public.site_eventos where site_id=current_setting('t.sa')::uuid),0,'B não enxerga auditoria de A');
select throws_ok($$select public.despublicar_site(current_setting('t.sa')::uuid)$$,'42501',null,'B não retira o site de A');
reset role;
-- Exclusão do site leva as versões junto (não bloqueia exclusão de conta)
select lives_ok($$delete from public.sites where id=current_setting('t.sa')::uuid$$,'apagar o site apaga as versões sem ser barrado pelo gatilho');
select finish(); rollback;
