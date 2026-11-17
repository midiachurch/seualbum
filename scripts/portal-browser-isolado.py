"""Navegador visitante real + Next/Server Actions + PostgREST no banco descartável.
Hook: run_portal_browser(db_name, secret, sql, output), após PostgREST estar pronto.
Somente proxy HTTP loopback; banco/API não publicam portas. Nenhum segredo real.
"""
import base64
import hashlib
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import threading
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
CLIENT_IMAGE = 'public.ecr.aws/supabase/storage-api:v1.72.1'
PROJETO = 'f2000000-0000-4000-8000-000000000001'


def run_portal_browser(db_name, secret, sql, output):
    if not db_name.startswith('seualbum-sql-test-'):
        raise RuntimeError('Portal browser exige o container descartável do harness')
    info = json.loads(subprocess.check_output(['docker', 'inspect', db_name]))[0]
    if info['HostConfig']['NetworkMode'] != 'none':
        raise RuntimeError('Banco do harness precisa estar sem rede externa')
    name = db_name + '-browser-proxy'
    control = uuid.uuid4().hex
    auth_name = db_name + '-browser-auth'
    def encode(value):
        return base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':')).encode()).rstrip(b'=')
    claims = {'role': 'anon', 'exp': int(time.time()) + 900}
    message = encode({'alg': 'HS256', 'typ': 'JWT'}) + b'.' + encode(claims)
    anon = (message + b'.' + base64.urlsafe_b64encode(hmac.new(secret.encode(), message, hashlib.sha256).digest()).rstrip(b'=')).decode()
    class Proxy(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass  # Nunca registrar código, cookie ou JWT.

        def respond(self, status, body):
            content = json.dumps(body).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Access-Control-Allow-Origin', 'http://127.0.0.1:3314')
            self.send_header('Access-Control-Allow-Headers', 'authorization,apikey,content-type,x-client-info,x-supabase-api-version')
            self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
            self.end_headers()
            self.wfile.write(content)

        def do_OPTIONS(self):
            self.respond(200, {})

        def do_GET(self):
            self.forward('GET')

        def forward(self, method):
            # Proxy loopback para Auth e PostgREST reais, exclusivamente no container sem rede.
            if not (re.fullmatch(r'/auth/v1/(token|user|signup|logout)(\?.*)?', self.path)
                    or re.fullmatch(r'/rest/v1/(rpc/(criar_galeria_digital|gerir_portal|estado_portal|abrir_portal|portal_projeto|portal_favorito|portal_entregar|portal_foto)|profiles|projetos|fotos|design_versions|aprovacoes|projeto_atividades|versoes_laminas|selecoes_entregues|selecao_entregue_fotos)(\?.*)?', self.path)):
                self.respond(404, {'error': 'unsupported'})
                return
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if size > 16384:
                    self.respond(413, {'error': 'size'})
                    return
                body = self.rfile.read(size).decode() if size else None
                headers = {k: self.headers[k] for k in ('Authorization', 'apikey', 'Content-Type', 'Accept', 'Prefer', 'x-supabase-api-version') if k in self.headers}
                auth = self.path.startswith('/auth/v1/')
                url = ('http://127.0.0.1:9999' + self.path.removeprefix('/auth/v1')) if auth else ('http://127.0.0.1:3000' + self.path.removeprefix('/rest/v1'))
                request = {'url': url, 'headers': headers, 'body': body, 'method': method}
                code = "let text='';for await(const chunk of process.stdin)text+=chunk;const p=JSON.parse(text);const r=await fetch(p.url,{method:p.method,headers:p.headers,...(p.body?{body:p.body}:{}),signal:AbortSignal.timeout(10000)});process.stdout.write(JSON.stringify({status:r.status,body:await r.text()}));"
                result = subprocess.run(['docker', 'exec', '-i', name, 'node', '--input-type=module', '-e', code], input=json.dumps(request), text=True, capture_output=True, timeout=15, check=True)
                response = json.loads(result.stdout)
                self.respond(response['status'], json.loads(response['body']) if response['body'] else {})
            except Exception:
                self.respond(502, {'error': 'local proxy failed'})

        def do_POST(self):
            if self.path in ('/__test/state', '/__test/revoke', '/__test/addphotos'):
                if not hmac.compare_digest(self.headers.get('x-test-control', ''), control):
                    self.respond(403, {'error': 'denied'})
                    return
                if self.path == '/__test/addphotos':
                    data = json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))))
                    project = data.get('id','')
                    if not re.fullmatch(r'[a-f0-9-]{36}', project):
                        self.respond(400, {'error':'invalid id'})
                        return
                    sql("insert into public.fotos(projeto_id,storage_path,nome_original,bucket) select p.id,'projetos/'||p.id||'/fotos/ensaio-'||n||'.jpg','ensaio-'||n||'.jpg','r2' from public.projetos p cross join generate_series(1,6) n where p.id='"+project+"' and p.nome like 'Ensaio de teste%';")
                    self.respond(200, {'fixture':True})
                elif self.path == '/__test/revoke':
                    sql("select set_config('request.jwt.claims','{\"sub\":\"f1000000-0000-4000-8000-000000000001\",\"role\":\"authenticated\"}',false); set role authenticated; select public.gerir_portal('" + PROJETO + "',null,null,true); reset role;")
                    self.respond(200, {'revoked': True})
                else:
                    state = sql("select json_build_object('snapshots',count(*),'revisao',coalesce(max(revisao),0),'notificacoes',(select count(*) from public.selecao_notificacoes n join public.selecoes_entregues s on s.id=n.selecao_id where s.projeto_id='"+PROJETO+"')) from public.selecoes_entregues where projeto_id='"+PROJETO+"';")
                    self.respond(200, json.loads(state))
                return
            self.forward('POST')

    server = None
    try:
        sql((ROOT / 'supabase/tests/api/portal-browser.fixture.sql').read_text())
        subprocess.run(['docker', 'run', '-d', '--pull=never', '--name', name, '--network', 'container:' + db_name,
            '--entrypoint', 'node', CLIENT_IMAGE, '-e', 'setInterval(()=>{},1000)'], check=True, capture_output=True)
        subprocess.run(['docker', 'run', '-d', '--pull=never', '--name', auth_name, '--network', 'container:' + db_name,
            '-e', 'GOTRUE_DB_DRIVER=postgres', '-e', 'GOTRUE_DB_DATABASE_URL=postgres://postgres:local-disposable-only@127.0.0.1:5432/postgres?search_path=auth',
            '-e', 'GOTRUE_SITE_URL=http://127.0.0.1:3314', '-e', 'API_EXTERNAL_URL=http://127.0.0.1:3313/auth/v1',
            '-e', 'GOTRUE_API_HOST=127.0.0.1', '-e', 'PORT=9999', '-e', 'GOTRUE_JWT_SECRET='+secret,
            '-e', 'GOTRUE_JWT_AUD=authenticated', '-e', 'GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated',
            '-e', 'GOTRUE_EXTERNAL_EMAIL_ENABLED=true', '-e', 'GOTRUE_MAILER_AUTOCONFIRM=true',
            'public.ecr.aws/supabase/gotrue:v2.197.0'], check=True, capture_output=True)
        server = ThreadingHTTPServer(('127.0.0.1', 3313), Proxy)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        env = os.environ.copy()
        env['SEUALBUM_PORTAL_TEST_ANON'] = anon
        env['SEUALBUM_PORTAL_CONTROL'] = control
        # Config Next define apenas loopback e credenciais vazias; não carrega .env real.
        process = subprocess.Popen(['node', 'node_modules/@playwright/test/cli.js', 'test', '-c', 'playwright.portal.config.ts'], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True)
        try:
            stdout, stderr = process.communicate(timeout=300)
        finally:
            # Um timeout não pode deixar Next/Playwright ouvindo em loopback.
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        text = (stdout + stderr).replace(str(ROOT), '<checkout>').replace(str(Path.home()), '<userhome>').replace(anon, '<synthetic-anon>').replace(control, '<test-control>')
        (output / 'portal-browser.log').write_text(text)
        if process.returncode:
            raise RuntimeError('Navegador portal falhou; consulte portal-browser.log')
        print('Portal navegador positivo aprovado: código, cookie, favorito/recarga, snapshot e revogação reais.', flush=True)
    finally:
        if server:
            server.shutdown()
            server.server_close()
        for container in (name, auth_name):
            subprocess.run(['docker', 'rm', '-f', container], capture_output=True)
