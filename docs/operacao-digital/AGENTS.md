# Frentes de execução

Contratos comuns em ARCHITECTURE.md. Todos devem ler AGENTS.md da raiz e guias locais Next antes de código. Sem dados pessoais, segredos, projeto MidiaChurch, alterações destrutivas ou produção.

| Frente | Branch / worktree | Propriedade inicial |
|---|---|---|
| Backend | feat/operacao-digital-backend / /private/tmp/seualbum-od-backend | Action favoritos, migration 0044, SQL e testes da action |
| Frontend | feat/operacao-digital-frontend / /private/tmp/seualbum-od-frontend | Gerenciador de fotos, favorito otimista, contador/filtro, modal acessível |
| Fluxos e integração | feat/operacao-digital-integracao / /private/tmp/seualbum-od-integracao | Inventário fluxos, config e cenários Playwright demo |
| Coordenação | feat/operacao-digital / checkout principal | Arquitetura, revisão, integração, regressões, documentação e publicação por PR |

Não copiar node_modules, .env, .git ou caches entre entregas. Não editar o checkout de outra frente. Não sobrescrever pesquisa local não versionada. Commits centralizados após revisão; branches de trabalho conservam a baseline e seus arquivos até conclusão da integração.
