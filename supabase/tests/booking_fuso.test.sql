begin; create extension if not exists pgtap with schema extensions; select plan(21);
-- Booking: fuso IANA por recurso, horário de verão (salto e repetição) e independência do fuso do servidor.
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('b8000000-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fz-a@example.invalid','{"role":"fotografo"}','{}',now(),now());
select set_config('app.orgA',(select id::text from public.organizacoes where dono_id='b8000000-0000-4000-8000-00000000000a'),true);
-- Datas de transição do próximo ano civil (EUA: 2º domingo de março e 1º domingo de novembro).
select set_config('app.ano',extract(year from now()+interval '1 year')::int::text,true);
select set_config('app.dstS',(make_date(current_setting('app.ano')::int,3,8) + ((7 - extract(dow from make_date(current_setting('app.ano')::int,3,8))::int) % 7))::text,true);
select set_config('app.dstF',(make_date(current_setting('app.ano')::int,11,1) + ((7 - extract(dow from make_date(current_setting('app.ano')::int,11,1))::int) % 7))::text,true);

select set_config('request.jwt.claims','{"sub":"b8000000-0000-4000-8000-00000000000a","role":"authenticated"}',true);set local role authenticated;
select is(set_config('app.rN',public.agenda_salvar_recurso(current_setting('app.orgA')::uuid,null,'Nova York','nova-york','pessoa',null,'America/New_York',30,0,30,0,365,24,null,true)::text,true) is not null,true,'recurso em America/New_York');
select is(set_config('app.rS',public.agenda_salvar_recurso(current_setting('app.orgA')::uuid,null,'São Paulo','sao-paulo','pessoa',null,'America/Sao_Paulo',60,0,30,0,365,24,null,true)::text,true) is not null,true,'recurso em America/Sao_Paulo');
select is(set_config('app.rT',public.agenda_salvar_recurso(current_setting('app.orgA')::uuid,null,'Tóquio','toquio','pessoa',null,'Asia/Tokyo',60,0,30,0,365,24,null,true)::text,true) is not null,true,'recurso em Asia/Tokyo');
select is(public.agenda_definir_disponibilidade(current_setting('app.rN')::uuid,'[{"dia":0,"inicio":"01:00","fim":"04:00"},{"dia":1,"inicio":"01:00","fim":"04:00"},{"dia":2,"inicio":"01:00","fim":"04:00"},{"dia":3,"inicio":"01:00","fim":"04:00"},{"dia":4,"inicio":"01:00","fim":"04:00"},{"dia":5,"inicio":"01:00","fim":"04:00"},{"dia":6,"inicio":"01:00","fim":"04:00"}]'::jsonb),7,'grade local 01:00-04:00 em Nova York');
select is(public.agenda_definir_disponibilidade(current_setting('app.rS')::uuid,'[{"dia":0,"inicio":"09:00","fim":"11:00"},{"dia":1,"inicio":"09:00","fim":"11:00"},{"dia":2,"inicio":"09:00","fim":"11:00"},{"dia":3,"inicio":"09:00","fim":"11:00"},{"dia":4,"inicio":"09:00","fim":"11:00"},{"dia":5,"inicio":"09:00","fim":"11:00"},{"dia":6,"inicio":"09:00","fim":"11:00"}]'::jsonb),7,'grade local 09:00-11:00 em São Paulo');
select is(public.agenda_definir_disponibilidade(current_setting('app.rT')::uuid,'[{"dia":0,"inicio":"09:00","fim":"11:00"},{"dia":1,"inicio":"09:00","fim":"11:00"},{"dia":2,"inicio":"09:00","fim":"11:00"},{"dia":3,"inicio":"09:00","fim":"11:00"},{"dia":4,"inicio":"09:00","fim":"11:00"},{"dia":5,"inicio":"09:00","fim":"11:00"},{"dia":6,"inicio":"09:00","fim":"11:00"}]'::jsonb),7,'grade local 09:00-11:00 em Tóquio');

-- Salto de primavera: 02:00 e 02:30 locais não existem
select is((select count(*)::integer from public.agenda_listar_slots_estudio(current_setting('app.rN')::uuid,current_setting('app.dstS')::date,current_setting('app.dstS')::date)),4,'salto de primavera: sobram 4 slots (02:00 e 02:30 locais não existem)');
select is((select array_agg(to_char(slot_inicio at time zone 'UTC','HH24:MI') order by slot_inicio) from public.agenda_listar_slots_estudio(current_setting('app.rN')::uuid,current_setting('app.dstS')::date,current_setting('app.dstS')::date)),array['06:00','06:30','07:00','07:30'],'salto de primavera: 01:00 e 01:30 em EST (UTC-5); 03:00 e 03:30 em EDT (UTC-4)');
select is((select count(*)::integer from public.agenda_listar_slots_estudio(current_setting('app.rN')::uuid,current_setting('app.dstS')::date-1,current_setting('app.dstS')::date-1)),6,'dia anterior ao salto tem os 6 slots normais');
select is((select array_agg(to_char(slot_inicio at time zone 'UTC','HH24:MI') order by slot_inicio) from public.agenda_listar_slots_estudio(current_setting('app.rN')::uuid,current_setting('app.dstS')::date+1,current_setting('app.dstS')::date+1)),array['05:00','05:30','06:00','06:30','07:00','07:30'],'dia seguinte ao salto: UTC-4 (05:00Z = 01:00 local)');

