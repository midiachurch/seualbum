# SeuÁlbum

Plataforma B2B de diagramação e design de álbuns para fotógrafos.
Next.js (App Router) + Supabase + Tailwind/Radix, deploy na Vercel.

## Rodando localmente

```bash
npm install
cp .env.local.example .env.local   # preencha com as chaves do seu projeto Supabase
npm run dev
```

A landing funciona sem Supabase configurado: o catálogo cai no fallback estático
de `src/lib/pricing.ts`. As áreas `/dashboard` e `/admin` exigem o banco.

## Banco de dados

As migrations em `supabase/migrations/` usam as mesmas versões (timestamp) do
projeto remoto **SeuAlbum** (`ytqbyfmroyilinxdhopv`). Confira antes de
qualquer push:

```bash
supabase link --project-ref ytqbyfmroyilinxdhopv
supabase migration list   # local e remoto devem bater, linha a linha
```

`supabase/legado/0001_init.sql` é o schema simplificado original, substituído
pela 0002 e nunca aplicado no projeto atual — fica só como referência.

O segredo do webhook de status não é versionado: grave-o em
`private.app_config` (chave `webhook_secret`, mesmo valor de `WEBHOOK_SECRET`)
— ver a migration 0006.

Depois crie sua conta em `/auth/register` e promova-a a admin:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'voce@seudominio.com.br');
```

### Configuração do Auth

Em **Authentication > URL Configuration** adicione como redirect URL:

- `http://localhost:3000/auth/callback`
- `https://SEU-DOMINIO/auth/callback`

## Variáveis de ambiente

Local: `.env.local` (modelo em `.env.local.example`). Na Vercel: **Project
Settings > Environment Variables**, em Production (e Preview, se usar).

| Variável                        | Deploy      | Para que serve                                                                 |
| ------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | obrigatória | `https://ytqbyfmroyilinxdhopv.supabase.co`                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | obrigatória | Chave pública do Supabase (Project Settings > API)                             |
| `SUPABASE_SERVICE_ROLE_KEY`     | obrigatória | Só no servidor, ignora RLS (webhooks). Nunca com prefixo `NEXT_PUBLIC_`        |
| `NEXT_PUBLIC_SITE_URL`          | obrigatória | URL canônica de produção (`https://SEU-DOMINIO`), usada nos redirects do Auth  |
| `STRIPE_SECRET_KEY`             | obrigatória | Chave secreta do Stripe (`sk_live_...` em produção)                            |
| `STRIPE_WEBHOOK_SECRET`         | obrigatória | `whsec_...` do endpoint `https://SEU-DOMINIO/api/webhooks/pagamento`           |
| `WEBHOOK_SECRET`                | obrigatória | Segredo de `/api/webhooks/status`; mesmo valor de `private.app_config.webhook_secret` |
| `R2_ACCOUNT_ID`                 | obrigatória | ID da conta Cloudflare (endpoint `https://<id>.r2.cloudflarestorage.com`)      |
| `R2_ACCESS_KEY_ID`              | obrigatória | Token de API do R2 (R2 > Manage API Tokens), permissão Object Read & Write     |
| `R2_SECRET_ACCESS_KEY`          | obrigatória | Segredo do mesmo token                                                         |
| `R2_BUCKET`                     | obrigatória | Nome do bucket privado das fotos (ex.: `seualbum-fotos`)                       |
| `R2_PUBLIC_BUCKET`              | obrigatória | Bucket **público** do R2 para vitrine e logos (ex.: `seualbum-publico`)        |
| `R2_PUBLIC_URL`                 | obrigatória | Domínio público desse bucket, sem barra no final (ex.: `https://midia.seualbum.com.br`); lido também no build (`next/image`) |
| `CRON_SECRET`                   | obrigatória | Segredo do Cron da Vercel (`/api/cron/limpar-fotos-r2`); a Vercel o envia sozinha |
| `DEV_LOGIN_*`                   | não usar    | Atalhos de login de teste; só funcionam em `next dev`                          |

