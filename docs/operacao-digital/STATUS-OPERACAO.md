# Status da Operação Digital — Etapa 02

## Retomada (Claude, 21/11/2026, após limite do Codex) — LEIA PRIMEIRO

O Codex parou com três frentes locais ainda **não documentadas e sem commit**, na central `/operacao-local`:

- **Loja com checkout simulado** (`src/lib/operacao-local/loja.ts`, `src/components/operacao-local/loja-local.tsx`): carrinho por galeria, compra idempotente por chave, conferência de total/comissão esperados, pago/recusado simulado. Sem pagamento real.
- **Assinatura simulada** (`assinatura.ts` + teste, `assinatura-local.tsx`): ciclo, faturas, adicional de armazenamento (padrão R$19/100 MB-escala local), cálculo de consumo. Capacidade segue ilustrativa, sem bloqueio de upload.
- **Mensagens/notificações locais** (`mensagens-notificacoes.test.ts`) e produção local (`producao.ts`).

**Correções feitas nesta retomada (mínimas, sem mudar comportamento):** `loja.ts` linha da compra usava `resumo.totalCentavos` (`number | null`) após o guard de nulo, que o TS não estreita com `falhar` inferido; aplicado `!` como nas linhas vizinhas. `loja-local.tsx` atualizava `estadoRef.current` durante o render (aviso `react-hooks/refs`); movido para `useEffect`.

**Gates após a correção:** `tsc --noEmit` exit 0; `eslint .` exit 0 sem avisos; Vitest 662 aprovados/7 ignorados (48 arquivos aprovados/2 ignorados). **Não executados nesta retomada:** Playwright (`test:e2e:local`), pgTAP das migrations 0048/0049 (Docker indisponível antes) e build. Os números de Chromium e SQL abaixo são do Codex e não cobrem loja/assinatura/mensagens.

**Construído após a retomada (autorização do usuário: construir tudo localmente; aprovações e publicação ficam para a revisão dele):**

- **SQL das migrations 0048/0049 executado:** Docker disponível; `scripts/test-db-isolado.py` com 50 migrations: **737 verificações, 17 arquivos, todos OK** (portal_prova 28, notificacoes_leitura 12 e o novo franquia_galeria 23). Resultado histórico de 674 acima fica superado.
- **Playwright local:** 9/9 Chromium aprovados. Não cobre loja nem os fluxos de assinatura além do que já existia; continua pendente.
- **Migration 0050 (`franquia_galeria`), local, NÃO aplicada remotamente:** coluna `fotos.tamanho_bytes` (nula em fotos antigas, nunca estimada), catálogo `planos_galeria` (Essencial R$49/10 GB, Profissional R$99/100 GB, Estúdio R$199/500 GB — hipóteses simuladas), `assinaturas_galeria` (snapshot do plano, origem sempre simulada, histórico preservado), RPC `escolher_plano_galeria` (idempotente por chave, troca encerra a anterior) e `consumo_franquia_galeria` (usado, % e situação sem_plano/dentro/alerta ≥80%/excedida; informa quantas fotos ainda não têm medição). Escrita só por RPC; RLS por fotógrafo/equipe.
- **Decisão deliberada: medir, não bloquear.** Nenhum upload ou acesso é bloqueado por franquia. Bloqueio é decisão comercial/contratual (a documentação veda que expirar assinatura inviabilize o acervo); a medição está pronta para receber um bloqueio por flag quando aprovado.
- **App:** confirmação de upload grava `tamanho_bytes` com o tamanho do HeadObject (não do navegador); action `escolherPlanoGaleria`; cartão "Armazenamento e plano" em `/dashboard/galerias`, com falha suave ("temporariamente indisponível") se a 0050 ainda não existir no banco. Testes unitários novos para a action e o formatador (que pegou um defeito real: "10,0 GB").
- **Gates finais:** `tsc` 0, `eslint` 0, Vitest **676 aprovados/7 ignorados**, build de produção ok (central local segue 404).
- **Pendências desta frente:** teste de navegador autenticado do cartão de plano (exige Auth/Supabase local), bloqueio opcional por franquia, `organization_id`/membros (ADR-002), cobrança real (ADR-004) e custo unitário dos planos.

### Ciclo seguinte — decisões tomadas pelo agente com base em práticas de mercado (autorização do usuário: decidir sem perguntar; revisão posterior)

