# Execução — Operação Digital

16/11/2026. Primeiro incremento funcional local validado; produto comercial completo ainda em desenvolvimento. Branch `feat/operacao-digital`, checkpoint `checkpoint/pre-operacao-digital-20261116` em `01176cb`. Documentos históricos e alterações locais de pesquisa preservados.

## Existia e foi reaproveitado

Next/App Router, Supabase Auth/RLS, R2/upload com identidade e retry, galeria do cliente, selfie, editor Konva, prova/versionamento, cobrança de extras e mensagens. A 0043 de isolamento já estava consolidada localmente; seu gate de navegador/produção continuava aberto. Não houve reescrita nem exclusão de funcionalidade.

## Implementado nesta rodada

- Migration versionada 0044: comando manual de estado desejado, sessão ativa, vínculo foto/projeto, escopo 0043, locks e evento com autor/data apenas em mudança real. Não amplia policies nem usa service role. Selfie mantém contrato próprio.
- Server Action validada e tipada; falha não declara persistência, mensagens sem detalhes internos, invalidação de páginas.
- Galeria: favorito otimista persistido, bloqueio por foto e reversão em erro, contador, filtro, aviso de compartilhamento e demo explícita. Modal nativo com teclado/Escape/foco. Upload/retry anterior preservado.
- Testes SQL e unitários de favorito; suíte demo de navegador isolada; gate HTTP real PostgREST com JWTs exclusivamente sintéticos e containers descartáveis sem portas host, sem pull/rede externa.
- Três frentes em worktrees independentes; contratos centralizados antes de implementar. Documentação comercial/arquitetural consolidada nesta pasta.

## Verificação

| Gate | Resultado observado |
|---|---|
| Vitest integrado | 560 aprovados, sete ignorados; 34 arquivos aprovados, dois ignorados |
| TypeScript | `npx tsc --noEmit --incremental false`, exit 0 |
| ESLint | `npm run lint`, exit 0 |
| SQL descartável | 547/547: 512 regressões anteriores e 35 favoritas; 44 migrations; baseline pré-0043 reproduziu seis falhas |
| HTTP PostgREST | 46 verificações aprovadas; papéis/projetos, GET com RLS, foto cruzada, idempotência, selfie, sessão sem sub, anon, inativo e oito comandos concorrentes com um evento |
| Navegador integrado demo | 2/2 Chromium: favorito/contador/filtro e modal/setas/Escape/foco; 13,6 s |
| Build integrado | `npm run build -- --webpack`, exit 0; credenciais vazias e site URL localhost. Primeira tentativa bloqueada em Google Fonts; repetição com rede passou |
| Diff | Sem erro de whitespace |

Build conserva avisos de libheif/extração de require, classe Tailwind ambígua e lockfile acima do repositório. Não impedem o build observado; não certificam runtime de HEIC. SQL omite apenas inicialização Vault/cron da 0015 em memória, mantendo jobs desligados, conforme harness anterior. Evidências resumidas em [evidence](evidence/).

## GitHub, Supabase e Vercel

- GitHub: autenticação e branches remotas verificadas. Main remota em `1d90e82`; PR desta branch inclui os quatro commits locais anteriores da consolidação S1. Publicação bloqueada pela revisão automática: destino público e payload composto pelo incremento e quatro commits anteriores exigem confirmação explícita. Nenhum push ou PR criado. Pacote em [PUBLICATION-REVIEW](PUBLICATION-REVIEW.md).
- Supabase: projeto CLI local identificado como `seu-album`. Tentativa de ler histórico de migrations retornou 403 por privilégios insuficientes no endpoint de login. **Nenhuma migration remota aplicada; baseline desconhecida.**
- Vercel: vínculo local `seualbum`; metadado GitHub de Production com sucesso em 25/10/2026 para `1d90e82`. **Nenhum novo preview ou produção confirmado nesta rodada.** Variáveis remotas e isolamento de preview não verificados.

## Pendências do produto e aprovações

Ainda não implementados nesta rodada: snapshot/entrega/exportação de seleção, portal sem cadastro por link e código revogável, timeline de eventos visíveis, notificações essenciais, assinatura recorrente, ledger/franquias/tráfego e contratação de armazenamento adicional. Diagramação externa/serviço e prova existentes precisam consolidação do fluxo comercial. Não declarar o MVP comercial pronto.

Gate técnico seguinte: baseline remota e ambiente de homologação isolado; login Auth + Server Action/navegador autenticado com recarga e falha, Storage/R2 real, revogação e regressões de prova/cobrança. O HTTP testado usa JWTs sintéticos; não certifica emissão/renovação de sessão Auth. Concorrência de estados divergentes segue último comando confirmado no banco, sem atualização em tempo real da outra aba.

Sem preços definitivos, custos adicionais, exclusão, migração de produção ou publicação em produção. Produção exige aprovação específica; preview funcional depende de ambiente seguro e migrations compatíveis, não de ampliar RLS ou usar credenciais de produção.

## Registro final da validação integrada

Repetição do harness SQL/HTTP na árvore principal concluiu com exit 0: 547 verificações SQL e 46 HTTP aprovadas. Containers exclusivos foram descartados pelo harness. Commits locais do incremento: `b64e05f`, `7bc4f1c`, `d6a1b24`; documentação em commit próprio. Build e navegador executados sequencialmente após a tentativa inicial de fontes restritas.
