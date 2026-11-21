# Módulo STUDIO (T01–T04)

Status: implementado localmente e testado em banco descartável. NÃO aplicado em banco remoto, sem push e sem deploy. Nenhum envio real de e-mail, WhatsApp ou SMS existe neste módulo.

## O que foi construído

| Entrega | Migration | Resumo |
| --- | --- | --- |
| T01 funil | `20261122000300_0080_studio_funil.sql` | `studio_negocios` (etapa comercial, valor, origem, responsável, vínculo com cliente/projeto/orçamento), `studio_negocio_historico` (imutável), RPCs de criar, mudar etapa, atualizar e vincular projeto. |
| T02 tarefas | `20261122000400_0081_studio_tarefas.sql` | `studio_tarefas`, RPCs de criar/atualizar/mudar status, `listar_tarefas_studio` (filtros) e `listar_funil_studio` (traz a próxima ação). |
| T03 modelos | `20261122000500_0082_studio_modelos.sql` | `studio_modelos` com variáveis de lista fechada e prévia (`renderizar_modelo_studio`) que não envia nada. |
| T04 outbox | `20261122000600_0083_studio_outbox.sql` | `studio_outbox`, `studio_outbox_registro`, `studio_configuracao`, `studio_optout`; enfileirar, reservar, concluir, processar, cancelar, reenfileirar, listar e automações. |
| T03 linha do tempo | `20261122000700_0084_studio_linha_do_tempo.sql` | `linha_do_tempo_studio`: mensagens, etapas, tarefas concluídas, orçamento e comunicação numa lista só. |

Interface: `/dashboard/estudio` (abas Funil, Tarefas, Modelos de mensagem, Fila de saída), item "Estúdio" no menu. `/dashboard/orcamentos` e `/dashboard/mensagens` seguem como estavam e têm atalho na página.

Código: `src/lib/actions/studio-funil.ts`, `studio-tarefas.ts`, `studio-comunicacao.ts`; `src/lib/studio/` (constantes, modelos, erros, outbox com adaptador injetável); `src/components/studio/`; tipos em `src/types/database.ts`.

## Decisões e por quê