- **0051 `organizacoes` (ADR-002, fundação aditiva):** `organizacoes` (uma por fotógrafo legado, backfill + trigger nos cinco pontos de criação), `organizacao_membros` com papéis dono/admin/editor/visualizador (padrão de plataformas de fotógrafos), exatamente um dono ativo, `projetos.organizacao_id` (nulo permitido, preenchido por backfill/trigger). RPCs `adicionar_membro_organizacao` (só membro já cadastrado, sem e-mail de convite), `remover_membro_organizacao`, `listar_equipe_organizacao`, `papel_na_organizacao`. Regras: só o dono promove/altera admin; admin gerencia editor/visualizador; dono não é removível; qualquer membro pode sair; cliente final nunca é membro. **Nenhuma RLS existente foi alterada** — a autorização continua por `fotografo_id`; policies multi-org ficam para ensaio em sombra, como pede o ADR. 37 verificações pgTAP.
- **Regressão encontrada e corrigida antes do commit:** a primeira versão usava `ON DELETE RESTRICT` e quebrava a exclusão de contas (`travas_seguranca`, que passava antes). Agora `CASCADE` na organização e `SET NULL` no vínculo do projeto: exclusão de conta (inclusive LGPD) não pode ser bloqueada.
- **Tela `/dashboard/equipe`** + actions `adicionarMembroEquipe`/`removerMembroEquipe`: lista, adiciona por e-mail de quem já tem conta, escolhe papel, remove ou sai. A UI só reflete o que o banco permite; quem pode o quê é decidido no SQL.
- **0052 `franquia_permite_envio`:** só decide sobre **novos** envios (leitura/download nunca passam por ela); sem plano sempre permite; o consumo é do dono do projeto; devolve apenas booleano, para não expor consumo a cliente final ou equipe; exige acesso ao projeto. 10 verificações.
- **Aplicação na rota de upload, atrás de flag desligada por padrão:** `SEUALBUM_FRANQUIA_BLOQUEIA_ENVIO=1` faz `POST /api/uploads/projeto-foto` recusar com 403 `franquia_excedida` e mensagem clara ("suas fotos continuam disponíveis"). **Falha aberta:** erro na medição nunca derruba o upload. Ligar a flag é decisão comercial, pois fotógrafos com plano escolhido passariam a ser limitados.
- **Gates:** SQL **784 verificações em 19 arquivos, todos OK** (as linhas `not ok` em `before-0043.tap` são a linha de base histórica reproduzida de propósito); Vitest **690 aprovados/7 ignorados**; `tsc` 0; `eslint` 0; build de produção ok.
- **Pendências:** convite por e-mail para quem ainda não tem conta, policies multi-org em sombra, transferência de titularidade, cobrança real (ADR-004), custo unitário, navegador autenticado das telas de plano e equipe.

### Ciclo seguinte — autorização ampliada: decidir também o que antes ficara em aberto, pelo mercado

- **Bloqueio de novo envio por franquia agora LIGADO por padrão** (`SEUALBUM_FRANQUIA_BLOQUEIA_ENVIO=0` desliga). Segue o padrão de plataformas de galeria: só barra envios novos, nunca leitura/download; só quem escolheu plano é limitado (sem plano o banco sempre permite); falha de medição não derruba o upload. A consulta passou a vir **depois** da checagem de chave existente, evitando consulta inútil. A mensagem do 403 chega à tela (o cliente de upload propaga o campo `erro`).
- **0053 `convites_organizacao` — convite por link para quem ainda não tem conta:** o app gera o segredo e envia só o hash (domínio separado, `convite:`); o banco nunca guarda o token e a coluna `token_hash` não é legível nem pelo dono (grant por coluna). Validade de 7 dias, uso único, preso ao e-mail do convidado, revogável; reemitir invalida o link anterior; no máximo 50 pendentes por organização. Aceite devolve **uma única mensagem** para link inexistente/expirado/usado/revogado/de outro e-mail (não permite sondar). Quem já é membro ativo não é promovido nem rebaixado pelo convite; cliente final não aceita. Papéis: só o dono convida/revoga administrador. **Não envia e-mail** (exigiria provedor e custo): o dono copia o link. 27 verificações.
- **App:** actions `criarConviteEquipe`/`revogarConviteEquipe`/`aceitarConviteEquipe`; a tela Equipe ganhou "Convidar por link" (link exibido uma única vez, copiar, lista de pendentes, revogar) e a página `/dashboard/convite/[token]` (sem login o proxy leva ao acesso e devolve; `noindex`, `no-referrer`; a página não confirma se o convite existe).
- **Gates:** SQL **811 verificações em 20 arquivos, todos OK**; Vitest **701 aprovados/7 ignorados**; `tsc` 0; `eslint` 0; build de produção ok.
- **Continua fora, por motivo técnico e não de decisão:** aplicar 0048–0053 no Supabase remoto (a CLI recebe 403; não se contorna permissão) e qualquer deploy de produção, que o usuário reservou para a revisão dele.
- **Pendências:** envio de e-mail do convite (depende de provedor), policies multi-org em sombra, transferência de titularidade, cobrança real (ADR-004), custo unitário, navegador autenticado das telas de plano/equipe/convite.

