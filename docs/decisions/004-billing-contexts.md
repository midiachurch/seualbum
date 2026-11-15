# ADR-004 — Contextos financeiros

Status: diretriz aprovada em 15/11/2026; ainda não implementada.

## Contexto

Hoje pedido e fatura de fechamento têm contratos e metadata distintos. Vender foto do estúdio a consumidor não é o mesmo serviço.

## Alternativas

Reutilizar orders/faturas e metadata sem distinguir finalidade; cobrar tudo no mesmo ciclo sem recebedor definido.

## Recomendação

Separar assinatura SaaS, serviço SeuAlbum e vendas da Store. Reutilizar adaptador/validação/idempotência; novas entidades/contextos só quando necessário.

## Consequências

Exige decisão de recebedor, estorno, suporte e entrega; recorrência não está comprovada como ciclo completo. Não ativar novos pagamentos nesta missão.

## Validação e reversão

Replay/evento fora de ordem/valor divergente e decisão terminal; reconciliação e piloto limitado antes de público geral.

## Decisão adotada

Separar assinatura SaaS, serviço SeuAlbum e venda do estúdio na Store. Para o piloto futuro, o fotógrafo/estúdio é o vendedor e recebedor da venda de fotos/produtos e responde por preço, direitos do conteúdo, entrega e solicitação de estorno; SeuAlbum fornece a plataforma e responde pelo seu serviço técnico. Serviços próprios de diagramação/produção continuam vendidos e recebidos pelo SeuAlbum em contexto separado. Essa direção de produto não define arranjo jurídico, tributário, gateway, split ou movimentação de dinheiro: contratos, fluxo de disputa/estorno, regras de entrega e viabilidade do provedor exigem validação específica antes de ativar a Store. Não há contratação, nova cobrança ou mudança de recebedor na integração existente.

## Registro da autorização

O responsável pelo produto autorizou as próximas decisões na conversa em 15/11/2026: “autorizo as proximas decisoes.” As escolhas acima foram fechadas pelo agente com base nessa delegação e nas recomendações do masterplan; não representam respostas individuais fornecidas pelo usuário a cada alternativa. A autorização registra a direção de produto/arquitetura, sem executar código, migrations, deploy ou operações financeiras.
