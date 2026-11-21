#!/usr/bin/env python3
"""SQL/pgTAP sintético, sem rede/portas. Não lê .env nem conecta a banco remoto.
Requer Docker e as três imagens oficiais já disponíveis. Sem pull/instalação.
Exclui somente inicialização de segredo Vault/cron da cópia em memória da 0015.
"""
import os
import importlib.util
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
DB_IMAGE = "public.ecr.aws/supabase/postgres:17.6.1.167"
STORAGE_IMAGE = "public.ecr.aws/supabase/storage-api:v1.72.1"
AUTH_IMAGE = "public.ecr.aws/supabase/gotrue:v2.197.0"
NAME = "seualbum-sql-test-" + uuid.uuid4().hex[:10]
OUTPUT = Path(os.environ.get("SEUALBUM_SQL_RESULTS", tempfile.mkdtemp(prefix="seualbum-sql-results-"))).resolve()
OUTPUT.mkdir(parents=True, exist_ok=True)


def run(args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, **kwargs)


def sql(content, user="postgres"):
    return run(["docker", "exec", "-i", NAME, "psql", "-X", "-qAt", "-U", user,
                "-d", "postgres", "-v", "ON_ERROR_STOP=1"], input=content, text=True).stdout


def main():
    if os.environ.get("SEUALBUM_PORTAL_BROWSER") == "1" and os.environ.get("SEUALBUM_API_TESTS") != "1":
        raise RuntimeError("SEUALBUM_PORTAL_BROWSER exige SEUALBUM_API_TESTS=1")
    for image in (DB_IMAGE, STORAGE_IMAGE, AUTH_IMAGE):
        run(["docker", "image", "inspect", image])
    try:
        run(["docker", "run", "-d", "--pull=never", "--name", NAME, "--network", "none",
             "--tmpfs", "/var/lib/postgresql/data:rw", "-e", "POSTGRES_PASSWORD=local-disposable-only",
             DB_IMAGE, "-c", "shared_preload_libraries=pg_net,pg_cron", "-c", "cron.database_name=postgres",
             "-c", "cron.launch_active_jobs=off"])
        for _ in range(60):
            try:
                process = run(["docker", "logs", NAME], text=True).stdout
                if "PostgreSQL init process complete" not in process:
                    time.sleep(0.5)
                    continue
                sql("select 1", "supabase_admin")
                break
            except subprocess.CalledProcessError:
                time.sleep(0.5)
        else:
            raise RuntimeError("PostgreSQL local não inicializou")
        with tempfile.TemporaryDirectory(prefix="seualbum-storage-schema-") as folder:
            archive = Path(folder) / "schema.tar"
            archive.write_bytes(run(["docker", "run", "--rm", "--pull=never", "--network", "none",
                "--entrypoint", "sh", STORAGE_IMAGE, "-c", "tar -C /app/migrations/tenant -cf - ."]).stdout)
            with tarfile.open(archive) as tar:
                tar.extractall(folder, filter="data")
            for file in sorted(Path(folder).glob("*.sql"), key=lambda f: int(f.name.split("-")[0])):
                sql("set storage.install_roles='false'; set search_path=storage,public,extensions;\n" + file.read_text(), "supabase_admin")
        sql("alter role postgres superuser;", "supabase_admin")
        run(["docker", "run", "--rm", "--pull=never", "--network", "container:" + NAME,
             "-e", "GOTRUE_DB_DRIVER=postgres", "-e", "GOTRUE_DB_DATABASE_URL=postgres://postgres:local-disposable-only@127.0.0.1:5432/postgres?search_path=auth",
             "-e", "GOTRUE_JWT_SECRET=synthetic-local-only-not-a-real-secret-20261115",
             "-e", "GOTRUE_SITE_URL=http://localhost", "-e", "API_EXTERNAL_URL=http://localhost",
             AUTH_IMAGE, "auth", "migrate"])
        files = sorted((ROOT / "supabase/migrations").glob("*.sql"))
        for file in files:
            content = file.read_text()
            if "_0015_" in file.name:
                content, count = re.subn(r"do \$\$ begin\s+if not exists \(select 1 from vault.secrets.*?end \$\$;",
                    "-- HARNESS: omitido segredo de cron; sem rede e cron desativado.\n", content, flags=re.S)
                if count != 1:
                    raise RuntimeError("Bloco Vault 0015 mudou: revisar harness")
            if "_0043_" in file.name:
                baseline = sql((ROOT / "docs/sprints/evidence/authorization-baseline.sql").read_text())
                (OUTPUT / "before-0043.tap").write_text(baseline)
                if len(re.findall(r"^not ok ", baseline, re.M)) != 6:
                    raise RuntimeError("Baseline não reproduziu exatamente as seis falhas")
                print("Antes da 0043: seis falhas reproduzidas", flush=True)
            sql(content)
        print(f"Migrations processadas: {len(files)} (0015 sem segredo Vault)", flush=True)
        (OUTPUT / "policies.json").write_text(sql("select coalesce(json_agg(p), '[]'::json) from pg_policies p where schemaname in ('public','storage');"))
        (OUTPUT / "functions.sql").write_text(sql("select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.prosecdef;"))
        failed = False
        for file in sorted((ROOT / "supabase/tests").glob("*.sql")):
            try:
                result = sql(file.read_text())
            except subprocess.CalledProcessError as error:
                (OUTPUT / (file.stem + ".tap")).write_text(error.stdout + error.stderr)
                print(file.name + ": ERRO SQL", flush=True)
                failed = True
                continue
            (OUTPUT / (file.stem + ".tap")).write_text(result)
            checks = re.findall(r"^(?:ok|not ok) \d+", result, re.M)
            plan = re.search(r"^1\.\.(\d+)$", result, re.M)
            bad = bool(re.search(r"^not ok|^Bail out!|^# Looks like", result, re.M)) or not plan or len(checks) != int(plan[1])
            failed |= bad
            print(f"{file.name}: {len(checks)} verificações, {'FALHOU' if bad else 'OK'}", flush=True)
        if os.environ.get("SEUALBUM_API_TESTS") == "1":
            spec = importlib.util.spec_from_file_location("postgrest_test", ROOT / "scripts/test-postgrest-isolado.py")
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            module.run_api(NAME, sql, OUTPUT)
        if os.environ.get("SEUALBUM_SELECTION_CONCURRENCY") == "1":
            spec = importlib.util.spec_from_file_location("selection_concurrency", ROOT / "scripts/selecao-concorrencia.py")
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            module.run_selection_concurrency(NAME, sql, OUTPUT)
        if os.environ.get("SEUALBUM_BOOKING_CONCURRENCY") == "1":
            spec = importlib.util.spec_from_file_location("booking_concurrency", ROOT / "scripts/booking-concorrencia.py")
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            module.run_booking_concurrency(NAME, sql, OUTPUT)
        print("Resultados: " + str(OUTPUT), flush=True)
        if failed:
            raise SystemExit(1)
    finally:
        subprocess.run(["docker", "rm", "-f", NAME], capture_output=True)


if __name__ == "__main__":
    main()
