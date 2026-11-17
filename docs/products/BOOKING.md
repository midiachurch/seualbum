# SeuAlbum Booking

Status: proposta de domínio; nenhuma implementação autorizada nesta missão.

## Objetivo comercial

Converter disponibilidade em reservas confiáveis e projetos vinculados.

## Funcionalidades existentes — fonte local, sem validação de produção

Não identificado módulo completo de agenda no código inventariado. Cliente/projeto, identidade e pagamento oferecem pontos de integração.

## Funcionalidades novas — propostas

Serviços/agendas, disponibilidade/fuso, bloqueios, holds com expiração, confirmação, cancelamento e integração opcional de calendário/sinal.

## Rotas atuais e propostas

Propor /dashboard/booking, /dashboard/booking/disponibilidade e /b/[estudioSlug]. Nenhuma rota está implementada por este plano.

## Componentes e serviços reutilizáveis

Cliente/projeto do Studio, identidade Core, UI de formulário e adaptador Billing quando houver sinal; não duplicar cadastro.

## Entidades e dados

Agendas, regras de disponibilidade, recursos, reservas/holds e eventos de estado. Instantes UTC + timezone explícito; conflito precisa de invariante transacional, não só checagem na UI.

## Dependências

Core + Studio. Store/Billing apenas se exigir pagamento de sinal; pagamento não deve confirmar slot já perdido.

## Permissões

Membro autorizado configura agenda; público vê slots mínimos, não detalhes de clientes. Cliente gerencia apenas reserva concedida.

## Potencial de monetização — hipótese

Adicional ou pacote após piloto; custos de mensagens/calendário e suporte a cancelamentos devem ser medidos.

## Critérios de aceitação da primeira versão

Duas reservas concorrentes não ocupam o mesmo recurso/intervalo; expiração libera hold; horário respeita fuso; projeto é criado/vinculado uma vez; cancelamento é auditável.

## Riscos técnicos

Concorrência, fuso, mudanças de disponibilidade, calendar sync, slots órfãos após pagamento e ausência de política comercial.

## Entregas rastreáveis

B01–B04. Ver [backlog](../roadmap/BACKLOG.md), [dependências](../architecture/MODULES-MAP.md) e [permissões](../architecture/PERMISSIONS.md). A pesquisa Pixieset é referência parcial, não especificação a copiar.