## Cloudflare R2 (fotos)

O Supabase fica só com banco e Auth; as fotos de alta resolução dos pedidos
ficam num bucket **privado** do R2 e o banco guarda só a chave de cada uma
(`pedidos_fotos_r2`, migrations 0030/0031). O helper fica em `src/lib/r2/`.

Upload do wizard de novo pedido (`src/lib/upload-pedido-foto.ts`):

1. `POST /api/uploads/pedido-foto` `{ chave, idArquivo, nome, tipo, tamanho }`
   → `{ key, url, headers }` (URL assinada de PUT, 15 min, tipo e tamanho travados)
2. o navegador faz `PUT` direto no R2 (o arquivo não passa pela Vercel)
3. `POST /api/uploads/pedido-foto/confirmar` `{ key, nome, capturadaEm, camera }`
   → confere no R2 (HeadObject) e grava a chave e o EXIF no índice

`DELETE /api/uploads/pedido-foto` `{ key }` tira a foto do rascunho.

Depois do upload, tudo lê o índice: a contagem no envio do pedido, a lista,
"Ver em alta" e download em `/admin/pedidos/[id]` (links assinados de 1h), e
a conversão pedido → projeto, que cria `fotos` com `bucket = 'r2'`. Fotos com
`bucket = 'r2'` são assinadas pelo R2 em todo lugar (projeto, editor, prova).

Limpeza: o Cron da Vercel (`vercel.json`, diário às 06:17 UTC) chama
`/api/cron/limpar-fotos-r2`, que apaga do R2 e do índice os rascunhos parados
há mais de 72h que nunca viraram pedido. O bucket `pedidos_fotos` do Supabase
não é mais lido nem escrito; o que sobrou nele pode ser apagado à mão.

No painel da Cloudflare, o bucket precisa de uma regra de **CORS** que libere
`PUT` e `GET` para a origem do site (`https://SEU-DOMINIO` e
`http://localhost:3000`), com o header `Content-Type` permitido — o editor
desenha as fotos num canvas e precisa do `GET` com CORS.

### Configurar o R2

`scripts/configurar-r2.sh` faz a parte da Cloudflare com o wrangler 4. Ele
cria os buckets `seualbum-fotos` (privado) e `seualbum-publico`, aplica o CORS
de `scripts/r2-cors.json` nos dois e liga a URL pública `r2.dev` do bucket
público. Pode rodar de novo sem problema.

```bash
npx wrangler@4 login
bash scripts/configurar-r2.sh
```

No fim ele imprime o que falta: criar o token S3 no painel (R2 > Manage API
Tokens, Object Read & Write nos dois buckets; o wrangler não cria esse token),
os valores das variáveis `R2_*` para a Vercel e um novo deploy. O
`R2_PUBLIC_URL` é a URL `https://pub-….r2.dev` impressa pelo script. Quando o
domínio próprio for aprovado, use os comandos comentados no script para ligá-lo
e troque o `R2_PUBLIC_URL`. A `r2.dev` tem limite de requisições e não é
recomendada para produção.

### Demais arquivos no R2 (migration 0034)

Todos os uploads novos seguem os mesmos 3 passos (assinar → `PUT` direto →
confirmar com HeadObject). O banco guarda só a chave e uma marca `r2`. Os
arquivos que já estavam no Supabase Storage continuam sendo lidos e apagados
de lá (**leitura dupla**). Nenhum bucket do Supabase foi apagado.

