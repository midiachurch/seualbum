<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


<!-- BEGIN:seualbum-planning -->

## SeuAlbum 2.0 — fontes de planejamento

- Comece por `docs/MASTERPLAN.md`; estado atual em `docs/architecture/CURRENT-STATE.md` e achados em `AUDIT-FINDINGS.md`.
- `docs/research/pixieset/` é pesquisa parcial. Não apresentar recurso não observado, tela de login ou proteção de acesso como evidência de painel/fluxo completo.
- Evoluir o MVP incrementalmente. Preservar reconhecimento por selfie, editor, prova/versionamento, cobrança de extras e integrações, salvo decisão justificada e aprovada.
- Conta, organização, papel global e concessão por projeto são conceitos distintos. UI/proxy não substituem RLS/RPC/trigger; não usar service role para contornar autorização.
- Favorito de foto, seleção entregue e aprovação do álbum são operações distintas. A RPC existente `favoritar_fotos` é unidirecional e registra origem de selfie; não é um toggle genérico.
- Os ADRs 001–004 em `docs/decisions/` tiveram suas diretrizes aprovadas em 15/11/2026. Consulte a decisão adotada e seus limites; isso não autoriza implementação, migrations ou deploy automaticamente. Rotas/tabelas futuras descritas na documentação não estão implementadas.
- Nesta missão de masterplan, o escopo autorizado é apenas documentação: sem código funcional, banco/migrations, instalação, exclusão ou deploy. Futuras implementações exigem autorização de escopo própria.
- Atualização posterior: o usuário autorizou prosseguir com a implementação incremental da Sprint S1. Consulte `docs/sprints/S1.md` para alterações, validação e pendências. A autorização não inclui migrações remotas ou deploy; o ambiente descartável de banco foi autorizado e os resultados constam em `docs/sprints/ISOLAMENTO-LOCAL.md`.
- Missão posterior de consolidação: implementação local da 0043, testes descartáveis e commits locais autorizados. Sem push, deploy ou migration remota. Status vigente em `docs/sprints/CONSOLIDACAO.md`.
- Não usar o projeto MidiaChurch nem expor credenciais ou dados pessoais em artefatos/testes/logs.

<!-- END:seualbum-planning -->

<!-- BEGIN:operacao-digital -->

## Operação Digital — 16/11/2026

O pedido Fase 01 autoriza implementação incremental do produto digital, migrations versionadas/testes seguros, três frentes em worktrees, publicação no GitHub via PR e preview. Prioridade vigente e contratos em `docs/operacao-digital/MASTER-PLAN.md` e `ARCHITECTURE.md`; resultados em `EXECUTION-STATUS.md`. As restrições documentais anteriores ficam históricas no que conflitarem com esta autorização. Preservar editor, selfie, prova, extras e integrações. Sem produção, custos adicionais, preços definitivos, exclusões ou migrations de produção com risco sem aprovação. Não usar outros projetos da conta.

<!-- END:operacao-digital -->
