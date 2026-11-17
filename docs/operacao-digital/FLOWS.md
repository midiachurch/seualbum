# Fluxos e integração — Operação Digital

Auditoria local de 16/11/2026 sobre a baseline `01176cb`. Este documento distingue código existente de entregas ainda necessárias. A prioridade comercial muda; editor, selfie, cobrança de extras, integrações e documentos históricos ficam preservados.

| Fluxo | Evidência local reutilizável | Limite observado / próximo contrato |
|---|---|---|
| Galeria autenticada | `src/app/cliente/projetos/[id]/page.tsx`, `project-hub.tsx`, `client-photos-manager.tsx`; projeto/cliente conferidos na página e sessão real em `queries.ts` | Upload com retry em memória e grid/lightbox existentes. Compartilhamento privado sem cadastro ainda não é este fluxo. Favorito manual persistido é o incremento desta rodada, sujeito a testes integrados. |
| Reconhecimento por selfie | `encontrar-minhas-fotos.tsx`, `actions/reconhecimento.ts`, migration 0042 | `favoritar_fotos` só marca e registra origem selfie. Não usar para desfazer favorito manual. AWS real, retenção e consentimento operacional não certificados por demo. |
| Seleção entregue | Campo `fotos.favorita` e seleção de fotos no editor | Não há snapshot comercial de seleção entregue identificado neste fluxo. Criar entidade de entrega com revisão, autor/data, arquivos originais e idempotência; favoritos continuam rascunho compartilhado. Confirmar não deve aprovar álbum. |
| Diagramação e equipe | `actions/diagramacao.ts`, `actions/album-editor.ts`, workspace `/admin/design`, editor e upload de lâminas | Atribuição por `responsavel_id`; concessões/organizações novas não implementadas. Contratação avulsa do serviço precisa pedido com escopo e cobrança próprios, sem misturar assinatura ou extras. |
| Prova de projeto | `actions/prova-fotografo.ts`, `actions/painel-cliente.ts`, `components/cliente/proof/`, `components/cliente/painel/`, migrations 0032/0039 | Versões liberadas, comentários, checklist e aprovação já têm domínio próprio. Preservar travas de versão e regressões financeiras; entrada de álbum externo deve usar a mesma prova, sem fingir documento editável. |
| Aprovação pública avulsa | `/album/[token]`, `actions/album-aprovacao-publica.ts`, `actions/album-editor.ts` | Token hexadecimal de 64 caracteres serve como credencial e acesso é específico daquela aprovação. Não equivale ao novo portal de projeto por link e código. Página desabilitada em demo. |
| Timeline do cliente | `project-timeline.tsx` recebe somente `currentStage` de `clientStageOf(project.status)` | É indicador de etapas, sem datas/responsáveis. Não afirmar timeline de eventos reais. `projeto_atividades` já registra mensagens em ações de projetos/diagramação; consolidar eventos de domínio e mapear visibilidade antes de usá-los no portal. Não expor notas internas. |
| Mensagens | `actions/mensagens.ts`, `mensagens-servidor.ts`, componentes de conversas, migration 0037 | Canais cliente–estúdio e estúdio–produção existentes. Preservar escopo/RLS 0043. Notificações essenciais precisam outbox deduplicada e preferências/canal validados; não presumir e-mail enviado. |
| Monetização | `lib/stripe.ts`, actions de pagamentos/faturamento, webhook e fechamento de extras | Há planos e Checkout, mas isso não prova recorrência e franquias de SaaS operantes. Ledger de armazenamento/tráfego e reservas atômicas devem anteceder limites comerciais. Sem preços definitivos. |

## Contratos seguintes

