# Módulo SITES (W01–W04)

Status: implementado localmente no worktree, com testes descartáveis. Nada aplicado em banco remoto, sem deploy, sem push. Escopo do backlog: W01 (especificação e propriedade), W02 (prévia e publicação mínima), W03 (domínio, identidade e retirada), W04 (acessibilidade e SEO). Blocos Store/Booking ficam fora (módulos inexistentes).

## O que foi construído

### Banco (migrations aditivas 0070 e 0071)

| Objeto | Função |
|---|---|
| `sites` | Um site por organização (`organizacao_id` único), `slug` único global, `status` (rascunho, publicado, despublicado), `rascunho` (jsonb) com revisão otimista, ponteiro `versao_publicada_id`. |
| `site_versoes` | Foto imutável a cada publicação: `conteudo` + mapa `midias` (chaves públicas resolvidas na hora de publicar) + nota + chave de idempotência. Trigger bloqueia UPDATE/DELETE. |
| `site_midias` | Biblioteca de imagens públicas da organização. A chave só existe sob `sites/{organizacao}/`, com CHECK no banco. |
| `site_dominios` | Domínios próprios: `pendente`, `verificado`, `falhou`; token TXT por registro; `ativo` separado. |
| `site_eventos` | Auditoria (criado, salvo, publicado, revertido, domínio verificado, etc.). |

RPCs de usuário (SECURITY DEFINER, `search_path = public, pg_temp`, grant só a `authenticated`): `criar_site`, `atualizar_site_dados`, `salvar_site_rascunho`, `registrar_site_midia`, `remover_site_midia`, `publicar_site`, `reverter_site_versao`, `despublicar_site`, `restaurar_site_versao_no_rascunho`, `adicionar_site_dominio`, `preparar_verificacao_dominio`, `definir_site_dominio_ativo`, `remover_site_dominio`.
Leitura pública (grant a `anon`): `obter_site_publicado(slug)`, `obter_site_publicado_por_host(host)`, `resolver_site_por_host(host)`. Só devolvem versão publicada de site publicado.
Atestação de DNS: `confirmar_verificacao_dominio`, liberada somente ao `service_role` (ver decisões).

Todas as tabelas têm RLS ligada; leitura só para membros da organização via `papel_na_organizacao` (0051); escrita só por RPC (sem INSERT/UPDATE/DELETE direto). Erros: 42501 sem permissão, 22023 inválido, 40001 rascunho desatualizado.

### Contrato dos blocos (documento v1)

`{ v:1, tema:{cor,fonte,modo}, seo:{titulo,descricao,midia_id}, paginas:[{slug,titulo,blocos:[{id,tipo,dados}]}] }`. Limites: 10 páginas, 40 blocos por página, 256 KB. A primeira página é sempre `inicio`.
Tipos: `hero`, `texto`, `sobre`, `galeria`, `servicos` (serviços e preços em texto livre), `contato` (e-mail, telefone, WhatsApp, Instagram e botão), `depoimentos`, `rodape`.
Validação duplicada de propósito: no banco (`_site_validar_conteudo`, autoridade) e em `src/lib/sites/validar.ts` (mensagens úteis e sanitização). Campos desconhecidos são rejeitados, não descartados em silêncio.

### App

- Painel `/dashboard/site` (nav "Site"): criar site, editar nome e endereço, tema e SEO, páginas (adicionar, renomear, reordenar, remover), blocos (adicionar, subir, descer, remover, editar), biblioteca de imagens com upload, prévia privada, publicar com nota, versões com rollback e restaurar no rascunho, tirar do ar, domínio (adicionar, TXT, verificar, ativar, remover), histórico.
- Prévia privada `/dashboard/site/previa`: rascunho salvo, só para membros (RLS), `noindex`.
- Público `/s/[slug]` e `/s/[slug]/[pagina]`, mais `sitemap.xml` e `robots.txt` por site. Metadados: title, description, canonical, Open Graph e Twitter.
- Por host: `/site-host/[slug]/...`, alvo interno do rewrite do proxy (links relativos à raiz do domínio). Pedido direto a `/site-host/*` retorna 404 no proxy.
- Upload: `/api/uploads/site-midia` (+ `/confirmar`) para o bucket público do R2, chave `sites/{organizacao}/...`, só dono/admin/editor.
- Ações de servidor em `src/lib/actions/sites.ts`: validam entrada, usam mensagens fixas, não vazam erro interno, invalidam o cache por slug (`revalidatePath`).

