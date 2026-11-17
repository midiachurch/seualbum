# Revisão local de armazenamento e autorização

Continuação a partir de `d7413a5`, em 16/11/2026. Nenhuma consulta ou alteração remota; nenhuma credencial ou dado real usado nesta revisão. A execução descartável não demonstra a configuração implantada no Supabase, R2 ou Vercel.

## Modelo observado

- Migration 0002: `projetos_fotos` é privado; leitura/escrita de objetos passa por `pode_ver_projeto`, que a 0043 restringe a conta ativa, fotógrafo/cliente vinculados e produção atribuída, preservando admin/gestor transversal.
- Migration 0027: `albuns_fotos` é privado, limite 50 MiB, JPEG/PNG/WebP; a 0043 restringe SELECT/UPDATE/DELETE ao layout visível via RLS. INSERT de álbum de projeto permite somente `{layout}/derivados/...`; originais pertencem ao projeto. Fotógrafo/cliente não recebem por isso acesso direto ao material interno do editor.
- `midia_vitrine` e `fotografo_logos` são públicos por finalidade. Não devem receber originais privados. R2 usa bucket privado separado de mídia pública e assinatura temporária pelo servidor.
- `src/lib/r2/sessao.ts`: projeto consulta RPC `pode_ver_projeto`; álbum consulta layout com sessão/RLS; mídia/logos têm portas por papel/capacidade. `src/lib/r2/cliente.ts` gera URLs temporárias com SDK S3. RLS SQL não governa diretamente um GET ao R2 nem revoga uma URL já emitida antes de seu vencimento.

## Exceções e limites preservados

A policy `albuns_fotos_aprovacao_publica` da 0027 permite SELECT de arquivos no caminho de aprovação ativa conhecendo seu UUID, sem exigir sessão ou token na própria policy. O token público é usado pela função que revela a aprovação. Isso é uma capacidade legada distinta de portal por link e código; UUID não deve ser tratado como dado público comum. O helper verifica aprovação não cancelada. Revisar expiração, enumeração e revogação operacional antes do portal comercial, sem remover compatibilidade sem decisão.

Álbuns avulsos sem projeto conservam escopo interno legado; não são isolados por organização. Não concluir tenancy SaaS a partir dos testes de dois projetos. Não houve teste runtime de Storage API, assinatura real R2, CORS/IAM, remoção de arquivo, quotas/franquias ou revogação de URL emitida. O harness usa schema oficial de Storage, mas não inicia o serviço de objetos; somente sua autorização SQL é exercitada.

## Nova suíte

`supabase/tests/storage_privado.test.sql` prepara identidades, dois projetos e layouts sintéticos em transação revertida. Verifica bucket privado/RLS, leitura, INSERT e UPDATE por fotógrafo, cliente, designer atribuído/não atribuído e admin, além de anon e designer inativo. A existência de foto/projeto visível não concede ao cliente acesso ao bucket interno de edição.

Resultado: **40/40 verificações Storage aprovadas**; as **547 regressões anteriores também passaram**, total **587/587 SQL** na árvore local. Harness terminou com exit 0 e removeu o container descartável. O gate HTTP não foi repetido nesta execução (não foi ativada a opção SEUALBUM_API_TESTS). As primeiras rodadas pararam na preparação da fixture (unicidade de cliente por usuário e posição do CTE de UPDATE); corrigidas sem alterar policy nem enfraquecer as expectativas de autorização.
