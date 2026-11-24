# Prévia navegável sem login — 21/11/2026

Pedido: disponibilizar localmente o que foi construído para navegação, sem informar acessos.

Execute `npm run preview:local` e abra **http://127.0.0.1:3121/previa**. O servidor escuta somente neste computador. Para reiniciar em outra porta, use `SEUALBUM_LOCAL_PORT=3122 npm run preview:local`.

O índice oferece galerias/operação, fotógrafo, administração, cliente, editor, design, Store, Booking, Studio, equipe, construtor de sites, site de exemplo e apresentação comercial. Há um botão para retornar ao índice em todas as páginas.

- **Galerias e operação:** fluxos interativos persistidos no navegador, inclusive importação, seleção, prova, compra e assinatura simuladas.
- **Painéis por perfil:** o índice cria uma sessão fictícia de demonstração ao abrir a área. Nenhum usuário real é autenticado. Para trocar de perfil, volte ao índice; a sessão de demonstração é compartilhada pelas abas do navegador.
- **Store, Booking, Studio, equipe e Sites:** componentes reais recebem fixtures tipadas, inteiramente fictícias. Formulários e abas podem ser explorados; gravações no servidor permanecem desativadas e informam demonstração. Os dados são reiniciados ao recarregar. Isso permite revisar a interface sem representar integração ou homologação externa.

O launcher esvazia as configurações de provedores externos antes de iniciar Next. A entrada direta por perfil exige desenvolvimento, as duas flags locais e ausência de Supabase configurado; fora dessas condições retorna 404. Os destinos são uma lista fixa, com redirecionamento relativo para preservar a origem e o cookie. Não houve mudança nas regras de autorização reais, migration remota, publicação externa ou cobrança.

Verificação: 16 endereços visitados no Chromium; quatro perfis abriram diretamente após a correção do redirecionamento entre localhost e 127.0.0.1. Índice inspecionado em desktop e celular (390 px), sem transbordamento horizontal. Cinco testes cobrem a entrada fictícia, recusa em produção/com Supabase/sem flag e destinos inválidos. Ações da loja verificadas com aviso de demonstração; navegação da linha do tempo e link da prévia de site conferidos. TypeScript e lint dos arquivos alterados também verificados.

Esta prévia serve para navegação local. O aceite funcional e as dependências externas continuam registrados em [REVISAO-LOCAL](REVISAO-LOCAL.md).


## Navegação independente publicável — 24/11/2026

Escopo corrigido pelo usuário: construir agora telas, fluxos e pontos de integração; conectar provedores depois. A falta de credenciais não bloqueia a navegação e não exige migrations remotas para esta entrega.

- `SEUALBUM_NAVEGACAO_INDEPENDENTE=1` habilita o mesmo índice, visão geral, quatro perfis, módulos e central de fluxos em um build de produção desconectado. A flag sozinha não permite misturar a demonstração com serviços: se houver configuração de Supabase, Stripe, R2, reconhecimento facial, e-mail, webhooks, cron ou roteamento de domínio, as entradas independentes permanecem fechadas.
- Sem a flag, a aplicação conectada e suas regras de autorização continuam operando. Cookies fictícios só são aceitos pelo modo de demonstração já existente quando não há Supabase. Cookies da entrada por perfil usam Secure em produção.
- A home da versão independente abre a apresentação comercial, conforme revisão do usuário; o botão “Explorar a plataforma” abre a visão geral. O endereço anterior `/?apresentacao=1` continua abrindo a mesma home. Os atalhos reais de Galerias, Loja, Agenda, Estúdio, Equipe e Sites levam às respectivas telas independentes, preservando as abas do Estúdio.
- Galerias e operação mantêm arquivos e fluxos em IndexedDB/localStorage do navegador: importação, seleção, prova/versionamento/aprovação, loja e assinatura simuladas. Esses dados não são enviados ao servidor e não migram automaticamente para os provedores.
- Os módulos com fixtures oferecem as telas e formulários existentes; ações que gravariam no servidor informam o modo de demonstração. Isso não equivale a pagamento real nem a backend já conectado. Não foram removidos os adaptadores e contratos existentes.
- Launcher reproduzível: `node scripts/navegacao-independente.mjs` para desenvolvimento; `--build` compila sem credenciais e `--start` serve esse artefato. Não usar o launcher como caminho de build da aplicação conectada.
- Verificações: TypeScript e ESLint aprovados; 1.068 testes unitários aprovados/7 ignorados; build webpack de produção aprovado; 59 acessos de navegador com quatro perfis, módulos e redirecionamentos, sem erros de JavaScript, com solicitações externas bloqueadas. Índice em 390 px sem transbordamento e menu móvel conferido. A primeira suíte unitária concorria com o build e excedeu um orçamento de desempenho; repetição sem o build e suíte com dois workers aprovadas, sem relaxar os limites.
- Nenhuma migration remota, conexão de provedor, exclusão ou cobrança faz parte desta publicação. Na Vercel, a versão independente deve receber variáveis vazias por deployment para serviços e a flag explícita, preservando os valores configurados no projeto para uma futura versão conectada. Cron não é incluído no deployment independente.


Publicação inicial independente concluída no domínio https://seualbum.vercel.app pelo deployment `dpl_6rmgJF6GX4fshKRU8tsQiHcJu8cH`, fonte `9ee77f0`. Além do gate local, os mesmos 59 acessos foram aprovados no domínio público com quatro perfis e zero erros de JavaScript; nenhuma solicitação a provedor foi liberada pelo navegador de teste. CI do código aprovado. O usuário solicitou depois que a home comercial volte a ser a entrada padrão; ajuste em publicação.

A publicação é direta da branch de desenvolvimento, sem merge na main. Flags e variáveis vazias pertencem ao deployment independente, não substituem as configurações do projeto. Um deploy Git comum não herda automaticamente essas substituições; escolher explicitamente o modo de publicação antes de uma próxima promoção. A versão anterior à publicação independente permanece em `https://seualbum-lgd961i7k-midiachurch.vercel.app`.