| O quê | Bucket antigo | Chave no R2 | Rota | Marca no banco |
| --- | --- | --- | --- | --- |
| Fotos do projeto (cliente, novo projeto, editor) | `projetos_fotos` | `projetos/{projeto}/fotos/{id}-{nome}` | `/api/uploads/projeto-foto` (+ `/confirmar`, cria a linha em `fotos`) | `fotos.bucket = 'r2'` |
| Editor de álbum: fotos do avulso, versões leves, lâminas do link de aprovação | `albuns_fotos` | `albuns/{album}/{id}-{nome}`, `albuns/{album}/derivados/{foto}-mini.jpg`, `albuns/{album}/aprovacoes/{aprovacao}/001.jpg` | `/api/uploads/album` (`destino`: `foto`, `derivado`, `aprovacao`) | prefixo `albuns/` no caminho do JSON |
| Biblioteca de mídia (banners, portfólio) | `midia_vitrine` (público) | `vitrine/{id}-{nome}` no bucket **público** | `/api/uploads/midia` (+ `/confirmar`, cria a linha em `media_assets`) | `media_assets.bucket = 'r2'` |
| Logo do estúdio | `fotografo_logos` (público) | `logos/{fotografo}/{id}-{nome}` no bucket **público** | `/api/uploads/logo` (+ `/confirmar`) | `fotografos.logo_bucket = 'r2'` + `logo_path` |

- **Álbuns:** os caminhos ficam em JSON (`album_layouts.fotos`/`derivados`,
  `album_aprovacoes.laminas`), então a marca é o prefixo `albuns/`. Caminho
  antigo começa pelo UUID do álbum e é lido de `albuns_fotos`. As Server Actions
  `registrarFotosAlbum`, `salvarDerivados` e `criarAprovacao` conferem cada
  chave no R2 antes de gravar. "Duplicar álbum" copia tudo para o R2: copia
  dentro do R2 ou baixa do bucket antigo e reenvia. O link público
  `/album/[token]` assina as lâminas do R2 pelo servidor, depois de a função
  do banco validar o token.
- **Vitrine e logos (públicos):** ficam num **segundo bucket**, com acesso
  público pelo domínio próprio (`R2_PUBLIC_BUCKET`/`R2_PUBLIC_URL`). Fizemos
  assim porque essas imagens aparecem em páginas abertas e cacheadas (home,
  portfólio, orçamento) e são gravadas no banco como endereço. Um link
  assinado expira (no máximo 7 dias no S3/R2), quebraria a página em cache e
  não aproveitaria o CDN. O acesso público do R2 vale para o bucket inteiro,
  e não para um prefixo. Por isso as fotos de clientes nunca dividem bucket
  com estes arquivos. `media_assets.url` e `fotografos.logo_url` guardam o
  endereço público só por compatibilidade: a biblioteca monta o endereço pela
  chave, e a tela pública do orçamento continua lendo `logo_url` (RPC
  `get_orcamento_publico`). SVG não é aceito (pode carregar script).
- **Configuração:** crie o bucket público e ligue um Custom Domain. Dê ao
  token Object Read & Write nos dois buckets. O bucket público precisa da
  mesma regra de CORS (`PUT` com `Content-Type`).
- **Antes do deploy:** aplique a 0034. Sem ela, só os uploads da vitrine e do
  logo falham (409). As leituras não dependem dela.
- **Copiar o que já existe (opcional):**
  `node --env-file=.env.local scripts/copiar-storage-para-r2.mjs` lista o que
  seria copiado. Com `--aplicar`, copia, confere no R2 e aponta as linhas para
  a chave nova. Ele nunca apaga nada do Supabase. As lâminas antigas de
  `versoes_laminas` ficam no `projetos_fotos`.

## Prova do álbum (revisão e aprovação)

A prova vive no projeto de produção (o pedido vira projeto quando é pago) e é
a mesma para o cliente final (`/cliente/projetos/[id]/prova`), o fotógrafo
(`/dashboard/albuns/[id]/prova`) e a equipe (`/admin/projetos/[id]/prova`).

- **Galeria:** a prova abre com todas as lâminas; numa versão parcial, as que
  mudaram têm o selo "Alterada" e o filtro "Só alteradas".