### Ciclo seguinte — "construir até a estrutura inteira ficar pronta" (decisões pelo mercado, sem pausas)

Migrations locais 0054–0084, **nenhuma aplicada remotamente** (a CLI continua recebendo 403). Suíte SQL integrada: **64 migrations, 30 arquivos .test.sql, todos OK**; Vitest **845 aprovados/7 ignorados**; `tsc`, `eslint` e build de produção ok. Detalhes por módulo em `docs/operacao-digital/modulos/`.

- **C03 — 0054 capacidades por organização:** leitura para todo membro ativo; escrita (fotos, projeto, linha do tempo, portal) só dono/admin/editor; **financeiro (faturas) segue fechado a membros** (a policy restritiva `producao_escopo` continua valendo). `pode_ver_projeto` e as policies existentes ficam intactas; organização do projeto imutável e sem associação cross-org. **Regressão pega pelo `travas_seguranca` e corrigida:** a trava consultava `organizacoes` sob a RLS do chamador e recusava a gestão legítima; agora pergunta por função de definição segura. 34 verificações.
- **S01–S04 — 0055 Store (venda do estúdio, ADR-004):** contexto financeiro próprio; **preço sempre calculado no banco** (o cliente nunca envia total) com snapshot no pedido; chave idempotente; máquina de estados com estados finais que **nunca reabrem**, valor divergente **não aplicado** e estorno fora de ordem tratado; entrega só de mídia do próprio pedido e só se **pago** (estorno derruba o acesso na hora); falhas de entrega registradas. Comprador é o convidado do portal (reaproveita `private.portal_validar`). **Pagamento exclusivamente simulado e fecha em produção** (`SEUALBUM_STORE_PAGAMENTO_SIMULADO=1` + `VERCEL_ENV!=production`); o banco só aceita provedor `simulado` (CHECK) — gateway/split/tributos dependem de contrato e migration própria. Token de entrega derivado da chave (retry devolve o mesmo link; `SEUALBUM_STORE_PEPPER` opcional). 82 verificações.
- **G04/G06 — 0056 coleções e download:** coleção é visão sobre as mesmas fotos (sem copiar mídia; remover não apaga foto); **download dos originais desligado por padrão**, liberado por galeria com validade e limite por acesso, cada baixada registrada, URL de 5 min, nunca original público. 60 verificações.
- **Booking (B01–B04) — 0060–0062:** agenda por recurso com `EXCLUDE USING gist` + advisory lock (8 sessões no mesmo slot: 1 hold, 7 recusas), hold de 10 min sem cron, fuso/DST testados, página pública `/agendar/[slug]` anônima e painel `/dashboard/agenda`; sinal simulado, reembolso manual. 207 verificações.
- **Studio (T01–T04) — 0080–0084:** funil comercial separado da produção, histórico imutável, tarefas, modelos com prévia, linha do tempo e **outbox sem envio real** (3 travas: constraint, configuração, adaptador `registro`); descadastro por canal. 301 verificações. Bug pego e corrigido pelos testes: membro removido conseguia alterar tarefa (NULL passando por `not`).
- **Em andamento (agentes em worktree, ainda não integrados):** Sites (0070+) e seleção→álbum/Design (0090+).
- **Erro meu corrigido antes do push:** um `git add` pegou a pesquisa do Pixieset (`investigation.cany`); removida do commit, segue intacta e sem versionar.
- **Pendências reais:** e-mail/SMS (convite, reserva, outbox) dependem de provedor e custo; cron para outbox/automações; sincronização de calendário externo; gateway real + estorno automático (ADR-004); tela de Estúdio/Agenda para membros com papel `designer` (as RPCs já os tratam, falta decisão de rota); LGPD/retenção de contato de visitantes; policies multi-org em sombra para financeiro; navegador autenticado das telas novas (exige Supabase local completo).

