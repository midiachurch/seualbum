begin; create extension if not exists pgtap with schema extensions; select plan(42);
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('d9000000-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dom-a@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('d9000000-0000-4000-8000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dom-b@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('d9000000-0000-4000-8000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dom-c@example.invalid','{"role":"designer"}','{}',now(),now()),
('d9000000-0000-4000-8000-00000000000d','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dom-d@example.invalid','{"role":"fotografo"}','{}',now(),now());
select set_config('t.orga',(select id::text from public.organizacoes where dono_id='d9000000-0000-4000-8000-00000000000a'),true);
select set_config('t.orgb',(select id::text from public.organizacoes where dono_id='d9000000-0000-4000-8000-00000000000b'),true);

select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select public.adicionar_membro_organizacao(current_setting('t.orga')::uuid,'dom-c@example.invalid','editor');
select public.adicionar_membro_organizacao(current_setting('t.orga')::uuid,'dom-d@example.invalid','visualizador');
select set_config('t.sa',public.criar_site(current_setting('t.orga')::uuid,'Estúdio Dom','estudio-dom')::text,true);
reset role;select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select set_config('t.sb',public.criar_site(current_setting('t.orgb')::uuid,'Estúdio Dom B','estudio-dom-b')::text,true);
reset role;select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;

-- Cadastro
select set_config('t.da',(select id::text from public.adicionar_site_dominio(current_setting('t.sa')::uuid,'  Fotos-Dom.com.br. ')),true);
select set_config('t.ta',(select token from public.site_dominios where id=current_setting('t.da')::uuid),true);
select is((select dominio from public.site_dominios where id=current_setting('t.da')::uuid),'fotos-dom.com.br','domínio é normalizado (caixa, espaços e ponto final)');
select matches(current_setting('t.ta'),'^seualbum-verificacao=[0-9a-f]{32}$','token de verificação tem formato esperado');
select is((select id from public.adicionar_site_dominio(current_setting('t.sa')::uuid,'fotos-dom.com.br')),current_setting('t.da')::uuid,'adicionar de novo devolve o mesmo registro');
select throws_ok($$select * from public.adicionar_site_dominio(current_setting('t.sa')::uuid,'localhost')$$,'22023',null,'localhost rejeitado');
select throws_ok($$select * from public.adicionar_site_dominio(current_setting('t.sa')::uuid,'site.internal')$$,'22023',null,'TLD reservado rejeitado');
select throws_ok($$select * from public.adicionar_site_dominio(current_setting('t.sa')::uuid,'sem espaco.com')$$,'22023',null,'domínio com espaço rejeitado');
select throws_ok($$select * from public.adicionar_site_dominio(current_setting('t.sa')::uuid,'192.168.0.1')$$,'22023',null,'IP rejeitado');
select throws_ok($$insert into public.site_dominios(site_id,organizacao_id,dominio,token) values (current_setting('t.sa')::uuid,current_setting('t.orga')::uuid,'x.com','seualbum-verificacao=00000000000000000000000000000000')$$,'42501',null,'sem INSERT direto em domínios');

-- Papéis
reset role;select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-00000000000c","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select * from public.adicionar_site_dominio(current_setting('t.sa')::uuid,'editor.com.br')$$,'42501',null,'editor não adiciona domínio');
select throws_ok($$select * from public.preparar_verificacao_dominio(current_setting('t.da')::uuid)$$,'42501',null,'editor não pede verificação');
reset role;select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-00000000000d","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.site_dominios),1,'visualizador lê os domínios (somente leitura)');
reset role;select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select * from public.adicionar_site_dominio(current_setting('t.sa')::uuid,'invasor.com.br')$$,'42501',null,'B não adiciona domínio ao site de A');
select is((select count(*)::integer from public.site_dominios),0,'B não enxerga domínios de A');
select throws_ok($$select * from public.preparar_verificacao_dominio(current_setting('t.da')::uuid)$$,'42501',null,'B não pede verificação do domínio de A');

-- Verificação: o banco não aceita auto-atestado de usuário
reset role;select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.confirmar_verificacao_dominio(current_setting('t.da')::uuid,array[current_setting('t.ta')])$$,'42501',null,'nem o dono atesta a própria verificação');
select throws_ok($$update public.site_dominios set status='verificado'$$,'42501',null,'sem UPDATE direto em domínios');
reset role; set local role anon;
select throws_ok($$select public.confirmar_verificacao_dominio(gen_random_uuid(),array['x'])$$,'42501',null,'anon não atesta verificação');
reset role; set local role service_role;
select throws_ok($$select public.confirmar_verificacao_dominio(current_setting('t.da')::uuid,array[current_setting('t.ta')])$$,'22023','Verificação não solicitada.','sem pedido de um dono/admin, nem o servidor confirma');
reset role;select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.definir_site_dominio_ativo(current_setting('t.da')::uuid,true)$$,'22023',null,'domínio não verificado não ativa');
select is((select status from public.preparar_verificacao_dominio(current_setting('t.da')::uuid)),'pendente','dono pede verificação');
reset role; set local role service_role;
select is(public.confirmar_verificacao_dominio(current_setting('t.da')::uuid,array['outro-valor','seualbum-verificacao=errado']),'falhou','registro TXT sem o token falha');
select is((select falhou_motivo from public.site_dominios where id=current_setting('t.da')::uuid),'registro_nao_encontrado','motivo da falha registrado');
select throws_ok($$select public.confirmar_verificacao_dominio(current_setting('t.da')::uuid,array[current_setting('t.ta')])$$,'22023',null,'o pedido é de uso único (sem novo pedido, não confirma)');
reset role;select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select public.preparar_verificacao_dominio(current_setting('t.da')::uuid);
reset role; set local role service_role;
select is(public.confirmar_verificacao_dominio(current_setting('t.da')::uuid,array['"'||current_setting('t.ta')||'"']),'verificado','token correto verifica o domínio');
select is(public.confirmar_verificacao_dominio(current_setting('t.da')::uuid,array['x']),'verificado','confirmar de novo não desfaz a verificação');
reset role;

