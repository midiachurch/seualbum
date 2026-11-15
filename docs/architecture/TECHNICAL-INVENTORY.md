# Inventário técnico estático

Data: 15/11/2026. Extração dos arquivos locais; não executa código/SQL nem consulta infraestrutura. Não é o schema efetivamente implantado. Regex enumera nomes, não resolve SQL dinâmico, sobrecargas ou policies finais. Schema legado excluído.

54 páginas; 19 handlers; 136 componentes TSX; 88 arquivos de biblioteca/action sem testes; 42 migrations.

## Páginas

| Rota derivada do arquivo | Fonte |
|---|---|
| `/admin/albuns/[id]` | [src/app/admin/albuns/[id]/page.tsx](../../src/app/admin/albuns/[id]/page.tsx) |
| `/admin/albuns` | [src/app/admin/albuns/page.tsx](../../src/app/admin/albuns/page.tsx) |
| `/admin/catalogo/adicionais` | [src/app/admin/catalogo/adicionais/page.tsx](../../src/app/admin/catalogo/adicionais/page.tsx) |
| `/admin/catalogo` | [src/app/admin/catalogo/page.tsx](../../src/app/admin/catalogo/page.tsx) |
| `/admin/clientes/[id]` | [src/app/admin/clientes/[id]/page.tsx](../../src/app/admin/clientes/[id]/page.tsx) |
| `/admin/clientes` | [src/app/admin/clientes/page.tsx](../../src/app/admin/clientes/page.tsx) |
| `/admin/design` | [src/app/admin/design/page.tsx](../../src/app/admin/design/page.tsx) |
| `/admin/diagramacao` | [src/app/admin/diagramacao/page.tsx](../../src/app/admin/diagramacao/page.tsx) |
| `/admin/diagramacao/templates` | [src/app/admin/diagramacao/templates/page.tsx](../../src/app/admin/diagramacao/templates/page.tsx) |
| `/admin/equipe` | [src/app/admin/equipe/page.tsx](../../src/app/admin/equipe/page.tsx) |
| `/admin/fotografos/[id]` | [src/app/admin/fotografos/[id]/page.tsx](../../src/app/admin/fotografos/[id]/page.tsx) |
| `/admin/fotografos` | [src/app/admin/fotografos/page.tsx](../../src/app/admin/fotografos/page.tsx) |
| `/admin/mensagens` | [src/app/admin/mensagens/page.tsx](../../src/app/admin/mensagens/page.tsx) |
| `/admin/midia` | [src/app/admin/midia/page.tsx](../../src/app/admin/midia/page.tsx) |
| `/admin` | [src/app/admin/page.tsx](../../src/app/admin/page.tsx) |
| `/admin/pedidos/[id]` | [src/app/admin/pedidos/[id]/page.tsx](../../src/app/admin/pedidos/[id]/page.tsx) |
| `/admin/pedidos` | [src/app/admin/pedidos/page.tsx](../../src/app/admin/pedidos/page.tsx) |
| `/admin/producao/grafica/[id]` | [src/app/admin/producao/grafica/[id]/page.tsx](../../src/app/admin/producao/grafica/[id]/page.tsx) |
| `/admin/producao/grafica` | [src/app/admin/producao/grafica/page.tsx](../../src/app/admin/producao/grafica/page.tsx) |
| `/admin/producao` | [src/app/admin/producao/page.tsx](../../src/app/admin/producao/page.tsx) |
| `/admin/projetos/[id]/editor` | [src/app/admin/projetos/[id]/editor/page.tsx](../../src/app/admin/projetos/[id]/editor/page.tsx) |
| `/admin/projetos/[id]` | [src/app/admin/projetos/[id]/page.tsx](../../src/app/admin/projetos/[id]/page.tsx) |
| `/admin/projetos/[id]/prova` | [src/app/admin/projetos/[id]/prova/page.tsx](../../src/app/admin/projetos/[id]/prova/page.tsx) |
| `/admin/projetos/novo` | [src/app/admin/projetos/novo/page.tsx](../../src/app/admin/projetos/novo/page.tsx) |
| `/admin/projetos` | [src/app/admin/projetos/page.tsx](../../src/app/admin/projetos/page.tsx) |
| `/admin/vitrine/banners` | [src/app/admin/vitrine/banners/page.tsx](../../src/app/admin/vitrine/banners/page.tsx) |
| `/admin/vitrine/paginas` | [src/app/admin/vitrine/paginas/page.tsx](../../src/app/admin/vitrine/paginas/page.tsx) |
| `/admin/vitrine/portfolio/[id]` | [src/app/admin/vitrine/portfolio/[id]/page.tsx](../../src/app/admin/vitrine/portfolio/[id]/page.tsx) |
| `/admin/vitrine/portfolio` | [src/app/admin/vitrine/portfolio/page.tsx](../../src/app/admin/vitrine/portfolio/page.tsx) |
| `/album/[token]` | [src/app/album/[token]/page.tsx](../../src/app/album/[token]/page.tsx) |
| `/albuns` | [src/app/albuns/page.tsx](../../src/app/albuns/page.tsx) |
| `/auth/login` | [src/app/auth/login/page.tsx](../../src/app/auth/login/page.tsx) |
| `/auth/register` | [src/app/auth/register/page.tsx](../../src/app/auth/register/page.tsx) |
| `/cliente/mensagens` | [src/app/cliente/mensagens/page.tsx](../../src/app/cliente/mensagens/page.tsx) |
| `/cliente` | [src/app/cliente/page.tsx](../../src/app/cliente/page.tsx) |
| `/cliente/projetos/[id]` | [src/app/cliente/projetos/[id]/page.tsx](../../src/app/cliente/projetos/[id]/page.tsx) |
| `/cliente/projetos/[id]/prova` | [src/app/cliente/projetos/[id]/prova/page.tsx](../../src/app/cliente/projetos/[id]/prova/page.tsx) |
| `/como-funciona` | [src/app/como-funciona/page.tsx](../../src/app/como-funciona/page.tsx) |
| `/criar-album` | [src/app/criar-album/page.tsx](../../src/app/criar-album/page.tsx) |
| `/dashboard/albuns/[id]/mensagens` | [src/app/dashboard/albuns/[id]/mensagens/page.tsx](../../src/app/dashboard/albuns/[id]/mensagens/page.tsx) |
| `/dashboard/albuns/[id]/prova` | [src/app/dashboard/albuns/[id]/prova/page.tsx](../../src/app/dashboard/albuns/[id]/prova/page.tsx) |
| `/dashboard/catalogo` | [src/app/dashboard/catalogo/page.tsx](../../src/app/dashboard/catalogo/page.tsx) |
| `/dashboard/mensagens` | [src/app/dashboard/mensagens/page.tsx](../../src/app/dashboard/mensagens/page.tsx) |
| `/dashboard/meus-albuns` | [src/app/dashboard/meus-albuns/page.tsx](../../src/app/dashboard/meus-albuns/page.tsx) |
| `/dashboard/novo-pedido` | [src/app/dashboard/novo-pedido/page.tsx](../../src/app/dashboard/novo-pedido/page.tsx) |
| `/dashboard/orcamentos` | [src/app/dashboard/orcamentos/page.tsx](../../src/app/dashboard/orcamentos/page.tsx) |
| `/dashboard` | [src/app/dashboard/page.tsx](../../src/app/dashboard/page.tsx) |
| `/editor-preview` | [src/app/editor-preview/page.tsx](../../src/app/editor-preview/page.tsx) |
| `/orcamento/[hash]` | [src/app/orcamento/[hash]/page.tsx](../../src/app/orcamento/[hash]/page.tsx) |
| `/p/[slug]` | [src/app/p/[slug]/page.tsx](../../src/app/p/[slug]/page.tsx) |
| `/` | [src/app/page.tsx](../../src/app/page.tsx) |
| `/portfolio` | [src/app/portfolio/page.tsx](../../src/app/portfolio/page.tsx) |
| `/precos` | [src/app/precos/page.tsx](../../src/app/precos/page.tsx) |
| `/servicos` | [src/app/servicos/page.tsx](../../src/app/servicos/page.tsx) |

## Route Handlers

| Rota | Métodos exportados | Fonte |
|---|---|---|
| `/api/cron/limpar-fotos-r2` | GET | [src/app/api/cron/limpar-fotos-r2/route.ts](../../src/app/api/cron/limpar-fotos-r2/route.ts) |
| `/api/cron/reconhecimento-facial` | GET | [src/app/api/cron/reconhecimento-facial/route.ts](../../src/app/api/cron/reconhecimento-facial/route.ts) |
| `/api/reconhecimento/buscar` | POST | [src/app/api/reconhecimento/buscar/route.ts](../../src/app/api/reconhecimento/buscar/route.ts) |
| `/api/reconhecimento/indexar` | POST | [src/app/api/reconhecimento/indexar/route.ts](../../src/app/api/reconhecimento/indexar/route.ts) |
| `/api/uploads/album` | POST | [src/app/api/uploads/album/route.ts](../../src/app/api/uploads/album/route.ts) |
| `/api/uploads/lamina` | POST | [src/app/api/uploads/lamina/route.ts](../../src/app/api/uploads/lamina/route.ts) |
| `/api/uploads/logo/confirmar` | POST | [src/app/api/uploads/logo/confirmar/route.ts](../../src/app/api/uploads/logo/confirmar/route.ts) |
| `/api/uploads/logo` | POST | [src/app/api/uploads/logo/route.ts](../../src/app/api/uploads/logo/route.ts) |
| `/api/uploads/midia/confirmar` | POST | [src/app/api/uploads/midia/confirmar/route.ts](../../src/app/api/uploads/midia/confirmar/route.ts) |
| `/api/uploads/midia` | POST | [src/app/api/uploads/midia/route.ts](../../src/app/api/uploads/midia/route.ts) |
| `/api/uploads/pedido-foto/confirmar` | POST | [src/app/api/uploads/pedido-foto/confirmar/route.ts](../../src/app/api/uploads/pedido-foto/confirmar/route.ts) |
| `/api/uploads/pedido-foto` | POST, DELETE | [src/app/api/uploads/pedido-foto/route.ts](../../src/app/api/uploads/pedido-foto/route.ts) |
| `/api/uploads/projeto-foto/confirmar` | POST | [src/app/api/uploads/projeto-foto/confirmar/route.ts](../../src/app/api/uploads/projeto-foto/confirmar/route.ts) |
| `/api/uploads/projeto-foto` | POST, DELETE | [src/app/api/uploads/projeto-foto/route.ts](../../src/app/api/uploads/projeto-foto/route.ts) |
| `/api/webhooks/pagamento` | POST | [src/app/api/webhooks/pagamento/route.ts](../../src/app/api/webhooks/pagamento/route.ts) |
| `/api/webhooks/status` | POST | [src/app/api/webhooks/status/route.ts](../../src/app/api/webhooks/status/route.ts) |
| `/auth/callback` | GET | [src/app/auth/callback/route.ts](../../src/app/auth/callback/route.ts) |
| `/auth/demo-login` | POST | [src/app/auth/demo-login/route.ts](../../src/app/auth/demo-login/route.ts) |
| `/auth/signout` | POST | [src/app/auth/signout/route.ts](../../src/app/auth/signout/route.ts) |

## Actions e exports

