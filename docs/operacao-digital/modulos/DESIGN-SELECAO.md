# DESIGN — integração Seleção → Álbum (D01–D04)

Status: implementado e testado localmente (banco descartável, Vitest, build, Playwright do editor). Migrations 0090 e 0091 **não aplicadas** em ambiente remoto. Sem push, sem deploy. Contexto: [BACKLOG](../../roadmap/BACKLOG.md) D01–D04, [DESIGN](../../products/DESIGN.md), [ADR-003](../../decisions/003-selection-and-approval.md).

## 1. Contrato (D01)

O álbum criado a partir de uma seleção entregue guarda a **referência ao snapshot** e os **IDs de foto daquele instante**. O vínculo é imutável.

| Peça | Onde |
|---|---|
| Tabela `album_selecao_vinculos` | migration `20261122000400_0090`: `layout_id` (único, FK `album_layouts`, cascata), `selecao_id` (FK `selecoes_entregues`), `projeto_id`, `revisao`, `destino` (`projeto` ou `avulso`), `foto_ids uuid[]` (1 a 1000), `chave`, `criado_por`. Único em `(selecao_id, criado_por, chave)` |
| RPC `criar_album_da_selecao(selecao, destino, chave, nome, formato, orientacao, documento?)` | cria o documento e o vínculo numa transação; idempotente por chave; advisory lock por projeto; `SECURITY DEFINER`, `search_path = public, pg_temp`, `revoke ... from public, anon, service_role`, grant só a `authenticated` |
| RPC `design_selecao_resumo(projeto)` | papel de quem chama, se pode criar/abrir o editor, se o projeto já tem álbum e os álbuns já nascidos de seleções |
| Helper `design_papel_no_projeto(projeto)` | `producao`, `dono`, `admin`, `editor`, `visualizador` ou nulo |

Invariantes (todos cobertos por `supabase/tests/design_selecao_vinculo.test.sql`):

1. Mudança posterior na seleção (nova revisão, favorito marcado/desmarcado, foto removida do projeto) **nunca** altera documento, biblioteca ou vínculo de um álbum já criado. O vínculo não tem UPDATE para ninguém (nem `service_role`, nem o dono da tabela); só a exclusão em cascata (excluir o álbum avulso ou o projeto) passa, detectada por `pg_trigger_depth() > 1`.
2. Sem duplicar originais. **Álbum de projeto**: o editor lê `fotos` do próprio projeto (mesmos IDs); a seleção vira a pasta "Seleção · revisão N" (todas favoritas) na biblioteca do álbum, e o editor já filtra por pasta e monta automaticamente a partir dela. **Álbum avulso**: `album_layouts.fotos` recebe **referências** (`id`, `path`, `bucket`, `referencia: true`) às mesmas chaves do snapshot; nada é copiado no R2/Storage.
3. O documento só pode citar fotos do snapshot (`22023` caso contrário; `fotoId` malformado também é `22023`, sem erro de cast).
4. Uma prova publicada (`design_versions`/`versoes_laminas`) não depende da seleção nem do vínculo.
5. Documento inicial: uma lâmina vazia (convenção do editor, `documentoInicial`). O preenchimento automático continua sendo uma ação explícita do editor, porque a qualidade do layout depende do formato e do estilo.

## 2. Integração no app (D02)

- Tela: `/dashboard/albuns/[id]/compartilhar` e o hub do projeto, dentro do painel "Entrega da seleção": bloco **Álbum a partir da seleção** (`src/components/design/criar-album-da-selecao.tsx`), uma linha por revisão entregue. O bloco só aparece se o banco disser que a pessoa pode criar; o cliente final não vê.
- Ações: `src/lib/actions/design-selecao.ts` (`consultarDesignSelecao`, `criarAlbumDaSelecao`, `restaurarVersaoDoAlbum`, `historicoDasVersoesDaProva`). Validam a forma, traduzem erros sem vazar detalhe interno, repetem com a mesma chave sem duplicar.
- Reuso do editor: o link "Abrir no editor" leva a `/admin/projetos/[id]/editor` (álbum do projeto) ou `/admin/albuns/[id]` (avulso). Nenhuma tela do editor foi alterada.
- Caminhos legados: o formato vem de `prepararLayoutDoProjeto` (projeto, produto ou escolha); quando falta, o formulário pergunta e grava no projeto como `criarLayoutDoProjeto` já fazia. Edições mínimas e aditivas em cinco pontos do editor para suportar referências: `fotosAvulsasParaEditor`, `removerFotoAlbum`, `excluirAlbumAvulso`, `renovarLinksDasFotos`, `duplicarAlbum`. Foto sem `bucket`/`referencia` segue exatamente o caminho de antes (regressão em `album-editor.test.ts`, que não foi alterado, e `album-editor-referencias.test.ts`). Remover a foto-referência ou excluir o álbum **nunca** apaga o original.
- Escopo do avulso: policy **restritiva** nova em `album_layouts` (`album_selecao_escopo_ok`): um avulso nascido de seleção só é visível/editável por quem produz o projeto de origem. Sem isso, qualquer equipe leria fotos de outro estúdio pelo avulso. Álbuns sem vínculo não mudam em nada (testado).

