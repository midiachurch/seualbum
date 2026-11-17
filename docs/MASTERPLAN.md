# SeuAlbum 2.0 — planejamento mestre

> Prioridade atual desde 16/11/2026: [Fase 01 — Operação Digital](operacao-digital/MASTER-PLAN.md). Este documento preserva o planejamento histórico; a nova frente autoriza implementação incremental e prioriza o primeiro produto digital comercial. Resultados atuais em [STATUS-OPERACAO](operacao-digital/STATUS-OPERACAO.md); relatório histórico em EXECUTION-STATUS.

Data: 15/11/2026. Status: consolidação local S1 autorizada e em execução; regressão SQL aprovada, gate de API/E2E e baseline remota pendentes. Sem rollout. Consulte [CONSOLIDACAO](sprints/CONSOLIDACAO.md).

## Diagnóstico executivo

O MVP já é um sistema de produção de álbuns com autenticação, seis papéis, projetos, editor, prova, revisão, cobrança e integrações. A estratégia é organizar esses ativos em sete módulos de um único produto, sem reescrever a aplicação. Core, Gallery e Design sustentam a primeira expansão; Store amplia receita depois que isolamento e pagamentos estiverem validados. Studio já tem uma base no MVP e deve ser consolidado durante as fases iniciais; sua expansão comercial fica na fase 5. Booking e Sites vêm depois, mediante demanda e capacidade operacional.

Prioridade imediata: confirmar a autorização efetiva no banco, reconciliar favoritos e uploads, e estabelecer uma fonte confiável do estado de implantação. Não há certificação de segurança ou de funcionamento em produção nesta entrega.

## Como ler

| Assunto | Fonte canônica |
|---|---|
| Visão e limites do produto | [VISION](strategy/VISION.md) |
| Hipóteses de receita e custos | [BUSINESS-MODEL](strategy/BUSINESS-MODEL.md) |
| Evidências locais e diagnóstico | [CURRENT-STATE](architecture/CURRENT-STATE.md) |
| Rotas, arquivos, tabelas, funções e políticas | [Inventário técnico](architecture/TECHNICAL-INVENTORY.md) |
| Auditoria classificada | [AUDIT-FINDINGS](architecture/AUDIT-FINDINGS.md) |
| Monólito modular e transição de dados | [TARGET-ARCHITECTURE](architecture/TARGET-ARCHITECTURE.md) |
| Dependências e fronteiras | [MODULES-MAP](architecture/MODULES-MAP.md) |
| Autorizações e matriz de validação | [PERMISSIONS](architecture/PERMISSIONS.md) |
| Escopo de cada produto | [Core](products/CORE.md), [Gallery](products/GALLERY.md), [Design](products/DESIGN.md), [Store](products/STORE.md), [Studio](products/STUDIO.md), [Booking](products/BOOKING.md), [Sites](products/SITES.md) |
| Navegação, identidade e acessibilidade | [GUIDELINES](design-system/GUIDELINES.md) |
| Fases, critérios de passagem e sprint | [ROADMAP](roadmap/ROADMAP.md) |
| Tarefas identificáveis e verificáveis | [BACKLOG](roadmap/BACKLOG.md) |
| Decisões aprovadas e limites | [Registro de decisões](decisions/README.md) |
| Pesquisa de referência e lacunas | [Pixieset](research/pixieset/README.md) |

## Base de evidência

Os sete documentos de pesquisa são a referência funcional primária, com cobertura parcial explícita. Seus IDs UI descrevem observações visuais; não equivalem aos ev_ do Craft Anything. Login/proteção de acesso não são referência do design dos painéis. Não foi repetida a investigação externa.

A skill Craft Anything foi aplicada pela regra de evidência e pela orientação de ler diretamente o código quando há fonte disponível. O inventário local cobre a estrutura; a revisão semântica aprofundou autorização, favoritos, uploads, prova, cobrança e integrações. Não afirma revisão linha a linha de todo arquivo. Na elaboração original não houve execução. Posteriormente a S1 executou testes e migrations somente em ambiente descartável; resultados no relatório de consolidação. Nenhuma consulta/migration remota ou deploy foi realizado.

## Decisões aprovadas em 15/11/2026

1. Monólito modular incremental, com sete módulos e reuso do MVP (ADR-001).
2. Organização inicial por estúdio; designer/operador por atribuição ou concessão explícita; gestão transversal de produção e suporte com escopo auditado (ADR-002).
3. Favoritos compartilhados por projeto na primeira versão; comando manual reversível, selfie separada e seleção distinta da aprovação (ADR-003).
4. Três contextos financeiros separados. Na Store futura, estúdio vende/recebe; SeuAlbum vende/recebe seus próprios serviços. Gateway, contratos e operações financeiras continuam sujeitos a validação específica (ADR-004).

O usuário delegou o fechamento das escolhas na conversa. Os ADRs identificam os detalhes definidos pelo agente sob essa autorização.

## Aprovações e validações ainda necessárias

- Contratos e detalhes técnicos de policies/backfill após testes P00/P02; a direção aprovada não certifica a autorização atual.
- Preços, comissões, packaging e ciclo recorrente: permanecem hipóteses, sem ativação.
- Regras contratuais e operacionais de entrega, estorno/disputa e provedor da Store antes do piloto.
- Implementação/testes isolados autorizados na S1; rollout remoto e deploy continuam fora do escopo.

## Primeiro sprint recomendado

Auditoria executável de autorização em ambiente local isolado, baseline de migrações e contratos de favoritos/upload. Depois da validação de acesso e da especificação técnica da ADR-003, implementar pequenos ajustes de identidade/erro de upload e favorito manual. O compromisso inicial é o pacote S1 do roadmap; correções condicionais só entram após o resultado dos testes. Booking/Sites não entram neste sprint.

## Governança documental

Este arquivo é o índice e a síntese, não outra especificação detalhada. Cada decisão tem um ADR; cada entrega tem ID no backlog. A pesquisa histórica fica preservada. README da raiz continua como guia de operação; divergências dele com migrações são registradas na auditoria até confirmação, sem declarar um estado remoto não consultado. Não excluir documentação preexistente para impor esta organização.
