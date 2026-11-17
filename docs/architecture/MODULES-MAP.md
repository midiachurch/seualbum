# Mapa de módulos e dependências

Todas as linhas dependem de Core para identidade, escopo e capacidades. “Existente” descreve artefatos locais, não certificação de produção.

| Módulo | Dono do domínio | Reuso atual | Dependência incremental |
|---|---|---|---|
| Core | Conta, organização, política, entitlements e adaptadores comuns | Auth, profiles, fotografos, permissões, clientes Supabase | Base de todos; não contém regra de lâmina |
| Gallery | Fotos, coleções, seleção, acesso/entrega | fotos, uploads R2, EXIF, reconhecimento | Core; integração contratada com Design/Store |
| Design | Documento de álbum, templates, versões, prova e produção | lib/album, editor, projetos, prova | Core + contrato de fotos Gallery |
| Store | Catálogo comercial, pedidos, fechamento e futuras vendas | planos, produtos, orders, faturas, adicionais, Stripe | Core; Gallery para venda por foto; Design para extras |
| Studio | CRM, relacionamento, comunicação e coordenação de projeto | clientes, orçamentos, conversas, CRM | Core; referencia estados de Design/Store sem regravá-los |
| Booking | Disponibilidade, reserva e conflito de agenda | Identidade, cliente/projeto e adaptadores futuros | Core + Studio; Store se houver sinal financeiro |
| Sites | Presença pública do estúdio, temas e publicação | CMS/vitrine/mídia como componentes | Core + mídia pública Gallery; Booking/Store opcionais |

## Matriz direcional

Linha consome contrato da coluna. B = base obrigatória; C = contrato da capacidade; O = integração opcional. Não implica ciclo de imports.

| Consumidor | Core | Gallery | Design | Store | Studio | Booking | Sites |
|---|---|---|---|---|---|---|---|
| Gallery | B | — | O | O | O | — | — |
| Design | B | C | — | C* | O | — | — |
| Store | B | C* | C* | — | O | — | — |
| Studio | B | O | O | O | — | — | — |
| Booking | B | — | — | O | C | — | — |
| Sites | B | C* | — | O | — | O | — |

\* Contratos separados por capacidade: Design emite uma decisão de aprovação, Store/Billing calcula e confirma cobrança, Design consome a liberação financeira. Isso não autoriza import circular nem duplicar máquina de estados. Sites consome somente mídia pública; Store só depende de Gallery para venda por foto. O serviço atual de álbuns continua podendo vender sem Gallery completa.

## Contratos a especificar antes de refatorar

AssetRef (foto canônica e origem privada/pública), SelectionSnapshot, AlbumVersionRef, ApprovalDecision, BillingContext/PaymentConfirmation, ProjectRef, OrganizationContext e CapabilityDecision. São contratos propostos; não DTOs ou tabelas já criados. Preferir funções de aplicação pequenas e adaptação do retorno existente.

## Fronteiras de dados

Projetos/cliente/fotógrafo existentes permanecem canônicos. Nova coleção pode opcionalmente referenciar projeto, e uma foto continua única para reuso; associações devem ter consistência de organização. A decisão de seleção inicial compartilhada ou individual é ADR-003. Álbum avulso não deve exigir projeto fictício. CRM não duplica auth.users; fatura SaaS não reutiliza fatura de fechamento sem discriminante e contrato apropriados.
