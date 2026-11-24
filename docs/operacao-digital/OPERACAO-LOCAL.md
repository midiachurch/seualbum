# Operação local — 21/11/2026

Prévia sem login para explorar as áreas: `npm run preview:local` → **http://127.0.0.1:3121/previa**. Modos de demonstração e limites em [PREVIA-LOCAL](PREVIA-LOCAL.md).

> Revisão vigente após a continuação do Claude e a integração do Codex: [REVISAO-LOCAL](REVISAO-LOCAL.md). O registro abaixo preserva as primeiras rodadas; Docker/SQL, novas jornadas e aprovação guest foram validados posteriormente.

Autoridade: pedido do usuário para construir localmente os fluxos de galerias de seleção e inteligentes e avançar eventos, produtos e serviços, sem depender de GitHub, Supabase ou outros serviços externos. Publicação fica para uma rodada posterior. Este ciclo não consulta contas, não aplica migrations remotas e não ativa cobrança.

## As três fases

1. **Estrutura do produto:** galerias de seleção e inteligentes, importação, favoritos, entrega de seleção e experiência do fotógrafo/cliente. Eventos, catálogo e solicitações comerciais podem ser preparados localmente sem antecipar lançamento.
2. **Isolamento e homologação:** verificar fronteiras entre contas/projetos, concorrência, persistência, mídia e jornadas integradas. Testes locais não certificam a configuração remota.
3. **Operação comercial:** conectar os ambientes homologados, aprovar condições comerciais e ativar os serviços autorizados. Assinatura, venda de produtos e serviços complementares são contextos separados. Produção, preços definitivos e custos exigem decisão específica.

Essa organização registra o esclarecimento desta conversa. As três frentes de execução anteriores são uma divisão do trabalho, não essas três fases.

## Decisões comerciais provisórias — autorização posterior de 21/11/2026

O usuário autorizou valores simulados baseados em referências de mercado e delegou decisões de fluxos/modos de operação, com ajustes futuros. A exigência anterior de aguardar preços/regras deixa de bloquear a simulação local. Valores definitivos, cobrança real, custos, publicação e alterações remotas continuam fora deste ciclo.

| Hipótese para o SeuAlbum local | Valor inicial | Operação |
|---|---:|---|
| Essencial | R$ 49/mês · 10 GB | Galerias e seleção |
| Profissional | R$ 99/mês · 100 GB | Maior volume de galerias |
| Estúdio | R$ 199/mês · 500 GB | Operação com mais acervo |
| Diagramação complementar | R$ 199 por solicitação | Serviço separado da assinatura |
| Coleção digital | R$ 99 por coleção | Produto vinculado à galeria de evento |
| Comissão de produtos em eventos | 10% | Calculada sobre o valor do produto |
| Comissão de serviço/galeria de seleção | 0% | Sem comissão simulada nesse contexto |

