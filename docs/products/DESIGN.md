# SeuAlbum Design

Status: proposta de domínio; nenhuma implementação autorizada nesta missão.

## Objetivo comercial

Preservar a diagramação profissional e acelerar revisão/entrega de álbuns.

## Funcionalidades existentes — fonte local, sem validação de produção

Editor canvas, álbum avulso/projeto, templates, Smart Layout, verificação de impressão, versões, JPG/ZIP, prova com pins e checklist, aprovação e revisão interna.

## Funcionalidades novas — propostas

Contratos claros com Gallery, snapshots de seleção, pré-checagem consistente, recuperação de trabalho e melhorias de navegação/performance com dados medidos.

## Rotas atuais e propostas

Preservar /admin/albuns, /admin/albuns/[id], /admin/projetos/[id]/editor, /admin/design, /admin/diagramacao, provas nas três áreas e /album/[token]. Propor /dashboard/design inicialmente como entrada/atalhos permitidos, não concessão automática de edição ao fotógrafo.

## Componentes e serviços reutilizáveis

src/lib/album, componentes album-editor, ProofViewer, painel de aprovação, DesignVersionsPanel, regras de diagramação e exportação.

## Entidades e dados

album_layouts, album_layout_versoes, album_templates, design_versions, versoes_laminas, aprovacoes, prova_comentarios/prova_laminas_revisao. Referenciar IDs de foto; preservar origens legadas e versões imutáveis publicadas.

## Dependências

Core + fotos de Gallery; contrato Billing para liberar produção quando fechamento estiver resolvido. Pode operar antes da Gallery comercial completa.

## Permissões

Editor atribuído, revisão interna por gestão e aprovação do cliente são capacidades distintas. Álbum avulso com token não equivale a sessão administrativa.

## Potencial de monetização — hipótese

Serviço avulso/volume e ferramenta são ofertas distinguíveis; preservar franquia congelada e adicionais do pedido.

## Critérios de aceitação da primeira versão

Publicação mantém versão anterior; reabrir/exportar reproduz o documento; aprovação concorrente não duplica fatura; lâminas herdadas não são sobrescritas; concessões por papel mantidas.

## Riscos técnicos

CPU/memória de renderização, histórico/derivados, publicação parcial, divergência seleção↔documento, contratos com faturamento.

## Entregas rastreáveis

D01–D04, P03. Ver [backlog](../roadmap/BACKLOG.md), [dependências](../architecture/MODULES-MAP.md) e [permissões](../architecture/PERMISSIONS.md). A pesquisa Pixieset é referência parcial, não especificação a copiar.
