# Revisão e aceite local — 21/11/2026

Base revisada: `c44d7bf`, após os incrementos do Claude, na branch `feat/operacao-digital`. A autorização vigente é revisar, ajustar e fechar a etapa que pode funcionar localmente, antes de conectar provedores e ambientes externos. Os 35 commits locais anteriores, referências do autor e pesquisa não rastreada foram preservados. Não houve push, merge, migration remota, publicação ou uso de outro projeto da conta nesta revisão.

## Resultado e fronteira do aceite

Os fluxos digitais abaixo têm implementação local e evidência de execução. A central de navegador e os módulos persistidos no servidor são ambientes distintos: a central não substitui Auth/RLS, não migra seus dados automaticamente para o servidor e não executa reconhecimento facial ou pagamentos reais. Este aceite fecha as jornadas locais descritas; não é certificação de produção, de fornecedores ou de toda funcionalidade futura do roadmap.

| Jornada | Resultado verificado nesta revisão |
|---|---|
| Galeria e seleção | Importação persistente em IndexedDB, favorito reversível, confirmação explícita, revisão preservada após recarga, CSV e ZIP dos originais. Favorito, entrega e aprovação continuam separados. |
| Diagramação e prova local | Escolha própria/serviço, referência à seleção entregue, lâminas importadas, publicação, comentários, ajustes, segunda versão e aprovação. Versões publicadas não podem ser alteradas. Mudança do rascunho em outra aba exige nova confirmação antes de publicar. |
| Aprovação guest persistida | Nova 0092: capacidade validada, versão liberada atual, chave idempotente, origem ligada à concessão e nenhuma identidade Auth fictícia. Usa o gatilho existente de aprovação/fechamento; excedentes continuam gerando fatura e `aprovado_aguardando_pagamento`. Revogação impede inclusive retry. Resumo mostra aprovação e pendência após recarga. |
| Compra local | Carrinho, cotação confirmada, recusa sem entrega, aprovação simulada, snapshot, download apenas dos IDs comprados e ZIP conferido por bytes. Preços/comissão alterados exigem nova confirmação. |
| Assinatura local | Fatura, atraso, pagamento simulado, adicional, renovação, cancelamento e nova contratação. Contratos/faturas anteriores e arquivos permanecem preservados. Consumo soma fotos e lâminas; tráfego aparece como não medido. |
| Comunicação local | Mensagem do cliente aparece para o fotógrafo, atividade tem data real e notificação pode ser marcada como lida com persistência. |
| Módulos de servidor do Claude | Regressão das 69 migrations e 36 arquivos SQL executada nesta revisão, incluindo organização/capacidades, Store, coleções, planos, Booking, Sites, Studio e Design. Os E2E Auth de editor (8) e módulos (5) executados pelo Claude permanecem evidência anterior, não foram reexecutados nesta rodada. |

## Ajustes realizados

1. Corrigida a integração dos reducers locais para que uma repetição idempotente retorne o mesmo estado e evite gravação desnecessária. Acrescentados testes integrados de produção e loja, além da cobertura já existente de assinatura e mensagens.
2. Contratação após cancelamento passou a criar outro ciclo, arquivando o contrato encerrado e suas faturas. Validação de persistência rejeita histórico adulterado e IDs duplicados. Estados v1 anteriores continuam compatíveis.
3. A confirmação de publicação/aprovação local agora congela versão, revisão, texto e chave ao abrir. Uma atualização em outra aba não troca silenciosamente o objeto que será confirmado.
4. Fechado o caminho de aprovação final do portal sem cadastro. Migration `20261122000420_0092_portal_aprovacao.sql`, action e UI reutilizam o fechamento da 0026. A leitura da prova anterior foi movida para helper privado sem grant de execução; o RPC público acrescenta o resumo de aprovação, sem expor preço de custo ou trilha privada. Upsells continuam nos fluxos existentes; esta nova action não recebe produtos, preços ou totais.
5. Adicionados testes negativos de versão antiga/cruzada/vazia, sessão inventada, alteração de chave, acesso direto à trilha, imutabilidade, idempotência e revogação. O teste de extras confere R$12 calculados no banco e mantém a aprovação aguardando pagamento.

O botão Restaurar do editor foi mantido: o fluxo existente já salva o estado anterior e permite desfazer. A RPC nova de restauração do Design continua disponível e testada; não foi feita uma substituição sem necessidade funcional. Ver [Design](modulos/DESIGN-SELECAO.md).

## Verificação reproduzível

