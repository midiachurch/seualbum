# DESIGN SYSTEM

## Medições verificadas: somente login

Fonte: Craft Anything `web_site_capture`, Clean Room, `include_html=false`, viewport de 1440 px, altura limitada a 900 px. Evidência `ev_cb6bd7e88ab5de6b521b5e37ecf95ac73045c29b3d677139bac33dc7ca39ea6a`.

| Propriedade | Valores observados |
|---|---|
| Fundo predominante | `#ffffff` |
| Ação principal | `#1abc9c` |
| Links / destaque | `#16a085` |
| Texto | `#1d1d1d`, `#333333`, `#666666`, `#999999` |
| Família declarada no estilo medido | `proxima-nova, Lato, Lucida Sans Unicode, Lucida Grande, sans-serif` |
| Tamanhos encontrados | 12, 13, 14, 16 e 24 px |
| Pesos recorrentes | 400, 500 e 600 |
| Espaçamentos recorrentes | 10, 11, 12, 15 e 25 px |

A família declarada não comprova qual fonte foi efetivamente renderizada. O coletor também retornou um peso `20`, tratado como anomalia e não como token de design.

## Observação visual auxiliar do Client Gallery

Barra lateral clara, divisória vertical discreta, ícones de contorno, título grande, amplo espaço vazio e ação verde no onboarding. Coleções, Biblioteca, Favoritos e Lixeira formam um primeiro grupo; Página inicial e Configurações ficam abaixo; há um indicador de armazenamento no rodapé. Valores exatos, comportamento móvel e animações desse painel ainda não foram medidos.

## Aplicação ao SeuAlbum

Preservar Poppins/Open Sans e a identidade do SeuAlbum. Reaproveitar princípios de hierarquia, agrupamento e clareza de ação, sem importar fontes, ícones, marca ou recursos do Pixieset. Os tokens do login não representam necessariamente os painéis modernos do Client Gallery.

## Padrões dos painéis observados visualmente

| Contexto | Padrão | Precisão |
|---|---|---|
| Gallery | Sidebar clara, ícones de contorno, item ativo discreto, cota ao pé e espaço de respiro | Visual; sem medidas exatas |
| Store | Navegação horizontal, sublinhado ativo, miolo limitado e ação alinhada ao título | Visual |
| Studio | Sidebar por ferramenta, submenus contextuais, tabelas/quadro e cards de estado vazio | Visual |
| Editor de e-mail | Campos à esquerda e prévia à direita, salvar separado | Desktop apenas |
| Website | Miniaturas grandes por categoria e prévia antes de aplicar | Não representa editor publicado |

Branding do Studio exibiu fundo `#F3F3F3` e destaque `#1D1D1D`, além do rótulo Sans serif. São valores visíveis de um tema de documentos/e-mails; não medidas do CSS do painel.

Componentes candidatos ao SeuAlbum: sidebar agrupada, abas, cabeçalho com ação, filtros, tabela com busca, cards de etapa, empty state com próxima ação, cota, aviso de upgrade, prévia e seletor de tema. Manter Lucide e os componentes locais quando adequados.

## Responsividade e microinterações: lacunas

Não foram medidos breakpoints, duração de animação, foco por teclado, hover completo ou comportamento móvel dos painéis. O menu Add Product e a prévia do Website foram observados. As imagens de 1440/390 px do demo público mostram a verificação de acesso, cujos tokens devem ser excluídos do design system do produto.

Validação futura: sidebar recolhida, filtros, ações em lote, tabelas com overflow, lightbox, foco em modais, retorno à origem e alvos de toque. Não declarar essas características como verificadas no Pixieset.
