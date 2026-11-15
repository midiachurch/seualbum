# SeuAlbum Core

Status: proposta de domínio; nenhuma implementação autorizada nesta missão.

## Objetivo comercial

Uma conta e uma organização coerentes para operar e contratar o ecossistema.

## Funcionalidades existentes — fonte local, sem validação de produção

Supabase Auth/profiles, fotografos como estúdio legado, seis papéis, guards, planos e adaptadores compartilhados.

## Funcionalidades novas — propostas

Organização/membership, contexto ativo validado, convites, entitlements, cotas, auditoria e configuração por organização.

## Rotas atuais e propostas

Preservar /auth/*, /dashboard, /admin e /cliente. Propor /dashboard/organizacao e /dashboard/conta; seletor de produtos no shell existente.

## Componentes e serviços reutilizáveis

requireUser/requireModuleAction, ROLE_PERMISSIONS, createClient/createAdminClient, componentes de navegação e UI.

## Entidades e dados

Reusar auth.users/profiles/fotografos; propor organizacoes, organizacao_membros e vínculo de entitlement/consumo. Não duplicar contas. Mapear o estúdio legado antes de backfill.

## Dependências

Nenhum outro produto é necessário para identidade; adaptadores de pagamento e armazenamento atendem contratos comuns, sem absorver seus domínios.

## Permissões

Owner/membro de organização são distintos da equipe global. Convite não pode promover papel global. Cliente final usa concessão de recurso.

## Potencial de monetização — hipótese

Base de assinatura por organização; sem preço decidido. Limits precisam de metering server-side.

## Critérios de aceitação da primeira versão

Um usuário troca organização sem acessar dados alheios; links legados funcionam; membership revogado nega operação; entitlements não contornam autorização.

## Riscos técnicos

Migração de propriedade, papel global amplo, cliente associado a mais de um estúdio, cache por organização e fallback permissivo.

## Entregas rastreáveis

P00, P01, C01–C05. Ver [backlog](../roadmap/BACKLOG.md), [dependências](../architecture/MODULES-MAP.md) e [permissões](../architecture/PERMISSIONS.md). A pesquisa Pixieset é referência parcial, não especificação a copiar.