- **Orientações:** o painel lateral lista todas as orientações da versão,
  numeradas. Aberta a lâmina, tocar marca um ponto e arrastar (mouse/caneta)
  marca uma área — o comentário guarda a posição em % (migration 0032).
- **Decisão:** "Aprovar álbum" (RPC `aprovar_prova`, com upsell) ou
  "Solicitar ajustes" (vira `alteracoes_solicitadas` e entra no histórico e
  no outbox de comunicação).
- **Versão parcial:** em `/admin/projetos/[id]`, "Nova versão (lâminas)" deixa
  o designer substituir, remover ou acrescentar só as lâminas que mudaram; as
  outras são herdadas da versão anterior sem reenvio.
- **Lâminas no R2:** upload manual e "Publicar versão" do editor sobem cada
  lâmina por `POST /api/uploads/lamina` (URL assinada, JPG até 50 MB);
  `criarVersaoComLaminas` confere cada chave no R2 antes de criar a versão.

## Controle da diagramação (migration 0038)

O dashboard (`/admin`) tem a seção **Diagramação** e o menu ganhou
**Diagramação** (`/admin/diagramacao`), o centro de controle de todos os álbuns
em diagramação: projetos da esteira (de "fotos recebidas" a "aprovado") e
álbuns avulsos do editor.

- **Dashboard:** KPIs (em diagramação, com o cliente, ajustes pedidos,
  aprovados nos últimos 30 dias, atrasados), carga por diagramador (atribuídos,
  em andamento, atrasados, entrega média em 90 dias) e os mais urgentes com
  "Abrir editor" / "Ver prova". Tudo vem de uma RPC, `diagramacao_resumo`,
  agregada no banco sobre a view `diagramacao_itens` (security_invoker: só a
  equipe vê linhas).
- **Centro de controle:** tabela ou quadro por etapa, com filtros (etapa,
  responsável, estúdio, prioridade, tipo, só atrasados, ocultar em espera) e,
  por linha, responsável, estúdio/cliente, prazo, prioridade, versão da prova,
  apontamentos abertos e última atividade. Ações: atribuir (também em massa),
  mudar prazo, prioridade (também em massa), pôr em espera/retomar, abrir o
  editor, ver a prova e, no avulso, copiar o link de aprovação ou abrir o
  editor no painel de compartilhar para publicá-lo.
- **Quem faz o quê:** admin/gestor atribuem, priorizam e pausam; o operador só
  consulta e abre editor/prova; o designer continua na própria fila
  (`/admin/design`). A trigger `guardar_controle_diagramacao` repete a trava no
  banco (prioridade e espera em `projetos`; responsável, prazo, prioridade e
  espera em `album_layouts`).
- **Prazo e atraso:** no projeto, o prazo é o SLA interno
  (`data_limite_producao`); "atrasado" = prazo vencido numa etapa da equipe e
  fora de espera. Prova parada com o cliente além de `data_limite_aprovacao`
  aparece à parte ("cliente atrasado").
- **Templates de lâmina** (`/admin/diagramacao/templates`, admin/gestor):
  renomear e desativar. Desativado some do editor sem ser apagado.
- **Sem a 0038:** o dashboard e o centro de controle mostram um aviso pedindo a
  migration; o resto do admin funciona.
- **Testes:** `src/lib/diagramacao/regras.test.ts`,
  `src/lib/actions/diagramacao.test.ts` e o pgTAP
  `supabase/tests/controle_diagramacao.test.sql`.

## Pagamento das faturas de fechamento (migration 0035)

Quando a prova é aprovada com lâminas extras e/ou adicionais, o banco emite a
fatura de fechamento (0023/0026) e o álbum fica em "aprovado — aguardando
pagamento". Quem paga é o estúdio, em **Meus álbuns > Fechamento pendente**:

