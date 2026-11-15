# Backlog técnico inicial

Atualização de execução: P00 corrigido/testado localmente; P02 possui harness e matriz, pendente de API/E2E. P01 remoto, P03 integração, P04/P05 e aceite integrado U01/U02 permanecem abertos. Fonte vigente: [CONSOLIDACAO](../sprints/CONSOLIDACAO.md). Nenhum C/G/D/S/T/B/W foi encerrado por existir documentação.

Status inicial: **proposta / não iniciada**, exceto pelo progresso registrado na [Sprint S1](../sprints/S1.md): U01/U02 implementados parcialmente em ambiente local, sem aceite integrado; P00/P01 em investigação. P0 = segurança/integridade pré-expansão; P1 = valor/robustez essencial; P2 = melhoria posterior. S/M/L é esforço relativo, não dias. Todo ID requer PR pequeno e evidência do aceite. Se uma tarefa L não couber em revisão única, separar contrato/teste, implementação e adoção; não juntar migração, remoção e rollout.

| ID | Fase | Prioridade | Esforço | Depende de | Tarefa | Aceite verificável |
|---|---|---|---|---|---|---|
| P00 | 0 | P0 | M | — | Decidir alcance de equipe e testar pode_ver_projeto/policies por ação | Dois estúdios + designer não atribuído + operador + cliente; leitura e mutação direta comparadas à política aprovada |
| P01 | 0 | P0 | S | — | Reconciliar baseline local/remoto e documentação de implantação | Relatório de versões/metadados sem segredos; divergência 0041 resolvida sem presumir aplicação |
| P02 | 0 | P0 | M | P00,P01 | Construir gate isolado de RLS/RPC e grants | pgTAP negativo por recurso, perfis e campos administrativos; nenhuma chamada a produção |
| P03 | 0 | P0 | M | P01 | Validar prova, extras e confirmação Stripe | Replay/valor divergente/concorrência/cortesia/cancelamento não duplicam fatura nem liberam indevidamente |
| P04 | 0 | P1 | S | P01 | Validar demo versus produção e configuração por capacidade | Integração ausente falha fechada; demo não é promovida a evidência real |
| P05 | 0 | P1 | M | P00 | Validar opt-in, custo e remoção biométrica | Índice revogado/vencido removido no fluxo testado; selfie não aparece em log/storage |
| U01 | 0/2 | P1 | S | P00 | Incorporar ID/chave/meta reais ao upload do cliente | ID temporário reconciliado com retorno canônico; ações futuras usam UUID persistido |
| U02 | 0/2 | P1 | M | U01 | Expor erro por arquivo e retomar confirmação com identidade estável | Falha de rede/PUT/confirmar tem status e retry, sem duplicar foto |
| U03 | 2 | P1 | M | U02 | Limitar fila, memória e concorrência de upload | Lote grande respeita limite definido; cancelamento/falha não trava a interface |
| C01 | 1 | P0 | M | P02 | Especificar organização, membership e concessões de cliente | ADR-002 e matriz aprovados; mapeamento legado determinístico |
| C02 | 1 | P0 | L | C01 | Ensaiar tenancy aditiva e backfill em ambiente isolado | Dados/IDs/chaves preservados; órfãos bloqueados; rollback e consistência testados |
| C03 | 1 | P0 | M | C02 | Aplicar capacidades por recurso no servidor/RLS | Leitura não implica upload/publicação; associação cross-org recusada |
| C04 | 1 | P1 | M | C03 | Adicionar shell, contexto e seletor de produtos | Organização validada em cada operação; deep links legados preservados |
| C05 | 1 | P1 | M | C03,P03 | Definir entitlements e medição mínima | Cota limita custo, nunca concede acesso; configuração de plano auditada |
| G01 | 0/2 | P1 | S | P00 | Especificar contrato da seleção compartilhada aprovada | ADR-003 diferencia marcar/desmarcar, origem manual/selfie e aprovação de álbum |
| G02 | 2 | P1 | M | G01,P02 | Implementar contrato mínimo de favorito persistido | Estado desejado idempotente, escopo validado, log correto, sem UPDATE geral em fotos |
| G03 | 2 | P1 | S | G02,U01 | Conectar estrela manual com feedback/rollback | Recarregar preserva escolha; erro visível; desmarcar funciona conforme decisão |
| G04 | 2 | P1 | M | C03,G03 | Adicionar coleção/sets e filtros reaproveitando fotos | Um original canônico; vínculo opcional ao projeto; sem acesso transversal |
| G05 | 2 | P1 | M | G04 | Versionar entrega da seleção e acessos | Seleção entregue é snapshot; revogar link e verificar versão sem aprovar álbum |
| G06 | 2 | P1 | M | G05 | Implementar download autorizado e revisão de UX | Original não exposto publicamente; mobile/teclado/expiração e lote testados |
| D01 | 3 | P1 | S | G05 | Definir contrato seleção→documento de álbum | Mudança posterior não altera prova publicada |
| D02 | 3 | P1 | M | D01 | Integrar seleção sem duplicar originais ou editor | IDs e caminhos legados funcionam em álbum avulso e de projeto |
| D03 | 3 | P1 | M | D02,P03 | Validar publicação parcial e recuperação | Lâmina herdada imutável; versão reproduzível; histórico/restauração ensaiados |
| D04 | 3 | P2 | M | D03 | Medir performance e acessibilidade do editor/prova | Orçamento por documento definido, teclado/foco e exportação regressivos |
| S01 | 4 | P0 | S | C05,P03 | Detalhar contratos dos contextos financeiros aprovados | ADR-004 aprovado; serviço/SaaS/venda com finalidade e responsabilidades próprias |
| S02 | 4 | P1 | M | S01 | Especificar catálogo/preço/entrega do piloto | Snapshot de preço e regra de produção; reuso avaliado antes de novas tabelas |
| S03 | 4 | P0 | L | S02,G06 | Implementar pedido/checkout do piloto | Valor no servidor; contexto inequívoco; mídia autorizada e recebedor correto |
| S04 | 4 | P0 | M | S03 | Implementar reconciliação, estorno e falha de entrega | Eventos repetidos/fora de ordem tratados; divergências acionáveis e auditadas |
| S05 | 4 | P1 | M | S04 | Pilotar monetização/cotas sem migrar clientes à força | Custo/receita e suporte medidos; política de retenção/exportação aprovada |
| T01 | 5 | P1 | S | C03 | Unificar modelo de cliente/projeto e jornada comercial | Sem segundo cadastro concorrente; etapa comercial separada de produção |
| T02 | 5 | P1 | M | T01 | Adicionar filtros/tarefas e próxima ação | Responsável/prazo visíveis e permitidos; links existentes funcionam |
| T03 | 5 | P1 | M | T01 | Consolidar conversas e prévia de comunicação | Fios/leituras isolados; prévia não envia; suporte respeita política |
| T04 | 5 | P2 | M | T03 | Validar automação/outbox mínima | Retry e idempotência sem mensagens duplicadas; envio externo só após aprovação de integração |
| B01 | 6 | P1 | S | T01,C03 | Definir recurso, fuso e política de reserva | Regras de duração/buffer/cancelamento e finalidade aprovadas |
| B02 | 6 | P0 | L | B01 | Implementar hold e conflito transacional | Duas requisições concorrentes não reservam o mesmo recurso/intervalo |
| B03 | 6 | P1 | M | B02; S04 se houver sinal | Integrar confirmação e vínculo de projeto, com sinal opcional | Sem sinal: um vínculo por reserva; com sinal: pagamento tardio não ocupa slot perdido e compensação definida |
| B04 | 6 | P1 | M | B03 | Validar fuso, expiração e cancelamento | Testes de timezone e alterações de agenda, sem expor calendário privado |
| W01 | 7 | P1 | S | C03 | Especificar site/blocos próprios e propriedade | Reuso do CMS avaliado; rascunho e publicação distintos |
| W02 | 7 | P1 | L | W01,G06 | Implementar prévia/publicação mínima | Somente mídia pública; isolamento de cache/org; HTML sanitizado |
| W03 | 7 | P0 | M | W02 | Validar domínio, identidade e retirada de publicação | Titularidade verificada; isolamento por host; rollback de versão e cache ensaiados |
| W04 | 7 | P2 | M | W03 | Pilotar acessibilidade, SEO e integrações opcionais | Mobile/teclado e metadados testados; blocos Store/Booking só se módulos disponíveis |

## Padrão de revisão

Cada implementação documenta problema, contrato alterado, atores autorizados, compatibilidade, teste negativo, observabilidade e rollback. Seeds são sintéticos e ambiente local isolado. Não marcar teste existente como aprovado sem execução. Não usar fixtures com clientes ou segredos reais.

## Pacotes revisáveis para tarefas L

- C02a: relatório/backfill em clone; C02b: constraints e policies em clone; C02c: ensaio de leitura sombra e rollback. Rollout remoto é nova aprovação.
- S03a: contrato e cálculo de preço; S03b: pedido e adaptador; S03c: confirmação/entrega autorizada. Gate S01 antes de qualquer integração comercial.
- B02a: modelo/invariante de intervalo; B02b: testes concorrentes; B02c: comando de hold/expiração e UI.
- W02a: estrutura/blocos/sanitização; W02b: prévia privada; W02c: publicação/cache e reversão.

O detalhamento final exige conhecimento de capacidade e resultados P00/P01. Uma dependência de teste não autoriza criar banco ou instalar ferramentas nesta missão documental.