-- Exclusividade: só o verificado é exclusivo
reset role;select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select * from public.adicionar_site_dominio(current_setting('t.sb')::uuid,'fotos-dom.com.br')$$,'22023','Domínio indisponível.','domínio verificado em outro site não pode ser cadastrado');
-- Disputa: A e B pedem o mesmo domínio ainda não verificado
select set_config('t.disp_b',(select id::text from public.adicionar_site_dominio(current_setting('t.sb')::uuid,'disputa.com.br')),true);
reset role;select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select set_config('t.disp_a',(select id::text from public.adicionar_site_dominio(current_setting('t.sa')::uuid,'disputa.com.br')),true);
select is((select count(*)::integer from public.site_dominios where dominio='disputa.com.br'),1,'A só enxerga o próprio pedido de domínio em disputa');
select public.preparar_verificacao_dominio(current_setting('t.disp_a')::uuid);
reset role;
select set_config('t.disp_btoken',(select token from public.site_dominios where id=current_setting('t.disp_b')::uuid),true);
set local role service_role;
select is(public.confirmar_verificacao_dominio(current_setting('t.disp_a')::uuid,array[(select 'seualbum-verificacao=nao-e-o-token')]),'falhou','quem não prova o DNS não leva o domínio');
reset role;select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-00000000000b","role":"authenticated"}',true);set local role authenticated;
select public.preparar_verificacao_dominio(current_setting('t.disp_b')::uuid);
reset role; set local role service_role;
select is(public.confirmar_verificacao_dominio(current_setting('t.disp_b')::uuid,array[current_setting('t.disp_btoken')]),'verificado','B prova o DNS e fica com o domínio');
reset role;
select throws_ok($$update public.site_dominios set status='verificado',verificado_em=now() where id=current_setting('t.disp_a')::uuid$$,'23505',null,'índice único impede dois verificados para o mesmo domínio');

-- Resolução host → site (somente publicado e ativo)
reset role;select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is(public.definir_site_dominio_ativo(current_setting('t.da')::uuid,true),true,'dono ativa domínio verificado');
reset role; set local role anon;
select is(public.resolver_site_por_host('fotos-dom.com.br'),null,'site não publicado não resolve por host');
reset role;select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select public.publicar_site(current_setting('t.sa')::uuid,'44444444-4444-4444-8444-444444444444');
reset role; set local role anon;
select is(public.resolver_site_por_host(' FOTOS-DOM.com.br. '),'estudio-dom','host ativo de site publicado resolve (normalizado)');
select is(public.obter_site_publicado_por_host('fotos-dom.com.br')->>'slug','estudio-dom','conteúdo por host é o do site dono do domínio');
select is(public.obter_site_publicado('estudio-dom')->>'dominio','fotos-dom.com.br','resposta por slug informa o domínio canônico');
select is(public.resolver_site_por_host('disputa.com.br'),null,'domínio verificado de site não publicado não resolve');
select is(public.resolver_site_por_host('desconhecido.com.br'),null,'host desconhecido não resolve');
reset role;select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select public.despublicar_site(current_setting('t.sa')::uuid);
reset role; set local role anon;
select is(public.resolver_site_por_host('fotos-dom.com.br'),null,'retirar o site derruba a resolução por host');
reset role;select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select public.reverter_site_versao(current_setting('t.sa')::uuid,(select id from public.site_versoes where site_id=current_setting('t.sa')::uuid));
select public.definir_site_dominio_ativo(current_setting('t.da')::uuid,false);
reset role; set local role anon;
select is(public.resolver_site_por_host('fotos-dom.com.br'),null,'domínio desativado não resolve');
reset role;
select throws_ok($$update public.site_dominios set ativo=true where id=current_setting('t.disp_a')::uuid$$,'23514',null,'constraint impede ativar domínio não verificado');
reset role;select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-00000000000c","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$select public.remover_site_dominio(current_setting('t.da')::uuid)$$,'42501',null,'editor não remove domínio');
reset role;select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is(public.remover_site_dominio(current_setting('t.da')::uuid),true,'dono remove o domínio');
reset role;
select finish(); rollback;
