# Bloqueios — Etapa 02

## Supabase remoto

Projeto vinculado local identificado como `seu-album`; host de NEXT_PUBLIC_SUPABASE_URL corresponde ao project-ref (comparação sem registrar URL/chaves). `supabase migration list --linked` com rede permitida recebe `LegacyDbConfigLoginRoleStatusError`, HTTP 403, na inicialização da role de login, antes de obter histórico. Não há evidência de schema remoto nem aplicação de 0041–0047. Não é evidência de erro SQL/RLS da aplicação. Versão da CLI não foi obtida na tentativa sandbox porque o binário tentou gravar telemetria fora da raiz; isso é um bloqueio local distinto do 403 remoto confirmado.

Intervenção necessária do responsável: verificar no painel Supabase se a conta da CLI tem acesso ao projeto Seu Álbum correto e à sua organização; autenticar a CLI localmente com a conta adequada (`supabase login`, sem enviar token/senha ao chat) e permitir uma consulta somente leitura do histórico. Não solicitar service role como solução. Mudanças em permissões externas sensíveis continuam sujeitas ao responsável. Nenhum outro projeto da conta foi inspecionado.

Após resolver: inventariar migrations/policies/functions/buckets e variáveis de staging sem valores, reconciliar baseline e ensaiar o rollout. **Não aplicar migration remota automaticamente.**

## Preview protegido

PR #2 tem preview Ready, mas acesso HTTP público redireciona para autenticação Vercel. Entrar pelo navegador com conta já autorizada ao projeto é o procedimento normal; se faltar acesso, usar solicitação de acesso e revisão pelo proprietário. Não desativar proteção nem criar bypass para facilitar testes. Procedimento confirmado na [documentação Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication). Nenhuma configuração sensível foi alterada.

## Homologação de serviços

Login Auth do fotógrafo no navegador, emissão/renovação de sessão Auth, Storage API e R2 real/IAM/CORS, preservação pós-refresh e URLs temporárias continuam gates. O portal foi testado em navegador com cookie guest real e PostgREST descartável; mídia foi substituída. Usa RPCs de capacidade sem Auth fictício e sem service role. Novas imagens R2 podem ser servidas após configuração; originais legados Supabase Storage retornam indisponível no novo portal porque a capacidade não deve ser convertida em bypass de RLS. Fluxos autenticados antigos e sua exportação Storage foram preservados.

URLs R2 emitidas pelo portal expiram em 60 s; revogar nega novas operações imediatamente, mas não invalida URL já emitida antes de expirar. Exportações autenticadas usam 5 min. Revogação instantânea de bytes já assinados exigiria proxy de conteúdo/estratégia adicional, não foi alegada.

## Produto ainda aberto

Prova/comentários/mensagens pelo portal sem cadastro, fluxo comercial integrado de diagramação opcional, timeline completa, marcação de leitura das notificações internas, recorrência/franquias/tráfego e testes do fluxo fim a fim. Limite técnico inicial de seleção: 1000 fotos por entrega, revisão sem sobrescrever snapshots. Galeria guest pagina 100 fotos; lista de galerias do fotógrafo exibe até 100. Limites não são franquias ou planos comerciais.