- **Sem segundo cadastro.** O negócio aponta para `clientes` existente. Criar lead reaproveita o cliente do estúdio por id ou por e-mail (sem diferenciar caixa) ou cria a linha em `clientes`. Um índice único impede mais de um negócio em andamento por cliente (padrão Pipedrive: pessoa única, negócio por oportunidade).
- **Etapa comercial separada da produção.** `studio_negocios.etapa` (lead, contato, proposta, fechado, perdido) nunca toca `projetos.status`; há teste provando que o status do projeto permanece igual. O vínculo cliente↔projeto exige o mesmo cliente e o mesmo estúdio.
- **Perda com motivo.** "Perdido" exige motivo de um catálogo (preço, sem resposta, concorrente, data indisponível, desistiu, outro), como HoneyBook/Dubsado/Pipedrive. Reabrir limpa o motivo; reabrir é barrado se o cliente já tem outro negócio ativo.
- **Histórico imutável.** UPDATE/DELETE/TRUNCATE são barrados por trigger (vale até para superusuário) e as tabelas não têm grant de escrita. Só ações referenciais (cascata na exclusão do cliente e anulação do ator quando o perfil some) passam, para não bloquear exclusão de conta (LGPD).
- **Idempotência.** Criação de negócio, mudança de etapa, criação de tarefa e enfileiramento usam chave de idempotência (índices únicos). Repetir a chave devolve o mesmo resultado sem duplicar. Concorrência é serializada por advisory lock por organização ou por `FOR UPDATE`.
- **Papéis.** Reaproveita `papel_na_organizacao` (0051). Leitura: qualquer membro. Escrita (funil, tarefas, enfileirar, cancelar, descadastro): dono, admin e editor. Gestão (modelos, processar a fila, automações, configuração, reenfileirar): dono e admin. Visualizador só lê. Cliente final nunca é membro e recebe 42501.
- **Tarefas.** Responsável precisa ser membro ativo (RPC e trigger, inclusive em escrita direta de superusuário). Dono/admin alteram qualquer tarefa; editor só as que são dele. "Próxima ação" é derivada da tarefa aberta mais próxima do cliente (sem segunda fonte de verdade). Filtros: abertas, minhas, atrasadas, hoje (fuso de Brasília), por responsável, concluídas, todas.
- **Linha do tempo.** Só o fio cliente↔estúdio entra; o fio interno estúdio↔equipe (0037) tem política própria e fica de fora. Mensagem apagada não expõe o conteúdo. Comunicações da outbox aparecem rotuladas como simuladas.
- **Modelos e prévia.** Variáveis de lista fechada (`cliente_nome`, `cliente_primeiro_nome`, `estudio`, `titulo_negocio`, `valor`, `projeto`, `responsavel_nome`, `tarefa`, `prazo_tarefa`), validadas ao salvar. A prévia é uma RPC de leitura: não grava nem enfileira. Variável sem dado vira `[nome]` e é listada em `faltando`; enfileirar recusa se faltar dado.
- **Outbox sem envio externo.** Status pendente, enviando, enviada, falhou, cancelada. Reserva exclusiva com `FOR UPDATE SKIP LOCKED`; backoff exponencial de 1, 2, 4 minutos até 60; após `max_tentativas` (5) o item vira "falhou" e só um gestor reenfileira. Reserva presa há mais de 10 minutos volta à fila. O único adaptador é `registro`: grava o que seria enviado em `studio_outbox_registro` (um por item, UNIQUE) e marca a linha como simulada. Três travas independentes impedem envio real: constraint `enviada ⇒ simulada e adaptador = registro`, constraint `studio_configuracao.envio_externo = false` e recusa de qualquer adaptador diferente de `registro` nas RPCs. Habilitar envio real exige migration nova e integração aprovada.
- **Adaptador injetável.** `src/lib/studio/outbox.ts` define `AdaptadorEnvio`; `processarFila` reserva, entrega ao adaptador e conclui. Exceção do adaptador vira falha com retry, nunca sucesso. Concluir é idempotente (só age em itens "enviando").
- **Descadastro (LGPD).** `studio_optout` por cliente e canal: cancela o que estava pendente, bloqueia novos itens e é respeitado pelas automações. Padrão de mercado para qualquer comunicação por e-mail.
- **Automações (manuais, sem cron).** (1) lembrete interno de tarefa atrasada ao responsável, uma vez por tarefa e prazo; (2) follow-up de proposta sem resposta do cliente há N dias (padrão 3, configurável de 1 a 60), uma vez por entrada na etapa. Só geram itens pendentes na outbox. Disparo por botão de gestor, para não criar custo nem envio sem aprovação.
- **Erros sem vazamento.** As server actions mapeiam 42501 para mensagem genérica e só repassam textos de 22023 que estão numa lista fechada; o resto vira mensagem padrão.
- **Segurança.** RLS ligada; tabelas sem grant de escrita; funções SECURITY DEFINER com `search_path = public, pg_temp`, `revoke ... from public, anon, service_role` e grant só a `authenticated`; funções auxiliares sem nenhum grant. Sem service role.

## Verificação

pgTAP em banco descartável sem rede: `studio_funil` (71), `studio_tarefas` (68), `studio_conversas` (49, modelos, prévia e linha do tempo) e `studio_outbox` (113). Cobrem isolamento entre organizações, papéis, idempotência, histórico imutável, responsável membro ativo, retry sem duplicar, adaptador registro e automações. Vitest: 46 testes novos em quatro arquivos. Um achado dos testes: lógica de três valores em `studio_pode_alterar_tarefa` deixava um ex-membro passar; corrigido com `coalesce` antes de chegar a qualquer commit.

## Pendências reais

- Apenas contas com papel de plataforma "fotógrafo" acessam `/dashboard`; membros da equipe com papel "designer" ainda não têm tela do Estúdio (a RPC já os trata como editor ou visualizador). Precisa de decisão de produto sobre onde essa equipe entra.
- Envio real (provedor de e-mail/WhatsApp, domínio, consentimento por canal, taxas) depende de integração e custo aprovados; hoje só simulação.
- Sem cron: automações e processamento da fila são manuais. Agendar exige credencial de serviço ou job aprovado.
- Edição completa de tarefa e de negócio na tela é mínima (troca de responsável, concluir/cancelar/reabrir; etapa por seletor). As RPCs de atualização completas existem e estão cobertas.
- Orçamentos existentes não têm `cliente_id`; o vínculo orçamento↔negócio é manual (por id), sem inferência por nome.
- Painel de métricas (conversão por origem, valor por etapa) fica para depois; os dados já estão no histórico.
- Migrations 0080–0084 não foram aplicadas em nenhum ambiente remoto; só passam pelo banco descartável.
