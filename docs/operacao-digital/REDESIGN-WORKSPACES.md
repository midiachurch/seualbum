# Redesign dos painéis internos — 21/11/2026

Autorização: após aprovar a visão geral inspirada na referência visual e solicitar a remoção da moldura cinza escura, o usuário autorizou aplicar o layout aos demais painéis internos.

## Implementação

- Estrutura comum em `src/components/workspace/`: navegação lateral, busca de áreas, trilha da página, identificação da conta, mensagens, saída e menu móvel. Fundo claro ocupa toda a janela; painéis translúcidos, cartões arredondados, indicadores em verde-lima, menta e rosa.
- Layouts de fotógrafo, administração e cliente adaptados, incluindo suas subpáginas. A autorização continua nos layouts, nas páginas, na proxy e no banco. O menu respeita o papel global e as restrições adicionais já existentes da proxy para o designer.
- Loja, Agenda, Estúdio (funil/tarefas/modelos/comunicação), Equipe e Sites na prévia recebem o mesmo workspace, cabeçalhos claros e indicadores calculados a partir das fixtures.
- Central de operação local passa a usar a navegação compartilhada. As telas de galerias, eventos, catálogo, assinatura, pedidos, comunicação, seleção e prova adotam a paleta e os cartões aprovados. Reducers, armazenamento, comandos e confirmações permanecem os existentes.
- Resumos do fotógrafo e da administração revistos; portal do cliente aproveita a largura do desktop e mantém uma coluna no celular. Chamada de aprovação usa destaque rosa e ação principal escura.
- Editor recebe a moldura do workspace. Estilos de formulários e cartões são excluídos da área de ferramentas para preservar o documento. Em janelas estreitas, a bancada pode rolar horizontalmente dentro do painel, sem alargar a página.
- Site público de exemplo conserva seu tema próprio. Não foram alterados marketing, autenticação, portal guest, banco, migrations ou integrações.

A busca comum procura **áreas do painel**, conforme seu rótulo. As buscas de conteúdo continuam nos componentes de cada módulo. Links adicionais de prévia só são oferecidos quando o servidor explicitamente habilita a prévia local. No cliente, mensagens, contato com o estúdio e saída continuam acessíveis.

## Verificações

- TypeScript sem erros e `git diff --check` limpo.
- 11 testes focados aprovados: navegação por papel, restrições do designer, página ativa em subrotas/abas, exclusão de links locais fora da prévia e bloqueio da entrada fictícia em produção/com Supabase/sem flags.
- 14 jornadas existentes da central aprovadas: 13 na execução inicial e a jornada restante repetida com sucesso após eliminar um nome duplicado entre menu e aba. Importação/IndexedDB, seleção, ZIP, acesso/revogação local, concorrência, prova/versionamento/aprovação, checkout, assinatura e comunicação exercitados. Logs em `/private/tmp/seualbum-workspace-e2e.log` e `/private/tmp/seualbum-workspace-e2e-retry.log`.
- 14 endereços representativos conferidos em desktop, sem transbordamento horizontal ou erros de JavaScript. Outros 14 em 390 px; corrigido o transbordamento do seletor de finalidade nos modelos e conferida a correção. Menu móvel, busca de áreas, aba ativa por URL e navegação do designer também exercitados.
- Varredura de carregamento das 34 páginas estáticas internas: 20 administrativas, 12 do fotógrafo e 2 do cliente. Respostas 200 e estrutura comum presente. A prévia privada de site depende de um identificador e fica fora dessa contagem. Durante a compilação ampla, Next reiniciou automaticamente por seu limite de memória; a navegação foi retomada depois de o servidor voltar. Isso não substitui os testes funcionais de cada módulo.
- Mais 5 rotas de detalhe com o projeto sintético `proj-1042`: projeto/prova/editor administrativos e projeto/prova do cliente, todas com resposta 200, workspace presente e sem transbordamento horizontal. Essa conferência do editor verifica carregamento/moldura, não edição persistida.

Os testes desta rodada cobrem apresentação, navegação e regressão local. Não certificam schema remoto, mídia real, acessibilidade integral ou produção. A cobertura anterior de banco/portal permanece descrita em [REVISAO-LOCAL](REVISAO-LOCAL.md); não foi reexecutada por esta alteração visual.

## Navegação local

Com `npm run preview:local`, abra **http://127.0.0.1:3121/previa**. A visão geral aprovada continua em **http://127.0.0.1:3121/previa/visao-geral**. A prévia usa exemplos e continua sem informar usuário ou senha. Os módulos com fixtures não gravam no servidor; a central conserva os dados neste navegador.

## Refino visual — 24/11/2026

A pedido do usuário, o shell compartilhado (`src/components/workspace/`) recebeu um visual mais atual. Somente CSS e a fonte de títulos foram alterados; navegação, autorização e componentes seguem iguais.

- Fundo liso `#F4F5F2` no lugar dos degradês; menu lateral como painel branco flutuante (no celular, gaveta branca).
- Item ativo com fundo tinta `#0F1A19` e ícone sobre verde-lima `#CFEF5A`; ícones em quadrados arredondados.
- Cartões, campos e botões sólidos em branco, com borda fina e raios por hierarquia (painel 28, cartão 20, controles 12).
- Indicadores: apenas o primeiro em lima; os demais em branco. Menta e rosa deixam de preencher os indicadores.
- Títulos e números em Bricolage Grotesque (`next/font`, variável `--font-display`); corpo segue em Open Sans. Cabeçalhos de tabela e rótulo da busca deixam a caixa alta.
- `/previa/visao-geral` usa a casca própria `visao-estudio` e **não** foi alterada.

Verificado: TypeScript, lint, suíte vitest e conferência visual de `/previa/agenda` em 1440 e 390 px, sem transbordamento horizontal nem erros de JavaScript. As jornadas E2E da central não foram reexecutadas para este refino.
