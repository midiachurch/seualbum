# COMPARATIVO SEUALBUM

Análise preliminar por leitura do código local. Não é uma conclusão sobre todo o Pixieset; a autenticação privada pelo Google foi recusada e a pesquisa visual alternativa permanece parcial.

| Área | Evidência no SeuAlbum | Oportunidade a validar |
|---|---|---|
| Hub do projeto | `src/components/cliente/project-hub.tsx`: visão geral, fotos, detalhes, aprovação e mensagens | Aperfeiçoar a orientação por próxima ação e manter a separação entre fotógrafo, cliente e produção |
| Fotos | `src/components/cliente/client-photos-manager.tsx`: envio, grade, estrela e lightbox | Evoluir seleção persistida, filtros e tratamento de falhas antes de ampliar o catálogo de recursos |
| Produção | `src/components/admin/projects/project-workspace.tsx`: briefing, atribuição, SLA, versões e histórico | Integrar uma futura galeria ao projeto existente, preservando o processo de diagramação |
| Aprovação | `src/lib/actions/projetos.ts`: aprovação, solicitação de ajustes, comentários e resolução | Não confundir seleção de fotos com aprovação de uma versão de álbum |
| Reconhecimento | `src/components/cliente/encontrar-minhas-fotos.tsx` | Preservar o diferencial de busca por selfie, com regras de acesso e consentimento próprias |
| Vitrine e mídia | `src/components/admin/vitrine/portfolio-manager.tsx`, `src/components/admin/media/media-library.tsx` | Separar recursos públicos da vitrine e fotografias privadas dos clientes |

## Pontos concretos para revisão futura

1. `toggleFavorite` em `client-photos-manager.tsx` altera somente o estado React. Não há chamada de persistência nessa função. Isso não demonstra ausência de persistência em toda a plataforma; é uma limitação observada nesse fluxo específico.
2. O upload real nesse componente recebe a URL de retorno, mas mantém o identificador temporário `novo-*` no estado. Revisar o contrato de retorno para usar a identidade persistida antes de acrescentar ações por foto.
3. A falha de upload desativa o indicador de envio, sem apresentar nessa função uma mensagem específica ou opção de tentar novamente. Desenhar estados explícitos de erro e retomada.
4. O lightbox possui controles de anterior/próxima e fechar. Verificar em execução o foco, Escape e retorno ao item de origem antes de classificá-lo como acessível.
5. A produção já contém revisão interna, aprovação do cliente e restrições de cobrança. Qualquer melhoria visual deve preservar essas regras e os serviços existentes.

Nenhum teste de execução foi realizado nesta etapa. As oportunidades acima são recomendações técnicas, não comportamentos observados do Pixieset.

## Reutilização e prioridades

`src/lib/actions/reconhecimento.ts` já utiliza a RPC `favoritar_fotos`. A proposta é avaliar sua autorização e contrato para atender ao toque manual na estrela, antes de criar persistência paralela. `src/lib/actions/album-editor.ts` também possui metadados de pastas, favoritas e prioridade: alinhar os contextos antes de migrar dados.

| Padrão observado | Evolução incremental | Preservar |
|---|---|---|
| Studio: quadro e filtros | Filtros e atalhos no quadro existente | Estados, SLA e restrições de cobrança |
| Preferências por domínio | Separar apresentação pública e operação privada | RLS, permissões e isolamento entre projetos |
| Editor com prévia lateral | Prévia de comunicação antes de aplicar | Envio explícito, sem automação silenciosa |
| Branding por contexto | Personalização controlada por estúdio | Identidade própria e componentes locais |
| Preço associado à coleção | Avaliar catálogo/projeto/adicionais existentes | Stripe e cobrança de lâminas extras |
| Onboarding orientado à ação | Primeira tarefa clara e demonstração isolada | Escolha explícita antes de criar dados |

Reservas, contratos e um construtor completo de sites são expansões de produto. Não são pré-requisitos para melhorar seleção, prova e produção de álbuns.
