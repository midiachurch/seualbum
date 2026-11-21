"""Gate de concorrência real do Booking: várias sessões SQL disputam o mesmo slot.
Chamado pelo harness descartável (SEUALBUM_BOOKING_CONCURRENCY=1). Sem rede, sem banco remoto.
"""
from concurrent.futures import ThreadPoolExecutor
import json
import subprocess

SESSOES = 8
SLOT = "((current_date + 3) + time '10:00') at time zone 'America/Sao_Paulo'"


def run_booking_concurrency(db_name, sql, output):
    if not db_name.startswith('seualbum-sql-test-'):
        raise RuntimeError('Container não pertence ao harness descartável')
    info = json.loads(subprocess.check_output(['docker', 'inspect', db_name]))[0]
    if info['HostConfig']['NetworkMode'] != 'none':
        raise RuntimeError('Gate exige namespace sem rede do harness')
    sql("""
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('c9100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','booking-conc@example.invalid','{"role":"fotografo"}','{}',now(),now());
insert into public.agenda_recursos(id,organizacao_id,nome,slug,fuso,publicado)
  select 'c9200000-0000-4000-8000-000000000001',id,'Concorrência sintética','conc-booking','America/Sao_Paulo',true
  from public.organizacoes where dono_id='c9100000-0000-4000-8000-000000000001';
insert into public.agenda_disponibilidade(recurso_id,dia_semana,inicio,fim)
  select 'c9200000-0000-4000-8000-000000000001',d,'09:00','17:00' from generate_series(0,6) d;
""")

    def tentativa(n):
        content = rf"""\set VERBOSITY verbose
set role anon;
select public.agenda_criar_hold('conc-booking',{SLOT},'Cliente {n:02d}','conc{n}@example.invalid',null,lpad('{n}',64,'a'));
"""
        return subprocess.run(['docker', 'exec', '-i', db_name, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
                              input=content, text=True, capture_output=True)

    with ThreadPoolExecutor(max_workers=SESSOES) as pool:
        resultados = list(pool.map(tentativa, range(1, SESSOES + 1)))
    ok = sum(r.returncode == 0 for r in resultados)
    conflitos = sum(r.returncode != 0 and '23P01' in r.stderr for r in resultados)
    if ok != 1 or conflitos != SESSOES - 1:
        raise RuntimeError(f'Esperado 1 sucesso e {SESSOES - 1} conflitos 23P01; obtido {ok} e {conflitos}')
    vivos = sql("select count(*) from public.agenda_reservas where recurso_id='c9200000-0000-4000-8000-000000000001' and status in ('hold','confirmada');").strip()
    if vivos != '1':
        raise RuntimeError('Concorrência gerou mais de uma reserva viva no mesmo intervalo')
    mensagem = f'{SESSOES} sessões simultâneas no mesmo slot: 1 hold criado, {SESSOES - 1} recusas 23P01.\n'
    (output / 'booking-concorrencia.txt').write_text(mensagem)
    print(mensagem, end='', flush=True)
