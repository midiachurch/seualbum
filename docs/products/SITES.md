# SeuAlbum Sites

Status: proposta de domínio; nenhuma implementação autorizada nesta missão.

## Objetivo comercial

Oferecer presença pública do estúdio coerente com o restante do ecossistema.

## Funcionalidades existentes — fonte local, sem validação de produção

Vitrine central, banners, portfólio, CMS em paginas_conteudo e mídia pública. Não equivalem a construtor de sites por organização.

## Funcionalidades novas — propostas

Site por organização, temas próprios, páginas/blocos limitados, rascunho/prévia/publicação, domínio verificado e revisão de acessibilidade/SEO.

## Rotas atuais e propostas

Preservar vitrine central e /p/[slug]. Propor /dashboard/sites e /site/[estudioSlug]; domínio próprio somente após validar titularidade e operação. Rascunho não deve ser público por erro de cache.

## Componentes e serviços reutilizáveis

Componentes marketing/layout, CMS e sanitização, media_assets/portfolio, Next metadata e adaptadores atuais; não copiar templates Pixieset.

## Entidades e dados

Sites, páginas/blocos e revisões/publicações com organização; associar só recursos explicitamente públicos. Avaliar estender o CMS por contrato antes de criar outro motor.

## Dependências

Core + mídia pública Gallery; Booking e Store por blocos opcionais. Sites não bloqueia Gallery/Design.

## Permissões

Editor e publicador são capacidades; gestão de domínio é específica. Contato público não expõe cadastro privado; upload privado nunca migra implicitamente ao bucket público.

## Potencial de monetização — hipótese

Adicional por site/domínio/recursos após validar custo e demanda; hospedagem e suporte de DNS entram na conta.

## Critérios de aceitação da primeira versão

Prévia privada, publicação reproduzível e rollback de versão; isolamento de organização no cache/domínio; HTML sanitizado; site não publicado retorna indisponível.

## Riscos técnicos

XSS, isolamento de cache, domínio/certificados, SEO e custo de editor visual amplo. Começar com blocos restritos em vez de editor arbitrário.

## Entregas rastreáveis

W01–W04. Ver [backlog](../roadmap/BACKLOG.md), [dependências](../architecture/MODULES-MAP.md) e [permissões](../architecture/PERMISSIONS.md). A pesquisa Pixieset é referência parcial, não especificação a copiar.
