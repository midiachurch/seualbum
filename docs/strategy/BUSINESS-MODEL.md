# Modelo de negócio — hipóteses para validação

## Camadas de receita

| Camada | Situação local | Hipótese futura |
|---|---|---|
| Serviço de diagramação | Catálogo, pedidos, pagamento e franquia/adicionais no código | Preservar avulso e contratos de volume com SLA |
| Uso do SaaS | Planos/assinatura de estúdio existem no domínio; ciclo recorrente completo não comprovado | Assinatura por organização, módulos e limites explícitos |
| Gallery | Fotos e curadoria ligadas ao projeto | Armazenamento, entrega e marca como benefício de plano |
| Design | Editor, prova e produção existentes | Plano de ferramenta e serviço gerenciado distinguíveis |
| Store | Fechamento/adicionais do serviço existentes; marketplace de fotos não identificado | Venda do estúdio com taxa/assinatura a definir |
| Studio / Booking / Sites | Gestão parcial; Booking/Sites são expansões | Pacotes ou adicionais após validação de demanda |

Não foram definidos preços, comissões ou promessa de margem. Preços dos seeds e a tela de planos do Pixieset não são pesquisa de disposição a pagar nem preços vigentes do SeuAlbum.

## Custo e limites

Modelar GB-mês de originais e derivados, transferência/download, processamento de imagens, indexação/busca facial, renderização/exportação, banco, suporte e horas de diagramação. Originais, prévias, versões e retenção contam separadamente. Projetos com grandes acervos devem ter cotas verificadas no servidor e informação clara antes do upload.

Entitlements futuros devem limitar operações caras sem confundir limite comercial com autorização: comprar um plano nunca concede acesso ao projeto alheio. Expiração de assinatura não deve apagar automaticamente o acervo nem inviabilizar retirada contratualmente permitida; política de retenção/exportação precisa de aprovação.

## Responsabilidade financeira

Há três contextos: assinatura SaaS da organização; pedido de serviço e fatura de fechamento pagos ao SeuAlbum; venda da Store pelo estúdio ao cliente final. Não usar uma fatura ou metadata existente para os três. A [ADR-004](../decisions/004-billing-contexts.md) aprovou estúdio como vendedor/recebedor das suas vendas e separação dos serviços próprios SeuAlbum. Contratos, gateway, estorno, entrega, tributos e suporte ainda precisam de validação específica antes de ativar a Store.

## Validação comercial

Entrevistar estúdios sobre frequência de seleção, volume, gargalos e interesse em módulos. Fazer piloto consentido de Gallery/Design; medir uso e custo por organização. Só depois aprovar packaging, limites e cobrança recorrente. Não anunciar Booking ou Sites como disponíveis antes dos gates de qualidade do roadmap.