**Estado do Git:** commits locais feitos na branch de desenvolvimento (ver log); sem merge, produção ou migration remota. Antes disso nada estava commitado. Atenção ao commitar: `Projetos Rafael/` (projetos de referência do autor, fora do escopo do repositório), `docs/research/pixieset/investigation.cany/` e capturas de pesquisa são não rastreados e devem ser tratados à parte. Sem push, merge, migration remota ou produção.

**Próximos passos sugeridos (alinhados à direção de plataforma recorrente):**
1. Rodar `test:e2e:local` e incluir cenários de loja e assinatura; documentar resultado.
2. Rodar pgTAP de 0048/0049 quando houver Docker.
3. Persistir plano, franquia e consumo **no servidor** (RLS/RPC) em vez do navegador: contrato de entitlements separado dos contextos financeiros da ADR-004.
4. Desenhar `organization_id`/membros (ADR-002) antes de qualquer plano de estúdio com equipe.
5. Medir custo unitário (GB, busca facial, exportação) para validar os planos R$49/99/199.

## Ciclo local — 21/11/2026

**Atualização comercial autorizada:** o usuário delegou preços simulados e fluxos operacionais. A central agora inclui planos Essencial R$49/10 GB, Profissional R$99/100 GB e Estúdio R$199/500 GB, editor de mensalidade/capacidade/comissão, edição de catálogo e financeiro por solicitação. Comissão inicial de 10% em produtos de eventos; serviços e seleção com 0%. Exemplos novos: diagramação R$199 e coleção digital R$99. São hipóteses próprias inspiradas em fontes oficiais, não cotações de mercado brasileiro ou preços definitivos; [fontes e decisões](OPERACAO-LOCAL.md). Estados existentes mantêm seus valores. Preços e comissão ficam registrados no pedido e condições do plano na assinatura; edição posterior vale para novas operações. Capacidade continua ilustrativa, sem bloqueio de uploads ou exclusão. Validação incremental: 647 unitários aprovados/7 ignorados e 9/9 Chromium, incluindo alteração de planos, recarga e preservação dos valores de solicitações anteriores. Os registros de 641/7 abaixo descrevem a entrega anterior.

Pedido vigente: construir localmente sem depender de GitHub, Supabase ou outros serviços externos, publicando depois. [Escopo, três fases e execução](OPERACAO-LOCAL.md). A Etapa 02 abaixo permanece como registro histórico.

- **Central `/operacao-local`:** galerias de seleção e inteligentes, importação validada com arquivos em IndexedDB, favoritos, snapshots revisionados/idempotentes, confirmação congelada, CSV e ZIP dos originais (limite técnico de 100 MB por operação). Cadastro de eventos e catálogo de produtos/serviços vinculado à galeria, solicitações com transições e assinatura explicitamente simuladas. Sem preços predefinidos, cobrança ou reconhecimento facial automático; agrupamento por participante é manual. O motor facial existente foi preservado.
- **Persistência:** schema versionado validado, vínculos por proprietário, leitura do estado mais recente antes de comandos e sincronização entre abas. Dados corrompidos são preservados e bloqueiam gravação. Isso é ambiente de desenvolvimento no navegador, não Auth/RLS ou compartilhamento privado entre pessoas.
- **Produto existente:** migration local 0048 e UI/action/rota conectam prova guest à última versão liberada, comentários por lâmina e solicitação de ajustes, com validação de capacidade e trilha de origem; aprovação financeira não foi alterada. Migration local 0049 e UI/action adicionam leitura de notificação exclusiva pelo destinatário ativo. Nenhuma migration remota foi executada.
- **Validação executada:** 641 testes unitários aprovados, 7 ignorados (45 arquivos aprovados, 2 ignorados); lint sem erros/avisos; 7/7 testes Chromium de ponta a ponta aprovados sem solicitações externas no navegador. Os cenários cobrem persistência dos arquivos após recarga, snapshot separado de favoritos, conteúdo binário do ZIP, código/revogação local, agrupamento manual, solicitação e assinatura simuladas, evento/catálogo, teclado/foco/layout móvel, arquivo inválido, corrupção e confirmação entre duas abas. Capturas desktop/móvel inspecionadas.
- **SQL preparado:** 28 verificações pgTAP de prova e 12 de leitura de notificações. Não executadas neste ciclo: daemon Docker indisponível. Os resultados SQL históricos abaixo não certificam as migrations novas.
- **Preservação:** pesquisa local e novo diretório independente `Projetos Rafael/` mantidos. TypeScript/ESLint excluem esse checkout aninhado para não compilar outro projeto junto. Nenhum push, publicação, merge, produção, instalação ou custo adicional.

