# Publicação e ambientes

## Estado e limites

Preservar Supabase `seu-album` e Vercel `seualbum` existentes. Não usar outro projeto da conta. GitHub `midiachurch/seualbum` é público: publicar somente código/documentação/testes sintéticos revisados; excluir `.env`, sessões de pesquisa, credenciais, dados pessoais, caches e arquivos de autenticação.

A migration 0044 exige a cadeia anterior, inclusive 0043. Validada em banco descartável não significa aplicada no remoto. A baseline remota não pôde ser consultada por 403 da CLI; nenhuma migration remota foi aplicada.

## Gates antes de preview funcional

1. Validar tipos, lint, Vitest, regressão SQL e compilação sobre a árvore integrada. Demo E2E é evidência exclusiva da interface.
2. Confirmar nomes e presença das variáveis no ambiente Preview sem expor valores: Supabase URL/anon, chave privilegiada somente servidor, R2 privado/público e CORS, Stripe teste/webhook, AWS/consentimento, site URL e cron. Não copiar automaticamente as credenciais de Production.
3. Obter ambiente seguro de staging ou clone descartável com schema 0041–0044 confirmado. Preview não deve receber credenciais de produção como conveniência.
4. Testar Auth/PostgREST/Storage e navegador com duas identidades/estúdios, sessão inativa, responsável revogado, favoritos após recarga e falhas; assinatura R2/URLs temporárias, provas e extras.
5. Publicar branch/PR. Integração Git Vercel pode criar deployment automático; verificar status e ambiente pelo provedor. Build de preview sem migration correspondente não certifica funcionalidade. Não mergear main para provocar produção.
6. Homologação humana com URL de preview verificada, limitações e dados sintéticos; produção apenas com autorização específica.

## Migração e reversão

Antes de qualquer aplicação remota: inventário de versões/funções/policies, backup e ensaio, compatibilidade dos links, plano de observação e reversão aprovado. 0044 acrescenta RPC sem ampliar policies; em falha remover exposição da UI e revogar RPC após avaliar consumidores, sem reabrir as policies amplas anteriores. Não aplicar rollback destrutivo por padrão. Testes de concorrência real e restauração continuam necessários.

## Comandos locais

- `npm run lint`
- `npx tsc --noEmit --incremental false`
- `npm test`
- `python3 scripts/test-db-isolado.py` (Docker, imagens já disponíveis, descartável)
- `SEUALBUM_API_TESTS=1 python3 scripts/test-db-isolado.py` (acrescenta HTTP PostgREST sem portas host; JWT sintético, sem login Auth)
- `npx playwright test -c playwright.demo.config.ts` (demo, sem banco)
- `npm run build -- --webpack` (usar ambiente sintético, sem chaves reais; fontes Google exigem rede)

Não iniciar build e servidor de teste simultaneamente no mesmo checkout: ambos usam `.next`. Não executar global setup autenticado contra stack existente sem confirmar propriedade, pois ele prepara dados/configuração.
