# Decisões da Operação Digital

16/11/2026. Pedido Fase 01 determina produto digital comercial como prioridade, preserva aplicação e autoriza desenvolvimento incremental. Não autoriza produção, custos nem preços definitivos.

- D01: manter monólito Next/Supabase e vínculo Vercel existentes; sem novo projeto independente. Compatível com ADR-001.
- D02: favorito compartilhado é rascunho reversível, selfie permanece comando próprio, entrega é snapshot e aprovação é versão. ADR-003 continua vigente; incremento manual implementado nesta frente, entrega ainda futura.
- D03: manter escopo por projeto/atribuição da 0043 e testes negativos. Sem ampliar policies nem usar service role como autorização. Organização e conta continuam conceitos distintos.
- D04: três worktrees independentes com contratos anteriores ao código; integração centralizada por arquivos revisados e commits por domínio.
- D05: prévia da galeria autenticada não certifica portal público ou SaaS multi-organização. Gates existentes permanecem explícitos.
- D06: assinatura/franquias e serviço de diagramação separados; sem preços definitivos. ADR-004 continua compatível.

[ADRs históricos](../decisions/README.md) não são apagados. A prioridade e o escopo de execução atuais substituem o limite documental da missão inicial, sem transformar planos futuros em funcionalidades presentes.

## Etapa 02 — 17/11/2026

- D07: conservar tabelas clientes/projetos para criação digital sem pedido/compra obrigatória; nova RPC estreita com idempotência, sessão de fotógrafo ativo e evento real. Não cria outra organização/conta.
- D08: seleção entregue usa snapshot imutável por revisão e chave/payload. Fotógrafo dono e cliente vinculado decidem; equipe autorizada lê/exporta sem decidir pelo cliente. Nome original nullable preserva legados sem inventar nomes.
- D09: portal guest usa concessão e sessão opacas com hashes; código bcrypt, 10 erros/15 minutos por concessão, expiração de 30 dias/sessão de 8 horas e revogação em cada RPC. Sem JWT de cliente fictício ou service role. Operações do portal serializadas por projeto para ordenar revogação/entrega; custo de concorrência/performance precisa medição para galerias grandes.
- D10: portal novo serve originais R2 por URL de 60 s após checagem, mantendo caminho autenticado Storage legado. Não ampliar policies anônimas para habilitar os legados. Prova/mensagens guest e proxy/imagens legadas ficam em gate de integração futuro.
- D11: fila máximo de 3 por gerenciador, retry conserva operação; progresso agregado por arquivos, sem porcentagem fictícia de bytes. Não promete retomada após refresh, cobrança/franquias ou cancelamento de PUT iniciado.