Build e TypeScript finais: ver registro de fechamento deste ciclo em OPERACAO-LOCAL. A central é restrita ao desenvolvimento com flag explícita; build de produção devolve 404 nessa rota, mesmo com a flag do launcher.

Data do ciclo: 17/11/2026. Base preservada `d03cf8d`; desenvolvimento em `feat/operacao-digital`. O arquivo estratégico foi reconstruído com origem explícita em SEUALBUM-FASE-01.md; não foi alegada recuperação do original.

## Implementado e integrado localmente

- **Entrada digital independente:** /dashboard/galerias e RPC 0047 criam cliente comercial sem conta obrigatória e projeto nas tabelas existentes, sem pedido de serviço/produção física. Chave idempotente e isolamento de proprietário. Reutiliza cliente de mesmo fotógrafo quando nome/e-mail coincidem.
- **Upload:** fila global de 3 por gerenciador, lotes sucessivos e retry da mesma operação, identidade/chave estáveis, validação de tipo/tamanho e HEIC sem MIME, estados por arquivo e progresso geral por arquivos concluídos. Nome original sanitizado persistido apenas na primeira confirmação e recuperado pelo mapper. Não promete retomada de arquivo após refresh nem porcentagem real de bytes.
- **Seleção:** RPC 0045, snapshot revisionado/imutável, payload explícito, idempotência, conflito de revisão, evento e notificação interna deduplicados. Contas fotógrafo dono/cliente vinculado podem entregar; equipe autorizada lê/exporta sem decidir pelo cliente.
- **Exportação:** CSV seguro com nomes conhecidos/IDs e links temporários autenticados para R2/Storage (5 min), assinatura em lotes. Não implementa ZIP único e não inventa nome de legado desconhecido.
- **Portal guest:** concessão por projeto, link/código sem cadastro, hash de segredo/sessão, código bcrypt, limite atômico de 10 falhas/15 min, validade do acesso de 30 dias/sessão de 8 horas, rotação/revogação. Cookie HttpOnly/Lax/path específico, Secure em produção. Sem usuário Auth fictício, sem service role e sem leitura anon ampla. Operações revalidam escopo e proprietário ativo. IDs explicitamente confirmados são entregues sem substituir o payload por rascunho concorrente.
- **UI portal:** galeria responsiva, marca/nome/logo, favoritos compartilhados, paginação de 100 fotos, modal/teclado/foco, confirmação e estado de erro. R2 lido por rota que revalida capacidade e emite URL de 60 s. Storage legado não é liberado por bypass.
- **Timeline/notificações:** criação com data real (autor de origem não inventado) e entregas do portal com concessão/data; seleção recebida aparece na área de galerias do fotógrafo. Não lê notas internas. Demais etapas/inbox com leitura ainda pendentes.

## Agentes e integração

Dois agentes auxiliares foram efetivamente iniciados sobre d03cf8d: IA1 em `feat/od-etapa2-selecao` / `/private/tmp/seualbum-etapa2-selecao`; IA2 em `feat/od-etapa2-upload` / `/private/tmp/seualbum-etapa2-upload`. IA1 entregou seleção/exportação/core e concorrência; IA2 entregou fila/nomes/validação e testes. Coordenação integrou os arquivos exclusivos, Database e pontos compartilhados; não copiou .env, dependências ou Git entre entregas. Nenhuma branch antiga foi sobrescrita.

Os dois agentes auxiliares concluíram os incrementos; IA1 também entregou o gate positivo de navegador. A coordenação revisou, integrou e repetiu o gate no checkout principal. Agora não há tarefa auxiliar ativa; coordenação permanece responsável pela publicação e acompanhamento.

## Verificações

