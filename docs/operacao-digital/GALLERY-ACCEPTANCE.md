# Upload e galeria — Etapa 02

Baseline d03cf8d; desenvolvimento isolado em `feat/od-etapa2-upload`. Não houve instalação, uso de credenciais, chamada ao Supabase/R2 real ou migration remota.

## Entrega

- Fila única por gerenciador, máximo três tarefas simultâneas. Lotes novos e retry passam pela mesma fila. ID ativo/em espera bloqueia clique duplicado; falha libera vaga; encerrar descarta pendentes e impede começar novos callbacks. Requisições já iniciadas não são canceladas porque a API existente não oferece AbortSignal; resolução posterior não atualiza componente desmontado.
- Cada retry conserva a mesma operação de `criarUploadProjetoFoto`: UUID, chave, resultado de EXIF e etapa de confirmação do objeto. Não promete retomada de arquivos após refresh. Lotes escolhidos novamente são uploads explícitos novos; não aplica heurística de deduplicação por nome/tamanho que poderia descartar fotos distintas.
- Estados por arquivo: fila, enviando, erro/retry, concluído. Indicador geral informa quantidade concluída/total, espera, execução e falhas. Não mostra percentuais inventados de bytes; transporte fetch ainda não mede progresso de bytes. Demo usa tempo sintético identificado, sem transferência real.
- Validação antecipada de MIME/tamanho e nome, inclusive HEIC/HEIF de MIME vazio por extensão. Arquivo vazio, formato não permitido e >300 MiB são exibidos como erros, em vez de serem descartados silenciosamente. Backend/HeadObject continuam autoritativos; MIME não equivale à inspeção de conteúdo binário.
- `nomeOriginal` é enviado à confirmação. `normalizarNomeOriginal` conserva apenas basename, normaliza Unicode, remove controles de apresentação e limita a 240 caracteres. Nome é metadado de apresentação, nunca autorização ou chave. Confirmação grava `nome_original` apenas no primeiro INSERT; retry de foto já existente não modifica seu nome. Consumidores legados sem nome mantêm null. Depende da coluna nullable na 0045 (propriedade IA1); nenhuma 0047 duplicada foi criada.
- Selfie, favoritos persistidos, filtro/contador, modal/teclado/foco, editor, prova, cobrança e políticas não foram alterados semanticamente. Identidade persistida após confirmação e object URLs até desmontagem continuam preservadas.

## Verificação

- 55 testes unitários focais aprovados: fila (5), operação upload/retomada/validação (19), normalização (2), confirmação/autorização/nome/idempotência (4) e rotas R2 existentes (25). A rodada completa anterior tinha 576 aprovados e uma única falha no snapshot do INSERT legado pela adição de nome_original:null; após autorização do coordenador, essa expectativa foi atualizada e a suíte de rotas passou integralmente, preservando as verificações de autorização.
- Três cenários Chromium demo aprovados em 17,6 s: favoritos/filtro; modal/setas/Escape/foco; lotes sucessivos, máximo três envios, HEIC sem MIME e formato inválido. Primeiro início bloqueado pelo sandbox; repetição com permissão local passou. Primeira execução do novo cenário parou por seletor de alerta ambíguo com o route-announcer Next; seletor corrigido sem alterar comportamento da aplicação.
- ESLint focal e `git diff --check` aprovados.
- TypeScript nesta baseline aponta somente dependência de integração: campo `nome_original` ainda ausente no Database baseline. Coordenador deve integrar tipo da IA1 e repetir tipos na árvore completa.

## Limites e próximos gates

A fila limita trabalho simultâneo, mas a galeria ainda mantém previews de todos os originais em memória e renderiza todos os thumbnails. Não houve benchmark de galerias extensas, virtualização nem teste de retomada persistente. Estabilidade comercial para grandes galerias exige ensaio com orçamento de memória/quantidade explicitado.

A mudança conserva tamanho do arquivo para validação e metadados de identidade, preparando integração futura com ledger de consumo. Não implementa assinatura, quota atômica, reserva de bytes, medição de tráfego nem cobrança de armazenamento extra. Esses controles precisam do backend e regras comerciais próprios.

Gate integrado: 0045 + Database, queries que exponham nome original no Photo quando necessário, testes de rotas existentes, SQL/HTTP e build/navegador na árvore integrada. Nome legado não deve ser inferido do UUID da chave. Sem certificação de CORS/IAM, assinatura R2 real, Auth ou configuração remota.
