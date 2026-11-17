# Contratos compartilhados — Etapa 02

Baseline d03cf8d. Autoridade: ordem Etapa 02 do usuário, implementação/testes locais e push de desenvolvimento autorizados; sem migration remota, merge, produção, custo ou alteração de permissões externas. Três frentes reais com worktrees isolados.

## Propriedade

IA1: migration 0045, SQL/testes seleção, actions/selecao-entregue.ts, lib/selecao-entregue/, tipos Database (coordenador integra adições), docs SELECTION-CONTRACT.md. IA2: gerenciador fotos, helper fila, testes upload/helper, rotas uploads/projeto-foto (nome original), migration 0047 exclusiva, docs GALLERY-ACCEPTANCE.md. Coordenador: migration 0046 portal e testes, lib/portal/, actions/portal.ts, app/portal/, painel compartilhamento autenticado, configurações e documentos centrais. Não editar migrations antigas ou arquivos de outra frente.

## Seleção e portal

Snapshot separado de favorito e aprovação, revisões serializadas por projeto, chave idempotente e payload comparado. Sessão autenticada ativa: apenas fotógrafo dono e cliente vinculado entregam; equipe atribuída pode ler/exportar mas não decidir pelo cliente. Campos snapshot incluem IDs, bucket, storage_path e nome_original nullable (sem inventar nome de legado). Adicionar nome_original em 0045 se preciso (0047 só altera upload consumo).

Backend disponibiliza função interna **private.entregar_selecao_core(p_projeto_id uuid, p_autor_id uuid, p_portal_id uuid, p_foto_ids uuid[], p_revisao_esperada integer, p_chave uuid) returns jsonb**. Revogar EXECUTE de public/anon/authenticated/service_role; somente wrappers definer com verificação de autorização chamam. p_autor_id para conta ou p_portal_id para concessão, exatamente um preenchido. Retorno jsonb `{id, revisao, total}`. Wrapper autenticado `entregar_selecao` valida ator/capacidade e delega. Core transacional gera snapshot imutável e evento real; portal registra origem distinta de identidade Auth.

Portal 0046 cria concessões por projeto com hash de segredo/código, sessões opacas com hash, expiração, revogação/rotação e limites atômicos de tentativas. Sem cadastro Auth fictício e sem service role. RPCs definer anon têm validação de capacidade explícita em cada chamada; nenhuma policy anon ampla de tabelas privadas. Somente fotógrafo dono ativo gere acesso. Coordenador consome core após verificar sessão portal. Sem exportar notas internas ou perfil completo. Link não carrega código ou sessão.

## Upload

Fila global máximo três execuções por gerenciador, mesmo com lotes novos/retry. Reutiliza operação existente e chave. IA2 adiciona persistência de nome_original no upload, idempotência preserva nome original na confirmação repetida. 0047 pode ser migration no-op documentada se campo já adicionado na 0045; não duplicar coluna à toa. Sem alegar retomada após refresh se arquivo não persistido.

Nenhum preço/cota fictício. Metadados preparam medição futura, mas assinatura/franquias continuam fora do incremento. Todos os arquivos com segredos e pesquisa local ficam fora do Git.

## Integração final de IDs confirmados e criação digital

A RPC guest `portal_entregar(p_sessao_hash text,p_foto_ids uuid[],p_revisao integer,p_chave uuid)` recebe a lista explicitamente confirmada, vinda de `favorita_ids` do resumo. Não relê o rascunho para escolher outro payload durante a confirmação; retry mantém a lista mesmo após mudanças posteriores de favoritos. O core privado continua com a assinatura inicial. Limite técnico de 1000 fotos/entrega e 100 fotos/página.

A 0047 da coordenação reutiliza clientes/projetos para criar galeria sem compra de diagramação, com chave de projeto idempotente. Não houve necessidade de migration de upload separada, pois nome_original entrou na 0045. Rota /dashboard/galerias lista projetos e notificações de seleções recebidas; /dashboard/albuns/[id]/compartilhar reúne upload, acesso e exportação. Não é implementação de assinatura/cota.
