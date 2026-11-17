"""Gate de duas sessões SQL; chamado pelo coordenador dentro do harness descartável.
Não abre banco remoto nem portas. Fixture permanece somente até o container ser removido.
"""
from concurrent.futures import ThreadPoolExecutor
import json
import subprocess
import time


def run_selection_concurrency(db_name, sql, output):
    if not db_name.startswith('seualbum-sql-test-'):
        raise RuntimeError('Container não pertence ao harness descartável')
    info = json.loads(subprocess.check_output(['docker', 'inspect', db_name]))[0]
    if info['HostConfig']['NetworkMode'] != 'none':
        raise RuntimeError('Gate exige namespace sem rede do harness')
    sql("""
insert into auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('c6000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','concurrency@example.invalid','{"role":"fotografo"}','{}',now(),now());
insert into public.clientes(id,fotografo_id,nome,email) values('ca000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','Cliente sintético','concurrency-client@example.invalid');
insert into public.projetos(id,nome,cliente_id,fotografo_id,status) values('c7000000-0000-4000-8000-000000000001','Concorrência sintética','ca000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','em_diagramacao');
insert into public.fotos(id,projeto_id,storage_path) values('c8000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000001','concorrencia.jpg');
""")
    def command(key, hold):
        pause = "select 1 from public.projetos where id='c7000000-0000-4000-8000-000000000001' for update; select pg_sleep(0.5);" if hold else ''
        content = rf"""\set VERBOSITY verbose
begin;
{pause}
select set_config('request.jwt.claims','{{"sub":"c6000000-0000-4000-8000-000000000001","role":"authenticated"}}',true);
set local role authenticated;
select public.entregar_selecao('c7000000-0000-4000-8000-000000000001',array['c8000000-0000-4000-8000-000000000001'::uuid],0,'c9000000-0000-4000-8000-{key:012}');
commit;
"""
        return subprocess.run(['docker', 'exec', '-i', db_name, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], input=content, text=True, capture_output=True)
    with ThreadPoolExecutor(max_workers=2) as pool:
        a = pool.submit(command, 1, True)
        time.sleep(0.1)
        b = pool.submit(command, 2, False)
        results = [a.result(), b.result()]
    successes = sum(r.returncode == 0 for r in results)
    conflicts = sum(r.returncode != 0 and '40001' in r.stderr for r in results)
    if successes != 1 or conflicts != 1:
        raise RuntimeError('Esperados exatamente um sucesso e um conflito de revisão')
    counts = sql("select count(*)||':'||max(revisao) from public.selecoes_entregues where projeto_id='c7000000-0000-4000-8000-000000000001';").strip()
    if counts != '1:1':
        raise RuntimeError('Concorrência duplicou seleção ou revisão')
    message = 'Duas sessões SQL: um sucesso, um conflito 40001; uma entrega/revisão persistida.\n'
    (output / 'selecao-concorrencia.txt').write_text(message)
    print(message, end='', flush=True)
