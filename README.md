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
| `DEV_LOGIN_*`                   | não usar    | Atalhos de login de teste; só funcionam em `next dev`                          |

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

Pendente: teste ponta a ponta do fluxo de adicionais e deploy na Vercel
(variáveis de ambiente acima, URLs de produção do Auth, do webhook do Stripe e
de `private.app_config.webhook_status_url`).
