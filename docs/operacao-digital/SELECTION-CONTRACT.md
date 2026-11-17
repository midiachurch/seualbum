# Contrato de seleção entregue — Etapa 02

Implementação local, sem implantação remota. Favoritos e aprovação continuam independentes.

`entregar_selecao(projeto, foto_ids, revisao_esperada, chave)` exige conta ativa e fotógrafo dono ou cliente vinculado; equipe pode consultar/exportar projeto autorizado, mas não entregar pelo cliente. IDs devem ser distintos, não vazios e até 1000. Ordem não altera o payload. Uma chave idempotente por projeto/origem/ator com o mesmo payload e revisão retorna a mesma entrega; payload divergente retorna 22023. Projeto é bloqueado durante revisão; revisão desatualizada retorna 40001. Snapshot contém IDs, bucket, caminho e nome original nullable, sem inventar nome legado. Foto não pode ser excluída ou alterar identidade do snapshot por efeito de cascade.

Core privado conforme ETAPA-02-CONTRACTS: `private.entregar_selecao_core(p_projeto_id uuid,p_autor_id uuid,p_portal_id uuid,p_foto_ids uuid[],p_revisao_esperada integer,p_chave uuid) returns jsonb`; apenas wrappers definer autorizados chamam. Exatamente uma identidade de origem. Retorno `{id,revisao,total}`. Portal deve validar concessão/sessão antes de chamar e nunca aceitar ator informado pelo navegador.

Leitura RLS por `pode_ver_projeto`, escrita direta negada. Atualizar/excluir snapshots é proibido inclusive por caminho de aplicação privilegiado. Evento de entrega com data/autor (ou concessão portal) é único por nova revisão e notificação interna persistida em tabela própria para fotógrafo dono; sem disparo externo nesta etapa. Exportação revalida leitura por RLS em cada chamada, devolve manifesto e links temporários (R2 5 minutos; Storage sessão/RLS) sem URL pública de originais. Nome original ausente é explicitado e exportação não o inventa.

Limites: não implementa assinatura, portal, cota, envio de e-mail, ZIP servidor ou retomada de download após expiração. URLs emitidas continuam utilizáveis até vencer; revogação não apaga download concluído. Snapshot é lista histórica, não cópia binária do objeto; exclusão física futura precisa retenção própria.