- `npm test`: **1.048 aprovados/7 ignorados**, 82 arquivos aprovados/2 ignorados. Os sete testes ignorados são os gates antigos que dependem do stack Auth configurado; não foram convertidos artificialmente em sucesso.
- `npm run test:e2e:local`: **14/14 Chromium aprovados**, incluindo as cinco jornadas novas de `e2e/operacao-local/jornadas.spec.ts`. Solicitações externas são bloqueadas pelo runner. Captura móvel de prova inspecionada, sem transbordamento horizontal.
- `SEUALBUM_API_TESTS=1 SEUALBUM_PORTAL_BROWSER=1 python3 scripts/test-db-isolado.py`: **1.773 verificações SQL em 36 arquivos, 69 migrations**, mais **64 verificações HTTP**, mais **1/1 cenário Chromium do portal**. Banco e API descartáveis sem rede externa, portas de proxy apenas loopback. O teste integrado confere no banco uma aprovação guest, fatura de extras de R$12 e estado pendente; apenas fotos/lâminas são substituídas por mídia sintética. O harness omite somente o bootstrap de segredo Vault/cron da 0015 na cópia em memória, como já documentado.
- `npm run typecheck`, `npm run lint` e build Next/webpack com credenciais externas desativadas: **exit 0**. Nenhum aviso novo de lint. O build conserva os avisos anteriores de HEIC, Tailwind e lockfile. Status **404** da central `/operacao-local` confirmado diretamente no artefato de produção.

O runner SQL faz limpeza somente dos próprios containers descartáveis. Não se conecta aos outros containers ou bancos existentes na máquina. Não lê `.env` nem usa credenciais remotas para executar os gates.

## Próxima etapa: integrações e homologação externa

1. **Staging autorizado:** resolver a titularidade/permissão do projeto Supabase, conferir catálogo de migrations e aplicar o conjunto ensaiado em staging com plano de rollback. A 0092 também precisa ser aplicada para habilitar aprovação guest. Nenhuma aplicação remota é implícita neste aceite.
2. **Arquivos reais:** confirmar R2/Storage, IAM, CORS, expiração de URLs, corpus HEIC e limites de memória/tráfego. Storage legado no portal guest continua fechado sem bypass de service role; sua migração/compatibilidade requer estratégia homologada. Os testes locais não certificam mídia ou infraestrutura reais.
3. **Reconhecimento facial:** ligar e homologar o motor existente, consentimento, retenção e custo. A central local oferece agrupamento manual identificado; o adapter hash/mock da referência não é usado como motor real.
4. **Cobrança:** selecionar/configurar o provedor de recorrência e gateway da Store, contratos, comissões, repasses, estornos e tributação. O adaptador atual da Store aceita somente pagamento simulado e bloqueia produção; o provedor real exigirá implementação específica após seu contrato. Hipóteses R$49/99/199 e R$19/100 GB não certificam custo ou margem.
5. **Comunicação e hospedagem:** conectar provedor de e-mail/SMS, cron/outbox, DNS/certificado e, se escolhido, OAuth de calendário. `.ics`, cópia de link e outbox de registro já existem localmente. LGPD/retenção e operação assistida precisam ser homologadas com o uso real.

Itens de expansão, como transferência de titularidade e autorização financeira multi-org em sombra, continuam no roadmap. Não foram renomeados como dependências de conexão nem incluídos artificialmente no escopo já aceito de galerias/seleção e jornadas locais.


## Preparação da publicação — 24/11/2026

- PR aberto: Operação digital: novos módulos, aprovação no portal e redesign dos painéis. CI e Vercel Preview aprovados.
- Consulta somente leitura do Supabase voltou a funcionar. Recuperado do histórico, sem alteração remota, o arquivo `20261117000400_0048_estado_portal.sql`, ausente no checkout. Há 22 migrations posteriores pendentes no remoto.
- Regressão executada nesta retomada: 1.773 verificações SQL e 64 HTTP aprovadas. A primeira jornada Chromium excedeu tempo de resposta; uma repetição avançou por entrada/favorito/seleção e identificou timeout na ponte local.
- A ponte do navegador iniciava um processo Node via Docker para cada RPC. Agora mantém um único processo durante a execução, com consultas serializadas, timeout de resposta e limpeza no encerramento. Não muda aplicação, banco ou permissões.
- Jornada isolada aprovada em cópia descartável, com 70 migrations, limite total de 180 segundos, SQL/HTTP geral omitidos nessa execução focada: entrada por código, cookie, favorito após recarga, seleção, aprovação guest com extras e revogação. Todas as asserções do cenário existente foram preservadas; só a mídia permanece sintética. Os diagnósticos registram apenas nome da RPC/status HTTP, sem código, cookie ou JWT.
- A cópia focada ficou em diretório temporário; não é um novo comando versionado. A execução integrada continua disponível pelo runner existente. Esse resultado não certifica R2, fornecedores externos ou produção.
- Schema anterior salvo localmente, sem dados de clientes; dry-run remoto aprovado para exatamente 22 migrations, sem seeds/roles/Vault. Backfill de nomes de estúdio compatível por consulta agregada. Vercel Production tem Supabase/login configurados, mas não lista R2 nem STRIPE_SECRET_KEY; arquivos locais também não têm essas credenciais. Upload R2 e cobrança real continuam dependentes de configuração. Merge, aplicação remota e deploy ainda não realizados neste registro.
