# Registro de decisões

As diretrizes dos ADRs 001–004 foram **aprovadas em 15/11/2026**, sob autorização do responsável pelo produto para fechar as próximas decisões. As escolhas detalhadas pelo agente estão registradas em cada ADR. Ainda não foram implementadas. Esta aprovação documental não autoriza por si só implementação, migration, deploy ou transação financeira.

| ADR | Decisão | Impacto |
|---|---|---|
| [001](001-modular-monolith.md) | Monólito modular incremental | Reuso do MVP e fronteiras |
| [002](002-organization-and-access.md) | Organização e escopos de equipe | Principal gate de isolamento |
| [003](003-selection-and-approval.md) | Favoritos, seleção e aprovação separados | Semântica/RPC e dados |
| [004](004-billing-contexts.md) | Três contextos financeiros | Risco comercial e integridade |

Nova decisão deve conter contexto, alternativas, recomendação, consequências, validação/rollback e pergunta objetiva de aprovação. Evidência local em CURRENT-STATE/AUDIT-FINDINGS; pesquisa externa permanece com suas limitações originais.

ADR-005: [Escopo local da produção](005-escopo-producao-local.md), implementado/testado localmente; sem implantação remota.