- **Modo simulado ligado** (`private.app_config.pagamento_simulado = 'true'`,
  padrão da 0023): o botão abre o modal simulado de sempre
  (`pagar_fatura_simulada`).
- **Modo simulado desligado** (`'false'`): "Pagar" abre o Stripe Checkout
  (`iniciarPagamentoFaturaAction`), no mesmo estilo dos pedidos: mesma conta,
  BRL, Pix e cartão conforme o painel do Stripe, volta para
  `/dashboard/meus-albuns?fechamento=sucesso|cancelado` na mesma origem do
  checkout dos pedidos.

Fluxo do checkout real:

1. `preparar_checkout_fatura` (RPC): o banco confere o estúdio dono, a fatura
   `pendente` e nenhum adicional do casal aguardando decisão, e devolve o valor.
   O valor nunca vem do navegador.
2. A Checkout Session leva `metadata.fatura_id` (nunca `pedido_id`); o id dela
   fica em `faturas.stripe_checkout_session_id` (`registrar_checkout_fatura`)
   para reaproveitar a sessão aberta em vez de abrir outra.
3. `/api/webhooks/pagamento` separa as sessões pelo metadata: com `fatura_id`,
   confere o valor pago contra a fatura e chama `confirmar_pagamento_fatura`
   com a service role (idempotente). Cartão confirma em
   `checkout.session.completed`; Pix em `checkout.session.async_payment_succeeded`.
   A volta do Checkout também confirma (quem chegar primeiro).
4. Fatura já paga = `ja_processado`. Fatura encerrada antes do pagamento
   (cortesia/cancelada) ou valor divergente = registrado no log e respondido 2xx
   (não adianta o Stripe reenviar): conferir e estornar à mão no Stripe.

Para ligar: aplicar a 0035 e depois
`update private.app_config set value = 'false' where key = 'pagamento_simulado';`.

## Scripts

| Comando             | O que faz                          |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento        |
| `npm run build`     | Build de produção                  |
| `npm run typecheck` | `tsc --noEmit`                     |
| `npm test`          | Testes (Vitest)                    |
| `npm run test:e2e`  | Testes no navegador (Playwright), só com o Supabase local |

## Testes E2E no navegador (Playwright)

`e2e/` clica no app de verdade (Chromium) contra o **Supabase local**. Nunca
aponte para o projeto remoto: `e2e/support/ambiente.ts` recusa qualquer URL
que não seja `127.0.0.1`/`localhost`, e o `.env.local` não é usado.

```bash
supabase init                 # só se não houver supabase/config.toml (não versionado)
supabase start                # Docker; aplica as migrations
supabase db reset --local     # opcional: banco limpo
npx playwright install chromium   # uma vez
npm run test:e2e
supabase stop
```

- O `playwright.config.ts` sobe o `next dev` na porta 3210 (`E2E_PORT`) com
  `NEXT_PUBLIC_SUPABASE_URL`/chaves do banco local e Stripe, R2 e webhooks
  vazios. Não reaproveita servidor já aberto.
- As chaves padrão são as de demonstração do `supabase start`. Se a API local
  não estiver na 54321 (outro projeto ocupando as portas), passe
  `E2E_SUPABASE_URL=http://127.0.0.1:<porta>`; chaves diferentes vão em
  `E2E_SUPABASE_ANON_KEY`/`E2E_SUPABASE_SERVICE_KEY`.
- O `global-setup` liga `private.app_config.pagamento_simulado = 'true'` via
  `docker exec` no contêiner `supabase_db_<project_id>` (lido do
  `supabase/config.toml`; outro nome em `E2E_DB_CONTAINER`).
- Cada teste cria os próprios usuários (admin, estúdio, casal) e projetos pela
  service role local e apaga tudo no fim (`e2e/support/seed.ts`). As lâminas
  apontam para um PNG no Storage local, não para o R2.