| Arquivo | Funções exportadas extraídas |
|---|---|
| [src/lib/actions/adicionais-admin.ts](../../src/lib/actions/adicionais-admin.ts) | `criarAdicional`, `atualizarAdicional`, `alternarAdicionalAtivo`, `reordenarAdicionais` |
| [src/lib/actions/album-aprovacao-publica.ts](../../src/lib/actions/album-aprovacao-publica.ts) | `comentarNoAlbum`, `decidirAlbum` |
| [src/lib/actions/album-editor.ts](../../src/lib/actions/album-editor.ts) | `criarAlbumAvulso`, `criarLayoutDoProjeto`, `salvarDocumentoAlbum`, `atualizarMiniatura`, `atualizarDadosAlbum`, `registrarFotosAlbum`, `listarFotosDoEditor`, `removerFotoAlbum`, `renovarLinksDasFotos`, `listarVersoesAlbum`, `salvarVersaoManual`, `obterVersaoAlbum`, `duplicarAlbum`, `listarAprovacoesAlbum`, `criarAprovacao`, `cancelarAprovacao`, `resolverComentarioAlbum`, `responderComentarioAlbum`, `finalizarAlbum`, `reabrirAlbum`, `excluirAlbumAvulso`, `recarregarAlbum`, `salvarDerivados`, `salvarBiblioteca`, `arquivarAlbum`, `enviarParaProducao`, `listarTemplates`, `salvarTemplate`, `favoritarTemplate`, `registrarUsoTemplate`, `excluirTemplate` |
| [src/lib/actions/catalogo-estudio.ts](../../src/lib/actions/catalogo-estudio.ts) | `salvarCatalogoEstudio` |
| [src/lib/actions/contas.ts](../../src/lib/actions/contas.ts) | `createTeamAccount`, `createClienteRecord`, `createClientAccount` |
| [src/lib/actions/crm.ts](../../src/lib/actions/crm.ts) | `marcarAlertaCrm`, `rodarAlertasCrm` |
| [src/lib/actions/dev-login.ts](../../src/lib/actions/dev-login.ts) | `devLoginAction`, `perfisDevConfigurados` |
| [src/lib/actions/diagramacao.ts](../../src/lib/actions/diagramacao.ts) | `atribuirDiagramacao`, `definirPrazoDiagramacao`, `definirPrioridadeDiagramacao`, `definirEsperaDiagramacao`, `renomearTemplateAlbum`, `definirTemplateAtivo` |
| [src/lib/actions/expedicao.ts](../../src/lib/actions/expedicao.ts) | `despacharProjeto` |
| [src/lib/actions/faturamento.ts](../../src/lib/actions/faturamento.ts) | `pagarLaminasExtras`, `dispensarCobranca` |
| [src/lib/actions/mensagens.ts](../../src/lib/actions/mensagens.ts) | `abrirConversa`, `listarConversas`, `listarMensagens`, `enviarMensagem`, `marcarComoLida`, `contarNaoLidas`, `apagarMensagem` |
| [src/lib/actions/orcamentos.ts](../../src/lib/actions/orcamentos.ts) | `createOrcamento`, `updateOrcamento`, `markOrcamentoEnviado`, `deleteOrcamento` |
| [src/lib/actions/pagamentos.ts](../../src/lib/actions/pagamentos.ts) | `iniciarPagamentoAction`, `iniciarPagamentoFaturaAction` |
| [src/lib/actions/paginas.ts](../../src/lib/actions/paginas.ts) | `createPagina`, `updatePagina`, `deletePagina` |
| [src/lib/actions/painel-cliente.ts](../../src/lib/actions/painel-cliente.ts) | `marcarLaminaRevisada` |
| [src/lib/actions/pedidos-admin.ts](../../src/lib/actions/pedidos-admin.ts) | `gerarLinksDownloadAction` |
| [src/lib/actions/pedidos.ts](../../src/lib/actions/pedidos.ts) | `criarPedidoAction` |
| [src/lib/actions/projetos.ts](../../src/lib/actions/projetos.ts) | `createProjeto`, `updateProjetoStatus`, `assignProjeto`, `addDesignVersion`, `criarVersaoComLaminas`, `createSmartLayoutVersion`, `reviewDesignVersion`, `clientApprove`, `clientRequestChanges`, `addProofComment`, `marcarComentarioResolvido`, `toggleTeamMemberStatus` |
| [src/lib/actions/prova-fotografo.ts](../../src/lib/actions/prova-fotografo.ts) | `fotografoAprovar`, `decidirAdicional`, `fotografoPedirAjustes`, `fotografoComentar` |
| [src/lib/actions/reconhecimento.ts](../../src/lib/actions/reconhecimento.ts) | `definirReconhecimentoFacial`, `destacarFotosNoAlbum`, `registrarEventoAnalitico` |
| [src/lib/actions/vitrine.ts](../../src/lib/actions/vitrine.ts) | `deleteMediaAsset`, `createBanner`, `updateBanner`, `deleteBanner`, `toggleBannerActive`, `reorderBanners`, `createCollection`, `updateCollection`, `deleteCollection`, `addPortfolioItems`, `removePortfolioItem`, `setCollectionCover` |

## Componentes