Permissões (decididas no banco):

| Papel | Consulta | Cria álbum |
|---|---|---|
| Quem produz o projeto hoje (gestão/admin ou equipe atribuída, 0043) | sim | sim (e abre o editor) |
| Fotógrafo dono do projeto | sim | sim (o editor segue restrito ao perfil de produção) |
| Organização: dono, admin, editor (0051/0054) | sim | sim |
| Organização: visualizador | sim | não |
| Designer não atribuído, outro estúdio, cliente final, anônimo | não | não |

## 3. Publicação parcial e recuperação (D03) — migration 0091

- **Lâmina publicada imutável** (`versoes_laminas`, gatilho `versao_lamina_guardar`): arquivo, ordem, bucket, dimensões, capa, `alterada` e `origem_lamina_id` não mudam, nem para o dono da tabela; nenhuma exclusão direta. Cascata e `SET NULL` de integridade passam (rollback da publicação e exclusão de versão-base continuam funcionando). Lâmina herdada (`alterada = false`) precisa apontar uma lâmina do **mesmo projeto** com o **mesmo bucket e chave**.
- **Versão reproduzível**: `design_versao_assinatura(versao)` é um hash das lâminas (ordem, bucket, chave, capa). Publicar a versão 2 não muda a assinatura da versão 1. `design_historico_versoes(projeto)` lista versões com herdadas, alteradas, base e assinatura.
- **Histórico do álbum imutável** (`album_layout_versoes`): documento, tipo e autoria não mudam (só o rótulo); só pontos `auto` podem ser podados (a poda de 40 do app continua).
- **Restaurar cria NOVA versão** (`restaurar_versao_album`): grava o estado de antes (`restauracao`, "Antes de restaurar"), aplica o documento, avança a revisão (a trava otimista segue válida) e registra a nova versão `manual` ("Restaurada de ..."). Nunca sobrescreve histórico; idempotente por chave (`album_restauracoes`); respeita o travamento por aprovação (`55000`) igual a `salvar_album_layout`.
- **Fechamento/extras intocados**: `supabase/tests/design_selecao_recuperacao.test.sql` prova que publicar parcial, aprovar, restaurar e criar álbum de seleção deixam o cálculo de lâminas extras (7 lâminas, 2 extras, R$ 20) e as faturas exatamente como estavam. Nenhuma função de cobrança foi tocada.

## 4. Desempenho e acessibilidade (D04)

Orçamento por documento (`src/lib/album/orcamento.ts`, medido por `orcamento.test.ts`):

| Métrica | Recomendado | Teto |
|---|---|---|
| Lâminas | 80 | 200 (`LIMITES`) |
| Quadros no documento | 500 | 8000 |
| Fotos distintas / fotos da seleção | 600 | 1000 (limite da seleção entregue) |
| JSON do documento | 600 KB | 2 MB (CHECK do banco) |
| Abertura (parse + normalizar + pré-checagem, CPU) | alvo 50 ms | falha do teste em 100 ms |
| Montagem automática (1000 fotos / 200 lâminas, execução fria) | alvo 1 s | falha em 2 s |

Números medidos (Node, máquina de desenvolvimento, média de 5 execuções após aquecimento):

| Lâminas | Quadros/fotos | JSON | Abertura | Montagem automática |
|---|---|---|---|---|
| 31 | 150 | 60 KB | 0,33 ms | 55 ms |
| 61 | 300 | 120 KB | 0,42 ms | 99 ms |
| 101 | 600 | 236 KB | 0,77 ms | 260 ms |
| 200 | 1000 | 400 KB | 1,31 ms | 323 ms |

Leitura: no teto de 200 lâminas e 1000 fotos o documento usa 20% do limite do banco e abre em ~1 ms de CPU; o gargalo real é canvas e imagens, não o documento. O formulário de criação avisa quando a seleção passa de 600 fotos. Tempo no navegador (canvas) não foi medido nesta etapa: o ambiente de teste é Node.