## Decisões e por quê (mercado: Squarespace, Pixieset Website, Format, Wix)

1. **Um site por organização.** É o padrão de Pixieset e Format; evita multiplicar custo de domínio e suporte. O modelo comporta mais de um (basta soltar o UNIQUE) se o preço justificar.
2. **Papéis.** Visualizador lê; editor edita o rascunho e as imagens; dono/admin publica, reverte, retira, mexe em domínio, nome e endereço. Espelha "editor produz, responsável publica" (Squarespace separa colaborador de publicação). Reusa `organizacoes`/`papel_na_organizacao`, sem novo modelo de organização.
3. **Rascunho e publicado distintos, versão imutável.** Publicar copia o rascunho para `site_versoes` e move o ponteiro. Rollback só move o ponteiro (nunca reescreve versão), como o "restaurar versão" do Squarespace/Wix. Publicar com a mesma chave de idempotência devolve a mesma versão (duplo clique, retry).
4. **Páginas dentro do documento versionado**, não em tabela própria. O snapshot é atômico (página e bloco nunca divergem entre versões) e o rollback é trivial. Custo: edição sempre salva o documento inteiro (limitado a 256 KB), aceitável para portfólio.
5. **Blocos tipados e fechados**, sem editor arbitrário nem HTML livre (risco de XSS e de custo do backlog). Texto rico é uma lista curta de tags, sanitizada no servidor (`sanitize-html`) ao salvar e de novo ao renderizar, e conferida no banco. O editor usa texto simples com marcações leves (negrito, itálico, lista, título, link), seguro por construção.
6. **Preço como texto livre** no bloco Serviços: preço definitivo é decisão comercial e não deve virar dado estruturado agora.
7. **Contato sem formulário.** Mostra canais e botão (mailto/WhatsApp). Formulário exigiria endpoint com antispam e destino de cadastro; contato público não expõe cadastro privado.
8. **Mídia só pública e própria.** `site_midias` aceita apenas `sites/{organizacao}/...`; blocos referenciam `midia_id`, validado contra a organização no banco. Original privado do R2 nunca entra; não há cópia implícita. Imagem sem texto alternativo é rejeitada (hero, sobre, galeria).
9. **Leitura anônima só por RPC.** `anon` não tem SELECT em nenhuma tabela do módulo; a RPC devolve só versão publicada de site publicado.
10. **Domínio: titularidade por TXT, exclusivo só quando verificado.** Cada registro tem token próprio (`seualbum-verificacao=<32 hex>` em `_seualbum-verificacao.{dominio}`), como Vercel/Squarespace. Pedidos pendentes não reservam o nome; quem prova o DNS primeiro fica com ele e os demais viram `falhou`. Ativar é passo explícito separado de verificar. Um domínio verificado pertence a no máximo um site (índice único parcial).
11. **Quem atesta o DNS.** O banco não consulta DNS. O servidor consulta com um resolver injetável (`ResolvedorDns`; em produção `node:dns`, nos testes mock sem rede) e atesta por `confirmar_verificacao_dominio`, que só o `service_role` executa e só conclui um pedido que um dono/admin fez nos últimos 15 minutos (`preparar_verificacao_dominio`, uso único). O service role não substitui autorização: o pedido sempre passa antes pela sessão do usuário. Impede que um admin se auto-atteste chamando a RPC direto (testado).
12. **Cache e isolamento.** O cache é por caminho (`/s/{slug}/...`, `/site-host/{slug}/...`), sempre com o slug. No proxy, o cache host→slug é em memória, chaveado pelo host, TTL de 15 s, sem cachear falha. Publicar, reverter, retirar, trocar slug e mexer em domínio chamam `revalidatePath` do slug (antigo e novo). Na build atual as páginas públicas saem dinâmicas (como `/p/[slug]`), então não há cache compartilhado de HTML entre sites. Com domínio ativo, `/s/{slug}` redireciona (307) para o domínio, o endereço canônico.
13. **Acessibilidade.** Link para pular ao conteúdo, landmarks (header, nav, main, footer), um h1 por página (título do hero ou h1 oculto), foco visível, alvos de 44 px, contraste calculado (texto sobre a cor de destaque escolhido por contraste; destaque só vira cor de texto se passar 4,5:1), responsivo, sem JS no site público.