-- Virada de outono: 01:00-01:59 acontece duas vezes; oferecemos uma só vez cada horário local
select is((select count(*)::integer from public.agenda_listar_slots_estudio(current_setting('app.rN')::uuid,current_setting('app.dstF')::date,current_setting('app.dstF')::date)),6,'virada de outono: 6 slots, horário repetido não duplica');
select is((select count(distinct slot_inicio)::integer from public.agenda_listar_slots_estudio(current_setting('app.rN')::uuid,current_setting('app.dstF')::date,current_setting('app.dstF')::date)),6,'virada de outono: nenhum instante repetido');
select is((select to_char(max(slot_inicio) at time zone 'UTC','HH24:MI') from public.agenda_listar_slots_estudio(current_setting('app.rN')::uuid,current_setting('app.dstF')::date,current_setting('app.dstF')::date)),'08:30','virada de outono: último slot local 03:30 já em EST (UTC-5)');

-- Fusos diferentes, mesmo relógio local, instantes diferentes
select is((select to_char(min(slot_inicio) at time zone 'UTC','HH24:MI') from public.agenda_listar_slots_estudio(current_setting('app.rS')::uuid,current_date+4,current_date+4)),'12:00','São Paulo (UTC-3): 09:00 local = 12:00Z');
select is((select to_char(min(slot_inicio) at time zone 'UTC','HH24:MI') from public.agenda_listar_slots_estudio(current_setting('app.rT')::uuid,current_date+4,current_date+4)),'00:00','Tóquio (UTC+9): 09:00 local = 00:00Z');
select is((select count(*)::integer from public.agenda_listar_slots_estudio(current_setting('app.rT')::uuid,current_date+4,current_date+4)),3,'Tóquio: 3 slots (09:00, 09:30 e 10:00) na janela de 2 h com duração de 1 h');

-- O fuso da sessão do servidor não altera o resultado
select set_config('app.snap',(select string_agg(slot_inicio at time zone 'UTC' ||'',',' order by slot_inicio) from public.agenda_listar_slots_estudio(current_setting('app.rN')::uuid,current_setting('app.dstS')::date-1,current_setting('app.dstS')::date+1)),true);
select set_config('timezone','Asia/Tokyo',true);
select is((select string_agg(slot_inicio at time zone 'UTC' ||'',',' order by slot_inicio) from public.agenda_listar_slots_estudio(current_setting('app.rN')::uuid,current_setting('app.dstS')::date-1,current_setting('app.dstS')::date+1)),current_setting('app.snap'),'servidor em Tóquio: mesmos instantes para o recurso de Nova York');
select set_config('timezone','Pacific/Kiritimati',true);
select is((select string_agg(slot_inicio at time zone 'UTC' ||'',',' order by slot_inicio) from public.agenda_listar_slots_estudio(current_setting('app.rN')::uuid,current_setting('app.dstS')::date-1,current_setting('app.dstS')::date+1)),current_setting('app.snap'),'servidor em UTC+14: mesmos instantes');
select set_config('timezone','UTC',true);

-- Reserva em dia de DST: a duração é real (30 min) e o fim continua coerente
select is(public.agenda_reservar_estudio(current_setting('app.rN')::uuid,(select min(slot_inicio) from public.agenda_listar_slots_estudio(current_setting('app.rN')::uuid,current_setting('app.dstS')::date,current_setting('app.dstS')::date) where slot_inicio at time zone 'UTC' >= (current_setting('app.dstS')::date + time '07:00')),'Cliente DST','dst@example.invalid',null,repeat('d5',32)) is not null,true,'reserva às 03:00 EDT no dia do salto');
select is((select count(*)::integer from public.agenda_listar_slots_estudio(current_setting('app.rN')::uuid,current_setting('app.dstS')::date,current_setting('app.dstS')::date)),3,'o slot reservado deixa de ser oferecido');
reset role;
select is((select fim - inicio from public.agenda_reservas where token_hash=repeat('d5',32)),interval '30 minutes','duração real de 30 min preservada');
reset role;
select finish(); rollback;
