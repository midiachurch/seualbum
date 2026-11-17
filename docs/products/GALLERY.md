# SeuAlbum Gallery

Status: proposta de domínio; nenhuma implementação autorizada nesta missão.

## Objetivo comercial

Receber, curar e entregar fotos com seleção confiável, aproveitando o projeto atual.

## Funcionalidades existentes — fonte local, sem validação de produção

fotos com grupos/favorita, lightbox, upload R2, EXIF, busca facial opcional e destaque por selfie.

## Funcionalidades novas — propostas

Coleções/sets como projeção do acervo, seleção entregue com snapshot, compartilhamento, permissões de download, filas/retry e busca/filtros.

## Rotas atuais e propostas

Preservar /cliente/projetos/[id] e suas fotos. Propor /dashboard/gallery, /dashboard/gallery/[colecaoId] e /g/[token] somente com concessão explícita.

## Componentes e serviços reutilizáveis

ClientPhotosManager, EncontrarMinhasFotos, FotosPorCena, uploadProjetoFoto, enviarEConfirmarR2, fotos/RPC existente e reservas de upload.

## Entidades e dados

Foto canônica em fotos; novas colecoes/associacoes/selecoes somente se necessárias. ADR-003 aprovou favorito compartilhado no projeto para a primeira versão; listas individuais ficam fora do escopo inicial. Seleção concluída versionada não altera aprovações antigas.

## Dependências

Core obrigatório; contrato de AssetRef e SelectionSnapshot para Design. Store consome galeria se houver venda por foto.

## Permissões

Separar ler, enviar, excluir, selecionar, compartilhar e baixar. Link público não concede reconhecimento facial ou acesso à biblioteca inteira.

## Potencial de monetização — hipótese

Armazenamento, entrega e personalização como benefícios de plano; custo biométrico controlado por cota e opt-in.

## Critérios de aceitação da primeira versão

ID real após upload; favorito preservado após recarga; retry não duplica foto; acesso cruzado negado; seleção não aprova álbum; expiração de acesso tem comportamento definido.

## Riscos técnicos

Booleano atual global, log de selfie na RPC, novos UUIDs em retries, originais privados expostos, biometria e custos em grandes acervos.

## Entregas rastreáveis

U01–U03, G01–G06, P05. Ver [backlog](../roadmap/BACKLOG.md), [dependências](../architecture/MODULES-MAP.md) e [permissões](../architecture/PERMISSIONS.md). A pesquisa Pixieset é referência parcial, não especificação a copiar.
