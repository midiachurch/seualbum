# ADR-002 — Organização, membership e equipe

Status: diretriz aprovada em 15/11/2026; ainda não implementada.

## Contexto

O estúdio atual está vinculado ao UID; multiusuário requer organização. Helpers SQL permitem equipe ampla, enquanto há intenção de atribuição na UI.

## Alternativas

Manter um login compartilhado por estúdio; tratar papel global como membership; reescrever tudo antes de testar isolamento.

## Recomendação

Organização como unidade comercial; auth existente; membros internos separados de clientes com concessões por recurso; operação SeuAlbum em escopo global explicitamente aprovado e auditado.

## Consequências

Backfill, policies e vínculo de cobrança precisam de ensaio; não há RLS multi-org pronta. Preservar IDs e clientes legados.

## Validação e reversão

P00/P02: decisões de autorização por ator/recurso e teste direto; C02: comparação/sombra sem ampliar acesso, rollback com janela de compatibilidade.

## Decisão adotada

Criar futuramente uma organização inicial por estúdio legado, preservando o proprietário atual e os IDs. Membros internos e clientes com concessões por recurso permanecem separados. No alvo, designer e operador acessam somente projetos atribuídos ou explicitamente concedidos. Admin/gestor internos acessam a operação transversal necessária à gestão de produção, com ação identificada e auditada; isso não concede acesso irrestrito a configurações financeiras de organizações. Suporte excepcional exige finalidade, escopo, duração e registro; não concede impersonação, gestão de membros ou cobrança automaticamente. A matriz detalhada e o mapeamento dependem dos testes P00/P02 e de revisão antes de qualquer alteração de policy.

## Registro da autorização

O responsável pelo produto autorizou as próximas decisões na conversa em 15/11/2026: “autorizo as proximas decisoes.” As escolhas acima foram fechadas pelo agente com base nessa delegação e nas recomendações do masterplan; não representam respostas individuais fornecidas pelo usuário a cada alternativa. A autorização registra a direção de produto/arquitetura, sem executar código, migrations, deploy ou operações financeiras.
