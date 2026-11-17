# Consolidação S1 — 15/11/2026

Branch: `fix/s1-isolamento-producao`. Implementação e testes locais autorizados; sem push, deploy ou migration remota. Alterações anteriores preservadas.

## Correção e alcance

A 0043 separa `pode_produzir_projeto` de papel global: admin/gestor mantêm produção transversal, designer/operador precisam ser responsáveis pelo projeto. `pode_ver_projeto` preserva fotógrafo/cliente vinculados. Contas inativas e claims sem usuário falham fechado nos helpers, conversas e RPCs alteradas.

Policies ALL de versões/lâminas e layouts não podem mais conceder SELECT/escrita transversal de projeto. Layouts de projeto, histórico e aprovações herdam o escopo. O Storage privado de álbuns usa o layout autorizado. Financeiro vinculado a projeto (inclusive INSERT/UPDATE de fatura) e conversas/RPCs foram restringidos. Transferência de responsável/estúdio/cliente e remoção do vínculo de layout exigem gestão. A RPC de reconhecimento confere escopo antes de alterar índice; o comando selfie permanece separado do favorito manual.

A autorização do servidor já passa por sessão real e consultas/RPC com RLS: `projetoParaUpload` consulta `pode_ver_projeto`; `producaoParaUpload` valida papel e projeto visível; `albumParaUpload` valida layout visível. Rotas faciais só chegam à service role após essa checagem. Não foi inserido bypass por service role.

## Antes e depois

O harness recria banco oficial em tmpfs, sem rede/portas, cron desligado; valida exatamente seis falhas antes da 0043 e falha em `not ok`, erro SQL ou plano incompleto. Remove o container em finally. Requer imagens locais, sem pull e sem leitura de .env.

- Antes: 42/48 aprovados, seis acessos indevidos reproduzidos.
- Primeira execução da 0043: matriz original 48/48 passou, mas regressões antigas falharam. Resultados preservados em `evidence/consolidacao/primeira-execucao/`.
- Depois: matriz ampliada **224/224**; oito suítes existentes **288/288**. Total **512/512** verificações após 0043.
- Matriz inclui oito atores, dois projetos/estúdios, fotos/favoritos, projetos, versões, lâminas, layouts/histórico, faturas, conversas/mensagens, criação de versões, reconhecimento, transferência de vínculos, revogação de atribuição, conta inativa, ausência de sub e grants anon.
- Vitest: **546 aprovados, sete ignorados**, 33 arquivos aprovados e dois ignorados. Treze testes de upload incluídos no total.
- TypeScript: `tsc --noEmit --incremental false`, exit 0. ESLint completo: `npm run lint`, exit 0. Diff sem erro de whitespace.
- E2E login: tentativa inicial bloqueada por porta no sandbox; repetição fora do sandbox iniciou Next, mas global setup falhou porque a API Supabase em localhost:54321 está inacessível. **Nenhum cenário E2E foi aprovado nesta execução.** Editor E2E depende do mesmo stack completo e do R2 falso e não foi executado. Não usar apenas SQL para certificar navegador/PostgREST.

## Mudanças nos testes existentes

Não removidos os ataques/regressões. O teste de controle agora espera o projeto atribuído e os dois avulsos legados (três itens), em vez de seis globais. O teste de suporte transversal usa gestor; o operador sem atribuição tem testes negativos na matriz ampliada. Fixtures de produção financeira/expedição atribuem explicitamente o operador e depois o designer antes das ações legítimas. Os testes de cobrança, escaping HTML e isolamento continuam presentes. Uma rodada intermediária parou na preparação de conta inativa; a fixture foi corrigida para desativar pela identidade admin, respeitando `guard_profile_role`.

## Limitações e riscos remanescentes

- Ambiente processa 43 migrations, mas omite somente a criação de segredo Vault de cron na cópia em memória da 0015; não valida Vault/cron ou bootstrap integral de infraestrutura.
- Não há acesso remoto configurado para esta missão. Divergência 0041 permanece documental: README dizia pendente e SQL dizia aplicada. Schema efetivamente implantado **desconhecido**; comentários não são evidência. Nenhum segredo/.env lido ou migration remota executada.
- A05/A06 corrigidos e reproduzidos nos caminhos locais testados. Não há certificação de todas as tabelas/combinações nem conclusão sobre vazamento em produção.
- Álbuns avulsos sem projeto conservam acesso de equipe legado; não ganham tenancy/isolamento por organização. Policies globais de catálogo, perfis, clientes e pedidos ainda precisam de revisão por capacidade na evolução Core; esta migração não transforma o MVP em SaaS multi-organização.
- Não existe concessão explícita nova: atribuição usa `responsavel_id`. Nenhuma nova tabela de concessões/membership.
- Favorito manual segue local; retry de upload é em memória. Upload real, assinatura R2, Stripe/AWS, retenção biométrica e UI não foram certificados por estes testes.
- E2E e baseline remota pendentes impedem declarar a consolidação completa para rollout.

## Roadmap e próxima sprint

P00: correção local e regressão SQL validadas no escopo acima. P02: harness e matriz executáveis, gate completo pendente de API/E2E. P01: baseline local reproduzida parcialmente, remoto pendente. P03: regressões SQL de cobrança preservadas; integração externa pendente. P04/P05 continuam abertos. U01/U02 testados localmente, aceite integrado pendente. Nenhum novo módulo iniciado.

Próxima sprint: stack local completo isolado com Auth/PostgREST/Storage para E2E e testes diretos de API; validar migração/rollback e compatibilidade de links. Após isso, inventário remoto somente leitura explicitamente autorizado e ensaio de rollout. Favorito manual G02/G03 permanece posterior ao gate de isolamento integrado. Não fazer rollback para as policies amplas antigas como solução de compatibilidade.

Commits locais iniciais: `57d1699` (upload) e `48fb616` (escopo/RLS e harness); endurecimento adicional de INSERT financeiro em commit subsequente. Documentação e evidências versionadas separadamente. Pacote bruto Craft Anything/imagens preservado localmente, fora dos commits para evitar versionamento de registros de sessão.