- Unitários integrados: 606 aprovados, 7 ignorados; 40 arquivos aprovados, 2 ignorados.
- SQL integrado: **674/674** verificações aprovadas; 47 migrations, incluindo 0045–0047. Inclui retry dos IDs confirmados após rascunho mudar e foto cruzada negada. Container descartável sem rede externa; 0015 omite somente criação do segredo Vault/cron na cópia de teste.
- HTTP PostgREST:64 verificações aprovadas, incluindo portal por código/capacidade, snapshot, leitura cruzada negada e revogação. JWTs apenas sintéticos para atores autenticados; guest usa sessão opaca sem Auth.
- Concorrência real: duas sessões SQL,uma entrega aceita e um conflito 40001, um snapshot persistido.
- Demo Chromium:5/5 aprovados, incluindo fila/HEIC e formulário guest fail-closed. Não certifica mídia ou sucesso integrado de login.
- Navegador guest positivo: **1/1 Chromium** no checkout integrado, com Next/Server Actions/PostgREST/SQL reais: código, cookie, ausência de cadastro Auth, favorito após recarga, snapshot/revisão/notificação e revogação. Somente mídia foi substituída; não certifica R2 real.
- TypeScript/lint/build webpack: **exit 0** no gate final, após reforço de IDs explícitos e integração. Build usa credenciais reais desativadas e mantém avisos de HEIC/Tailwind/lockfile já conhecidos.

Uma primeira fixture de portal violou corretamente a trava de pasta R2; corrigido o caminho sintético. Outra expectativa assumia negação por grant onde o contrato é SELECT com RLS/zero linhas; corrigida para exigir zero fotos privadas. Um seletor de alerta conflitou com o anunciador do Next; passou após restringir ao main. Nenhuma policy foi afrouxada para passar testes.

## Infraestrutura e bloqueios

Etapa 02 publicada até **cd986e8** e PR #2 atualizado, aberto/draft confirmado. **CI success** no run 44009963932 e **Vercel Preview success** no deployment 7843216905, ambos do mesmo SHA. [Preview verificado](https://seualbum-k3ohahc7i-midiachurch.vercel.app), protegido por autenticação Vercel (HTTP 302). Nenhuma produção ou migration remota. Este registro de publicação é documentação posterior à implementação; o head atual e seus checks ficam disponíveis no PR. Pesquisa local não versionada e seus 20 arquivos preservados por hash. Histórico d03cf8d mantido.

Supabase: associação local `seu-album` confirmada e URL local corresponde ao ref; CLI com rede permitida recebe 403 na role de login antes do histórico. Nenhuma migration remota, consulta de dados de cliente ou contorno de permissão. Intervenção humana e gates em BLOQUEIOS.md.

Vercel: preview protegido por login; procedimento é entrar com conta autorizada ou solicitar acesso ao responsável. Nenhum bypass ou remoção da proteção. Ready não é homologação funcional. Variáveis/serviços de staging não foram certificados.

## Pendências reais

Navegador autenticado do fotógrafo, R2/Storage API reais/IAM/CORS/URLs expiradas, mídia legada no portal guest, prova/comentários/mensagens guest, escolha comercial própria/contratada e passagem de estado integrada, timeline de todas etapas e marcação de leitura das notificações, assinatura/franquias/adicional/tráfego e regras comerciais. Limites técnicos de 1000 fotos por entrega e 100 galerias na lista não são planos comerciais. Galerias grandes precisam medição de memória/DOM/bytes; não foram certificadas por 11 arquivos sintéticos.

Não há prontidão comercial ou porcentagem global alegada. Commits de implementação: `5840ded` (seleção), `2499c3b` (upload), `2ae9c40` (portal/galerias) e `9de0b68` (gates); testes e documentação em commits próprios. Sem merge, produção, migration remota, exclusão, preço definitivo ou custo adicional. Próximo ciclo: homologação local integrada, baseline/staging quando acesso for resolvido, depois integração guest da prova e escolha de diagramação; assinatura/cotas seguem contrato próprio.

## Fechamento do ciclo

Os containers descartáveis e listeners de teste 3313/3314 foram verificados ausentes após cleanup. Pesquisa local: 20 arquivos com hashes preservados. Nenhuma alteração rastreada de outro autor foi sobrescrita. A publicação da implementação e a homologação local estão comprovadas nos limites acima; homologação comercial/produção continuam abertas. Não foi calculado percentual sem critérios completos de aceite.

## Reforço após revisão independente

Revisão estática independente não encontrou travessia de projeto ou elevação na criação digital. Foi reforçado o vínculo entre URL e cookie: o hash da sessão agora inclui o link além do segredo opaco, impedindo reutilizar o cookie em outro link até quando seu Path é copiado manualmente. Teste unitário específico e cenário de navegador com cópia intencional do cookie verificam essa negação. O projeto continua determinado pela concessão na RPC; nenhum segredo bruto é salvo no banco. Contagem unitária atualizada para 606; demais regressões preservadas. URLs R2 já emitidas continuam com janela de 60 s, explicitamente não revogáveis antes da expiração.
