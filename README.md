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

## Scripts

| Comando             | O que faz                          |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento        |
| `npm run build`     | Build de produção                  |
| `npm run typecheck` | `tsc --noEmit`                     |

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

Pendente: aplicar as migrations 0030, 0031 e 0032 no Supabase; levar para o R2 os
demais buckets (projetos, álbuns, vitrine, logos). Também: teste ponta a ponta do fluxo de adicionais e deploy na Vercel
(variáveis de ambiente acima, URLs de produção do Auth, do webhook do Stripe e
de `private.app_config.webhook_status_url`).
