# Matriz do MVP — comparação com a Fase 01

Baseline examinada: `d7413a5`, PR #2. A classificação abaixo descreve código e evidência local; não certifica operação comercial ou aplicação de migrations no Supabase remoto.

`SEUALBUM-FASE-01.md` não foi localizado entre os arquivos do repositório nesta continuação. A comparação usa o pedido estratégico original **SEU ÁLBUM — FASE 01 | OPERAÇÃO DIGITAL**, fornecido na conversa, e sua organização em [MVP-SCOPE](MVP-SCOPE.md). Não se afirma equivalência com um arquivo externo que não foi disponibilizado com esse nome. Se existir outra versão, reconciliá-la antes de alterar contratos.

Implementado = há comportamento e evidência no escopo indicado. Parcial = existe base reaproveitável, mas falta parte do requisito ou validação integrada. Pendente = o fluxo comercial solicitado não foi identificado como implementado.

| Requisito Fase 01 | Estado | Evidência e limite |
|---|---|---|
| Preservar um único projeto e funcionalidades anteriores | Implementado no incremento | Mesmo monólito Next/Supabase, editor/selfie/prova/extras preservados; commits do PR não criam produto independente |
| Upload de fotografias | Parcial | `src/lib/upload-projeto-foto.ts`, rotas `/api/uploads/projeto-foto`: reserva, PUT, confirmação e retry com identidade conservada; envio real R2 não certificado nesta rodada |
| Organização da galeria | Parcial | `Photo.grupo` e grid em `client-photos-manager.tsx`; gerenciamento premium por fotógrafo e organização completa ainda exigem aceite |
| Identidade visual personalizada | Parcial | Marca e logos de fotógrafo já existem; não comprovado contrato de branding completo por galeria |
| Galeria responsiva | Parcial | Grid e estilos responsivos existentes; suíte demo atual é Chromium desktop, sem aceite em matriz móvel |
| Modal e navegação de imagens | Implementado localmente | Dialog nativo, setas, Escape, foco; dois cenários demo incluem esse comportamento |
| Compartilhamento privado da galeria | Parcial | Área cliente autenticada por projeto; não entrega acesso privado sem cadastro por link e código |
| Marcar/desmarcar imagens individualmente | Implementado localmente | `actions/favoritos.ts`, RPC 0044 `definir_favorito_foto`; foto/projeto/sessão ativa, comando de estado explícito e evento; não aplicada remotamente |
| Contador de favoritas e filtro | Implementado localmente | `client-photos-manager.tsx`, cenários `e2e/demo/galeria.spec.ts` |
| Salvamento do progresso | Parcial | Favorito persistido por RPC e recuperado por HTTP GET no banco descartável; navegador autenticado com recarga ainda não validado |
| Confirmação/entrega da seleção | Pendente | Favorito compartilhado é rascunho. Não há snapshot comercial de entrega identificado em `FotoRow`/fluxo da galeria |
| Exportação/download das fotos escolhidas | Pendente no fluxo de seleção | Exportações do editor não equivalem ao pacote das fotos de uma seleção entregue; exige autorização e snapshot no servidor |
| Identificação dos originais | Parcial | `FotoRow.storage_path`, bucket e ID identificam objetos; `Photo` não expõe nome original durável. Nome local de upload não prova recuperação após recarga; não inventar nome original a partir de UUID |
| Contratação opcional de diagramação Seu Álbum | Parcial | Pedidos, cobrança e operação de diagramação existentes; opção comercial digital separada da assinatura ainda não consolidada |
| Selecionadas disponíveis para equipe | Parcial | Equipe atribuída acessa projeto/favoritos; snapshot entregue imutável e acesso específico ao pacote ainda pendentes |
| Comunicação fotógrafo/equipe | Implementado em código existente | `actions/mensagens.ts`, `mensagens-servidor.ts`, migration 0037 e restrições 0043; integração operacional/notificações externas não certificadas |
| Diagramação externa pelo fotógrafo | Parcial | Upload de lâminas/versões e prova são reaproveitáveis; escolha externa e encaminhamento comercial completo ainda precisam de integração |
| Upload de álbum diagramado | Parcial | Rotas de upload de lâmina e actions de versões existem; validar o caminho externo de ponta a ponta |
| Visualização de páginas e comentários | Implementado em código existente | `components/cliente/proof/`, `components/cliente/painel/`, `actions/painel-cliente.ts` e `prova-fotografo.ts`; preservar contratos atuais |
| Solicitação de alterações e versões | Implementado em código existente | Prova completa/parcial, comentários e decisões em migrations 0032/0039; browser integrado ainda é gate |
| Registro de aprovação final | Implementado em código existente | Aprovação da versão liberada, independente de favorito; regressões SQL de prova/cobrança preservadas |
| Timeline com eventos, datas e responsáveis | Parcial | `project-timeline.tsx` deriva indicador de status, sem datas/atores. `projeto_atividades` é base, mas pode conter notas internas; precisa eventos com visibilidade explícita |
| Portal por link e código sem cadastro | Pendente | `/album/[token]` é aprovação avulsa, não portal completo de projeto por link/código |
| Revogação do acesso pelo fotógrafo | Pendente no portal novo | Não identificado contrato de concessão revogável do portal; não confundir sessão autenticada ou token avulso com esse requisito |
| Portal unificando seleção, timeline e aprovação | Parcial | Hub cliente autenticado existente; novo acesso sem cadastro e entrega de seleção pendentes |
| Notificações essenciais | Parcial | Mensagens/realtime/não lidas existem; entrega externa, outbox, retry e deduplicação precisam contrato e testes |
| Assinatura mensal | Pendente como operação SaaS | Planos/Checkout/fechamento existem em `lib/stripe.ts`; não comprovam recorrência implementada com ciclo de vida da assinatura |
| Limites de armazenamento por plano | Pendente | Reservas de upload não equivalem ao ledger de bytes/franquias atômicas de um plano |
| Armazenamento adicional contratado | Pendente | Sem produto/entitlement e reconciliação de consumo implementados no fluxo examinado |
| Diagramação cobrada separadamente | Parcial | Serviço/pedido/extras têm base financeira; separação comercial da nova assinatura ainda precisa fechamento |
| Consumo de armazenamento e tráfego | Pendente | Falta medição/reconciliação e política de cobrança/limites no servidor |
| Permanência conforme assinatura ativa e limites | Pendente | Requer ciclo de vida de assinatura, consumo, carência/retenção aprovados; não executar exclusão automática com hipótese comercial |
| Sem preços definitivos não aprovados | Preservado no incremento | Não foram fixados novos preços definitivos; hipóteses históricas não devem ser ativadas automaticamente |
| Roadmap: editor, sites, CRM, impressão, logística, expansão Pixieset | Preservado | Editor/CRM/expedição já têm bases; futuros produtos permanecem no roadmap, sem declarar pesquisa parcial como implementação |

