begin; create extension if not exists pgtap with schema extensions; select plan(48);
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('d7000000-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','site-a@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('d7000000-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','site-b@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('d7000000-0000-4000-8000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','site-c@example.invalid','{"role":"designer"}','{}',now(),now()),
('d7000000-0000-4000-8000-00000000000d','00000000-0000-0000-0000-000000000000','authenticated','authenticated','site-d@example.invalid','{"role":"fotografo"}','{}',now(),now());
create function public.zz_doc(p_blocos jsonb) returns jsonb language sql as $$
  select jsonb_build_object('v',1,'tema',jsonb_build_object('cor','#112233','fonte','serif','modo','claro'),'seo',jsonb_build_object('titulo','T','descricao','D'),
    'paginas',jsonb_build_array(jsonb_build_object('slug','inicio','titulo','Início','blocos',p_blocos))) $$;
select set_config('t.orga',(select id::text from public.organizacoes where dono_id='d7000000-0000-4000-8000-00000000000a'),true);
select set_config('t.orgb',(select id::text from public.organizacoes where dono_id='d7000000-0000-4000-8000-00000000000b'),true);

-- Equipe da organização A: C editor, D visualizador
select set_config('request.jwt.claims','{"sub":"d7000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select public.adicionar_membro_organizacao(current_setting('t.orga')::uuid,'site-c@example.invalid','editor');
select public.adicionar_membro_organizacao(current_setting('t.orga')::uuid,'site-d@example.invalid','visualizador');

-- Criação
select set_config('t.sa',public.criar_site(current_setting('t.orga')::uuid,'Estúdio A','estudio-a')::text,true);
select is((select count(*)::integer from public.sites),1,'dono cria o site da organização');
select is(public.criar_site(current_setting('t.orga')::uuid,'Estúdio A','Estudio-A'),current_setting('t.sa')::uuid,'repetir o mesmo pedido devolve o mesmo site');
select throws_ok($$select public.criar_site(current_setting('t.orga')::uuid,'Outro','outro-endereco')$$,'22023',null,'uma organização tem um único site');
select is((select status from public.sites),'rascunho','site nasce como rascunho');
select is((select count(*)::integer from public.site_versoes),0,'criar não publica nada');
select throws_ok($$update public.sites set status='publicado'$$,'42501',null,'sem UPDATE direto em sites');
select throws_ok($$insert into public.site_versoes(site_id,organizacao_id,numero,conteudo,chave_idempotencia) values (current_setting('t.sa')::uuid,current_setting('t.orga')::uuid,9,'{}',gen_random_uuid())$$,'42501',null,'sem INSERT direto em versões');

-- B: outra organização
reset role;select set_config('request.jwt.claims','{"sub":"d7000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.criar_site(current_setting('t.orgb')::uuid,'Estúdio B','admin')$$,'22023',null,'slug reservado rejeitado');
select throws_ok($$select public.criar_site(current_setting('t.orgb')::uuid,'Estúdio B','a')$$,'22023',null,'slug curto rejeitado');
select throws_ok($$select public.criar_site(current_setting('t.orga')::uuid,'Invasor','invasor-x')$$,'42501',null,'estranho não cria site em outra organização');
select set_config('t.sb',public.criar_site(current_setting('t.orgb')::uuid,'Estúdio B','estudio-b')::text,true);
select throws_ok($$select public.atualizar_site_dados(current_setting('t.sb')::uuid,'Estúdio B','estudio-a')$$,'22023',null,'slug é único globalmente');
select is((select count(*)::integer from public.sites),1,'B enxerga só o próprio site');
select is((select count(*)::integer from public.sites where slug='estudio-a'),0,'B não enxerga o rascunho de A');
select throws_ok($$select public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('[]'),1)$$,'42501',null,'B não edita o site de A');
select throws_ok($$select public.atualizar_site_dados(current_setting('t.sa')::uuid,'x x','novo-slug')$$,'42501',null,'B não renomeia o site de A');

-- Papéis em A
reset role;select set_config('request.jwt.claims','{"sub":"d7000000-0000-4000-8000-00000000000c","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.criar_site(current_setting('t.orga')::uuid,'Estúdio A','estudio-a2')$$,'42501',null,'editor não cria site');
select is(public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('[{"id":"hero-1","tipo":"hero","dados":{"titulo":"Olá"}}]'),1),2,'editor salva rascunho (revisão sobe)');
select throws_ok($$select public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('[]'),1)$$,'40001',null,'revisão desatualizada é recusada');
select throws_ok($$select public.atualizar_site_dados(current_setting('t.sa')::uuid,'Novo nome','novo-slug')$$,'42501',null,'editor não renomeia');
reset role;select set_config('request.jwt.claims','{"sub":"d7000000-0000-4000-8000-00000000000d","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('[]'),2)$$,'42501',null,'visualizador não edita');
select is((select count(*)::integer from public.sites),1,'visualizador lê o site');

-- Validação de blocos (como dono de A)
reset role;select set_config('request.jwt.claims','{"sub":"d7000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('[{"id":"b1","tipo":"iframe","dados":{}}]'),2)$$,'22023',null,'tipo de bloco desconhecido rejeitado');
select throws_ok($$select public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('[{"id":"b1","tipo":"hero","dados":{"titulo":"x","html":"<b>"}}]'),2)$$,'22023',null,'campo desconhecido rejeitado');
select throws_ok($$select public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('[{"id":"b1","tipo":"hero","dados":{}}]'),2)$$,'22023',null,'hero sem título rejeitado');
select throws_ok($$select public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('[{"id":"b1","tipo":"texto","dados":{"html":"<p>oi</p><script>alert(1)</script>"}}]'),2)$$,'22023',null,'script em HTML rejeitado');
select throws_ok($$select public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('[{"id":"b1","tipo":"texto","dados":{"html":"<img src=x onerror=alert(1)>"}}]'),2)$$,'22023',null,'img/onerror rejeitado');
select throws_ok($$select public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('[{"id":"b1","tipo":"texto","dados":{"html":"<a href=\"javascript:alert(1)\">x</a>"}}]'),2)$$,'22023',null,'href javascript: rejeitado');
select throws_ok($$select public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('[{"id":"b1","tipo":"texto","dados":{"html":"<p onclick=\"x()\">x</p>"}}]'),2)$$,'22023',null,'atributo de evento rejeitado');
select throws_ok($$select public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('[{"id":"b1","tipo":"hero","dados":{"titulo":"x","cta_texto":"Ir","cta_url":"javascript:alert(1)"}}]'),2)$$,'22023',null,'URL de botão com javascript: rejeitada');
select throws_ok($$select public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('[{"id":"b1","tipo":"contato","dados":{"titulo":"Fale"}}]'),2)$$,'22023',null,'contato sem canal rejeitado');
select throws_ok($$select public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('[{"id":"b1","tipo":"hero","dados":{"titulo":"x"}},{"id":"b1","tipo":"hero","dados":{"titulo":"y"}}]'),2)$$,'22023',null,'identificador de bloco repetido rejeitado');
select throws_ok($$select public.salvar_site_rascunho(current_setting('t.sa')::uuid,jsonb_set(public.zz_doc('[]'),'{paginas,0,slug}','"home"'),2)$$,'22023',null,'primeira página precisa ser inicio');
select is(public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('[
 {"id":"t1","tipo":"texto","dados":{"titulo":"Oi","html":"<p>Olá <strong>mundo</strong> <a href=\"https://exemplo.com.br\" target=\"_blank\" rel=\"noopener noreferrer\">link</a></p>"}},
 {"id":"s1","tipo":"servicos","dados":{"titulo":"Serviços","itens":[{"nome":"Ensaio","preco":"A partir de R$ 500"}]}},
 {"id":"c1","tipo":"contato","dados":{"titulo":"Fale","email":"oi@exemplo.com.br","whatsapp":"5511999999999"}},
 {"id":"d1","tipo":"depoimentos","dados":{"itens":[{"texto":"Lindo","autor":"Ana"}]}},
 {"id":"r1","tipo":"rodape","dados":{"texto":"© Estúdio","links":[{"rotulo":"Instagram","url":"https://instagram.com/estudio"}]}}]'),2),3,'documento válido com vários tipos é salvo');

-- Mídia
select set_config('t.chavea','sites/'||current_setting('t.orga')||'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-foto.webp',true);
select set_config('t.ma',public.registrar_site_midia(current_setting('t.orga')::uuid,current_setting('t.chavea'),'foto.webp',1200,800,300)::text,true);
select is(public.registrar_site_midia(current_setting('t.orga')::uuid,current_setting('t.chavea'),'foto.webp',1200,800,300),current_setting('t.ma')::uuid,'registrar a mesma chave é idempotente');
select throws_ok($$select public.registrar_site_midia(current_setting('t.orga')::uuid,'sites/'||current_setting('t.orgb')||'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-x.webp','x.webp',1,1,1)$$,'22023',null,'chave da pasta de outra organização rejeitada');
select throws_ok($$select public.registrar_site_midia(current_setting('t.orga')::uuid,'projetos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/fotos/original.jpg','x.jpg',1,1,1)$$,'22023',null,'original privado do R2 rejeitado');
select throws_ok($$select public.registrar_site_midia(current_setting('t.orga')::uuid,'pedidos/u/c/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-x.jpg','x.jpg',1,1,1)$$,'22023',null,'foto de pedido (privada) rejeitada');
select throws_ok($$select public.registrar_site_midia(current_setting('t.orga')::uuid,'sites/'||current_setting('t.orga')||'/../x/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-x.webp','x.webp',1,1,1)$$,'22023',null,'travessia de caminho rejeitada');
select is(public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc(format('[{"id":"h1","tipo":"hero","dados":{"titulo":"Capa","midia_id":"%s","alt":"Casal na praia"}}]',current_setting('t.ma'))::jsonb),3),4,'bloco com mídia própria e alt é salvo');
select throws_ok(format($$select public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('[{"id":"h1","tipo":"hero","dados":{"titulo":"Capa","midia_id":"%s"}}]'),4)$$,current_setting('t.ma')),'22023',null,'imagem sem alt rejeitada');
select throws_ok(format($$select public.salvar_site_rascunho(current_setting('t.sa')::uuid,public.zz_doc('[{"id":"g1","tipo":"galeria","dados":{"itens":[{"midia_id":"%s"}]}}]'),4)$$,current_setting('t.ma')),'22023',null,'galeria sem alt rejeitada');
select throws_ok($$select public.remover_site_midia(current_setting('t.ma')::uuid)$$,'22023',null,'mídia em uso não é removida');

