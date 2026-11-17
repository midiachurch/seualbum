# Operação Digital — arquitetura e contratos

16/11/2026. Desenvolvimento incremental autorizado pelo pedido Fase 01. Um único monólito Next/Supabase; editor, selfie, prova, extras e integrações preservados. Sem produção ou migration remota nesta rodada.

## Contrato inicial compartilhado

O primeiro incremento fecha favorito manual persistido na galeria autenticada existente. Favorito compartilhado por projeto é rascunho, não seleção entregue nem aprovação final. Não reutilizar `favoritar_fotos` (selfie).

- Server action em `src/lib/actions/favoritos.ts`: `definirFavoritoFoto(projetoId: string, fotoId: string, favorita: boolean): Promise<{ok:true}|{ok:false;erro:string}>`.
- RPC `definir_favorito_foto(p_projeto_id uuid, p_foto_id uuid, p_favorita boolean)`: comando idempotente, sessão ativa e projeto autorizado, foto pertencente ao projeto; sem service role. Origem manual em histórico sem texto de selfie. Policies existentes não devem ganhar escopo.
- UI usa valor explícito, bloqueia duplicação por foto durante gravação, restaura estado em falha e apresenta erro. Contador e filtro de favoritos; modal com teclado e foco acessíveis. Modo demo explicitamente demonstrativo.
- Backend detém action, migration 0044 e SQL/testes unitários próprios. Frontend detém apenas gerenciador de fotos. Integração detém testes de contrato, documentação de fluxos/gates e avaliação E2E.

## Próximos contratos, ainda não implementados

Portal sem cadastro exige credencial específica revogável, código verificado no servidor, expiração/rate limit, nenhuma leitura anon ampla. Entrega de seleção exige snapshot transacional com originais identificáveis; favorito continua independente. Timeline usa eventos reais persistidos e ator/data, nunca datas simuladas. Assinatura e franquias exigem ledger de reservas/consumo servidor, provedor e regras comerciais aprovadas. Não lançar cotas fictícias nem preços definitivos.

Três frentes usam branches/worktrees independentes e integração pelo coordenador após revisão. Gate SQL anterior continua obrigatório; novo recurso não certifica tenancy global. API/E2E, baseline remota e ensaio de rollout continuam gates comerciais.