1. **Entrega de seleção**: RPC transacional autenticada com projeto, revisão esperada e chave idempotente. Valida todas as fotos no projeto, grava snapshot de IDs/caminhos/nomes originais e evento com ator/data; concorrência retorna conflito. Reabrir cria nova revisão auditável.
2. **Portal privado**: concessão de acesso própria do projeto, hash do segredo/código, escopo explícito, expiração e revogação. Código verificado no servidor com tentativas limitadas; cada leitura/mutação confere concessão ativa. Nenhuma policy anon ampla ou service role como substituto de autorização.
3. **Timeline**: eventos imutáveis originados de comandos concluídos no banco, com tipo, instante, ator, projeto e visibilidade. Derivar estado da seleção e da prova separadamente; não fabricar datas para as etapas anteriores.
4. **Arquivos selecionados**: exportação conferida no servidor contra snapshot autorizado, manifesto com nomes originais e links temporários, sem tornar bucket público. Revalidar acesso antes de gerar lote/ZIP.
5. **Assinatura**: identificar provedor, eventos de cancelamento/inadimplência, carência e retenção antes da ativação. Consumo de bytes e tráfego medido no servidor e reconciliação de objetos; reenvios idempotentes não duplicam cobrança.

## Matriz de aceite

- SQL: sessão ausente/inativa, outro estúdio/projeto, responsável revogado, foto fora do projeto, comando idempotente e ausência de efeito lateral em selfie/prova/cobrança.
- API: tokens reais do stack descartável contra PostgREST e servidor, incluindo acessos negativos diretos e URLs temporárias após revogação.
- Navegador autenticado: favorito persiste após recarregar, erro restaura estado, duas abas recebem estado confiável, seleção entregue e aprovação permanecem distintas.
- Demo isolada: modal, teclado/foco, contador e filtro; resultado não prova persistência, autorização, upload, Stripe ou AWS.
- Rollout: baseline remota de migrations e ambiente de preview verificados; produção exige aprovação humana. A evidência SQL anterior e a nova UI não removem esses gates.

## Execução E2E

`playwright.config.ts` usa `e2e/global-setup.ts` e exige API Supabase local. A consolidação anterior foi bloqueada em localhost:54321 antes de cenários. `playwright.editor.config.ts` também exige esse stack e R2 falso. `playwright.demo.config.ts` isola os novos testes de interface sem setup de banco, desliga integrações por variáveis explícitas e usa porta própria sem reaproveitar servidor. Os testes demo abortam pedidos externos do navegador e substituem fotos de exemplo por SVG local.

## Resultado observado nesta rodada

Dois cenários demo passaram em Chromium (17,6 s) no worktree isolado: favorito/contador/filtro e modal/setas/Escape/restauração de foco. O primeiro início foi bloqueado por `listen EPERM`; a repetição com permissão de execução local passou. ESLint dos dois arquivos de teste/configuração e da configuração principal passou; `git diff --check` passou. O servidor de teste usou cópias do componente e da action em desenvolvimento nas outras frentes; a integração final deve repetir os gates sobre a árvore integrada. Nenhum teste demo fez conexão com Supabase ou comprovou persistência.

O stack de API real necessita Auth, PostgREST e banco com migrations, JWTs sintéticos consistentes, exposição somente localhost e identificação exclusiva de containers; o setup E2E atual também escreve `private.app_config.pagamento_simulado` no container selecionado. Portanto, não deve ser apontado para container pré-existente sem confirmar propriedade. Storage é necessário para os caminhos de upload; os testes do editor ainda exigem R2 falso. Esta frente não iniciou nem alterou stack de API existente.

## Gate HTTP posterior

O harness opcional `SEUALBUM_API_TESTS=1 python3 scripts/test-db-isolado.py` acrescenta PostgREST local em namespace de rede isolado, sem portas host, e cliente HTTP. Foram aprovadas 46 verificações com JWTs sintéticos, inclusive isolamento, novo GET persistido, conta inativa e concorrência. Isso reduz a lacuna de PostgREST, mas não testa login Auth, cookies/Server Action de navegador autenticado, Storage ou arquivos assinados. A matriz de aceite completa acima continua válida.
