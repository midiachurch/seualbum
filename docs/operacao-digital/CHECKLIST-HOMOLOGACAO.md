# Checklist de homologação

- [x] Histórico/base local e PR #2 conferidos antes da Etapa 02.
- [x] Testes locais negativos SQL/RLS de seleção, portal e Storage.
- [x] HTTP PostgREST de capacidade, isolamento e revogação.
- [x] Concorrência de entrega: um sucesso e um conflito, snapshot único.
- [x] Unitários, tipos, lint e navegador demo (inclui fila/HEIC, portal fail-closed).
- [ ] Criação da galeria e login Auth no navegador com duas contas/estúdios.
- [x] Entrada guest por código correto, cookie real, recarga, entrega e revogação no navegador local integrado com PostgREST real (mídia substituída). Rotação em SQL; ainda falta homologação de staging.
- [ ] Upload R2 real, confirmação/retry, nome original após recarga e foto privada em dispositivos móveis.
- [ ] Exportação de originais reais por snapshot, nomes/CSV, expiração e revogação de acesso.
- [ ] Prova versionada, comentários, alteração e aprovação pelo novo portal sem expor notas internas.
- [ ] Mensagens, escolha de diagramação, timeline completa e notificações visuais.
- [ ] Baseline remota e staging confirmados; nenhuma migração remota implícita.
- [ ] Preview com conta Vercel autorizada e serviços isolados de homologação.
- [ ] Recorrência/franquias/consumo e regras comerciais validados antes de lançamento.

Marcação local não equivale a aceite em produção. Detalhes dos resultados e evidências em STATUS-OPERACAO.md.
