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
import select

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
            self.end_headers()
            self.wfile.write(content)

        def do_POST(self):
            if self.path in ('/__test/state', '/__test/revoke', '/__test/proof'):
                if not hmac.compare_digest(self.headers.get('x-test-control', ''), control):
                    self.respond(403, {'error': 'denied'})
                    return
                if self.path == '/__test/proof':
                    state = sql("select json_build_object('status',p.status,'aprovacoes',(select count(*) from public.portal_prova_aprovacoes where projeto_id=p.id),'valor',(select sum(valor_total) from public.faturas where projeto_id=p.id),'origem_guest',(select bool_and(usuario_id is null) from public.aprovacoes where projeto_id=p.id)) from public.projetos p where p.id='"+PROJETO+"';")
                    self.respond(200, json.loads(state))
                elif self.path == '/__test/revoke':
                    sql("select set_config('request.jwt.claims','{\"sub\":\"f1000000-0000-4000-8000-000000000001\",\"role\":\"authenticated\"}',false); set role authenticated; select public.gerir_portal('" + PROJETO + "',null,null,true); reset role;")
                    self.respond(200, {'revoked': True})
                else:
                    state = sql("select json_build_object('snapshots',count(*),'revisao',coalesce(max(revisao),0),'notificacoes',(select count(*) from public.selecao_notificacoes n join public.selecoes_entregues s on s.id=n.selecao_id where s.projeto_id='"+PROJETO+"')) from public.selecoes_entregues where projeto_id='"+PROJETO+"';")
                    self.respond(200, json.loads(state))
                return
            if not re.fullmatch(r'/rest/v1/rpc/(abrir_portal|portal_projeto|portal_favorito|portal_entregar|portal_foto|portal_prova|portal_lamina|portal_comentar_prova|portal_aprovar_prova)', self.path):
                self.respond(404, {'error': 'unsupported'})
                return
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if size < 1 or size > 16384:
                    self.respond(413, {'error': 'size'})
                    return
                body = self.rfile.read(size).decode()
                headers = {k: self.headers[k] for k in ('Authorization', 'apikey', 'Content-Type') if k in self.headers}
                request = {'url': 'http://127.0.0.1:3000' + self.path.removeprefix('/rest/v1'), 'headers': headers, 'body': body}
                with bridge_lock:
                    bridge.stdin.write(json.dumps(request) + '\n')
                    bridge.stdin.flush()
                    if not select.select([bridge.stdout], [], [], 15)[0]:
                        bridge.terminate()  # Não reutilizar uma resposta atrasada em outra RPC.
                        raise TimeoutError('Ponte local não respondeu em 15s')
                    response = json.loads(bridge.stdout.readline())
                print('RPC:', self.path.rsplit('/',1)[-1], response['status'], flush=True)
                self.respond(response['status'], json.loads(response['body']))
            except Exception:
                self.respond(502, {'error': 'local proxy failed'})

    server = None
    bridge = None
    bridge_lock = threading.Lock()
    try:
        sql((ROOT / 'supabase/tests/api/portal-browser.fixture.sql').read_text())
        subprocess.run(['docker', 'run', '-d', '--pull=never', '--name', name, '--network', 'container:' + db_name,
            '--entrypoint', 'node', CLIENT_IMAGE, '-e', 'setInterval(()=>{},1000)'], check=True, capture_output=True)
        bridge_code = "import {createInterface} from 'node:readline';for await(const line of createInterface({input:process.stdin})){try{const p=JSON.parse(line);const r=await fetch(p.url,{method:'POST',headers:p.headers,body:p.body,signal:AbortSignal.timeout(10000)});process.stdout.write(JSON.stringify({status:r.status,body:await r.text()})+'\\n')}catch{process.stdout.write(JSON.stringify({status:502,body:'{}'})+'\\n')}}"
        bridge = subprocess.Popen(['docker','exec','-i',name,'node','--input-type=module','-e',bridge_code],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1)
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
        print('Portal navegador positivo aprovado: código, cookie, favorito/recarga, seleção, aprovação com fechamento de extras e revogação reais.', flush=True)
    finally:
        if bridge:
            bridge.terminate()
            try: bridge.wait(timeout=3)
            except subprocess.TimeoutExpired: bridge.kill()
        if server:
            server.shutdown()
            server.server_close()
        subprocess.run(['docker', 'rm', '-f', name], capture_output=True)