- [src/components/admin/adicionais-manager.tsx](../../src/components/admin/adicionais-manager.tsx)
- [src/components/admin/admin-sidebar.tsx](../../src/components/admin/admin-sidebar.tsx)
- [src/components/admin/catalog-manager.tsx](../../src/components/admin/catalog-manager.tsx)
- [src/components/admin/clients-table.tsx](../../src/components/admin/clients-table.tsx)
- [src/components/admin/crm/retencao-card.tsx](../../src/components/admin/crm/retencao-card.tsx)
- [src/components/admin/design/design-queue.tsx](../../src/components/admin/design/design-queue.tsx)
- [src/components/admin/diagramacao/controle-diagramacao.tsx](../../src/components/admin/diagramacao/controle-diagramacao.tsx)
- [src/components/admin/diagramacao/resumo-diagramacao.tsx](../../src/components/admin/diagramacao/resumo-diagramacao.tsx)
- [src/components/admin/diagramacao/templates-manager.tsx](../../src/components/admin/diagramacao/templates-manager.tsx)
- [src/components/admin/media/media-library.tsx](../../src/components/admin/media/media-library.tsx)
- [src/components/admin/media/media-picker-modal.tsx](../../src/components/admin/media/media-picker-modal.tsx)
- [src/components/admin/pedidos/order-media-card.tsx](../../src/components/admin/pedidos/order-media-card.tsx)
- [src/components/admin/photographers-table.tsx](../../src/components/admin/photographers-table.tsx)
- [src/components/admin/production/barcode.tsx](../../src/components/admin/production/barcode.tsx)
- [src/components/admin/production/despacho-manager.tsx](../../src/components/admin/production/despacho-manager.tsx)
- [src/components/admin/production/ordem-servico.tsx](../../src/components/admin/production/ordem-servico.tsx)
- [src/components/admin/production/production-queue.tsx](../../src/components/admin/production/production-queue.tsx)
- [src/components/admin/production/sla-badge.tsx](../../src/components/admin/production/sla-badge.tsx)
- [src/components/admin/projects/assignment-control.tsx](../../src/components/admin/projects/assignment-control.tsx)
- [src/components/admin/projects/cobranca-laminas-card.tsx](../../src/components/admin/projects/cobranca-laminas-card.tsx)
- [src/components/admin/projects/communication-history.tsx](../../src/components/admin/projects/communication-history.tsx)
- [src/components/admin/projects/design-versions-panel.tsx](../../src/components/admin/projects/design-versions-panel.tsx)
- [src/components/admin/projects/fotos-por-cena.tsx](../../src/components/admin/projects/fotos-por-cena.tsx)
- [src/components/admin/projects/laminas-parciais.tsx](../../src/components/admin/projects/laminas-parciais.tsx)
- [src/components/admin/projects/laminas-upload.tsx](../../src/components/admin/projects/laminas-upload.tsx)
- [src/components/admin/projects/new-project-wizard.tsx](../../src/components/admin/projects/new-project-wizard.tsx)
- [src/components/admin/projects/project-status-badge.tsx](../../src/components/admin/projects/project-status-badge.tsx)
- [src/components/admin/projects/project-workspace.tsx](../../src/components/admin/projects/project-workspace.tsx)
- [src/components/admin/projects/projects-board.tsx](../../src/components/admin/projects/projects-board.tsx)
- [src/components/admin/projects/reconhecimento-facial-card.tsx](../../src/components/admin/projects/reconhecimento-facial-card.tsx)
- [src/components/admin/projects/upload-dropzone.tsx](../../src/components/admin/projects/upload-dropzone.tsx)
- [src/components/admin/projects/visual-option-cards.tsx](../../src/components/admin/projects/visual-option-cards.tsx)
- [src/components/admin/send-proof-action.tsx](../../src/components/admin/send-proof-action.tsx)
- [src/components/admin/team-table.tsx](../../src/components/admin/team-table.tsx)
- [src/components/admin/vitrine/banners-manager.tsx](../../src/components/admin/vitrine/banners-manager.tsx)
- [src/components/admin/vitrine/collection-detail.tsx](../../src/components/admin/vitrine/collection-detail.tsx)
- [src/components/admin/vitrine/paginas-manager.tsx](../../src/components/admin/vitrine/paginas-manager.tsx)
- [src/components/admin/vitrine/portfolio-manager.tsx](../../src/components/admin/vitrine/portfolio-manager.tsx)
- [src/components/album-editor/abrir-editor-do-projeto.tsx](../../src/components/album-editor/abrir-editor-do-projeto.tsx)
- [src/components/album-editor/albuns-hub.tsx](../../src/components/album-editor/albuns-hub.tsx)
- [src/components/album-editor/aprovacao-cliente.tsx](../../src/components/album-editor/aprovacao-cliente.tsx)
- [src/components/album-editor/aprovacao-painel.tsx](../../src/components/album-editor/aprovacao-painel.tsx)
- [src/components/album-editor/barra-editor.tsx](../../src/components/album-editor/barra-editor.tsx)
- [src/components/album-editor/camadas.tsx](../../src/components/album-editor/camadas.tsx)
- [src/components/album-editor/canvas-lamina.tsx](../../src/components/album-editor/canvas-lamina.tsx)
- [src/components/album-editor/editor-album.tsx](../../src/components/album-editor/editor-album.tsx)
- [src/components/album-editor/fita-laminas.tsx](../../src/components/album-editor/fita-laminas.tsx)
- [src/components/album-editor/flipbook.tsx](../../src/components/album-editor/flipbook.tsx)
- [src/components/album-editor/historico.tsx](../../src/components/album-editor/historico.tsx)
- [src/components/album-editor/inspetor.tsx](../../src/components/album-editor/inspetor.tsx)
- [src/components/album-editor/miniatura-lamina.tsx](../../src/components/album-editor/miniatura-lamina.tsx)
- [src/components/album-editor/paineis-simples.tsx](../../src/components/album-editor/paineis-simples.tsx)
- [src/components/album-editor/painel-fotos.tsx](../../src/components/album-editor/painel-fotos.tsx)
- [src/components/album-editor/painel-layouts.tsx](../../src/components/album-editor/painel-layouts.tsx)
- [src/components/album-editor/painel-modelos.tsx](../../src/components/album-editor/painel-modelos.tsx)
- [src/components/album-editor/publicar.tsx](../../src/components/album-editor/publicar.tsx)
- [src/components/album-editor/visualizacao.tsx](../../src/components/album-editor/visualizacao.tsx)
- [src/components/auth/dev-login-panel.tsx](../../src/components/auth/dev-login-panel.tsx)
- [src/components/auth/google-button.tsx](../../src/components/auth/google-button.tsx)
- [src/components/auth/login-form.tsx](../../src/components/auth/login-form.tsx)
- [src/components/auth/register-form.tsx](../../src/components/auth/register-form.tsx)
- [src/components/cliente/attention-card.tsx](../../src/components/cliente/attention-card.tsx)
- [src/components/cliente/client-bottom-nav.tsx](../../src/components/cliente/client-bottom-nav.tsx)
- [src/components/cliente/client-photos-manager.tsx](../../src/components/cliente/client-photos-manager.tsx)
- [src/components/cliente/client-project-card.tsx](../../src/components/cliente/client-project-card.tsx)
- [src/components/cliente/client-stage-badge.tsx](../../src/components/cliente/client-stage-badge.tsx)
- [src/components/cliente/encontrar-minhas-fotos.tsx](../../src/components/cliente/encontrar-minhas-fotos.tsx)
- [src/components/cliente/no-projects-empty-state.tsx](../../src/components/cliente/no-projects-empty-state.tsx)
- [src/components/cliente/painel/painel-aprovacao.tsx](../../src/components/cliente/painel/painel-aprovacao.tsx)
- [src/components/cliente/painel/prova-aguardando-card.tsx](../../src/components/cliente/painel/prova-aguardando-card.tsx)
- [src/components/cliente/previa-album-aberto.tsx](../../src/components/cliente/previa-album-aberto.tsx)
- [src/components/cliente/project-hub.tsx](../../src/components/cliente/project-hub.tsx)
- [src/components/cliente/project-timeline.tsx](../../src/components/cliente/project-timeline.tsx)
- [src/components/cliente/proof/comparador-versoes.tsx](../../src/components/cliente/proof/comparador-versoes.tsx)
- [src/components/cliente/proof/proof-viewer.tsx](../../src/components/cliente/proof/proof-viewer.tsx)
- [src/components/dashboard/album-thumb.tsx](../../src/components/dashboard/album-thumb.tsx)
- [src/components/dashboard/catalogo-estudio.tsx](../../src/components/dashboard/catalogo-estudio.tsx)
- [src/components/dashboard/cobrancas-laminas-extras.tsx](../../src/components/dashboard/cobrancas-laminas-extras.tsx)
- [src/components/dashboard/dashboard-nav.tsx](../../src/components/dashboard/dashboard-nav.tsx)
- [src/components/dashboard/novo-pedido/steps/field.tsx](../../src/components/dashboard/novo-pedido/steps/field.tsx)
- [src/components/dashboard/novo-pedido/steps/step-briefing.tsx](../../src/components/dashboard/novo-pedido/steps/step-briefing.tsx)
- [src/components/dashboard/novo-pedido/steps/step-fotos.tsx](../../src/components/dashboard/novo-pedido/steps/step-fotos.tsx)
- [src/components/dashboard/novo-pedido/steps/step-plano.tsx](../../src/components/dashboard/novo-pedido/steps/step-plano.tsx)
- [src/components/dashboard/novo-pedido/steps/step-projeto.tsx](../../src/components/dashboard/novo-pedido/steps/step-projeto.tsx)
- [src/components/dashboard/novo-pedido/steps/step-revisao.tsx](../../src/components/dashboard/novo-pedido/steps/step-revisao.tsx)
- [src/components/dashboard/novo-pedido/wizard-footer.tsx](../../src/components/dashboard/novo-pedido/wizard-footer.tsx)
- [src/components/dashboard/novo-pedido/wizard.tsx](../../src/components/dashboard/novo-pedido/wizard.tsx)
- [src/components/dashboard/orcamentos-manager.tsx](../../src/components/dashboard/orcamentos-manager.tsx)
- [src/components/editor/album-editor-preview.tsx](../../src/components/editor/album-editor-preview.tsx)
- [src/components/editor/element-controls.tsx](../../src/components/editor/element-controls.tsx)
- [src/components/editor/media-library-panel.tsx](../../src/components/editor/media-library-panel.tsx)
- [src/components/editor/page-filmstrip.tsx](../../src/components/editor/page-filmstrip.tsx)
- [src/components/layout/site-footer.tsx](../../src/components/layout/site-footer.tsx)
- [src/components/layout/site-header.tsx](../../src/components/layout/site-header.tsx)
- [src/components/marketing/billing-toggle.tsx](../../src/components/marketing/billing-toggle.tsx)
- [src/components/marketing/cta-band.tsx](../../src/components/marketing/cta-band.tsx)
- [src/components/marketing/cta-buttons.tsx](../../src/components/marketing/cta-buttons.tsx)
- [src/components/marketing/design-styles.tsx](../../src/components/marketing/design-styles.tsx)
- [src/components/marketing/editorial-split.tsx](../../src/components/marketing/editorial-split.tsx)
- [src/components/marketing/faq.tsx](../../src/components/marketing/faq.tsx)
- [src/components/marketing/feature-comparison.tsx](../../src/components/marketing/feature-comparison.tsx)
- [src/components/marketing/final-cta.tsx](../../src/components/marketing/final-cta.tsx)
- [src/components/marketing/hero-carousel.tsx](../../src/components/marketing/hero-carousel.tsx)
- [src/components/marketing/hero.tsx](../../src/components/marketing/hero.tsx)
- [src/components/marketing/how-it-works.tsx](../../src/components/marketing/how-it-works.tsx)
- [src/components/marketing/order-steps.tsx](../../src/components/marketing/order-steps.tsx)
- [src/components/marketing/page-coming-soon.tsx](../../src/components/marketing/page-coming-soon.tsx)
- [src/components/marketing/page-hero.tsx](../../src/components/marketing/page-hero.tsx)
- [src/components/marketing/plan-models.tsx](../../src/components/marketing/plan-models.tsx)
- [src/components/marketing/portfolio-showcase.tsx](../../src/components/marketing/portfolio-showcase.tsx)
- [src/components/marketing/pricing-card.tsx](../../src/components/marketing/pricing-card.tsx)
- [src/components/marketing/pricing-section.tsx](../../src/components/marketing/pricing-section.tsx)
- [src/components/marketing/text-image-gallery.tsx](../../src/components/marketing/text-image-gallery.tsx)
- [src/components/marketing/value-pillars.tsx](../../src/components/marketing/value-pillars.tsx)
- [src/components/mensagens/caixa-de-entrada.tsx](../../src/components/mensagens/caixa-de-entrada.tsx)
- [src/components/mensagens/conversa-thread.tsx](../../src/components/mensagens/conversa-thread.tsx)
- [src/components/mensagens/mensagens-do-cliente.tsx](../../src/components/mensagens/mensagens-do-cliente.tsx)
- [src/components/mensagens/nova-conversa.tsx](../../src/components/mensagens/nova-conversa.tsx)
- [src/components/mensagens/painel-mensagens-projeto.tsx](../../src/components/mensagens/painel-mensagens-projeto.tsx)
- [src/components/mensagens/selo-nao-lidas.tsx](../../src/components/mensagens/selo-nao-lidas.tsx)
- [src/components/orders/approve-order-action.tsx](../../src/components/orders/approve-order-action.tsx)
- [src/components/orders/pay-order-button.tsx](../../src/components/orders/pay-order-button.tsx)
- [src/components/orders/status-badge.tsx](../../src/components/orders/status-badge.tsx)
- [src/components/ui/accordion.tsx](../../src/components/ui/accordion.tsx)
- [src/components/ui/badge.tsx](../../src/components/ui/badge.tsx)
- [src/components/ui/button.tsx](../../src/components/ui/button.tsx)
- [src/components/ui/confirm-dialog.tsx](../../src/components/ui/confirm-dialog.tsx)
- [src/components/ui/editorial-image.tsx](../../src/components/ui/editorial-image.tsx)
- [src/components/ui/empty-state.tsx](../../src/components/ui/empty-state.tsx)
- [src/components/ui/input.tsx](../../src/components/ui/input.tsx)
- [src/components/ui/label.tsx](../../src/components/ui/label.tsx)
- [src/components/ui/modal.tsx](../../src/components/ui/modal.tsx)
- [src/components/ui/rich-text-editor.tsx](../../src/components/ui/rich-text-editor.tsx)
- [src/components/ui/simple-tabs.tsx](../../src/components/ui/simple-tabs.tsx)
- [src/components/ui/skeleton.tsx](../../src/components/ui/skeleton.tsx)
- [src/components/ui/switch.tsx](../../src/components/ui/switch.tsx)

## Bibliotecas e adaptadores

- [src/lib/adicionais.ts](../../src/lib/adicionais.ts)
- [src/lib/album/ajustes.ts](../../src/lib/album/ajustes.ts)
- [src/lib/album/derivados.ts](../../src/lib/album/derivados.ts)
- [src/lib/album/divisorias.ts](../../src/lib/album/divisorias.ts)
- [src/lib/album/documento.ts](../../src/lib/album/documento.ts)
- [src/lib/album/exportar.ts](../../src/lib/album/exportar.ts)
- [src/lib/album/fontes.ts](../../src/lib/album/fontes.ts)
- [src/lib/album/modelos.ts](../../src/lib/album/modelos.ts)
- [src/lib/album/ornamentos.ts](../../src/lib/album/ornamentos.ts)
- [src/lib/album/pdf.ts](../../src/lib/album/pdf.ts)
- [src/lib/album/preparar-projeto.ts](../../src/lib/album/preparar-projeto.ts)
- [src/lib/album/templates.ts](../../src/lib/album/templates.ts)
- [src/lib/album/texto.ts](../../src/lib/album/texto.ts)
- [src/lib/album/texturas.ts](../../src/lib/album/texturas.ts)
- [src/lib/album/verificacao.ts](../../src/lib/album/verificacao.ts)
- [src/lib/apontamento.ts](../../src/lib/apontamento.ts)
- [src/lib/cenas.ts](../../src/lib/cenas.ts)
- [src/lib/demo-data.ts](../../src/lib/demo-data.ts)
- [src/lib/demo-mode.ts](../../src/lib/demo-mode.ts)
- [src/lib/diagramacao/regras.ts](../../src/lib/diagramacao/regras.ts)
- [src/lib/dimensoes-imagem.ts](../../src/lib/dimensoes-imagem.ts)
- [src/lib/exif/exif.worker.ts](../../src/lib/exif/exif.worker.ts)
- [src/lib/exif/extrair.ts](../../src/lib/exif/extrair.ts)
- [src/lib/exif/index.ts](../../src/lib/exif/index.ts)
- [src/lib/imagens-locais.ts](../../src/lib/imagens-locais.ts)
- [src/lib/mappers.ts](../../src/lib/mappers.ts)
- [src/lib/mensagens-servidor.ts](../../src/lib/mensagens-servidor.ts)
- [src/lib/mensagens.ts](../../src/lib/mensagens.ts)
- [src/lib/mock-platform-data.ts](../../src/lib/mock-platform-data.ts)
- [src/lib/mock-projects-data.ts](../../src/lib/mock-projects-data.ts)
- [src/lib/mock-vitrine-data.ts](../../src/lib/mock-vitrine-data.ts)
- [src/lib/plano-vitrine.ts](../../src/lib/plano-vitrine.ts)
- [src/lib/preco.ts](../../src/lib/preco.ts)
- [src/lib/pricing.ts](../../src/lib/pricing.ts)
- [src/lib/prova/painel.ts](../../src/lib/prova/painel.ts)
- [src/lib/prova/versao-parcial.ts](../../src/lib/prova/versao-parcial.ts)
- [src/lib/r2/chaves.ts](../../src/lib/r2/chaves.ts)
- [src/lib/r2/cliente.ts](../../src/lib/r2/cliente.ts)
- [src/lib/r2/sessao.ts](../../src/lib/r2/sessao.ts)
- [src/lib/r2/varredura.ts](../../src/lib/r2/varredura.ts)
- [src/lib/redirect-seguro.ts](../../src/lib/redirect-seguro.ts)
- [src/lib/rekognition/cliente.ts](../../src/lib/rekognition/cliente.ts)
- [src/lib/rekognition/indexacao.ts](../../src/lib/rekognition/indexacao.ts)
- [src/lib/rekognition/regras.ts](../../src/lib/rekognition/regras.ts)
- [src/lib/rekognition/resumo.ts](../../src/lib/rekognition/resumo.ts)
- [src/lib/rekognition/selfie.ts](../../src/lib/rekognition/selfie.ts)
- [src/lib/resolucao.ts](../../src/lib/resolucao.ts)
- [src/lib/sanitizar-html.ts](../../src/lib/sanitizar-html.ts)
- [src/lib/segredo.ts](../../src/lib/segredo.ts)
- [src/lib/sla.ts](../../src/lib/sla.ts)
- [src/lib/smart-layout.ts](../../src/lib/smart-layout.ts)
- [src/lib/status-album.ts](../../src/lib/status-album.ts)
- [src/lib/stripe.ts](../../src/lib/stripe.ts)
- [src/lib/supabase/client.ts](../../src/lib/supabase/client.ts)
- [src/lib/supabase/diagramacao.ts](../../src/lib/supabase/diagramacao.ts)
- [src/lib/supabase/middleware.ts](../../src/lib/supabase/middleware.ts)
- [src/lib/supabase/queries.ts](../../src/lib/supabase/queries.ts)
- [src/lib/supabase/server.ts](../../src/lib/supabase/server.ts)
- [src/lib/telemetria.ts](../../src/lib/telemetria.ts)
- [src/lib/upload-album.ts](../../src/lib/upload-album.ts)
- [src/lib/upload-fotografo-logo.ts](../../src/lib/upload-fotografo-logo.ts)
- [src/lib/upload-lamina.ts](../../src/lib/upload-lamina.ts)
- [src/lib/upload-media-asset.ts](../../src/lib/upload-media-asset.ts)
- [src/lib/upload-pedido-foto.ts](../../src/lib/upload-pedido-foto.ts)
- [src/lib/upload-projeto-foto.ts](../../src/lib/upload-projeto-foto.ts)
- [src/lib/upload-r2.ts](../../src/lib/upload-r2.ts)
- [src/lib/utils.ts](../../src/lib/utils.ts)

