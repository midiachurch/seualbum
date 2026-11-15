# Auditoria técnica classificada

Atualização S1: A03/A04 (identidade, erro/retry) tratados no código local, mantendo fila U03 pendente. A05/A06 reproduzidos antes e bloqueados após 0043 na matriz de 223 verificações. A07 (remoto) e A08 (API/E2E completo) continuam abertos. A01/A02 não alterados. A tabela abaixo preserva achados da baseline; evidências vigentes em [CONSOLIDACAO](../sprints/CONSOLIDACAO.md).

Confirmado = leitura inequívoca do artefato local, não incidente em produção. Suspeito = hipótese de impacto/política desejada. Dependente de testes = comportamento ou implantação não observado. Prioridade P0 impede expansão de escopo; não implica ataque comprovado.

| ID | Classificação / prioridade | Evidência e conclusão | Validação/encaminhamento |
|---|---|---|---|
| A01 | Confirmado / P1 | `client-photos-manager.tsx`, `toggleFavorite`: só setState; não persiste estrela manual | Reabrir tela em teste; G01–G03 |
| A02 | Confirmado / P1 | Migration 0042 `favoritar_fotos`: só favorita=true, até 1000, escopo por projeto e log com texto de selfie | Reutilizar autorização/infra, definir comando manual reversível e origem correta; não chamar como toggle |
| A03 | Confirmado / P1 | Componente usa URL do upload, preservando id temporário novo-*; helper `uploadProjetoFoto` já retorna id/storagePath/meta | Consolidar identidade persistida; U01 |
| A04 | Confirmado / P1 | catch do upload no componente só desliga uploading; não mostra erro nem retry; envios em forEach sem fila limitada nesse consumidor | Estados por arquivo e orçamento de concorrência; U02/U03 |
| A05 | Confirmado / P0 | `pode_ver_projeto` (0002) contém OR is_equipe(); 0021 inclui designer em is_equipe. O helper não restringe designer à atribuição | P00: testar designer não atribuído diretamente na API/RPC; não confiar na fila filtrada |
| A06 | Suspeito / P0 | Intenção de designer/operador restrito aparece em comentários/UI, mas SQL dá escopo de equipe amplo; foto SELECT e RPC de favorito usam helper | Decidir política de equipe e separar leitura/edição/gestão. Exposição real depende das policies/grants implantadas |
| A07 | Confirmado no fonte / P0 | 0041 adiciona travas de campo/papel e proteção de observações internas; README e comentários discordam sobre implantação | P01: obter baseline autorizado; não executar migrations nesta missão |
| A08 | Dependente de testes / P0 | RLS/triggers, grants e SECURITY DEFINER locais foram inspecionados, não o catálogo remoto efetivo | Testes negativos por papel, estúdio e projeto em clone isolado; inventário de funções e search_path |
| A09 | Confirmado / P1 | Estúdio ligado ao UID de fotógrafo; não há organização/membership nas 42 migrations | Evolução compatível de tenancy, sem tabela de usuário paralela; C01/C02 |
| A10 | Confirmado no fonte / P1 | Prova/aprovação/fatura estão em RPCs/triggers e não são a estrela de fotos; fechamento usa valor do banco | Preservar testes de aprovação e cobrança em cada mudança de domínio |
| A11 | Dependente de testes / P0 | Webhook verifica assinatura sobre corpo bruto; metadata separa pedido e fatura; confirmação e valor em lib/stripe | Replay, valor divergente, concorrência retorno/webhook e estado terminal; P03 |
| A12 | Confirmado / P1 | Demo depende da ausência de URL Supabase e usa cookie local; não prova comportamento real | Verificar bloqueio de demo não configurado em produção e contratos que não silenciem falhas; P04 |
| A13 | Dependente de testes / P1 | Reconhecimento: consentimento na rota, opt-in/60 dias no SQL, índice privado, rate-limit e fila de remoção | Validar IAM, retenção real, exclusão, custo e finalidade; P05; sem conclusão de conformidade legal |
| A14 | Confirmado / P2 | Comentários de platform.ts/sidebar dizem schema mock/client-admin enquanto tipos/código já têm seis papéis | Registrar documentação divergente; corrigir comentários só em implementação autorizada |
| A15 | Suspeito / P1 | Reuso de pode_ver_projeto como acesso a upload/busca/favorito mistura capacidade de ler e de alterar | Decompor capacidades por operação após decisão de política; P00/C03 |
| A16 | Dependente de testes / P1 | Contratos de repetição do upload já têm confirmação idempotente por chave, mas novo helper gera novo UUID por chamada | Testar PUT concluído + confirmação perdida; retry precisa conservar chave/ID da tentativa |
| A17 | Confirmado / P2 | CI executa tipos/lint/Vitest; pgTAP/Playwright existem fora desse job | Planejar gates locais e CI isolados, sem instalar nada agora |

## Limites do parecer

Não houve exploração de contas, requisições adversariais ou acesso ao banco. A05 é uma constatação da composição das funções locais, não prova de vazamento remoto. Não declarar RLS segura nem vulnerabilidade implantada sem P00/P01. O inventário textual não resolve todos os grants implícitos, policies permissivas combinadas, funções sobrecarregadas, proprietários ou FORCE RLS.

Detalhes de prioridades e critérios no [backlog](../roadmap/BACKLOG.md). Pesquisa visual externa permanece [parcial](../research/pixieset/README.md).

## Fontes focais para reprodução da leitura

- [Gerenciador de fotos do cliente](../../src/components/cliente/client-photos-manager.tsx), [contrato do upload](../../src/lib/upload-projeto-foto.ts) e [rotina R2](../../src/lib/upload-r2.ts).
- [Action de reconhecimento/favoritos](../../src/lib/actions/reconhecimento.ts) e [migration 0042](../../supabase/migrations/20261021000100_0042_reconhecimento_facial.sql).
- [Helper e policies base](../../supabase/migrations/20260921022721_0002_plataforma_completa.sql), [inclusão do designer na equipe](../../supabase/migrations/20260927230855_0021_workspace_designer.sql) e [travas 0041](../../supabase/migrations/20261013000100_0041_travas_seguranca.sql).
- [Autorização das rotas de upload](../../src/lib/r2/sessao.ts), [proxy](../../src/proxy.ts), [helpers de acesso](../../src/lib/supabase/queries.ts) e [papéis de apresentação](../../src/types/platform.ts).
- [Webhook de pagamento](../../src/app/api/webhooks/pagamento/route.ts), [confirmação Stripe](../../src/lib/stripe.ts) e [faturamento](../../src/lib/actions/faturamento.ts).