## Roteamento por host: depende de infraestrutura

O app entrega o suporte, mas o domínio do cliente só chega até ele se a infraestrutura permitir:
- O domínio precisa apontar (CNAME/A) para a hospedagem e estar cadastrado no provedor (certificado TLS). Isso é operação de DNS/hospedagem, fora do código.
- O proxy só trata host de estúdio com `SITES_HOST_ROUTING=1`. Hosts do app ficam em `SITES_APP_HOSTS` (lista separada por vírgula), `NEXT_PUBLIC_SITE_URL` e qualquer `*.vercel.app`. Padrão: desligado, nenhuma rota existente muda.
- Ligado, o host é resolvido por `resolver_site_por_host` e reescrito sempre para `/site-host/{slug}/...`, então um domínio nunca alcança rota do app nem outro site. Host sem site publicado e ativo recebe 404 com `noindex`.

## Reaproveitamento do CMS existente

| Existente | Decisão |
|---|---|
| `paginas_conteudo` e `/p/[slug]` | Não reaproveitado como modelo: sem organização, sem versões, editável só pela equipe da plataforma. Mantido intacto. |
| `media_assets` / vitrine | Não reaproveitado: biblioteca central da plataforma sem organização. Criada `site_midias` com prefixo por organização. |
| `sanitizar-html.ts` e `sanitize-html` | Reaproveitada a biblioteca e o padrão (lista branca no servidor); lista própria, mais estrita (sem imagem nem estilo). |
| Bucket público do R2, `urlDeEnvio`, `metadadosDoObjeto`, `enviarEConfirmarR2` | Reaproveitados no upload (3 passos), com nova rota e porta de entrada `membroParaUploadDeSite`. |
| `organizacoes`, `papel_na_organizacao` (0051) | Base de toda a autorização. |
| Padrões de server action, testes e componentes de Equipe | Seguidos. |

Novo: tabelas `sites*`, validador de blocos, versões, domínios, renderizador, painel, proxy por host.

## Testes

- pgTAP: `sites_modelo` (48), `sites_publicacao` (37), `sites_dominios` (42) — isolamento entre organizações, papéis, anon só publicado, versão imutável, rollback, retirada, domínio único e verificação, bloco inválido, mídia de outra organização e privada, chave do usuário não atesta DNS.
- Vitest: validação e sanitização (script, onerror, javascript:, data:), resolver DNS mockado e fluxo de verificação em dois passos, roteamento por host e cache por host, SEO (sitemap, robots, canonical), contraste, texto rico, chaves de mídia, ações de servidor.

## Pendências reais

- Revalidar domínios periodicamente (expiração/transferência); hoje `verificado` não expira.
- Redirecionamento do slug antigo após troca de endereço (hoje o antigo vira 404).
- Varredura de órfãos do R2 não cobre o prefixo `sites/` (a varredura atual só olha vitrine/logos; ver `PREFIXOS_DO_APP`). Mídia órfã é segura, só ocupa espaço.
- Lightbox na galeria, formulário de contato com antispam, tema por bloco, editor visual WYSIWYG, arrastar-e-soltar (hoje subir/descer por botão, acessível).
- Blocos opcionais Store e Booking (dependem de módulos que não existem).
- Geração de derivados otimizados das imagens (hoje usa o arquivo enviado, limite de 10 MB).
- Cache de borda/CDN do site público (páginas hoje dinâmicas) e métricas de acesso.
- Homologação com domínio, DNS e certificado reais; teste manual de teclado e leitor de tela em produção.
- Migrations 0070/0071 só validadas em banco descartável; aplicação remota depende de aprovação.