- Specs: `login.spec.ts` (cada papel cai na sua área) e `adicionais.spec.ts`
  (casal desiste do adicional; casal pede, estúdio aceita e paga no Pix
  simulado e a gráfica recebe; estúdio recusa e o álbum é liberado sem
  cobrança).
- O Vitest ignora `e2e/`. Falhas deixam trace e screenshot em `test-results/`
  (`npx playwright show-trace <arquivo>`).

O GitHub Actions (`.github/workflows/ci.yml`) roda `tsc --noEmit` e o Vitest
em todo pull request e push no `main`, com Node 24 (o mesmo da Vercel) e sem
segredos.

### Verificar produção

Depois de cada deploy:

```bash
node scripts/verificar-producao.mjs                      # padrão: https://seualbum.vercel.app
node scripts/verificar-producao.mjs https://SEU-DOMINIO --vercel
```

Só faz requisições sem login e sem efeito colateral (GETs e chamadas com
segredo ausente ou assinatura falsa) e imprime uma tabela PASS/FAIL: home e
login abrem; o cron e o webhook de status recusam chamada sem segredo; o
webhook do Stripe responde 400 a assinatura falsa (503 = falta
`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`); `/auth/callback` sem `code`
redireciona para o login; os uploads sem sessão dão 401 (503 = R2 não
configurado; 404 = o deploy ainda não tem a rota). Sai com código 1 se algo
falhar. `--vercel` roda `npx vercel@50 env ls production` (exige `vercel login`
e `vercel link`) e lista só os **nomes** das variáveis obrigatórias da tabela
acima que faltam em Production.

## Estado atual

Implementado: landing e vitrine, autenticação com 6 papéis (admin, gestor,
operador, designer, fotógrafo, cliente), painel do estúdio (`/dashboard`:
pedidos, prova, catálogo, orçamentos), área do cliente final (`/cliente`),
esteira do admin (design, produção, gráfica, CRM de retenção), pagamento via
Stripe Checkout e upsell de adicionais na aprovação da prova (0026).

Smart Album (editor de diagramação, migration 0027): `/admin/albuns` lista os
álbuns avulsos e os de projeto; o editor (`/admin/albuns/[id]` e
`/admin/projetos/[id]/editor`) tem canvas de lâmina aberta com sangria, dobra
e área segura, fotos/textos/formas, Smart Layout, modelos de álbum,
preenchimento automático, verificação de impressão, histórico de versões e
visualização em livro. Projeto: "Publicar versão" gera JPGs de 300 DPI e entra
na prova da esteira. Avulso: link de aprovação sem login (`/album/[token]`) e
exportação em ZIP. A lógica fica em `src/lib/album/`.

Fluxo de adicionais testado ponta a ponta no Supabase local (`supabase init` gera o
`supabase/config.toml`, que não é versionado; depois `supabase start`):
`supabase test db` roda os testes pgTAP de `supabase/tests/`, e
`SUPABASE_E2E_URL=http://127.0.0.1:54321 npx vitest run src/lib/actions/adicionais.e2e.test.ts`
roda as Server Actions contra o mesmo banco (sem a variável, o arquivo é pulado).
As faturas de fechamento são pagas pelo Stripe Checkout quando o modo simulado
está desligado (ver "Pagamento das faturas de fechamento"); o pgTAP
`supabase/tests/checkout_fatura.test.sql` cobre as travas da 0035.

Pendente: aplicar as migrations 0035, 0036 e 0038 no Supabase (0033 e 0034 já aplicadas); criar o bucket público do R2
(`R2_PUBLIC_BUCKET`/`R2_PUBLIC_URL`). Opcional: copiar os arquivos antigos com
`scripts/copiar-storage-para-r2.mjs`. Também: desligar `pagamento_simulado` quando o Stripe
estiver pronto e deploy na Vercel
(variáveis de ambiente acima, URLs de produção do Auth, do webhook do Stripe e
de `private.app_config.webhook_status_url`).