Acessibilidade e teclado (`criar-album-da-selecao.test.ts`, 16 testes, sem DOM: HTML estático do React + regras puras): formulário com nome acessível; rádios nativos em `fieldset`/`legend`, cada um com `label` e descrição ligadas por id; campos com `label`; ajuda por `aria-describedby`; erro com `role="alert"`; aviso com `role="note"`; status com `aria-live`; alvos de toque de 44 px; ordem do Tab igual à do DOM e sem `tabindex` positivo; Escape cancela (exceto durante o envio); foco entra no destino marcado ao abrir e volta ao gatilho ao fechar.

Exportação regressiva: o documento sobrevive a salvar e reabrir sem mudar (o que o JPG/ZIP lê); a pré-checagem dá o mesmo resultado antes e depois; o documento inicial criado pelo banco normaliza para o mesmo documento do editor; o PDF de 100 lâminas é determinístico (mesmo SHA-256) e com `xref` íntegra (52,5 KB). A rasterização do canvas coberta pelo Playwright do editor (seção 6).

## 5. Decisões de mercado e por quê

- **Seleção é entrada, não espelho** (Pixellu SmartAlbums, Fundy Designer, Pic-Time, Pixieset): o álbum nasce de uma lista fixa e depois evolui sozinho; uma nova seleção do cliente gera outra revisão e, se o estúdio quiser, outro álbum. Por isso o snapshot é guardado e nada sincroniza de volta.
- **Um álbum de projeto por projeto** (mantém a regra de 0027 e a prova/aprovação atuais); novas revisões viram álbuns **avulsos** (variantes), sem tocar no que já foi para prova.
- **Auto-design é opt-in**: o editor já tem "Preencher automaticamente"; criar o álbum não monta lâminas sozinho.
- **Quem cria**: o estúdio e a equipe que produz. Visualizador só consulta. Cliente final nunca vê o design.
- **Restaurar nunca reescreve** (versionamento tipo Git/Figma): sempre uma nova versão, com o estado de antes preservado.
- **Referência, não cópia**: custo de armazenamento e consistência (o original é um só).

## 6. Verificação (22/11/2026, local)

- `npx tsc --noEmit` e `npx eslint .`: limpos.
- `npx vitest run`: 63 arquivos, 803 testes passando (7 ignorados, já existentes). Novos: `orcamento.test.ts` (11), `design-selecao.test.ts` (17), `criar-album-da-selecao.test.ts` (16), `album-editor-referencias.test.ts` (5), `contrato.test.ts` (5). `album-editor.test.ts` e demais testes existentes não foram alterados.
- `python3 -I scripts/test-db-isolado.py` (banco descartável, sem rede): todos os `.test.sql` OK, incluindo `design_selecao_vinculo` (61 verificações) e `design_selecao_recuperacao` (63); `escopo_producao` (224), `fluxo_adicionais` (54), `checkout_fatura` (18) e demais seguem iguais. As 57 migrations aplicam também em um Supabase local completo (`supabase start`). `not ok` em `before-0043.tap` é a linha de base histórica (6).
- `npx next build --webpack`: passa. Precisa de rede só para baixar Google Fonts (`next/font`), então não roda dentro do sandbox sem rede.
- Playwright do editor (`playwright.editor.config.ts`, 8 testes: avulso, projeto/"Publicar versão", hub): **8/8 antes (commit-base) e 8/8 depois** das mudanças, contra um Supabase local temporário (portas 565xx) e o R2 falso. O Turbopack recusa o symlink de `node_modules` do worktree; o `next dev` do teste foi rodado com `--webpack` por uma configuração temporária, removida em seguida.

## 7. Pendências reais

1. **Restaurar versão na tela do editor**: a RPC e a ação existem e são testadas, mas o painel "Histórico" do editor continua restaurando só no estado do navegador (com desfazer). Ligar o botão exige recarregar o documento e a revisão do editor depois da restauração; ficou fora para não arriscar regressão no editor.
2. **Abrir o editor para o papel editor da organização**: a organização autoriza *criar* o álbum, mas as tabelas do editor continuam restritas a `is_equipe()` + atribuição (0027/0043). Estender o editor a membros sem perfil de produção é decisão própria (ADR-002).
3. **Preenchimento automático ao abrir um álbum recém-criado da seleção**: hoje o designer aciona "Preencher automaticamente" filtrando pela pasta da seleção.
4. **Tempo de abertura no navegador** (canvas + imagens) não medido; o orçamento cobre o documento, não o render.
5. **Aplicação remota**: 0090 e 0091 exigem revisão de baseline e aplicação em staging; as travas de imutabilidade assumem que nenhuma rotina de manutenção reescreve `versoes_laminas` diretamente.
6. Fotos de um avulso referenciam originais de projeto nos buckets legados (`projetos_fotos`, `pedidos_fotos`) ou R2; a assinatura nos legados depende da RLS de Storage de quem abre (equipe do projeto), validada só no banco descartável.
