# Galerias Digitais v1 — PR publicada; homologação externa pendente

Data: 17/11/2026. Autorização: pedido anexado do usuário para implementar, publicar nova PR, revisar/aplicar migrations, integrar e verificar produção. Os limites anteriores de Etapa 02 são históricos no que conflitam com este pedido.

## Base e preservação

Worktree exclusivo `/private/tmp/seualbum-galerias-digitais-v1`, branch `feat/galerias-digitais-v1`, criado em `b59e2cf` e atualizado por fast-forward para `origin/main` (`4fac791`). PR #2 já estava mesclado; não foi alterado. Nenhum commit posterior na branch da base. Referência visual `feat/experiencia-2` consultada sem copiar sua implementação ou sobrescrever seu worktree. Pesquisa Pixieset e checkout original preservados. Dependências locais reutilizadas por symlink, sem instalação.

## Experiência implementada

- Login/cadastro do fotógrafo e `/dashboard` levam a `/dashboard/galerias`. Navegação oferece Galerias e Minha conta; não oferece serviços físicos, cobrança, prova ou editor. Homepage e atalhos públicos refletem o produto digital; rotas históricas, dados e contratos preservados.
- Lista com criação destacada em diálogo acessível, informações reais de fotos/data e última seleção recebida. A criação abre Fotos da nova galeria.
- Galeria com áreas Fotos, Seleções e Compartilhar. Grade responsiva e fila/retry existentes preservados, com concorrência 3 e identidade por arquivo.
- Seleções do fotógrafo apresentam revisões, data, total e Exportar CSV com links autorizados temporários. O painel desta versão não apresenta ação de decidir a entrega pelo cliente.
- Compartilhamento com estado consultável após recarga, validade, campos copiáveis, alerta de exibição única e confirmação antes de substituir/revogar. Nenhum link/código bruto é persistido para recuperar na UI.
- Portal sem cadastro com favoritos persistidos, modal de fotos, confirmação modal de entrega e retorno visual após entrega. CTA móvel alcançável, foco visível, ações de ao menos 44 px, contraste e textos de erro/revogação. Revisões continuam distintas dos favoritos e da aprovação legada.

## Migration 0048 e plano revisado

`20261117000400_0048_estado_portal.sql`: cria somente `estado_portal(uuid)`, RPC de leitura de metadados (`estado`, `expiraEm`). SECURITY DEFINER com `search_path=public,pg_temp`, verificação de perfil fotógrafo ativo e proprietário do projeto. Execução somente authenticated; anon/public/service_role sem grant. Não abre tabelas de credenciais, não retorna hashes, links, códigos ou sessões e não escreve dados.

É aditiva e compatível com a versão ainda em produção: nenhuma tabela, coluna, policy ou RPC existente é alterada. 0043–0047 revisadas como dependências e continuam cobertas pelas regressões. Em caso de rollback de frontend, a função aditiva pode permanecer sem afetar a versão anterior. Não usar reset/repair nem excluir registros.

Alvos conferidos: Supabase `ytqbyfmroyilinxdhopv`; Vercel `seualbum`, ID `prj_nHefeqEHHGDxpDkilEtDbz1fZXII`. Histórico remoto contém as 47 migrations anteriores, todas correspondentes. Simulação lista SOMENTE a 0048. Aplicada nesta entrega após CI verde, em 17/11/2026. Nova consulta confirma 48 migrations correspondentes e segunda simulação `upToDate=true`, sem pendências.

## Validação e capturas

- TypeScript e lint aprovados. 606 unitários aprovados; 7 ignorados preexistentes.
- Build webpack aprovado com rede para fontes Google; primeira tentativa em sandbox falhou por indisponibilidade de rede. Avisos preexistentes HEIC/Tailwind/lockfile.
- 48 migrations ensaiadas no banco descartável; 684 verificações SQL aprovadas (inclui 10 da 0048), 64 verificações HTTP e concorrência real (uma aceitação/um conflito).
- Playwright demo: 5/5.
- Playwright com Auth GoTrue, Next, Server Actions, PostgREST e SQL reais: fotógrafo/cliente em 1440 e 390 px, geração de acesso, favorito após reload, duas revisões, CSV, revogação e negação entre galerias. Mídia/R2 substituídos, exclusivamente no ambiente descartável. Retry na UI verificou falha de confirmação após PUT: uma assinatura, um PUT, duas confirmações, mesma chave/ID; o seletor final da lista distingue o título da seleção do card de galeria. Gate final: 3/3 aprovado.
- [Capturas e limites](evidence/galerias-v1/capturas/README.md). Links/códigos mascarados e identidades sintéticas. Sem capturas de dados pessoais ou credenciais reais.