## Migrations da cadeia local

- [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql)
- [supabase/migrations/20260921022756_0004_endurecer_funcoes.sql](../../supabase/migrations/20260921022756_0004_endurecer_funcoes.sql)
- [supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql](../../supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql)
- [supabase/migrations/20260921031107_0005_media_assets_select_publico.sql](../../supabase/migrations/20260921031107_0005_media_assets_select_publico.sql)
- [supabase/migrations/20260921031945_0006_webhook_status_aguardando_aprovacao.sql](../../supabase/migrations/20260921031945_0006_webhook_status_aguardando_aprovacao.sql)
- [supabase/migrations/20260921034141_0007_cerebro_operacional.sql](../../supabase/migrations/20260921034141_0007_cerebro_operacional.sql)
- [supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql](../../supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql)
- [supabase/migrations/20260921044231_0009_bucket_logo_fotografo.sql](../../supabase/migrations/20260921044231_0009_bucket_logo_fotografo.sql)
- [supabase/migrations/20260925234225_0010_pedidos_cliente_idempotencia.sql](../../supabase/migrations/20260925234225_0010_pedidos_cliente_idempotencia.sql)
- [supabase/migrations/20260925234425_0011_pedidos_fotos_storage.sql](../../supabase/migrations/20260925234425_0011_pedidos_fotos_storage.sql)
- [supabase/migrations/20260926000226_0012_pedidos_pagamento_stripe.sql](../../supabase/migrations/20260926000226_0012_pedidos_pagamento_stripe.sql)
- [supabase/migrations/20260926001117_0013_pedidos_assinatura_bypass.sql](../../supabase/migrations/20260926001117_0013_pedidos_assinatura_bypass.sql)
- [supabase/migrations/20260926003846_0014_signup_papel_confiavel.sql](../../supabase/migrations/20260926003846_0014_signup_papel_confiavel.sql)
- [supabase/migrations/20260926024721_0015_limpeza_fotos_orfas.sql](../../supabase/migrations/20260926024721_0015_limpeza_fotos_orfas.sql)
- [supabase/migrations/20260926032236_0016_limpeza_fotos_72h.sql](../../supabase/migrations/20260926032236_0016_limpeza_fotos_72h.sql)
- [supabase/migrations/20260926141859_0017_pedido_vira_projeto.sql](../../supabase/migrations/20260926141859_0017_pedido_vira_projeto.sql)
- [supabase/migrations/20260926150447_0018_laminas_e_apontamentos.sql](../../supabase/migrations/20260926150447_0018_laminas_e_apontamentos.sql)
- [supabase/migrations/20260927212258_0019_comentarios_resolvidos.sql](../../supabase/migrations/20260927212258_0019_comentarios_resolvidos.sql)
- [supabase/migrations/20260927230710_0020_papel_designer_enum.sql](../../supabase/migrations/20260927230710_0020_papel_designer_enum.sql)
- [supabase/migrations/20260927230855_0021_workspace_designer.sql](../../supabase/migrations/20260927230855_0021_workspace_designer.sql)
- [supabase/migrations/20260928010041_0022_status_pagamento_excedente_enum.sql](../../supabase/migrations/20260928010041_0022_status_pagamento_excedente_enum.sql)
- [supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql](../../supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql)
- [supabase/migrations/20260928015536_0024_crm_retencao.sql](../../supabase/migrations/20260928015536_0024_crm_retencao.sql)
- [supabase/migrations/20260928020123_0025_fotos_exif.sql](../../supabase/migrations/20260928020123_0025_fotos_exif.sql)
- [supabase/migrations/20260928021809_0026_upsell_adicionais.sql](../../supabase/migrations/20260928021809_0026_upsell_adicionais.sql)
- [supabase/migrations/20260928021852_0026b_upsell_fechamento.sql](../../supabase/migrations/20260928021852_0026b_upsell_fechamento.sql)
- [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql)
- [supabase/migrations/20261005000000_0028_login_google.sql](../../supabase/migrations/20261005000000_0028_login_google.sql)
- [supabase/migrations/20261005000100_0029_cron_limpeza_projeto_novo.sql](../../supabase/migrations/20261005000100_0029_cron_limpeza_projeto_novo.sql)
- [supabase/migrations/20261007000000_0030_pedidos_fotos_r2.sql](../../supabase/migrations/20261007000000_0030_pedidos_fotos_r2.sql)
- [supabase/migrations/20261008000000_0031_fotos_pedido_no_r2.sql](../../supabase/migrations/20261008000000_0031_fotos_pedido_no_r2.sql)
- [supabase/migrations/20261008000100_0032_prova_galeria_versao_parcial.sql](../../supabase/migrations/20261008000100_0032_prova_galeria_versao_parcial.sql)
- [supabase/migrations/20261009000000_0033_papel_app_metadata_pos_criacao.sql](../../supabase/migrations/20261009000000_0033_papel_app_metadata_pos_criacao.sql)
- [supabase/migrations/20261009000100_0034_demais_buckets_no_r2.sql](../../supabase/migrations/20261009000100_0034_demais_buckets_no_r2.sql)
- [supabase/migrations/20261009000200_0035_checkout_fatura_fechamento.sql](../../supabase/migrations/20261009000200_0035_checkout_fatura_fechamento.sql)
- [supabase/migrations/20261009000300_0036_travas_chaves_r2.sql](../../supabase/migrations/20261009000300_0036_travas_chaves_r2.sql)
- [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql)
- [supabase/migrations/20261009000500_0038_controle_diagramacao.sql](../../supabase/migrations/20261009000500_0038_controle_diagramacao.sql)
- [supabase/migrations/20261009000600_0039_painel_aprovacao_cliente.sql](../../supabase/migrations/20261009000600_0039_painel_aprovacao_cliente.sql)
- [supabase/migrations/20261009000700_0040_r2_uploads_pendentes.sql](../../supabase/migrations/20261009000700_0040_r2_uploads_pendentes.sql)
- [supabase/migrations/20261013000100_0041_travas_seguranca.sql](../../supabase/migrations/20261013000100_0041_travas_seguranca.sql)
- [supabase/migrations/20261021000100_0042_reconhecimento_facial.sql](../../supabase/migrations/20261021000100_0042_reconhecimento_facial.sql)

## Tabelas declaradas

