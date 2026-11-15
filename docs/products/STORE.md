# SeuAlbum Store

Status: proposta de domínio; nenhuma implementação autorizada nesta missão.

## Objetivo comercial

Monetizar produtos e serviços sem misturar cobrança do SeuAlbum com venda do fotógrafo.

## Funcionalidades existentes — fonte local, sem validação de produção

Planos, produtos, orders, faturas/fatura_itens, adicionais, orçamentos e Stripe Checkout para pedido/fechamento; simulação configurável.

## Funcionalidades novas — propostas

Se validado: catálogo de fotos/impressões, carrinho, preço por coleção, políticas de entrega, pedidos comerciais, estorno e conciliação separados. Assinatura SaaS recorrente é outra capacidade futura.

## Rotas atuais e propostas

Preservar /dashboard/novo-pedido, /dashboard/catalogo, /dashboard/meus-albuns, /orcamento/[hash] e /api/webhooks/pagamento. Propor /dashboard/store e /s/[estudioSlug] com catálogo público aprovado.

## Componentes e serviços reutilizáveis

lib/stripe, actions/pagamentos/faturamento/adicionais, snapshot de preço e funções idempotentes existentes; não reutilizar metadata.pedido_id para domínios diferentes.

## Entidades e dados

Reusar catálogo/fechamento onde a semântica coincide; modelar contexto financeiro explícito e novas entidades de venda apenas após ADR-004. Preço/itens congelados na transação.

## Dependências

Core e Billing; Gallery para venda por foto; Design fornece aprovação/consumo de lâminas, sem calcular valor no navegador.

## Permissões

Só responsável financeiro do estúdio paga fechamento atual. ADR-004 definiu estúdio como vendedor/recebedor das suas vendas e SeuAlbum como prestador da plataforma; serviços próprios SeuAlbum seguem separados. Contratos, gateway e regras operacionais exigem validação antes do piloto. Cliente só vê/paga pedidos próprios.

## Potencial de monetização — hipótese

Hipótese de assinatura/taxa comercial; nenhuma comissão ou preço aprovado. Validar margem após gateway, produção, entrega e suporte.

## Critérios de aceitação da primeira versão

Webhook com assinatura válida, valor e contexto corretos; replay não duplica; cancelado/cortesia não é reaberto; produto vendido entrega apenas mídia autorizada.

## Riscos técnicos

Viabilidade do arranjo de recebimento aprovado, estorno/disputa, contratos de produção, recorrência incompleta, duplicidade financeira e cobrança simulada em ambiente indevido.

## Entregas rastreáveis

S01–S05, P03, P04. Ver [backlog](../roadmap/BACKLOG.md), [dependências](../architecture/MODULES-MAP.md) e [permissões](../architecture/PERMISSIONS.md). A pesquisa Pixieset é referência parcial, não especificação a copiar.
