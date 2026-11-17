# PLANO DE IMPLEMENTACAO

Plano preliminar para refinamento após a pesquisa autenticada. Não autoriza implementação e não depende de reconstruir o MVP.

| Ordem | Entrega proposta | Critério de aceite |
|---|---|---|
| 0 | Concluir inventário e evidências da pesquisa | Cobertura por página, estado, plano e limitação; nenhuma regra inferida apresentada como observada |
| 1 | Consolidar confiabilidade da seleção de fotos | Favorito sobrevive ao recarregamento, respeita acesso ao projeto e apresenta erro recuperável |
| 2 | Melhorar fila de uploads | Identidade real após envio, estados por arquivo, erro visível e nova tentativa sem duplicar registros |
| 3 | Aperfeiçoar navegação e estados vazios | Próxima ação clara, atalhos por papel e preservação das áreas admin/dashboard/cliente |
| 4 | Evoluir galeria do projeto | Filtros e seleção em lote com teclado, foco e experiência móvel verificados |
| 5 | Especificar compartilhamento e download | Escopo, validade e revogação definidos; reutilizar autorização e armazenamento existentes |
| 6 | Avaliar extensões comerciais | Priorizar uso real de fotógrafos; preservar Stripe, aprovação e cobrança de lâminas extras |

## Dependências e validação futura

Não alterar schema nesta pesquisa. Uma etapa futura de favoritos persistidos exige revisar as actions e políticas existentes antes de propor migração. Permissões devem ser verificadas no servidor. Compartilhar galeria, selecionar fotos e aprovar álbum são operações diferentes.

Validação proporcional às futuras mudanças: regressão de acesso por perfil/projeto, persistência entre sessões, falhas de upload, teclado/foco, celular e fluxos atuais de prova e pagamento. Implementar em mudanças pequenas e revisáveis, após autorização.