| Nome | Declarações locais, em ordem de arquivo |
|---|---|
| `private.app_config` | [supabase/migrations/20260921031945_0006_webhook_status_aguardando_aprovacao.sql](../../supabase/migrations/20260921031945_0006_webhook_status_aguardando_aprovacao.sql#L21) |
| `public.adicionais` | [supabase/migrations/20260928021809_0026_upsell_adicionais.sql](../../supabase/migrations/20260928021809_0026_upsell_adicionais.sql#L26) |
| `public.adicionais_estudio` | [supabase/migrations/20260928021809_0026_upsell_adicionais.sql](../../supabase/migrations/20260928021809_0026_upsell_adicionais.sql#L57) |
| `public.album_aprovacao_comentarios` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L192) |
| `public.album_aprovacoes` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L175) |
| `public.album_layout_versoes` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L124) |
| `public.album_layouts` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L30) |
| `public.album_templates` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L149) |
| `public.aprovacoes` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L383) |
| `public.banners` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L464) |
| `public.clientes` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L259) |
| `public.comunicacoes_log` | [supabase/migrations/20260921034141_0007_cerebro_operacional.sql](../../supabase/migrations/20260921034141_0007_cerebro_operacional.sql#L14) |
| `public.conversa_leituras` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L87) |
| `public.conversas` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L42) |
| `public.design_versions` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L368) |
| `public.eventos_analiticos` | [supabase/migrations/20261021000100_0042_reconhecimento_facial.sql](../../supabase/migrations/20261021000100_0042_reconhecimento_facial.sql#L264) |
| `public.fatura_itens` | [supabase/migrations/20260928021809_0026_upsell_adicionais.sql](../../supabase/migrations/20260928021809_0026_upsell_adicionais.sql#L78) |
| `public.faturas` | [supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql](../../supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql#L86) |
| `public.fotografos` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L215) |
| `public.fotos` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L351) |
| `public.media_assets` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L451) |
| `public.mensagens` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L64) |
| `public.notificacoes_crm` | [supabase/migrations/20260928015536_0024_crm_retencao.sql](../../supabase/migrations/20260928015536_0024_crm_retencao.sql#L24) |
| `public.orcamentos` | [supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql](../../supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql#L242) |
| `public.orders` | [supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql](../../supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql#L16) |
| `public.paginas_conteudo` | [supabase/migrations/20260921034141_0007_cerebro_operacional.sql](../../supabase/migrations/20260921034141_0007_cerebro_operacional.sql#L156) |
| `public.pedidos_fotos_r2` | [supabase/migrations/20261007000000_0030_pedidos_fotos_r2.sql](../../supabase/migrations/20261007000000_0030_pedidos_fotos_r2.sql#L21) |
| `public.planos` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L185) |
| `public.portfolio_collections` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L481) |
| `public.portfolio_items` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L497) |
| `public.produtos` | [supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql](../../supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql#L17) |
| `public.profiles` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L63) |
| `public.projeto_atividades` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L395) |
| `public.projetos` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L288) |
| `public.prova_comentarios` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L405) |
| `public.prova_laminas_revisao` | [supabase/migrations/20261009000600_0039_painel_aprovacao_cliente.sql](../../supabase/migrations/20261009000600_0039_painel_aprovacao_cliente.sql#L26) |
| `public.r2_uploads_pendentes` | [supabase/migrations/20261009000700_0040_r2_uploads_pendentes.sql](../../supabase/migrations/20261009000700_0040_r2_uploads_pendentes.sql#L30) |
| `public.reconhecimento_buscas` | [supabase/migrations/20261021000100_0042_reconhecimento_facial.sql](../../supabase/migrations/20261021000100_0042_reconhecimento_facial.sql#L298) |
| `public.reconhecimento_fotos` | [supabase/migrations/20261021000100_0042_reconhecimento_facial.sql](../../supabase/migrations/20261021000100_0042_reconhecimento_facial.sql#L56) |
| `public.reconhecimento_projetos` | [supabase/migrations/20261021000100_0042_reconhecimento_facial.sql](../../supabase/migrations/20261021000100_0042_reconhecimento_facial.sql#L33) |
| `public.reconhecimento_rostos` | [supabase/migrations/20261021000100_0042_reconhecimento_facial.sql](../../supabase/migrations/20261021000100_0042_reconhecimento_facial.sql#L79) |
| `public.reconhecimento_rostos_remover` | [supabase/migrations/20261021000100_0042_reconhecimento_facial.sql](../../supabase/migrations/20261021000100_0042_reconhecimento_facial.sql#L97) |
| `public.versoes_laminas` | [supabase/migrations/20260926150447_0018_laminas_e_apontamentos.sql](../../supabase/migrations/20260926150447_0018_laminas_e_apontamentos.sql#L23) |

## Views declaradas

| Nome | Declarações locais, em ordem de arquivo |
|---|---|
| `public.diagramacao_itens` | [supabase/migrations/20261009000500_0038_controle_diagramacao.sql](../../supabase/migrations/20261009000500_0038_controle_diagramacao.sql#L157) |

## Funções SQL: nomes e declarações

| Nome | Declarações locais, em ordem de arquivo |
|---|---|
| `private.escapar_html` | [supabase/migrations/20261013000100_0041_travas_seguranca.sql](../../supabase/migrations/20261013000100_0041_travas_seguranca.sql#L399) |
| `public._autor_da_mensagem` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L159) |
| `public._captura_ou_nulo` | [supabase/migrations/20260928020123_0025_fotos_exif.sql](../../supabase/migrations/20260928020123_0025_fotos_exif.sql#L23) |
| `public._excedente_da_versao` | [supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql](../../supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql#L249) |
| `public._fatura_tem_item_aguardando` | [supabase/migrations/20260928021852_0026b_upsell_fechamento.sql](../../supabase/migrations/20260928021852_0026b_upsell_fechamento.sql#L66) |
| `public._liberar_para_impressao` | [supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql](../../supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql#L408) |
| `public._usuario_eh_equipe` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L146) |
| `public.abrir_conversa` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L433) |
| `public.album_aprovacao_comentar` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L254) |
| `public.album_aprovacao_decidir` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L283) |
| `public.album_aprovacao_publica` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L221) |
| `public.aplicar_aprovacao` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L419); [supabase/migrations/20260926141859_0017_pedido_vira_projeto.sql](../../supabase/migrations/20260926141859_0017_pedido_vira_projeto.sql#L258); [supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql](../../supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql#L330); [supabase/migrations/20260928021809_0026_upsell_adicionais.sql](../../supabase/migrations/20260928021809_0026_upsell_adicionais.sql#L276) |
| `public.aplicar_papel_do_app_metadata` | [supabase/migrations/20261009000000_0033_papel_app_metadata_pos_criacao.sql](../../supabase/migrations/20261009000000_0033_papel_app_metadata_pos_criacao.sql#L24) |
| `public.aprovacao_de_album_ativa` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L340) |
| `public.aprovar_prova` | [supabase/migrations/20260928021809_0026_upsell_adicionais.sql](../../supabase/migrations/20260928021809_0026_upsell_adicionais.sql#L213) |
| `public.calcular_excedente` | [supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql](../../supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql#L297) |
| `public.chave_r2_em_uso_por_projeto` | [supabase/migrations/20261009000300_0036_travas_chaves_r2.sql](../../supabase/migrations/20261009000300_0036_travas_chaves_r2.sql#L25) |
| `public.cliente_pode_revisar_lamina` | [supabase/migrations/20261009000600_0039_painel_aprovacao_cliente.sql](../../supabase/migrations/20261009000600_0039_painel_aprovacao_cliente.sql#L99) |
| `public.concluir_cadastro_google` | [supabase/migrations/20261005000000_0028_login_google.sql](../../supabase/migrations/20261005000000_0028_login_google.sql#L89) |
| `public.confirmar_pagamento_fatura` | [supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql](../../supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql#L465); [supabase/migrations/20260928021852_0026b_upsell_fechamento.sql](../../supabase/migrations/20260928021852_0026b_upsell_fechamento.sql#L115) |
| `public.consumir_upload_r2` | [supabase/migrations/20261009000700_0040_r2_uploads_pendentes.sql](../../supabase/migrations/20261009000700_0040_r2_uploads_pendentes.sql#L103) |
| `public.contar_mensagens_nao_lidas` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L532) |
| `public.conversas_validar` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L200) |
| `public.converter_pedido_em_projeto` | [supabase/migrations/20260926141859_0017_pedido_vira_projeto.sql](../../supabase/migrations/20260926141859_0017_pedido_vira_projeto.sql#L75); [supabase/migrations/20260928020123_0025_fotos_exif.sql](../../supabase/migrations/20260928020123_0025_fotos_exif.sql#L39); [supabase/migrations/20261008000000_0031_fotos_pedido_no_r2.sql](../../supabase/migrations/20261008000000_0031_fotos_pedido_no_r2.sql#L32) |
| `public.current_role_v` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L94) |
| `public.decidir_adicional` | [supabase/migrations/20260928021852_0026b_upsell_fechamento.sql](../../supabase/migrations/20260928021852_0026b_upsell_fechamento.sql#L11) |
| `public.definir_prazo_aprovacao` | [supabase/migrations/20260921034141_0007_cerebro_operacional.sql](../../supabase/migrations/20260921034141_0007_cerebro_operacional.sql#L120) |
| `public.definir_reconhecimento_facial` | [supabase/migrations/20261021000100_0042_reconhecimento_facial.sql](../../supabase/migrations/20261021000100_0042_reconhecimento_facial.sql#L132) |
| `public.diagramacao_resumo` | [supabase/migrations/20261009000500_0038_controle_diagramacao.sql](../../supabase/migrations/20261009000500_0038_controle_diagramacao.sql#L333) |
| `public.dispensar_fatura` | [supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql](../../supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql#L498); [supabase/migrations/20260928021852_0026b_upsell_fechamento.sql](../../supabase/migrations/20260928021852_0026b_upsell_fechamento.sql#L147) |
| `public.encerrar_reconhecimentos_vencidos` | [supabase/migrations/20261021000100_0042_reconhecimento_facial.sql](../../supabase/migrations/20261021000100_0042_reconhecimento_facial.sql#L166) |
| `public.favoritar_fotos` | [supabase/migrations/20261021000100_0042_reconhecimento_facial.sql](../../supabase/migrations/20261021000100_0042_reconhecimento_facial.sql#L222) |
| `public.fixar_autor_atividade` | [supabase/migrations/20261013000100_0041_travas_seguranca.sql](../../supabase/migrations/20261013000100_0041_travas_seguranca.sql#L275) |
| `public.fixar_franquia_pedido` | [supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql](../../supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql#L56) |
| `public.fotos_orfas_pedidos` | [supabase/migrations/20260926024721_0015_limpeza_fotos_orfas.sql](../../supabase/migrations/20260926024721_0015_limpeza_fotos_orfas.sql#L24); [supabase/migrations/20260926032236_0016_limpeza_fotos_72h.sql](../../supabase/migrations/20260926032236_0016_limpeza_fotos_72h.sql#L12) |
| `public.fotos_para_indexar` | [supabase/migrations/20261021000100_0042_reconhecimento_facial.sql](../../supabase/migrations/20261021000100_0042_reconhecimento_facial.sql#L197) |
| `public.fotos_validar_chave_r2` | [supabase/migrations/20261009000300_0036_travas_chaves_r2.sql](../../supabase/migrations/20261009000300_0036_travas_chaves_r2.sql#L41); [supabase/migrations/20261009000700_0040_r2_uploads_pendentes.sql](../../supabase/migrations/20261009000700_0040_r2_uploads_pendentes.sql#L130) |
| `public.franquia_do_projeto` | [supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql](../../supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql#L86) |
| `public.gerar_alertas_crm` | [supabase/migrations/20260928015536_0024_crm_retencao.sql](../../supabase/migrations/20260928015536_0024_crm_retencao.sql#L52) |
| `public.get_orcamento_publico` | [supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql](../../supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql#L281); [supabase/migrations/20261013000100_0041_travas_seguranca.sql](../../supabase/migrations/20261013000100_0041_travas_seguranca.sql#L372) |
| `public.guard_fotografo_admin_fields` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L235) |
| `public.guard_order_admin_fields` | [supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql](../../supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql#L49); [supabase/migrations/20260926000226_0012_pedidos_pagamento_stripe.sql](../../supabase/migrations/20260926000226_0012_pedidos_pagamento_stripe.sql#L34) |
| `public.guard_profile_role` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L162); [supabase/migrations/20261005000000_0028_login_google.sql](../../supabase/migrations/20261005000000_0028_login_google.sql#L71) |
| `public.guardar_campos_pedido` | [supabase/migrations/20261013000100_0041_travas_seguranca.sql](../../supabase/migrations/20261013000100_0041_travas_seguranca.sql#L185) |
| `public.guardar_campos_projeto` | [supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql](../../supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql#L167); [supabase/migrations/20261013000100_0041_travas_seguranca.sql](../../supabase/migrations/20261013000100_0041_travas_seguranca.sql#L303) |
| `public.guardar_controle_diagramacao` | [supabase/migrations/20261009000500_0038_controle_diagramacao.sql](../../supabase/migrations/20261009000500_0038_controle_diagramacao.sql#L78) |
| `public.guardar_insercao_fotografo` | [supabase/migrations/20261013000100_0041_travas_seguranca.sql](../../supabase/migrations/20261013000100_0041_travas_seguranca.sql#L67) |
| `public.guardar_insercao_projeto` | [supabase/migrations/20261013000100_0041_travas_seguranca.sql](../../supabase/migrations/20261013000100_0041_travas_seguranca.sql#L131) |
| `public.guardar_resolucao_comentario` | [supabase/migrations/20260927212258_0019_comentarios_resolvidos.sql](../../supabase/migrations/20260927212258_0019_comentarios_resolvidos.sql#L30) |
| `public.handle_new_user` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L135); [supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql](../../supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql#L136); [supabase/migrations/20260926003846_0014_signup_papel_confiavel.sql](../../supabase/migrations/20260926003846_0014_signup_papel_confiavel.sql#L22); [supabase/migrations/20260927230855_0021_workspace_designer.sql](../../supabase/migrations/20260927230855_0021_workspace_designer.sql#L47); [supabase/migrations/20261005000000_0028_login_google.sql](../../supabase/migrations/20261005000000_0028_login_google.sql#L25) |
| `public.is_admin` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L107) |
| `public.is_designer` | [supabase/migrations/20260927230855_0021_workspace_designer.sql](../../supabase/migrations/20260927230855_0021_workspace_designer.sql#L32) |
| `public.is_equipe` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L112); [supabase/migrations/20260927230855_0021_workspace_designer.sql](../../supabase/migrations/20260927230855_0021_workspace_designer.sql#L27) |
| `public.is_gestor_ou_admin` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L117) |
| `public.is_operacao` | [supabase/migrations/20260927230855_0021_workspace_designer.sql](../../supabase/migrations/20260927230855_0021_workspace_designer.sql#L37) |
| `public.listar_clientes_visiveis` | [supabase/migrations/20261013000100_0041_travas_seguranca.sql](../../supabase/migrations/20261013000100_0041_travas_seguranca.sql#L255) |
| `public.listar_conversas` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L567) |
| `public.marca_do_estudio_cliente` | [supabase/migrations/20261009000600_0039_painel_aprovacao_cliente.sql](../../supabase/migrations/20261009000600_0039_painel_aprovacao_cliente.sql#L151) |
| `public.marcar_alerta_crm` | [supabase/migrations/20260928015536_0024_crm_retencao.sql](../../supabase/migrations/20260928015536_0024_crm_retencao.sql#L166) |
| `public.marcar_conversa_lida` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L507) |
| `public.mensagem_sistema_status_projeto` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L632) |
| `public.mensagens_atualizar_conversa` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L337) |
| `public.mensagens_guardar_edicao` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L296) |
| `public.mensagens_preparar` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L234) |
| `public.minha_assinatura` | [supabase/migrations/20260926001117_0013_pedidos_assinatura_bypass.sql](../../supabase/migrations/20260926001117_0013_pedidos_assinatura_bypass.sql#L15); [supabase/migrations/20261013000100_0041_travas_seguranca.sql](../../supabase/migrations/20261013000100_0041_travas_seguranca.sql#L90) |
| `public.notificar_status_aguardando_aprovacao` | [supabase/migrations/20260921031945_0006_webhook_status_aguardando_aprovacao.sql](../../supabase/migrations/20260921031945_0006_webhook_status_aguardando_aprovacao.sql#L38); [supabase/migrations/20260927230855_0021_workspace_designer.sql](../../supabase/migrations/20260927230855_0021_workspace_designer.sql#L248) |
| `public.ofertas_da_prova` | [supabase/migrations/20260928021809_0026_upsell_adicionais.sql](../../supabase/migrations/20260928021809_0026_upsell_adicionais.sql#L168) |
| `public.pagamento_simulado_ativo` | [supabase/migrations/20261009000200_0035_checkout_fatura_fechamento.sql](../../supabase/migrations/20261009000200_0035_checkout_fatura_fechamento.sql#L39) |
| `public.pagar_fatura_e_aprovar` | [supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql](../../supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql#L126) |
| `public.pagar_fatura_simulada` | [supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql](../../supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql#L427); [supabase/migrations/20260928021852_0026b_upsell_fechamento.sql](../../supabase/migrations/20260928021852_0026b_upsell_fechamento.sql#L78) |
| `public.pedido_liberado_vira_projeto` | [supabase/migrations/20260926141859_0017_pedido_vira_projeto.sql](../../supabase/migrations/20260926141859_0017_pedido_vira_projeto.sql#L192) |
| `public.pode_escrever_conversa` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L123) |
| `public.pode_ver_conversa` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L100) |
| `public.pode_ver_projeto` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L325) |
| `public.preencher_revisao_lamina` | [supabase/migrations/20261009000600_0039_painel_aprovacao_cliente.sql](../../supabase/migrations/20261009000600_0039_painel_aprovacao_cliente.sql#L54) |
| `public.preparar_checkout_fatura` | [supabase/migrations/20261009000200_0035_checkout_fatura_fechamento.sql](../../supabase/migrations/20261009000200_0035_checkout_fatura_fechamento.sql#L56) |
| `public.projeto_herda_franquia_do_pedido` | [supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql](../../supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql#L112); [supabase/migrations/20261013000100_0041_travas_seguranca.sql](../../supabase/migrations/20261013000100_0041_travas_seguranca.sql#L223) |
| `public.r2_chaves_sem_referencia` | [supabase/migrations/20261009000700_0040_r2_uploads_pendentes.sql](../../supabase/migrations/20261009000700_0040_r2_uploads_pendentes.sql#L202) |
| `public.rascunhos_r2_expirados` | [supabase/migrations/20261008000000_0031_fotos_pedido_no_r2.sql](../../supabase/migrations/20261008000000_0031_fotos_pedido_no_r2.sql#L142); [supabase/migrations/20261009000300_0036_travas_chaves_r2.sql](../../supabase/migrations/20261009000300_0036_travas_chaves_r2.sql#L92) |
| `public.reconhecimento_rosto_para_remover` | [supabase/migrations/20261021000100_0042_reconhecimento_facial.sql](../../supabase/migrations/20261021000100_0042_reconhecimento_facial.sql#L107) |
| `public.registrar_busca_facial` | [supabase/migrations/20261021000100_0042_reconhecimento_facial.sql](../../supabase/migrations/20261021000100_0042_reconhecimento_facial.sql#L310) |
| `public.registrar_checkout_fatura` | [supabase/migrations/20261009000200_0035_checkout_fatura_fechamento.sql](../../supabase/migrations/20261009000200_0035_checkout_fatura_fechamento.sql#L98) |
| `public.registrar_comunicacao_status` | [supabase/migrations/20260921034141_0007_cerebro_operacional.sql](../../supabase/migrations/20260921034141_0007_cerebro_operacional.sql#L44); [supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql](../../supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql#L173); [supabase/migrations/20260927230855_0021_workspace_designer.sql](../../supabase/migrations/20260927230855_0021_workspace_designer.sql#L144); [supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql](../../supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql#L542); [supabase/migrations/20260928021852_0026b_upsell_fechamento.sql](../../supabase/migrations/20260928021852_0026b_upsell_fechamento.sql#L192); [supabase/migrations/20261013000100_0041_travas_seguranca.sql](../../supabase/migrations/20261013000100_0041_travas_seguranca.sql#L418) |
| `public.reservar_upload_r2` | [supabase/migrations/20261009000700_0040_r2_uploads_pendentes.sql](../../supabase/migrations/20261009000700_0040_r2_uploads_pendentes.sql#L62) |
| `public.rodar_alertas_crm` | [supabase/migrations/20260928015536_0024_crm_retencao.sql](../../supabase/migrations/20260928015536_0024_crm_retencao.sql#L145) |
| `public.salvar_album_layout` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L82) |
| `public.set_updated_at` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L82); [supabase/migrations/20260921022756_0004_endurecer_funcoes.sql](../../supabase/migrations/20260921022756_0004_endurecer_funcoes.sql#L5) |
| `public.sincronizar_total_fatura` | [supabase/migrations/20260928021809_0026_upsell_adicionais.sql](../../supabase/migrations/20260928021809_0026_upsell_adicionais.sql#L119) |
| `public.somar_dias_uteis` | [supabase/migrations/20260926141859_0017_pedido_vira_projeto.sql](../../supabase/migrations/20260926141859_0017_pedido_vira_projeto.sql#L51) |
| `public.total_mensagens_nao_lidas` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L554) |
| `public.validar_segredo_limpeza_fotos` | [supabase/migrations/20260926024721_0015_limpeza_fotos_orfas.sql](../../supabase/migrations/20260926024721_0015_limpeza_fotos_orfas.sql#L70) |

## Declarações de policies (histórico, não estado final)

| Policy | Relação | Declaração |
|---|---|---|
| `profiles_select_own_or_equipe` | `public.profiles` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L535) |
| `profiles_insert_self` | `public.profiles` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L540) |
| `profiles_update_own_or_admin` | `public.profiles` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L545) |
| `profiles_delete_admin` | `public.profiles` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L551) |
| `planos_select_public` | `public.planos` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L558) |
| `planos_write_admin` | `public.planos` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L563) |
| `fotografos_select_own_or_equipe` | `public.fotografos` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L571) |
| `fotografos_insert_self_or_equipe` | `public.fotografos` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L576) |
| `fotografos_update_own_or_equipe` | `public.fotografos` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L581) |
| `fotografos_delete_admin` | `public.fotografos` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L587) |
| `clientes_select_own_scope` | `public.clientes` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L596) |
| `clientes_write_fotografo_ou_equipe` | `public.clientes` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L601) |
| `clientes_update_fotografo_ou_equipe` | `public.clientes` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L606) |
| `clientes_delete_fotografo_ou_equipe` | `public.clientes` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L612) |
| `projetos_select_scope` | `public.projetos` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L621) |
| `projetos_insert_scope` | `public.projetos` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L631) |
| `projetos_update_fotografo_ou_equipe` | `public.projetos` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L640) |
| `projetos_delete_equipe` | `public.projetos` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L646) |
| `fotos_select` | `public.fotos` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L653) |
| `fotos_insert` | `public.fotos` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L657) |
| `fotos_delete` | `public.fotos` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L661) |
| `design_versions_select` | `public.design_versions` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L667) |
| `design_versions_write_equipe` | `public.design_versions` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L671) |
| `aprovacoes_select` | `public.aprovacoes` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L675) |
| `aprovacoes_insert_cliente` | `public.aprovacoes` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L680) |
| `projeto_atividades_select` | `public.projeto_atividades` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L691) |
| `projeto_atividades_insert` | `public.projeto_atividades` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L695) |
| `prova_comentarios_select` | `public.prova_comentarios` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L699) |
| `prova_comentarios_insert_cliente` | `public.prova_comentarios` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L703) |
| `media_assets_select_equipe` | `public.media_assets` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L716) |
| `media_assets_write_equipe` | `public.media_assets` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L720) |
| `banners_select_public_or_equipe` | `public.banners` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L724) |
| `banners_write_equipe` | `public.banners` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L728) |
| `portfolio_collections_select_public_or_equipe` | `public.portfolio_collections` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L732) |
| `portfolio_collections_write_equipe` | `public.portfolio_collections` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L736) |
| `portfolio_items_select_public_or_equipe` | `public.portfolio_items` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L740) |
| `portfolio_items_write_equipe` | `public.portfolio_items` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L747) |
| `projetos_fotos_read` | `storage.objects` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L762) |
| `projetos_fotos_write` | `storage.objects` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L766) |
| `projetos_fotos_delete` | `storage.objects` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L770) |
| `midia_vitrine_read_public` | `storage.objects` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L775) |
| `midia_vitrine_write_equipe` | `storage.objects` | [supabase/migrations/20260921022721_0002_plataforma_completa.sql](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql#L779) |
| `orders_select_own_or_equipe` | `public.orders` | [supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql](../../supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql#L90) |
| `orders_insert_own` | `public.orders` | [supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql](../../supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql#L95) |
| `orders_update_own_while_pendente` | `public.orders` | [supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql](../../supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql#L100) |
| `orders_delete_own_while_pendente` | `public.orders` | [supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql](../../supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql#L106) |
| `deliverables_read_owner_or_equipe` | `storage.objects` | [supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql](../../supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql#L115) |
| `deliverables_write_equipe` | `storage.objects` | [supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql](../../supabase/migrations/20260921023157_0003_compat_pedidos_legado.sql#L129) |
| `media_assets_select_publico_ou_equipe` | `public.media_assets` | [supabase/migrations/20260921031107_0005_media_assets_select_publico.sql](../../supabase/migrations/20260921031107_0005_media_assets_select_publico.sql#L8) |
| `comunicacoes_log_select_equipe_ou_fotografo` | `public.comunicacoes_log` | [supabase/migrations/20260921034141_0007_cerebro_operacional.sql](../../supabase/migrations/20260921034141_0007_cerebro_operacional.sql#L33) |
| `paginas_conteudo_select_publico_ou_equipe` | `public.paginas_conteudo` | [supabase/migrations/20260921034141_0007_cerebro_operacional.sql](../../supabase/migrations/20260921034141_0007_cerebro_operacional.sql#L177) |
| `paginas_conteudo_write_equipe` | `public.paginas_conteudo` | [supabase/migrations/20260921034141_0007_cerebro_operacional.sql](../../supabase/migrations/20260921034141_0007_cerebro_operacional.sql#L182) |
| `produtos_select_publico_ou_equipe` | `public.produtos` | [supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql](../../supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql#L40) |
| `produtos_write_equipe` | `public.produtos` | [supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql](../../supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql#L45) |
| `faturas_select_scope` | `public.faturas` | [supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql](../../supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql#L106) |
| `faturas_insert_scope` | `public.faturas` | [supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql](../../supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql#L111) |
| `faturas_update_equipe` | `public.faturas` | [supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql](../../supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql#L118) |
| `orcamentos_select_dono_ou_equipe` | `public.orcamentos` | [supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql](../../supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql#L269) |
| `orcamentos_write_dono` | `public.orcamentos` | [supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql](../../supabase/migrations/20260921043539_0008_monetizacao_expedicao_b2b.sql#L274) |
| `fotografo_logos_read_public` | `storage.objects` | [supabase/migrations/20260921044231_0009_bucket_logo_fotografo.sql](../../supabase/migrations/20260921044231_0009_bucket_logo_fotografo.sql#L10) |
| `fotografo_logos_write_dono` | `storage.objects` | [supabase/migrations/20260921044231_0009_bucket_logo_fotografo.sql](../../supabase/migrations/20260921044231_0009_bucket_logo_fotografo.sql#L14) |
| `pedidos_fotos_insert_dono` | `storage.objects` | [supabase/migrations/20260925234425_0011_pedidos_fotos_storage.sql](../../supabase/migrations/20260925234425_0011_pedidos_fotos_storage.sql#L29) |
| `pedidos_fotos_select_dono_ou_equipe` | `storage.objects` | [supabase/migrations/20260925234425_0011_pedidos_fotos_storage.sql](../../supabase/migrations/20260925234425_0011_pedidos_fotos_storage.sql#L33) |
| `pedidos_fotos_delete_rascunho` | `storage.objects` | [supabase/migrations/20260925234425_0011_pedidos_fotos_storage.sql](../../supabase/migrations/20260925234425_0011_pedidos_fotos_storage.sql#L42) |
| `orders_insert_own` | `public.orders` | [supabase/migrations/20260926000226_0012_pedidos_pagamento_stripe.sql](../../supabase/migrations/20260926000226_0012_pedidos_pagamento_stripe.sql#L73) |
| `orders_insert_own` | `public.orders` | [supabase/migrations/20260926001117_0013_pedidos_assinatura_bypass.sql](../../supabase/migrations/20260926001117_0013_pedidos_assinatura_bypass.sql#L34) |
| `aprovacoes_insert_cliente_ou_fotografo` | `public.aprovacoes` | [supabase/migrations/20260926141859_0017_pedido_vira_projeto.sql](../../supabase/migrations/20260926141859_0017_pedido_vira_projeto.sql#L228) |
| `prova_comentarios_insert_cliente_ou_fotografo` | `public.prova_comentarios` | [supabase/migrations/20260926141859_0017_pedido_vira_projeto.sql](../../supabase/migrations/20260926141859_0017_pedido_vira_projeto.sql#L243) |
| `versoes_laminas_select` | `public.versoes_laminas` | [supabase/migrations/20260926150447_0018_laminas_e_apontamentos.sql](../../supabase/migrations/20260926150447_0018_laminas_e_apontamentos.sql#L41) |
| `versoes_laminas_write_equipe` | `public.versoes_laminas` | [supabase/migrations/20260926150447_0018_laminas_e_apontamentos.sql](../../supabase/migrations/20260926150447_0018_laminas_e_apontamentos.sql#L53) |
| `prova_comentarios_update_equipe` | `public.prova_comentarios` | [supabase/migrations/20260927212258_0019_comentarios_resolvidos.sql](../../supabase/migrations/20260927212258_0019_comentarios_resolvidos.sql#L68) |
| `clientes_select_own_scope` | `public.clientes` | [supabase/migrations/20260927230855_0021_workspace_designer.sql](../../supabase/migrations/20260927230855_0021_workspace_designer.sql#L96) |
| `orders_select_own_or_equipe` | `public.orders` | [supabase/migrations/20260927230855_0021_workspace_designer.sql](../../supabase/migrations/20260927230855_0021_workspace_designer.sql#L100) |
| `orders_update_own_while_pendente` | `public.orders` | [supabase/migrations/20260927230855_0021_workspace_designer.sql](../../supabase/migrations/20260927230855_0021_workspace_designer.sql#L104) |
| `faturas_select_scope` | `public.faturas` | [supabase/migrations/20260927230855_0021_workspace_designer.sql](../../supabase/migrations/20260927230855_0021_workspace_designer.sql#L109) |
| `faturas_insert_scope` | `public.faturas` | [supabase/migrations/20260927230855_0021_workspace_designer.sql](../../supabase/migrations/20260927230855_0021_workspace_designer.sql#L113) |
| `faturas_update_equipe` | `public.faturas` | [supabase/migrations/20260927230855_0021_workspace_designer.sql](../../supabase/migrations/20260927230855_0021_workspace_designer.sql#L117) |
| `orcamentos_select_dono_ou_equipe` | `public.orcamentos` | [supabase/migrations/20260927230855_0021_workspace_designer.sql](../../supabase/migrations/20260927230855_0021_workspace_designer.sql#L122) |
| `comunicacoes_log_select_equipe_ou_fotografo` | `public.comunicacoes_log` | [supabase/migrations/20260927230855_0021_workspace_designer.sql](../../supabase/migrations/20260927230855_0021_workspace_designer.sql#L126) |
| `faturas_select_scope` | `public.faturas` | [supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql](../../supabase/migrations/20260928010546_0023_fechamento_laminas_extras.sql#L235) |
| `notificacoes_crm_select_gestao` | `public.notificacoes_crm` | [supabase/migrations/20260928015536_0024_crm_retencao.sql](../../supabase/migrations/20260928015536_0024_crm_retencao.sql#L45) |
| `adicionais_select_estudio_ou_operacao` | `public.adicionais` | [supabase/migrations/20260928021809_0026_upsell_adicionais.sql](../../supabase/migrations/20260928021809_0026_upsell_adicionais.sql#L45) |
| `adicionais_write_gestao` | `public.adicionais` | [supabase/migrations/20260928021809_0026_upsell_adicionais.sql](../../supabase/migrations/20260928021809_0026_upsell_adicionais.sql#L49) |
| `adicionais_estudio_dono` | `public.adicionais_estudio` | [supabase/migrations/20260928021809_0026_upsell_adicionais.sql](../../supabase/migrations/20260928021809_0026_upsell_adicionais.sql#L70) |
| `fatura_itens_select_scope` | `public.fatura_itens` | [supabase/migrations/20260928021809_0026_upsell_adicionais.sql](../../supabase/migrations/20260928021809_0026_upsell_adicionais.sql#L109) |
| `album_layouts_equipe` | `public.album_layouts` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L71) |
| `album_layout_versoes_equipe` | `public.album_layout_versoes` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L140) |
| `album_templates_equipe` | `public.album_templates` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L168) |
| `album_aprovacoes_equipe` | `public.album_aprovacoes` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L213) |
| `album_aprovacao_comentarios_equipe` | `public.album_aprovacao_comentarios` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L217) |
| `albuns_fotos_equipe_select` | `storage.objects` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L334) |
| `albuns_fotos_aprovacao_publica` | `storage.objects` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L354) |
| `albuns_fotos_equipe_insert` | `storage.objects` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L364) |
| `albuns_fotos_equipe_update` | `storage.objects` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L376) |
| `albuns_fotos_equipe_delete` | `storage.objects` | [supabase/migrations/20260928030000_0027_album_layouts.sql](../../supabase/migrations/20260928030000_0027_album_layouts.sql#L381) |
| `pedidos_fotos_r2_select_dono_ou_equipe` | `public.pedidos_fotos_r2` | [supabase/migrations/20261007000000_0030_pedidos_fotos_r2.sql](../../supabase/migrations/20261007000000_0030_pedidos_fotos_r2.sql#L40) |
| `pedidos_fotos_r2_insert_rascunho` | `public.pedidos_fotos_r2` | [supabase/migrations/20261007000000_0030_pedidos_fotos_r2.sql](../../supabase/migrations/20261007000000_0030_pedidos_fotos_r2.sql#L45) |
| `pedidos_fotos_r2_delete_rascunho` | `public.pedidos_fotos_r2` | [supabase/migrations/20261007000000_0030_pedidos_fotos_r2.sql](../../supabase/migrations/20261007000000_0030_pedidos_fotos_r2.sql#L54) |
| `pedidos_fotos_r2_delete_rascunho` | `public.pedidos_fotos_r2` | [supabase/migrations/20261009000300_0036_travas_chaves_r2.sql](../../supabase/migrations/20261009000300_0036_travas_chaves_r2.sql#L123) |
| `conversas_select` | `public.conversas` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L389) |
| `mensagens_select` | `public.mensagens` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L393) |
| `mensagens_insert` | `public.mensagens` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L397) |
| `mensagens_update_autor` | `public.mensagens` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L406) |
| `conversa_leituras_select` | `public.conversa_leituras` | [supabase/migrations/20261009000400_0037_mensagens.sql](../../supabase/migrations/20261009000400_0037_mensagens.sql#L413) |
| `prova_laminas_revisao_select` | `public.prova_laminas_revisao` | [supabase/migrations/20261009000600_0039_painel_aprovacao_cliente.sql](../../supabase/migrations/20261009000600_0039_painel_aprovacao_cliente.sql#L127) |
| `prova_laminas_revisao_insert_cliente` | `public.prova_laminas_revisao` | [supabase/migrations/20261009000600_0039_painel_aprovacao_cliente.sql](../../supabase/migrations/20261009000600_0039_painel_aprovacao_cliente.sql#L132) |
| `prova_laminas_revisao_update_cliente` | `public.prova_laminas_revisao` | [supabase/migrations/20261009000600_0039_painel_aprovacao_cliente.sql](../../supabase/migrations/20261009000600_0039_painel_aprovacao_cliente.sql#L137) |
| `prova_laminas_revisao_delete_cliente` | `public.prova_laminas_revisao` | [supabase/migrations/20261009000600_0039_painel_aprovacao_cliente.sql](../../supabase/migrations/20261009000600_0039_painel_aprovacao_cliente.sql#L143) |
| `r2_uploads_pendentes_select_proprio` | `public.r2_uploads_pendentes` | [supabase/migrations/20261009000700_0040_r2_uploads_pendentes.sql](../../supabase/migrations/20261009000700_0040_r2_uploads_pendentes.sql#L50) |
| `fotografos_insert_self_or_equipe` | `public.fotografos` | [supabase/migrations/20261013000100_0041_travas_seguranca.sql](../../supabase/migrations/20261013000100_0041_travas_seguranca.sql#L58) |
| `orders_insert_own` | `public.orders` | [supabase/migrations/20261013000100_0041_travas_seguranca.sql](../../supabase/migrations/20261013000100_0041_travas_seguranca.sql#L108) |
| `fotos_insert` | `public.fotos` | [supabase/migrations/20261013000100_0041_travas_seguranca.sql](../../supabase/migrations/20261013000100_0041_travas_seguranca.sql#L362) |
| `reconhecimento_projetos_select` | `public.reconhecimento_projetos` | [supabase/migrations/20261021000100_0042_reconhecimento_facial.sql](../../supabase/migrations/20261021000100_0042_reconhecimento_facial.sql#L52) |
| `reconhecimento_fotos_select` | `public.reconhecimento_fotos` | [supabase/migrations/20261021000100_0042_reconhecimento_facial.sql](../../supabase/migrations/20261021000100_0042_reconhecimento_facial.sql#L73) |
| `eventos_analiticos_insert_proprio` | `public.eventos_analiticos` | [supabase/migrations/20261021000100_0042_reconhecimento_facial.sql](../../supabase/migrations/20261021000100_0042_reconhecimento_facial.sql#L286) |
| `eventos_analiticos_select_operacao` | `public.eventos_analiticos` | [supabase/migrations/20261021000100_0042_reconhecimento_facial.sql](../../supabase/migrations/20261021000100_0042_reconhecimento_facial.sql#L290) |

## RPCs literais chamadas no código

| Nome | Chamadores |
|---|---|
| `abrir_conversa` | [src/lib/actions/mensagens.ts](../../src/lib/actions/mensagens.ts#L72) |
| `album_aprovacao_comentar` | [src/lib/actions/album-aprovacao-publica.ts](../../src/lib/actions/album-aprovacao-publica.ts#L32) |
| `album_aprovacao_decidir` | [src/lib/actions/album-aprovacao-publica.ts](../../src/lib/actions/album-aprovacao-publica.ts#L54) |
| `album_aprovacao_publica` | [src/app/album/[token]/page.tsx](../../src/app/album/[token]/page.tsx#L37) |
| `aprovar_prova` | [src/lib/actions/projetos.ts](../../src/lib/actions/projetos.ts#L420); [src/lib/actions/prova-fotografo.ts](../../src/lib/actions/prova-fotografo.ts#L58) |
| `calcular_excedente` | [src/lib/supabase/queries.ts](../../src/lib/supabase/queries.ts#L1242) |
| `chave_r2_em_uso_por_projeto` | [src/app/api/uploads/projeto-foto/route.ts](../../src/app/api/uploads/projeto-foto/route.ts#L93) |
| `concluir_cadastro_google` | [src/app/auth/callback/route.ts](../../src/app/auth/callback/route.ts#L40) |
| `confirmar_pagamento_fatura` | [src/lib/stripe.ts](../../src/lib/stripe.ts#L211) |
| `decidir_adicional` | [src/lib/actions/prova-fotografo.ts](../../src/lib/actions/prova-fotografo.ts#L74) |
| `definir_reconhecimento_facial` | [src/lib/actions/reconhecimento.ts](../../src/lib/actions/reconhecimento.ts#L27) |
| `diagramacao_resumo` | [src/lib/supabase/diagramacao.ts](../../src/lib/supabase/diagramacao.ts#L22) |
| `dispensar_fatura` | [src/lib/actions/faturamento.ts](../../src/lib/actions/faturamento.ts#L59) |
| `encerrar_reconhecimentos_vencidos` | [src/app/api/cron/reconhecimento-facial/route.ts](../../src/app/api/cron/reconhecimento-facial/route.ts#L53) |
| `favoritar_fotos` | [src/lib/actions/reconhecimento.ts](../../src/lib/actions/reconhecimento.ts#L58) |
| `fotos_para_indexar` | [src/lib/rekognition/indexacao.ts](../../src/lib/rekognition/indexacao.ts#L115) |
| `get_orcamento_publico` | [src/lib/supabase/queries.ts](../../src/lib/supabase/queries.ts#L1597) |
| `listar_clientes_visiveis` | [src/lib/supabase/queries.ts](../../src/lib/supabase/queries.ts#L470) |
| `listar_conversas` | [src/lib/actions/mensagens.ts](../../src/lib/actions/mensagens.ts#L100) |
| `marca_do_estudio_cliente` | [src/lib/supabase/queries.ts](../../src/lib/supabase/queries.ts#L843) |
| `marcar_alerta_crm` | [src/lib/actions/crm.ts](../../src/lib/actions/crm.ts#L24) |
| `marcar_conversa_lida` | [src/lib/actions/mensagens.ts](../../src/lib/actions/mensagens.ts#L192) |
| `minha_assinatura` | [src/lib/actions/pedidos.ts](../../src/lib/actions/pedidos.ts#L135); [src/lib/supabase/queries.ts](../../src/lib/supabase/queries.ts#L301) |
| `ofertas_da_prova` | [src/lib/supabase/queries.ts](../../src/lib/supabase/queries.ts#L1362) |
| `pagamento_simulado_ativo` | [src/lib/supabase/queries.ts](../../src/lib/supabase/queries.ts#L1526) |
| `pagar_fatura_simulada` | [src/lib/actions/faturamento.ts](../../src/lib/actions/faturamento.ts#L39) |
| `pode_ver_projeto` | [src/lib/r2/sessao.ts](../../src/lib/r2/sessao.ts#L95) |
| `preparar_checkout_fatura` | [src/lib/actions/pagamentos.ts](../../src/lib/actions/pagamentos.ts#L225) |
| `r2_chaves_sem_referencia` | [src/app/api/cron/limpar-fotos-r2/route.ts](../../src/app/api/cron/limpar-fotos-r2/route.ts#L91) |
| `rascunhos_r2_expirados` | [src/app/api/cron/limpar-fotos-r2/route.ts](../../src/app/api/cron/limpar-fotos-r2/route.ts#L48) |
| `registrar_busca_facial` | [src/app/api/reconhecimento/buscar/route.ts](../../src/app/api/reconhecimento/buscar/route.ts#L61) |
| `registrar_checkout_fatura` | [src/lib/actions/pagamentos.ts](../../src/lib/actions/pagamentos.ts#L290) |
| `reservar_upload_r2` | [src/app/api/uploads/projeto-foto/route.ts](../../src/app/api/uploads/projeto-foto/route.ts#L50) |
| `rodar_alertas_crm` | [src/lib/actions/crm.ts](../../src/lib/actions/crm.ts#L39) |
| `salvar_album_layout` | [src/lib/actions/album-editor.ts](../../src/lib/actions/album-editor.ts#L272) |
| `total_mensagens_nao_lidas` | [src/components/mensagens/realtime.ts](../../src/components/mensagens/realtime.ts#L100); [src/lib/actions/mensagens.ts](../../src/lib/actions/mensagens.ts#L201) |

## Testes e infraestrutura

- [supabase/tests/checkout_fatura.test.sql](../../supabase/tests/checkout_fatura.test.sql)
- [supabase/tests/controle_diagramacao.test.sql](../../supabase/tests/controle_diagramacao.test.sql)
- [supabase/tests/fluxo_adicionais.test.sql](../../supabase/tests/fluxo_adicionais.test.sql)
- [supabase/tests/mensagens.test.sql](../../supabase/tests/mensagens.test.sql)
- [supabase/tests/painel_aprovacao_cliente.test.sql](../../supabase/tests/painel_aprovacao_cliente.test.sql)
- [supabase/tests/papel_app_metadata.test.sql](../../supabase/tests/papel_app_metadata.test.sql)
- [supabase/tests/r2_uploads_pendentes.test.sql](../../supabase/tests/r2_uploads_pendentes.test.sql)
- [supabase/tests/travas_seguranca.test.sql](../../supabase/tests/travas_seguranca.test.sql)
- [e2e/adicionais.spec.ts](../../e2e/adicionais.spec.ts)
- [e2e/editor/ambiente.ts](../../e2e/editor/ambiente.ts)
- [e2e/editor/apoio.ts](../../e2e/editor/apoio.ts)
- [e2e/editor/avulso.spec.ts](../../e2e/editor/avulso.spec.ts)
- [e2e/editor/global-setup.ts](../../e2e/editor/global-setup.ts)
- [e2e/editor/hub.spec.ts](../../e2e/editor/hub.spec.ts)
- [e2e/editor/projeto.spec.ts](../../e2e/editor/projeto.spec.ts)
- [e2e/editor/r2-falso/desviar.mjs](../../e2e/editor/r2-falso/desviar.mjs)
- [e2e/editor/r2-falso/servidor.mjs](../../e2e/editor/r2-falso/servidor.mjs)
- [e2e/global-setup.ts](../../e2e/global-setup.ts)
- [e2e/login.spec.ts](../../e2e/login.spec.ts)
- [e2e/painel-aprovacao.spec.ts](../../e2e/painel-aprovacao.spec.ts)
- [e2e/support/ambiente.ts](../../e2e/support/ambiente.ts)
- [e2e/support/seed.ts](../../e2e/support/seed.ts)
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- [src/app/api/webhooks/pagamento/route.test.ts](../../src/app/api/webhooks/pagamento/route.test.ts)
- [src/lib/actions/adicionais.e2e.test.ts](../../src/lib/actions/adicionais.e2e.test.ts)
- [src/lib/actions/album-editor.test.ts](../../src/lib/actions/album-editor.test.ts)
- [src/lib/actions/diagramacao.test.ts](../../src/lib/actions/diagramacao.test.ts)
- [src/lib/actions/faturamento.test.ts](../../src/lib/actions/faturamento.test.ts)
- [src/lib/actions/mensagens.test.ts](../../src/lib/actions/mensagens.test.ts)
- [src/lib/actions/pagamentos.test.ts](../../src/lib/actions/pagamentos.test.ts)
- [src/lib/actions/painel-cliente.e2e.test.ts](../../src/lib/actions/painel-cliente.e2e.test.ts)
- [src/lib/actions/painel-cliente.test.ts](../../src/lib/actions/painel-cliente.test.ts)
- [src/lib/actions/prova.test.ts](../../src/lib/actions/prova.test.ts)
- [src/lib/album/divisorias.test.ts](../../src/lib/album/divisorias.test.ts)
- [src/lib/album/documento.test.ts](../../src/lib/album/documento.test.ts)
- [src/lib/album/modelos.test.ts](../../src/lib/album/modelos.test.ts)
- [src/lib/album/pdf.test.ts](../../src/lib/album/pdf.test.ts)
- [src/lib/album/preparar-projeto.test.ts](../../src/lib/album/preparar-projeto.test.ts)
- [src/lib/album/templates.test.ts](../../src/lib/album/templates.test.ts)
- [src/lib/album/verificacao.test.ts](../../src/lib/album/verificacao.test.ts)
- [src/lib/apontamento.test.ts](../../src/lib/apontamento.test.ts)
- [src/lib/diagramacao/regras.test.ts](../../src/lib/diagramacao/regras.test.ts)
- [src/lib/mensagens.test.ts](../../src/lib/mensagens.test.ts)
- [src/lib/prova/painel.test.ts](../../src/lib/prova/painel.test.ts)
- [src/lib/prova/versao-parcial.test.ts](../../src/lib/prova/versao-parcial.test.ts)
- [src/lib/r2/chaves.test.ts](../../src/lib/r2/chaves.test.ts)
- [src/lib/r2/cliente.test.ts](../../src/lib/r2/cliente.test.ts)
- [src/lib/r2/rotas-demais.test.ts](../../src/lib/r2/rotas-demais.test.ts)
- [src/lib/r2/rotas.test.ts](../../src/lib/r2/rotas.test.ts)
- [src/lib/r2/script-copia.test.ts](../../src/lib/r2/script-copia.test.ts)
- [src/lib/r2/sessao.test.ts](../../src/lib/r2/sessao.test.ts)
- [src/lib/r2/varredura.test.ts](../../src/lib/r2/varredura.test.ts)
- [src/lib/redirect-seguro.test.ts](../../src/lib/redirect-seguro.test.ts)
- [src/lib/rekognition/regras.test.ts](../../src/lib/rekognition/regras.test.ts)
- [src/lib/resolucao.test.ts](../../src/lib/resolucao.test.ts)
- [src/lib/sanitizar-html.test.ts](../../src/lib/sanitizar-html.test.ts)
- [src/lib/segredo.test.ts](../../src/lib/segredo.test.ts)
- [package.json](../../package.json)
- [next.config.mjs](../../next.config.mjs)
- [tailwind.config.ts](../../tailwind.config.ts)
- [vercel.json](../../vercel.json)
- [vitest.config.ts](../../vitest.config.ts)
- [playwright.config.ts](../../playwright.config.ts)
- [playwright.editor.config.ts](../../playwright.editor.config.ts)
- [supabase/functions/admin-create-user/index.ts](../../supabase/functions/admin-create-user/index.ts)