**Origem e limite dos números:** consulta às páginas oficiais em 21/11/2026. A [Pixieset](https://pixieset.com/pricing/) publica Basic a US$10/mês com 10 GB e Plus a US$20/mês com 100 GB no pagamento mensal; os planos pagos anunciam vendas sem comissão. A [Fotop](https://faq.fotop.com/portal/pt-br/kb/articles/quanto-custa-para-utilizar-a-fotop) descreve seu modelo Standard com comissão de 10%, e a [Fotto](https://ajuda.fotto.com.br/hc/pt-br/articles/22748719094413-Fotto-Comiss%C3%A3o-Taxas-e-Tarifas) informa comissão fixa de 10%. Essas referências inspiram a estrutura, não demonstram uma média de mercado, equivalência em reais ou margem sustentável para o SeuAlbum. Não foi feita conversão cambial. R$49/99/199, o pacote de diagramação e a coleção são escolhas experimentais do agente, não cotações dos concorrentes.

**Fluxo adotado:** fotógrafo escolhe um plano simulado → cria galeria → importa e seleciona → cliente confirma snapshot → diagramação própria ou solicitação opcional de serviço → prova/versionamento/ajustes no fluxo existente. Produto de evento pode gerar solicitação local com preço e comissão explícitos. Solicitação passa de solicitada para em preparação, depois concluída ou cancelada. Não existe confirmação de pagamento real nesse caminho.

**Regras de cálculo:** o domínio busca o preço no catálogo e calcula comissão em centavos inteiros; o navegador não envia um total confiável. Serviços não recebem a comissão de produtos de eventos. Valores sob consulta não viram zero. Pedido conserva seu preço e repasse; escolha de plano conserva mensalidade e capacidade da simulação naquele momento. Editar a configuração vale para escolhas/solicitações futuras. Preços de produtos também podem ser editados no catálogo.

**Preservação:** estados locais existentes continuam legíveis e seus preços não são preenchidos automaticamente. O catálogo com R$199/R$99 nasce apenas em novos estados. Planos e parâmetros comerciais têm editor local; capacidades são hipóteses de oferta, não espaço garantido do navegador, quotas de servidor ou autorização para excluir arquivos. O ledger/RLS e a conciliação comercial continuam necessários antes de operação real.

## Como abrir

```sh
npm run dev:local
```

Abrir `http://127.0.0.1:3121/operacao-local`. Para outra porta, usar `SEUALBUM_LOCAL_PORT=3122 npm run dev:local`. O launcher sobrescreve as variáveis das integrações com valores vazios e só escuta loopback. A rota exige desenvolvimento e a flag de operação local; retorna 404 em produção.

O ambiente de produto usa dados e arquivos do navegador. Ele permite testar jornadas sem Auth, PostgREST, R2, AWS ou Stripe. A prévia de cliente e o código local são simulações no mesmo navegador, não autenticação, isolamento entre pessoas ou compartilhamento real. O portal existente continua sendo o caminho de acesso privado com capacidade validada no banco.

## Entregas deste ciclo

- Central local com galerias de seleção e inteligentes, importação de arquivos, favoritos, seleção revisionada, exportação CSV/ZIP de originais, eventos e catálogo vinculado às galerias. O ZIP tem limite técnico local de 100 MB por operação.
- Domínio puro com comandos explícitos, verificação de vínculo das fotos e produtos, snapshots independentes de favoritos e transições de solicitações.
- Persistência local versionada e armazenamento de arquivos no navegador. Persistência não equivale a backup; limpeza dos dados do site elimina o ambiente local.
- Produtos/serviços com preço opcional sob consulta, solicitações e assinatura identificadas como simulação, sem transações financeiras.
- Galerias inteligentes com agrupamento manual por participante. O motor de reconhecimento por selfie existente foi preservado; o ambiente local não executa identificação biométrica nem apresenta agrupamentos manuais como resultado facial.
- Incremento do portal real: leitura da prova publicada, mídia R2 validada pela capacidade, comentários por lâmina e solicitação de ajustes com origem guest e idempotência. Aprovação final financeira continua no fluxo existente.
- Notificações reais de seleção com marcação de leitura exclusiva pelo destinatário ativo; sem UPDATE direto na tabela.

As migrations 0048 e 0049 são arquivos versionados para validação local. Não foram aplicadas remotamente. Não se deve abrir o portal com essas funções em um ambiente cujo schema ainda não tenha sido atualizado e homologado.

## Verificação

Rodada comercial posterior: 647 unitários aprovados/7 ignorados (46 arquivos aprovados/2 ignorados), 9/9 Chromium, TypeScript, lint e build webpack com exit 0. Novos testes exercitam edição de preços/comissão, compatibilidade do estado anterior, arredondamento seguro, ausência de comissão em serviço, preservação de snapshots e recarga da configuração. Captura móvel dos planos inspecionada sem transbordamento horizontal. Os resultados de 641/7 a seguir preservam a entrega anterior. Para editar valores na interface: Operação → Configurar valores simulados; Catálogo → Editar item.

Resultados em STATUS-OPERACAO: 641 unitários aprovados e 7 ignorados; lint sem erros/avisos; 7/7 cenários Chromium aprovados. O teste de ZIP confere os bytes do original extraído; outro teste altera favoritas em uma segunda aba enquanto a primeira confirma a seleção. Capturas desktop/móvel inspecionadas. O navegador visível do aplicativo estava indisponível; a verificação visual usou as capturas da suíte local.

O daemon Docker estava indisponível: 40 verificações pgTAP novas permanecem preparadas, sem alegar execução. Isso não bloqueou a construção e a validação do domínio e da interface locais. Os testes de navegador da central não certificam as novas RPCs de prova/notificação.

Fechamento: `npm run typecheck`, `npm run lint` e build Next com webpack e credenciais externas desativadas terminaram com exit 0. O artefato de produção de `/operacao-local` tem status 404 e não contém a central, verificado diretamente em HTML/metadados de saída. O build preserva os avisos conhecidos de HEIC, Tailwind e lockfile. Os servidores dos testes foram encerrados. Não houve commit/push ou publicação neste ciclo.

## Integração posterior

### Bases fornecidas pelo autor em 21/11/2026

O usuário disponibilizou `Projetos Rafael/SmartStudios MVP/` e `Projetos Rafael/plataforma-eventos/`, declarou autoria e autorizou aproveitar código, tecnologias e concepção no SeuAlbum. Os projetos originais permanecem preservados. Sua exclusão dos checks TypeScript/ESLint do SeuAlbum evita misturar aplicações; não impede consulta ou extração revisada.

- **SmartStudios:** leitura inicial de `src/components/entrega/revisao/RevisaoDaEntrega.tsx`, `src/data/entrega-tipos.ts` e `src/data/aprovacao-por-link.ts` identifica revisão de item, rodadas, comentários por posição/tempo e link revogável. Candidatos para melhorar a prova existente, conservando seus estados e contratos. O README é anterior a funcionalidades presentes no código; não tratá-lo como inventário atual.
- **Plataforma de eventos:** `packages/core/src/` concentra regras separadas e arquivos de testes para eventos, preços, pedidos, créditos e identificação; `apps/web/src/server/checkout-service.ts` conecta cálculo, pedido e comissões. Candidatos para eventos e comércio futuro, após revisão das regras aplicáveis ao SeuAlbum.
- **Limites observados:** o checkout consultado importa `mockPaymentsAdapter`; o projeto documenta adapters faciais simulados. Presença de telas/adapters não certifica pagamento ou reconhecimento reais. Nenhum teste dos projetos de referência foi executado nesta leitura.
- **Compatibilidade:** o SmartStudios usa Tailwind 4 e a plataforma de eventos usa Prisma/tRPC/workspaces, enquanto o SeuAlbum usa Tailwind 3 e Supabase/RLS/RPC. Adaptar componentes e regras por partes. O leitor de aprovação do SmartStudios utiliza service client; esse mecanismo não será transplantado para contornar a autorização do SeuAlbum.

Prioridade de aproveitamento: prova/versionamento/comentários, regras de eventos e catálogo, depois pedidos/condições comerciais. O reconhecimento facial existente do SeuAlbum continua preservado; mocks de referência não o substituem como motor real. Não copiar credenciais, dados de usuários, bancos ou mídia privada dos projetos de origem.

O ambiente local não migra seus dados automaticamente para um projeto remoto. Catálogo, eventos, pedidos e assinatura locais ainda precisam de contratos persistentes com RLS/RPC, conciliação e provedores antes de uso comercial multiusuário. A integração facial real depende de um motor e de validação da infraestrutura; pagamento real depende de provedor e regras aprovadas. Não há promessa de reconhecimento offline, cobrança, recuperação de arquivo apagado ou homologação comercial nesta entrega.
