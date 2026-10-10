#!/usr/bin/env bash
#
# Configura o Cloudflare R2 do seualbum com o wrangler (v4):
#   1. cria o bucket PRIVADO (fotos dos clientes) e o PÚBLICO (vitrine e logos);
#   2. aplica o CORS de scripts/r2-cors.json nos dois;
#   3. liga a URL pública r2.dev do bucket público (vira o R2_PUBLIC_URL);
#   4. imprime o que falta fazer no painel e na Vercel.
#
# Antes, uma vez:   npx wrangler@4 login
# Depois:           bash scripts/configurar-r2.sh
#
# Pode rodar de novo quantas vezes quiser: bucket que já existe é pulado, o
# CORS é sobrescrito com o mesmo conteúdo e a r2.dev só é ligada se estiver
# desligada. Nomes diferentes: R2_BUCKET=... R2_PUBLIC_BUCKET=... bash scripts/configurar-r2.sh
# Mais de uma conta na Cloudflare: CLOUDFLARE_ACCOUNT_ID=... bash scripts/configurar-r2.sh

set -euo pipefail

BUCKET_PRIVADO="${R2_BUCKET:-seualbum-fotos}"
BUCKET_PUBLICO="${R2_PUBLIC_BUCKET:-seualbum-publico}"
DIR_SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARQUIVO_CORS="$DIR_SCRIPTS/r2-cors.json"

wrangler() { npx --yes wrangler@4 "$@"; }
# Tira as cores ANSI da saída do wrangler, para dar grep com segurança.
sem_cor() { sed $'s/\x1b\\[[0-9;]*m//g'; }
titulo() { printf '\n== %s\n' "$1"; }

[[ -f "$ARQUIVO_CORS" ]] || { echo "Não achei $ARQUIVO_CORS" >&2; exit 1; }

# --- 0. Login e conta -------------------------------------------------------
titulo "Conferindo o login no wrangler"
if ! WHOAMI="$(wrangler whoami --json 2>/dev/null)"; then
  echo "Você não está logado. Rode antes:  npx wrangler@4 login" >&2
  exit 1
fi

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  # Uma conta só: usa ela. Várias: o wrangler perguntaria a cada comando.
  # shellcheck disable=SC2016 # o ${...} é template string do JavaScript
  CONTAS="$(printf '%s' "$WHOAMI" | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      for (const c of JSON.parse(s).accounts ?? []) console.log(`${c.id}\t${c.name}`)
    })')"
  if [[ "$(printf '%s\n' "$CONTAS" | grep -c .)" -ne 1 ]]; then
    echo "Seu login tem acesso a mais de uma conta (ou a nenhuma). Escolha o ID e rode de novo com" >&2
    echo "  CLOUDFLARE_ACCOUNT_ID=<id> bash scripts/configurar-r2.sh" >&2
    printf '%s\n' "$CONTAS" >&2
    exit 1
  fi
  CLOUDFLARE_ACCOUNT_ID="$(printf '%s' "$CONTAS" | cut -f1)"
fi
export CLOUDFLARE_ACCOUNT_ID
echo "Conta: $CLOUDFLARE_ACCOUNT_ID"

# --- 1. Buckets -------------------------------------------------------------
titulo "Buckets"
# `r2 bucket list` imprime blocos "name: <bucket>". Falha de rede/permissão
# derruba o script (set -e) em vez de ser confundida com "não existe".
LISTA="$(wrangler r2 bucket list | sem_cor)"

bucket_existe() { printf '%s\n' "$LISTA" | grep -Eq "^name:[[:space:]]+$1[[:space:]]*\$"; }

for b in "$BUCKET_PRIVADO" "$BUCKET_PUBLICO"; do
  if bucket_existe "$b"; then
    echo "• $b já existe, pulando."
  else
    wrangler r2 bucket create "$b"
  fi
done

# --- 2. CORS ----------------------------------------------------------------
titulo "CORS (scripts/r2-cors.json)"
for b in "$BUCKET_PRIVADO" "$BUCKET_PUBLICO"; do
  wrangler r2 bucket cors set "$b" --file "$ARQUIVO_CORS" --force
done

# --- 3. Acesso público do bucket público ------------------------------------
titulo "Acesso público de $BUCKET_PUBLICO (r2.dev)"
extrair_url() { sem_cor | grep -Eo 'https://[A-Za-z0-9.-]+\.r2\.dev' | head -n1 || true; }

URL_PUBLICA="$(wrangler r2 bucket dev-url get "$BUCKET_PUBLICO" | extrair_url)"
if [[ -n "$URL_PUBLICA" ]]; then
  echo "• r2.dev já estava ligada."
else
  URL_PUBLICA="$(wrangler r2 bucket dev-url enable "$BUCKET_PUBLICO" --force | extrair_url)"
fi
if [[ -z "$URL_PUBLICA" ]]; then
  echo "Não consegui ler a URL r2.dev. Veja com: npx wrangler@4 r2 bucket dev-url get $BUCKET_PUBLICO" >&2
  exit 1
fi
echo "URL pública: $URL_PUBLICA"

# Quando o domínio próprio for aprovado (a zona precisa estar na MESMA conta
# da Cloudflare; o zone ID fica na página Overview do domínio), troque a r2.dev
# por ele e atualize R2_PUBLIC_URL na Vercel (exige novo deploy):
#   npx wrangler@4 r2 bucket domain add seualbum-publico --domain midia.seualbum.com.br --zone-id <ZONE_ID> --force
#   npx wrangler@4 r2 bucket dev-url disable seualbum-publico --force
# Inclua também o domínio do site em scripts/r2-cors.json e rode este script de novo.

# --- 4. Próximos passos -----------------------------------------------------
cat <<EOF

==============================================================================
 Buckets prontos. Falta o token da API S3 (o wrangler não cria esse token):
==============================================================================

1) Painel da Cloudflare > R2 > Manage API Tokens > Create API Token
   (https://dash.cloudflare.com/$CLOUDFLARE_ACCOUNT_ID/r2/api-tokens)
   - Permissions: Object Read & Write
   - Specify bucket(s): Apply to specific buckets only
       $BUCKET_PRIVADO
       $BUCKET_PUBLICO
   - TTL: Forever (ou o prazo que preferir)
   Copie o "Access Key ID" e o "Secret Access Key": o segredo só aparece uma vez.

2) Na Vercel (projeto seualbum > Settings > Environment Variables, ambiente
   Production), cadastre as variáveis abaixo. Em Preview o upload falha: o CORS
   só libera seualbum.vercel.app e localhost:3000.

   R2_ACCOUNT_ID=$CLOUDFLARE_ACCOUNT_ID
   R2_ACCESS_KEY_ID=<Access Key ID do passo 1>
   R2_SECRET_ACCESS_KEY=<Secret Access Key do passo 1>
   R2_BUCKET=$BUCKET_PRIVADO
   R2_PUBLIC_BUCKET=$BUCKET_PUBLICO
   R2_PUBLIC_URL=$URL_PUBLICA

   Pela linha de comando (pede o valor; repita para cada variável):
     npx vercel env add R2_ACCOUNT_ID production

   Coloque as mesmas linhas no .env.local para o next dev.

3) Faça um novo deploy (Deployments > ... > Redeploy, ou npx vercel --prod).
   R2_PUBLIC_URL é lida no build (next.config.mjs, next/image): sem deploy
   novo as imagens da vitrine não carregam.

Obs.: a URL r2.dev tem limite de requisições e a Cloudflare não a recomenda
para produção. Troque pelo domínio próprio assim que ele for aprovado
(comandos comentados neste script).
EOF