-- B tenta usar a mídia de A
reset role;select set_config('request.jwt.claims','{"sub":"d7000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select throws_ok(format($$select public.salvar_site_rascunho(current_setting('t.sb')::uuid,public.zz_doc('[{"id":"h1","tipo":"hero","dados":{"titulo":"Capa","midia_id":"%s","alt":"x"}}]'),1)$$,current_setting('t.ma')),'22023',null,'mídia de outra organização rejeitada no bloco');
select throws_ok($$select public.remover_site_midia(current_setting('t.ma')::uuid)$$,'42501',null,'B não remove mídia de A');
select is((select count(*)::integer from public.site_midias),0,'B não enxerga mídias de A');
reset role;select set_config('request.jwt.claims','{"sub":"d7000000-0000-4000-8000-00000000000d","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.registrar_site_midia(current_setting('t.orga')::uuid,'sites/'||current_setting('t.orga')||'/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb-x.webp','x.webp',1,1,1)$$,'42501',null,'visualizador não registra mídia');
reset role;
select throws_ok($$insert into public.site_midias(organizacao_id,chave,nome) values (current_setting('t.orga')::uuid,'sites/'||current_setting('t.orgb')||'/cccccccc-cccc-4ccc-8ccc-cccccccccccc-x.webp','x')$$,'23514',null,'constraint do banco também barra chave de outra organização');
reset role; set local role anon;
select throws_ok($$select public.criar_site(current_setting('t.orga')::uuid,'Anon','anon-site')$$,'42501',null,'anon não cria site');
reset role;
select finish(); rollback;