## Infraestrutura e maturidade da evidência

- Migrations 0043/0044 e permissões foram exercitadas no banco descartável; HTTP PostgREST usa JWTs sintéticos. Isto não certifica emissão/renovação de sessão Auth nem schema remoto.
- Storage legado e R2 coexistem. Arquivos públicos de vitrine não devem ser tratados como originais privados. SQL de Storage, autenticação nas rotas e assinatura de objeto precisam ser testados em conjunto antes do aceite comercial.
- CI do PR #2 cobre TypeScript, lint e Vitest. O gate de publicação Vercel atesta build/deployment, não presença das migrations, R2/IAM/CORS ou jornada comercial.
- A consulta remota de migrations foi anteriormente bloqueada por 403. Não inferir implantação de 0041–0044 a partir de comentários do SQL ou sucesso de build.

## Ordem para reduzir retrabalho

1. Fechar o gate de ambiente: baseline remota somente leitura quando houver acesso; Auth/Server Action/Storage em stack descartável e preview com configuração de homologação confirmada.
2. Entrega de seleção: contrato transacional, revisão/idempotência, originais e exportação autorizada; independente do favorito e da aprovação.
3. Portal revogável: concessão por projeto, código verificado no servidor e controle de tentativas; somente depois conectar a seleção/fluxos existentes.
4. Consolidar diagramação externa/contratada e prova; emitir timeline com fatos reais e visibilidade explícita.
5. Implementar assinatura, ledger/cotas/tráfego e retenção após regras comerciais aprovadas. Não bloquear incrementos locais independentes por falta de acesso remoto.
