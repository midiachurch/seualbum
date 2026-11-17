#!/usr/bin/env python3
"""HTTP real via PostgREST, somente no banco descartável do harness SQL.
Execute SEUALBUM_API_TESTS=1 python3 scripts/test-db-isolado.py.
Sem portas no host, sem pull, sem .env. JWTs sintéticos não passam por Auth.
"""
import base64
import hashlib
import hmac
import json
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
API_IMAGE = 'public.ecr.aws/supabase/postgrest:v14.18'
CLIENT_IMAGE = 'public.ecr.aws/supabase/storage-api:v1.72.1'


def token(secret, actor=None, role='authenticated'):
    def encode(value):
        return base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':')).encode()).rstrip(b'=')
    claims = {'role': role, 'exp': int(time.time()) + 600}
    if actor:
        claims['sub'] = f'a1000000-0000-4000-8000-{actor:012}'
    message = encode({'alg': 'HS256', 'typ': 'JWT'}) + b'.' + encode(claims)
    signature = base64.urlsafe_b64encode(hmac.new(secret.encode(), message, hashlib.sha256).digest()).rstrip(b'=')
    return (message + b'.' + signature).decode()


def run_api(db_name, sql, output):
    api_name = db_name + '-api'
    client_name = db_name + '-http'
    secret = 'seualbum-disposable-jwt-' + uuid.uuid4().hex
    password = 'seualbum-disposable-db-' + uuid.uuid4().hex
    def run(args, **kwargs):
        return subprocess.run(args, check=True, capture_output=True, **kwargs)
    for image in (API_IMAGE, CLIENT_IMAGE):
        run(['docker', 'image', 'inspect', image])
    try:
        sql((ROOT / 'supabase/tests/api/favoritos.fixture.sql').read_text())
        sql(f"alter role authenticator login password '{password}'; grant authenticated, anon to authenticator;")
        run(['docker', 'run', '-d', '--pull=never', '--name', api_name,
             '--network', 'container:' + db_name,
             '-e', 'PGRST_DB_URI=postgres://authenticator:' + password + '@127.0.0.1:5432/postgres',
             '-e', 'PGRST_DB_SCHEMAS=public', '-e', 'PGRST_DB_ANON_ROLE=anon',
             '-e', 'PGRST_JWT_SECRET=' + secret, '-e', 'PGRST_SERVER_HOST=127.0.0.1',
             '-e', 'PGRST_SERVER_PORT=3000', API_IMAGE])
        config = {'tokens': {str(n): token(secret, n) for n in range(1, 9)},
                  'noSub': token(secret), 'anon': token(secret, role='anon')}
        source = (ROOT / 'scripts/test-postgrest-isolado.mjs').read_text()
        source = 'const config = ' + json.dumps(config) + ';\n' + source
        result = subprocess.run(['docker', 'run', '--rm', '-i', '--pull=never', '--name', client_name,
            '--network', 'container:' + db_name, '--entrypoint', 'node', CLIENT_IMAGE,
            '--input-type=module', '-'], input=source, text=True, capture_output=True)
        (output / 'postgrest-http.log').write_text(result.stdout + result.stderr)
        print(result.stdout, end='', flush=True)
        if result.returncode:
            raise RuntimeError('PostgREST HTTP falhou; consulte postgrest-http.log')
        # Contas são desativadas pela gestão no banco; HTTP testa a sessão já emitida.
        sql("select set_config('request.jwt.claims','{\"sub\":\"a1000000-0000-4000-8000-000000000007\",\"role\":\"authenticated\"}',false); update public.profiles set status='inativo' where id='a1000000-0000-4000-8000-000000000001';")
        inactive = '''
const response = await fetch('http://127.0.0.1:3000/rpc/definir_favorito_foto', {
 method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+config.tokens['1']},
 body:JSON.stringify({p_projeto_id:'a2000000-0000-4000-8000-000000000001',p_foto_id:'a4000000-0000-4000-8000-000000000001',p_favorita:false}), signal:AbortSignal.timeout(3000)});
if(response.status!==403) throw Error('Conta inativa: esperado 403, recebido '+response.status);
console.log('ok - conta inativa com JWT já emitido retorna HTTP 403');
'''
        result = run(['docker', 'run', '--rm', '-i', '--pull=never', '--name', client_name,
            '--network', 'container:' + db_name, '--entrypoint', 'node', CLIENT_IMAGE,
            '--input-type=module', '-'], input='const config = '+json.dumps(config)+';\n'+inactive, text=True)
        with (output / 'postgrest-http.log').open('a') as log:
            log.write(result.stdout)
        print(result.stdout, end='', flush=True)
    finally:
        for name in (client_name, api_name):
            subprocess.run(['docker', 'rm', '-f', name], capture_output=True)
