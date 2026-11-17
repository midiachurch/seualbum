# Permissões: atual, risco e alvo

> Baseline histórica abaixo. Localmente a 0043 restringiu produção por atribuição e conta ativa; a 0044 separou favorito manual. Continuação validou 587 verificações SQL e 46 HTTP, incluindo Storage privado. Estado remoto desconhecido por 403; ver [execução](../operacao-digital/EXECUTION-STATUS.md) e [limites de Storage](../operacao-digital/STORAGE-REVIEW.md).

## Estado atual e fronteiras

`profiles.role` possui admin, gestor, operador, designer, fotografo e cliente. `ROLE_PERMISSIONS` é matriz de apresentação/aplicação; não é policy SQL. Proxy revalida usuário e área, mas exclui APIs; helpers e Route Handlers repetem autenticação. A service role ignora RLS e deve ter finalidade estreita, validação prévia e retorno mínimo.

| Ator atual | Intenção de produto / controles locais | Ressalva |
|---|---|---|
| Admin | Gestão da plataforma e equipe | Papel global; não converter em owner de todos os estúdios |
| Gestor | Operação, atribuição, revisão interna e vitrine | Diferenciar gestão de produção de gestão comercial da organização |
| Operador | Produção e ações permitidas pela matriz | Comentários dizem atribuição, SQL de equipe é mais amplo: A05/A06 |
| Designer | Fila, editor e prova; conversas atribuídas | Helper pode_ver_projeto inclui is_equipe, que inclui designer; acesso amplo no SQL local |
| Fotógrafo | Próprio estúdio, clientes/projetos, pedidos e fechamento | Não equivale a multiusuário/multiorganização |
| Cliente | Projetos vinculados e decisões autorizadas de prova | Não recebe acesso administrativo à organização |
| Visitante | Vitrine e concessões públicas por hash/token | Não ganha acesso privado geral nem reconhecimento facial |

A permissão atual efetiva é a composição de grants, RLS, RPCs e triggers implantados. Não foi medida no banco. Policies permissivas combinam por OR, e SECURITY DEFINER pode executar fora da RLS do chamador; testes devem atingir PostgREST/RPC diretamente, não somente a UI.

## Alvo proposto: contexto + capacidade

Decisão: usuário autenticado + membership/concessão ativa + organização do recurso + capacidade da operação + estado de negócio + entitlement, quando houver custo. Entitlement não autoriza acesso alheio. Ausência de contexto, perfil ou membership deve negar a operação, não assumir admin.

| Capacidade | Owner/admin da organização | Membro produtor autorizado | Cliente com concessão | Operação SeuAlbum |
|---|---|---|---|---|
| Gerir membros e assinatura SaaS | Sim | Não | Não | Não por suporte; somente operação excepcional específica aprovada |
| Fotos privadas | Conforme organização/projeto | Somente escopo concedido | Somente galeria/projeto concedido | Finalidade e atribuição, a aprovar |
| Enviar/excluir fotos | Capacidade explícita | Capacidade explícita | Envio se permitido; exclusão restrita à regra de propriedade | Conforme operação autorizada |
| Favoritar/entregar seleção | Conforme papel e escopo | Conforme papel e escopo | Concessão de seleção | Não simular decisão do cliente |
| Editar/publicar prova | Produção autorizada | Produção atribuída | Não | Produção/revisão conforme papel |
| Aprovar álbum | Representante autorizado da decisão | Não por ser editor | Conforme projeto/versão | Revisão interna distinta da decisão do cliente |
| Pagar fechamento | Responsável financeiro do estúdio | Somente se concedido | Não por padrão atual | Cortesia só gestão, com motivo |
| Publicar site / alterar domínio | Capacidade específica | Se concedido | Não | Sem acesso irrestrito implícito |

Direção aprovada na ADR-002: designer/operador por atribuição ou concessão, gestão interna transversal apenas para produção e suporte com escopo auditado. Esta matriz é especificação de alvo, ainda sujeita à revisão dos contratos e testes; não substitui permissões implantadas. Papéis de organização sugeridos owner/admin/member são novos conceitos, não renomeação dos globais gestor/operador/designer.

## RPC favoritar_fotos

0042 exige sessão, pode_ver_projeto, lote até 1000, restringe UPDATE a IDs do próprio projeto e só marca true. O estado é booleano global em fotos, não lista por pessoa. O log pressupõe selfie. Reusar a operação sem mudança de contrato causaria semântica incorreta para toque manual e impossibilidade de desmarcar. Propor comando autenticado com estado desejado e origem definida pelo servidor, controle por recurso e histórico neutro; preservar o comando de selfie. Não abrir UPDATE amplo em fotos como solução.

## Invariantes e testes obrigatórios futuros

1. Estúdio A não lê/grava/assina mídia do B, mesmo conhecendo UUID/chave. Cliente A não muda IDs para projeto B.
2. Designer não atribuído: teste de SELECT fotos/projetos, RPC favorito e acesso a upload. Comparar resultado com política aprovada; testar também operador.
3. Cliente não promove papel, altera plano, franquia, prazo, expedição ou observações internas; testar as travas da 0041 e chamadas diretas.
4. Relacionamentos cliente↔projeto↔organização consistentes; membership revogado deixa de autorizar; cache/URLs de mídia têm validade e revogação documentadas.
5. Aprovação só da versão liberada correta; concorrência e repetição não duplicam fatura nem liberam impressão sem fechamento.
6. Reserva de upload pertence ao autor; chave atravessada e confirmação repetida não criam registro alheio. Service role não pode ser alcançada por um handler sem escopo validado.
7. Token público entrega somente versão/dados concedidos; expiração/revogação e enumeração a validar. Não expor índices faciais ou originals por simples conhecimento do token.

## Dados sensíveis e pesquisa

Preservar opt-in por projeto, consentimento de busca, retenção e remoção. A combinação desses controles não é parecer jurídico de conformidade. Validar finalidade, papéis de tratamento e contratos antes de ampliar uso biométrico. Nunca colocar dados reais ou credenciais em documentação, fixture, log ou evidência.
