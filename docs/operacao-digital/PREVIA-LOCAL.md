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