Uma expectativa HTTP 404 foi ajustada para exigir tela 404 e ausência de conteúdo: Next pode iniciar streaming com HTTP 200 antes de `notFound()`. As verificações SQL/API de isolamento não foram relaxadas. A fixture da 0048 foi corrigida para usar ator admin na inativação e ordenar acesso ainda não revogado antes dos anteriores com mesmo timestamp transacional.

## Gates externos ainda abertos

Vercel produção lista Auth, mas não lista `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. Preview lista somente `NEXT_PUBLIC_SUPABASE_URL`, sem anon key. Nenhuma credencial R2 local disponível. Configuração solicitada ao responsável no painel, sem segredos pelo chat. Não criar outro bucket/projeto nem custo para contornar. Sem essa configuração não há homologação real de upload/imagem.

Conta de teste indicada pelo usuário: identificador mantido apenas na conversa, sem copiá-lo para artefatos. Solicitação de login no Chrome em andamento; não reutilizar credenciais locais de outra conta. Chrome foi observado na área `/cliente`. Consulta remota restrita confirmou a conta indicada ativa com papel `cliente` e sem linha em `fotografos`. Solicitada escolha de conta de fotógrafo ao responsável; nenhuma elevação de papel realizada.

Produção anterior observada: `https://seualbum.vercel.app`, deployment `dpl_AZzEg1ZnkfP2ToMGMfXY9afg5e1F` / `https://seualbum-lgd961i7k-midiachurch.vercel.app`, Ready em `main` `4fac791`. Ready não comprova upload/fluxo comercial saudável.

PR publicada: [#3 — Galerias Digitais v1](https://github.com/midiachurch/seualbum/pull/3), aberta, sem merge. Implementação `3b6efb8`, normalização de evidência `41d97bc`. CI `44107632051` e Vercel Preview `7856766126` aprovados para `41d97bc363eaa84dc5cb81165de7d9730ded5713`. [Preview](https://seualbum-eljohv5ez-midiachurch.vercel.app), HTTP 302 para autenticação Vercel; não houve bypass. Ready não comprova fluxo com mídia real. A sessão GitHub ativa não tinha push; usada a sessão proprietária já autenticada somente no processo, sem trocar a conta global nem expor tokens.

Migration 0048 aplicada no alvo correto após CI verde; simulação final sem pendências. Consulta pós-aplicação confere existência da RPC e grants: authenticated=true, anon=false, service_role=false. Nenhuma migration anterior reaplicada, nenhum reset/repair.

Próximos gates: resolver configuração R2/preview e conta de fotógrafo; homologar serviços reais; fazer merge e acompanhar deploy automático do SHA integrado; jornada completa em produção com conteúdo próprio. Não alegar produção ou R2 validados antes desses gates. Esta atualização documental posterior também dispara os checks do head da PR; o SHA vigente deve ser consultado no GitHub.

## Incidente da ferramenta Vercel

Durante diagnóstico, `vercel env run -e production -- node <script local de booleanos>` retornou inesperadamente a criação/publicação de `seualbum-check-env` fora do alvo, deployment `dpl_5tG2reGXzweLvASuS7yV4VRyHgZv`, URL `https://seualbum-check-env.vercel.app`. O script local não contém comando de deploy nem valores de credenciais. O vínculo do worktree continua `seualbum` (`prj_nHefeqEHHGDxpDkilEtDbz1fZXII`). Operações Vercel de publicação interrompidas e responsável avisado; solicitada autorização de remoção restrita do recurso inesperado. Não foi solicitada nem realizada publicação da entrega em produção. Consulta somente leitura com a CLI anterior confirmou o recurso inesperado `prj_wvAATmNG1wMR98uKiVaHSvxrGnBh`. Causa ainda em apuração; não repetir `env run`.
