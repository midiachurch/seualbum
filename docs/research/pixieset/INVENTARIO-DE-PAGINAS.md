# INVENTARIO DE PAGINAS

## Cobertura atual

| Área | Estado | Evidência / limite |
|---|---|---|
| Login | Capturado pelo Craft Anything em Clean Room | `ev_cb6bd7e88ab5de6b521b5e37ecf95ac73045c29b3d677139bac33dc7ca39ea6a` |
| Dashboard | Observado visualmente em sessão autenticada do Chrome habitual | Portal por produtos e acessos rápidos. Ainda sem captura autenticada pelo Craft Anything |
| Client Gallery: coleções | Observado visualmente em sessão autenticada do Chrome habitual | Estado inicial, opção de começar com fotos demonstrativas, barra lateral e cota. A opção demonstrativa não foi executada: poderia criar conteúdo permanente |
| Biblioteca, Favoritos, Lixeira, Página inicial, Configurações | Links observados na navegação do Client Gallery | Ver matriz ampliada abaixo; cobertura parcial |
| Store, Studio Manager, Website, Mobile Gallery, Photo Editor | Entradas observadas no dashboard | Ver matriz ampliada abaixo; cobertura parcial |
| Conta, perfil e cobrança | Entradas observadas no dashboard | Valores pessoais não registrados |
| Upload, organização, configurações de coleção, compartilhamento, seleção, downloads e cliente final | Pendente | Dependem de coleção acessível sem criar dados na conta |
| Modais, animações e responsividade | Pendente | Não inferir cobertura a partir de um único estado desktop |

As observações visuais do Chrome habitual são notas auxiliares, sem identificador de evidência do Craft Anything. Não confundir navegação disponível com funcionalidade testada.

## Incidente de sessão

O login confirmado pelo usuário foi observado em janelas habituais do Chrome. O navegador privado do Craft Anything permaneceu no login. A primeira tentativa de captura retornou `not_found` (nenhum alvo depurável); a sessão privada foi reaberta e uma captura posterior confirmou o login vazio. Nenhuma credencial ou cookie foi transferido entre perfis. `web_page_show` foi recusado por Clean Room e não foi contornado com inspeção de código.

## Ampliação da cobertura pela interface visual

Observações auxiliares obtidas com controle nativo do Chrome autenticado, sem leitura de código-fonte ou tráfego:

| ID | Área / rota genérica | Estado observado |
|---|---|---|
| UI-01 | Dashboard | Produtos e atalhos por operação |
| UI-02 | Client Gallery /collections/get-started | Onboarding; nenhuma coleção; carga demonstrativa não executada |
| UI-03 | /photos | Biblioteca vazia, busca e ação Nova coleção |
| UI-04 | /starred/collections | Abas de coleções e fotos com estrela; não confundir com seleção do cliente |
| UI-05 | /trash/collections | Vazia; consumo de cota e exclusão após 30 dias informados |
| UI-06 | /homepage | Status, senha, bio, campos de contato, ordenação e prévia |
| UI-07 | /settings | Marca, domínio, logos, favicon e bloqueios de plano |
| UI-08 | /settings/watermark | Marca de proteção e aplicação a downloads web |
| UI-09 | /settings/presets | Lista e ação de adicionar predefinição; não criada |
| UI-10 | /settings/email-templates | Modelos de compartilhamento e lembrete de expiração |
| UI-11 | Editor de modelo de e-mail existente | Nome, assunto, corpo e prévia; sem salvar |
| UI-12 | /settings/preferences | Idioma, nome de arquivo, indexação, nitidez, RAW, termos, privacidade e cookies |
| UI-13 | /settings/integrations | Photo Editor, Lightroom e Google Analytics |
| UI-14 | Store /store/ | Onboarding de produtos e checkout |
| UI-15 | /store/price/ e detalhe de tabela | Tabela padrão, 8 produtos, nenhuma coleção associada |
| UI-16 | Menu Add Product | Produto físico manual, download digital e pacote |
| UI-17 | /store/setting/ | Estado global, taxa do plano, pagamento, moeda, revisão e termos |
| UI-18 | Conta | Preferências de login e segurança; valores pessoais omitidos |
| UI-19 | Seleção de plano Client Gallery | Comparação de armazenamento, vídeo, marca e comércio; sem contratar |

Impostos ficou sem conteúdo recuperável. O Studio Manager foi recuperado por recarga e sua cobertura consta abaixo. Estes IDs UI são referências editoriais locais, não evidências ev_ emitidas pelo Craft Anything.

## Ampliação Studio e Website

| ID | Área / rota genérica | Estado observado |
|---|---|---|
| UI-20 | Studio / | Home e resumos operacionais |
| UI-21 | /projects/board-view | Quadro, etapas, filtros, lista e arquivados |
| UI-22 | /projects/create-details | Formulário anterior à criação; não submetido |
| UI-23 | /contacts | Categorias, busca, colunas e contato demonstrativo; valores omitidos |
| UI-24 | /invoices | Totais por situação e filtros de estado |
| UI-25 | /session-types | Confirmação obrigatória de fuso; não persistida |
| UI-26 | /contracts | Lista e estados; links de questionários/orçamentos |
| UI-27 | /templates/contracts | Categorias e modelos demonstrativos |
| UI-28 | /inbox | Caixa vazia e ação de nova mensagem |
| UI-29 | /settings/branding | Logo, capa, cores, fonte, prévias e bloqueios por plano |
| UI-30 | Website / | Seletor por categoria; nenhum tema aplicado |
| UI-31 | Website: prévia de template | Esquemas de cor, prévia embutida e demo público; sem aplicar |

Os IDs UI são notas editoriais locais, não evidências ev_ do Craft. O usuário informou conta Google-only e a autenticação privada foi recusada. Não há novo login solicitado.

## Cobertura não concluída

Pedidos/clientes/impostos/envio/cupons da Store; relatórios/transações/links de pagamento, formulários de contato, subtipos de documentos/modelos e demais preferências do Studio; billing/perfil/avançado completos; editor real do Website; Mobile Gallery e Photo Editor; coleção com fotos e experiência do cliente. Ausência de inspeção não significa ausência de recurso.
