# ADR-003 — Favoritos e seleção separados da aprovação

Status: diretriz aprovada em 15/11/2026; ainda não implementada.

## Contexto

Estrela manual é local; RPC existente é unidirecional e registra selfie. fotos.favorita é global no projeto.

## Alternativas

Reutilizar a RPC como toggle sem mudar contrato; abrir UPDATE geral; criar listas individuais em todo fluxo imediatamente.

## Recomendação

Começar preservando favorito compartilhado por projeto com comando de estado desejado e histórico neutro; manter fluxo selfie; entregar seleção como snapshot separado de aprovação. Listas individuais só com necessidade aprovada.

## Consequências

Marcação por uma pessoa pode ser vista por outras com acesso; isso precisa ser claro na UX. O contrato deve prevenir desmarcar lote indevido e preservar atribuição/histórico.

## Validação e reversão

Dois usuários, concorrência, recarga, erro/retry e idempotência; decisão de álbum continua referenciando versão liberada.

## Decisão adotada

Na primeira versão, favoritos são compartilhados por projeto, preservando o modelo existente. O comando manual recebe estado desejado e permite marcar/desmarcar com autorização e histórico neutro. O comando de selfie permanece distinto. Entrega de seleção gera snapshot separado da aprovação de versão de álbum. Listas privadas por pessoa ficam fora do escopo inicial.

## Registro da autorização

O responsável pelo produto autorizou as próximas decisões na conversa em 15/11/2026: “autorizo as proximas decisoes.” As escolhas acima foram fechadas pelo agente com base nessa delegação e nas recomendações do masterplan; não representam respostas individuais fornecidas pelo usuário a cada alternativa. A autorização registra a direção de produto/arquitetura, sem executar código, migrations, deploy ou operações financeiras.
