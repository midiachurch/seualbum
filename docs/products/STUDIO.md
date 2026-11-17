# SeuAlbum Studio

Status: proposta de domínio; nenhuma implementação autorizada nesta missão.

## Objetivo comercial

Centralizar relacionamento e coordenação comercial sem duplicar projeto, cliente ou mensagens.

## Funcionalidades existentes — fonte local, sem validação de produção

Clientes/fotógrafos, projeto, CRM de retenção, orçamentos, conversas reais, leituras e avisos de sistema. Outbox de comunicação possui conteúdo simulado sem prova de envio externo.

## Funcionalidades novas — propostas

Pipeline comercial configurável sem substituir produção, tarefas, formulários e templates de comunicação; propostas/documentos após validação de demanda.

## Rotas atuais e propostas

Preservar /dashboard/orcamentos, /dashboard/mensagens, /admin/clientes, /admin/mensagens e /cliente/mensagens. Propor /dashboard/studio e /dashboard/studio/clientes, referenciando os mesmos registros.

## Componentes e serviços reutilizáveis

actions/crm/orcamentos/mensagens, Conversations UI, ProjectWorkspace, ProjectHub e filtros existentes.

## Entidades e dados

clientes, projetos, orcamentos, conversas, mensagens, conversa_leituras, comunicacoes_log e notificacoes_crm; tarefas/etapas comerciais podem ser novas, sem segunda tabela de projetos.

## Dependências

Core; projeta situação de Design/Store por contrato, sem gravar estado financeiro/produção diretamente. Base comercial de Booking.

## Permissões

Fios cliente↔estúdio e estúdio↔equipe não se confundem. Leitura de suporte e capacidade de escrita obedecem policy própria e futura política de organização.

## Potencial de monetização — hipótese

Gestão e automações como hipótese de plano; custo por comunicação/volume a validar.

## Critérios de aceitação da primeira versão

Uma conversa por contexto canônico; ausência de vazamento entre estúdios; mensagem de sistema não duplica; próximos passos comerciais não mudam status de produção.

## Riscos técnicos

Automação enviar mensagem indevida, tarefas duplicadas, projeto comercial versus produção, dados pessoais e suporte transversal.

## Entregas rastreáveis

T01–T04. Ver [backlog](../roadmap/BACKLOG.md), [dependências](../architecture/MODULES-MAP.md) e [permissões](../architecture/PERMISSIONS.md). A pesquisa Pixieset é referência parcial, não especificação a copiar.
