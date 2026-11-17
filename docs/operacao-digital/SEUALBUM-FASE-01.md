# Seu Álbum — Fase 01, estratégia reconstruída

Origem explícita: reconstrução das diretrizes do pedido original “SEU ÁLBUM — FASE 01 | OPERAÇÃO DIGITAL” fornecido na conversa e da ordem “Etapa 02”, recebida em 16–17/11/2026. **O arquivo original com este nome não foi recuperado.** Esta é uma síntese operacional rastreável, não cópia alegada de arquivo externo.

## Produto inicial

Plataforma de serviços digitais para fotógrafos, no monólito existente, com assinatura recorrente e serviços complementares. Não depende de impressão, laboratórios, gráficas ou logística física.

Fotógrafo cria projeto e envia fotos → galeria premium → link privado e código → cliente sem cadastro escolhe e entrega seleção → fotógrafo recebe snapshot organizado e originais → diagramação própria ou serviço opcional Seu Álbum → prova versionada → ajustes ou aprovação final → conclusão. Timeline de fatos reais e notificações internas contextualizadas acompanham o fluxo.

## Critérios

- Galeria responsiva com marca do fotógrafo, grid, modal/teclado, estados vazios/erro, favoritos persistidos, contador e filtro.
- Upload múltiplo com concorrência limitada, progresso honesto, retry e identidade estáveis, arquivo validado, acesso privado, metadados de originais. Consumo e franquias controlados no backend antes de ativar cobrança.
- Portal por link/código, sessão segura, limites de tentativas, concessão por projeto, expiração/revogação/renovação; nenhuma conta Auth fictícia.
- Favoritos são rascunho. Entrega cria snapshot versionado auditável com autor/origem e data, revisão/conflito e retry idempotente. Exporta nomes conhecidos/IDs e originais autorizados, sem inventar nomes de legados.
- Prova preserva versão, páginas, comentários, solicitação de ajustes, aprovação final e responsável/data. Mensagens assíncronas existentes são reutilizadas.
- Timeline separa eventos automáticos/manuais e visibilidade cliente/interno; notificações não duplicam. Não expor notas administrativas.
- Diagramação opcional e cobrada separadamente. Assinatura/franquia/adicional de espaço e tráfego são contextos próprios; nenhum preço definitivo, quota fictícia ou exclusão automática de dados reais.
- Manter galerias conforme contrato ativo e consumo; políticas de recuperação/inadimplência precisam aprovação comercial antes de operação destrutiva.

## Preservação e limites

Preservar editor, selfie, prova, extras, integrações, identidade visual, pesquisa Pixieset, documentação e histórico. Sites/CRM expandido/novos serviços/impressão/logística continuam futuros sem bloquear lançamento digital.

Três frentes reais e isoladas: coordenação/portal/infra, seleção/exportação e upload/armazenamento. Contratos anteriores ao paralelismo e revisão antes da integração. Desenvolvimento, testes, commits/push de desenvolvimento e PR em rascunho autorizados; sem merge/prod/migration remota/custo/exclusão ou mudança relevante de arquitetura sem aprovação.

A matriz MVP-MATRIX distingue código implementado, validação local e homologação. CI/Ready não certificam schema remoto, Storage/R2 nem o fluxo comercial completo.
