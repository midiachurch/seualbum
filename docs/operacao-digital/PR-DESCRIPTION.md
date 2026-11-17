A estrela manual da galeria existia apenas no estado do navegador. Este incremento persiste marcar/desmarcar pela RPC 0044, com sessão ativa, escopo por projeto/foto e histórico idempotente. A UI oferece contador/filtro, reversão em erro e modal com teclado/foco; favoritos continuam rascunho compartilhado, separados da selfie, entrega da seleção e aprovação.

Inclui os quatro commits locais anteriores da S1: identidade/retry de upload, isolamento 0043, proteção financeira e documentação/evidências. Preserva editor, prova, extras e integrações. A estratégia Operação Digital e os gates comerciais estão em docs/operacao-digital/.

Validação integrada: 560 testes unitários aprovados (sete ignorados), 547 verificações SQL, 46 HTTP PostgREST e dois cenários Chromium demo; TypeScript, lint e build webpack aprovados. Banco/container descartáveis, JWTs sintéticos e integrações externas desligadas. Build mantém avisos preexistentes de HEIC/Tailwind/lockfile.

PR em rascunho, sem merge/produção. Supabase remoto não alterado; consulta de baseline bloqueada por 403. Login Auth/navegador autenticado, upload real, portal por link/código, seleção entregue, recorrência/cotas e preview funcional permanecem pendentes. Não representa lançamento comercial.
