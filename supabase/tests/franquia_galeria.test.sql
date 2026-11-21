begin; create extension if not exists pgtap with schema extensions; select plan(23);
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('e1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','franquia-1@example.invalid','{"role":"fotografo"}','{}',now(),now()),
('e1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','franquia-2@example.invalid','{"role":"fotografo"}','{}',now(),now());
-- Projetos e fotos do fotógrafo 1 (3 medidas + 1 sem medição) e uma foto do fotógrafo 2.
select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);set local role authenticated;
do $$ begin perform public.criar_galeria_digital('e2000000-0000-4000-8000-000000000001','Galeria F1','Cliente F1','f1@example.invalid'); end $$;
reset role;select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);set local role authenticated;
do $$ begin perform public.criar_galeria_digital('e2000000-0000-4000-8000-000000000002','Galeria F2','Cliente F2','f2@example.invalid'); end $$;
reset role;
insert into public.fotos(projeto_id,storage_path,bucket,tamanho_bytes) values
('e2000000-0000-4000-8000-000000000001','projetos/e2000000-0000-4000-8000-000000000001/fotos/a.jpg','r2',4000000000),
('e2000000-0000-4000-8000-000000000001','projetos/e2000000-0000-4000-8000-000000000001/fotos/b.jpg','r2',3000000000),
('e2000000-0000-4000-8000-000000000001','projetos/e2000000-0000-4000-8000-000000000001/fotos/c.jpg','r2',2000000000),
('e2000000-0000-4000-8000-000000000001','projetos/e2000000-0000-4000-8000-000000000001/fotos/d.jpg','r2',null),
('e2000000-0000-4000-8000-000000000002','projetos/e2000000-0000-4000-8000-000000000002/fotos/z.jpg','r2',9000000000);

-- Catálogo
select is((select count(*)::integer from public.planos_galeria),3,'catálogo semeado com três hipóteses');
select throws_ok($$insert into public.fotos(projeto_id,storage_path,bucket,tamanho_bytes) values ('e2000000-0000-4000-8000-000000000001','x','r2',0)$$,'23514',null,'tamanho zero rejeitado');

-- Sem plano: consumo mede, mas informa sem_plano
select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);set local role authenticated;
select throws_ok($$update public.planos_galeria set preco_mensal_centavos=1$$,'42501',null,'catálogo sem escrita para o app');
select is((select situacao from public.consumo_franquia_galeria()),'sem_plano','sem assinatura -> sem_plano');
select is((select usado_bytes from public.consumo_franquia_galeria()),9000000000::bigint,'soma só as fotos do próprio fotógrafo');
select is((select fotos_sem_medicao from public.consumo_franquia_galeria()),1,'foto sem medição é informada, não estimada');

-- Escolha de plano
select is(public.escolher_plano_galeria('e3000000-0000-4000-8000-000000000001','essencial') is not null,true,'escolhe plano Essencial');
select is(public.escolher_plano_galeria('e3000000-0000-4000-8000-000000000001','essencial'),(select id from public.assinaturas_galeria where chave='e3000000-0000-4000-8000-000000000001'),'retry com a mesma chave devolve a mesma assinatura');
select is((select count(*)::integer from public.assinaturas_galeria where fotografo_id=auth.uid()),1,'retry não duplica');
select throws_ok($$select public.escolher_plano_galeria('e3000000-0000-4000-8000-000000000001','profissional')$$,'22023',null,'mesma chave com outro plano negada');
select throws_ok($$select public.escolher_plano_galeria(gen_random_uuid(),'inexistente')$$,'22023',null,'plano inexistente negado');
select throws_ok($$select public.escolher_plano_galeria(null,'essencial')$$,'22023',null,'chave nula negada');

-- Situação por faixa: 9 GB de 10 GB = 90% -> alerta
select is((select situacao from public.consumo_franquia_galeria()),'alerta','90% da franquia -> alerta');
select is((select percentual from public.consumo_franquia_galeria()),90,'percentual inteiro correto');

-- Troca de plano preserva histórico e mantém uma ativa
do $$ begin perform public.escolher_plano_galeria('e3000000-0000-4000-8000-000000000002','profissional'); end $$;
select is((select situacao from public.consumo_franquia_galeria()),'dentro','9 GB de 100 GB -> dentro');
select is((select count(*)::integer from public.assinaturas_galeria where fotografo_id=auth.uid() and status='ativa'),1,'uma única assinatura ativa');
select is((select count(*)::integer from public.assinaturas_galeria where fotografo_id=auth.uid() and status='substituida'),1,'anterior preservada como substituída');
select is((select preco_mensal_centavos from public.assinaturas_galeria where chave='e3000000-0000-4000-8000-000000000001'),4900,'snapshot do preço original preservado');

-- Isolamento
reset role;select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);set local role authenticated;
select is((select count(*)::integer from public.assinaturas_galeria),0,'outro fotógrafo não lê assinaturas alheias');
select throws_ok($$select public.escolher_plano_galeria('e3000000-0000-4000-8000-000000000001','essencial')$$,'42501',null,'outro fotógrafo não captura a chave');
select is((select usado_bytes from public.consumo_franquia_galeria()),9000000000::bigint,'consumo do outro é só dele');
select throws_ok($$insert into public.assinaturas_galeria(fotografo_id,chave,plano_slug,plano_nome,preco_mensal_centavos,armazenamento_bytes) values (auth.uid(),gen_random_uuid(),'essencial','x',0,1)$$,'42501',null,'sem INSERT direto na assinatura');

-- Anônimo
reset role; set local role anon;
select throws_ok($$select public.escolher_plano_galeria(gen_random_uuid(),'essencial')$$,'42501',null,'anon não escolhe plano');
reset role;
select finish(); rollback;
