# Pixieset - SeuAlbum 2.0

Pesquisa iniciada em 14/11/2026 (São Paulo). **Resultado parcial: a investigação completa ainda não foi concluída.**

Foram observadas 31 áreas ou estados na sessão habitual autenticada: Dashboard, Client Gallery, configurações, Store, Studio Manager e prévia do Website Builder. Isso não equivale a 31 páginas inteiramente testadas.

## Documentos

- [Inventário e cobertura](INVENTARIO-DE-PAGINAS.md)
- [Design system](DESIGN-SYSTEM.md)
- [Análise funcional](ANALISE-FUNCIONAL.md)
- [Fluxos de usuário](FLUXOS-DE-USUARIO.md)
- [Comparativo com o MVP](COMPARATIVO-SEUALBUM.md)
- [Plano incremental](PLANO-DE-IMPLEMENTACAO.md)
- [Capturas disponíveis e lacunas](screenshots/README.md)

## Método

Skill Craft Anything lida integralmente. MCP 0.6.1 respondeu em Clean Room; grupos core, browser e projects habilitados. A atualização dinâmica de ferramentas falhou no cliente; foi aberta sessão MCP independente pela CLI oficial, com --clean-room e mcp --all-tools. Investigação própria em investigation.cany/, sem usar projetos anteriores.

web_page_show foi recusado por Clean Room e a recusa foi respeitada. Nenhum Deep mode, código proprietário, HTML, scripts ou tráfego foi usado. Capturas com include_html=false preservaram a visão externa.

O Google recusou autenticação no navegador privado. O usuário confirmou que sua conta usa apenas Google. Não há pedido de novo login pendente. Não transferimos cookies ou alteramos segurança. A captura e o registro bruto do estado OAuth foram descartados dos arquivos por conterem contexto de autenticação.

Como alternativa autorizada, o controle visual nativo observou o Chrome habitual já autenticado. IDs UI-01 a UI-31 são notas editoriais locais, não IDs ev_ do Craft Anything. As imagens dessas telas foram vistas durante a navegação, mas não foram exportadas para esta pasta. A tentativa de exportação nativa encontrou timeout/indisponibilidade.

## Evidências Craft Anything

| ID | Resultado |
|---|---|
| ev_526c91641271d5dcfc200f8fb5e98ba99de80678b9d825c505b06886fec8fe5e | Dashboard solicitado; redirecionamento ao login privado |
| ev_cb6bd7e88ab5de6b521b5e37ecf95ac73045c29b3d677139bac33dc7ca39ea6a | Login vazio; medidas limitadas a essa tela |
| ev_656fc8bc935f1c8f8a5422aa231ab34e08aa995163594a1ef9dc524ff4f0e2d8 | Demo público apresentou verificação de acesso |
| ev_bbbf8e7ec264634af73a5ed7a0e237d056d904760b275205d67feb76776264b9 | Verificação capturada em 1440 e 390 px; não é o template |

## Principais oportunidades

1. Confiabilidade de favoritos e uploads: a estrela do gerenciador de fotos do cliente é local; outra action de reconhecimento já persiste favoritos via RPC.
2. Navegação por próxima ação, filtros e estados vazios, preservando diagramação, revisão interna e aprovação existentes.
3. Separação entre preferências administrativas, seleção do cliente e aprovação do álbum.
4. Predefinições e prévias de comunicação, com componentes e identidade próprios do SeuAlbum.

## Lacunas para conclusão

- Sem capturas autenticadas exportáveis dos painéis pelo Craft Anything.
- Conta sem coleções/fotos; nenhum conteúdo demonstrativo foi criado.
- Upload, organização em coleção, seleção do cliente, compartilhamento e download real não testados.
- Reservas exigiram confirmação persistente de fuso; não confirmada.
- Website chegou ao seletor e à prévia, sem aplicar modelo ou criar site.
- Subáreas de Store, Studio e conta/billing ainda não percorridas integralmente.
- Responsividade, animações e medidas exatas dos painéis não validadas.

Para concluir, é necessária captura autenticada compatível com o acesso autorizado e coleção de teste já existente/autorizada, ou autorização específica para demonstração que crie dados. Não repetir o login privado recusado pelo Google.

## Preservação do MVP

Somente docs/research/pixieset/ foi criada/alterada no repositório. Código funcional, banco e integrações intactos. Nenhuma coleção, produto, assinatura ou mensagem foi criada deliberadamente; nenhum tema aplicado ou configuração salva. Não foram executados builds/testes do MVP: os achados locais são de análise estática.
