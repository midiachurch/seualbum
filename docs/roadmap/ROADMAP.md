# Roadmap priorizado

Sem datas de lançamento ou compromisso de capacidade. Esforço S/M/L no backlog é relativo; estimar duração após baseline e dimensionamento de equipe. Implementação depende de autorização separada.

| Fase | Resultado | Gate de saída | Dependência / retorno / risco |
|---|---|---|---|
| 0 — auditoria e consolidação | Baseline, autorização testada e confiabilidade de fotos/pagamentos | P00–P05; A05/A06 resolvidos ou política aprovada; gaps de teste explícitos | Alto retorno de confiança; evita ampliar superfície insegura |
| 1 — Core | Organização e capacidades introduzidas com compatibilidade | C01–C05; acesso cruzado/revogação negados; links e billing legados preservados | Maior risco estrutural; desbloqueia multiusuário real |
| 2 — Gallery | Curadoria persistida, upload recuperável e entrega controlada | U/G concluídos; seleção versionada e permissões verificadas | Valor ao fotógrafo/cliente; antes de comércio por foto |
| 3 — Design | Editor/prova integrados à seleção sem perder produção | D01–D04; snapshot, versão e fechamento regressivos passam | Diferencial existente deve receber manutenção desde fase 0 |
| 4 — Store | Cobrança reconciliada e piloto comercial limitado | ADR-004, S01–S05; recebedor/entrega/estorno aprovados | Receita potencial; risco financeiro e suporte |
| 5 — Studio | CRM/pipeline e comunicação consolidados | T01–T04; projeto/conversa sem duplicação | Base existe: refinos urgentes entram antes, expansão depois |
| 6 — Booking | Reserva sem conflito e vínculo idempotente ao Studio | B01–B04; concorrência/fuso/cancelamento testados | Só após validar demanda e regras comerciais |
| 7 — Sites | Blocos próprios com publicação isolada | W01–W04; domínio/cache/privacidade e rollback verificados | Não bloqueia fluxo principal; custo de produto alto |

## Ajuste à ordem solicitada

Manter as oito fases como visão, sem tratá-las como projetos do zero. Design, Store e Studio já existem parcialmente. Seus bugs, segurança e operação ficam em manutenção transversal na fase 0; Core não pode exigir meses de reescrita para corrigir estrela/upload. A Gallery comercial completa depende do Core, mas U01/U02 e especificação G01 podem ser preparados cedo. Se entrevistas demonstrarem valor maior de Studio, sua expansão pode anteceder a nova Store, mediante revisão dos gates e capacidade.

## Sprint S1 — consolidação local, aceite integrado pendente

0043 e regressão SQL: 512 verificações aprovadas; E2E bloqueado por infraestrutura. Fase 0 não encerrada. Detalhes em [CONSOLIDACAO](../sprints/CONSOLIDACAO.md).

Implementação incremental autorizada posteriormente ao masterplan. Progresso e limites em [S1](../sprints/S1.md). U01/U02 têm alterações locais testadas; o gate de isolamento e o aceite integrado continuam pendentes. Migrações remotas e deploy não autorizados nesta entrega.

Meta: provar isolamento atual e fechar contratos de identidade/seleção, entregando correções pequenas apenas se os testes permitirem.

Pacote comprometido: P00 (política/testes negativos), P01 (baseline e divergência de documentação), G01 (contrato e decisão de favoritos), U01 (ID canônico) e U02 (erro explícito/retry conservando operação). Timebox e capacidade a confirmar antes de iniciar; não assumir que todo pacote cabe em uma semana.

Sequência: política de equipe + ambiente local isolado → reproduzir acessos e baseline → revisar A05/A06 → autorizar correção de policy se necessária → contrato favorito (ADR-003) → identidade/erro de upload → regressão. G02/G03 entram como extensão se política e RPC puderem ser alteradas com segurança. Não habilitar multi-organização, Store nova, Booking ou Sites no S1.

Aceite: evidência de testes diretos de API/RPC com dois estúdios e projetos, usuário não atribuído e cliente final; retorno real de upload incorporado; erro recuperável visível; confirmação repetida sem duplicidade; fluxos existentes de prova/cobrança preservados. Se um P0 falhar, escopo de features cede lugar à correção revisada. Nenhum teste pode apontar para produção.

## Critérios de pausa/replanejamento

Divergência de schema, autorização transversal não aprovada, custos sem limite, corrupção de vínculo de arquivos ou falha de reconciliação bloqueiam expansão. Pesquisa Pixieset incompleta limita comparação visual, mas não impede corrigir achados locais comprovados. Não usar a referência para justificar contornar acesso ou criar recursos não autorizados.
