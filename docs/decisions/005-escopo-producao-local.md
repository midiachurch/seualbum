# ADR-005 — Escopo local da produção

Status: implementado e validado por SQL local; não implantado.

A 0043 mantém helpers globais de papel e acrescenta escopo por projeto em policies/RPCs. Admin/gestor mantêm operação transversal; designer/operador precisam de atribuição. Sem concessões novas ou tenancy. Conta inativa e ausência de sub falham fechado nos caminhos alterados. Vínculos de projeto/layout só mudam pela gestão. Não ampliar grants como solução de compatibilidade.

Alternativa rejeitada: mudar is_equipe globalmente, afetando catálogo e fluxos sem projeto. Álbum avulso preserva contrato legado explicitamente; isolamento futuro depende do Core.

Validação: 224 verificações de escopo mais 288 regressões SQL. E2E bloqueado e remoto desconhecido. Evidências/limites em ../sprints/CONSOLIDACAO.md. Reversão exige revisão de segurança: não reabrir acesso amplo como rollback. Execução local autorizada pelo usuário na missão de consolidação; nenhum rollout remoto autorizado.
