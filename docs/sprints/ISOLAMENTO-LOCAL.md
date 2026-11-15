# S1 — teste local de isolamento

Baseline histórica anterior à correção. A reprodução antes/depois da 0043 e a regressão ampliada estão em [CONSOLIDACAO](CONSOLIDACAO.md).

## Resultado observado

A suíte existente passou: **288 verificações em oito arquivos SQL**. A matriz adicional que expressa o ADR-002 teve **42 aprovações e seis falhas em 48 verificações**. O processo `psql` retorna zero mesmo quando pgTAP registra `not ok`; o resultado foi apurado pelo TAP, não apenas pelo exit code.

Designer atribuído ao projeto A consegue, indevidamente segundo a decisão aprovada, acessar o projeto B. Operador atribuído ao projeto B consegue acessar A. Em ambos os casos: `pode_ver_projeto` retorna true, RLS permite ler a foto e `favoritar_fotos` não recusa a chamada. Antes de cada ator, os favoritos são reiniciados para false pelo bootstrap; as chamadas usam foto válida no projeto testado.

Fotógrafos e clientes foram isolados entre os dois projetos nos três caminhos testados. Admin e gestor mantiveram o acesso transversal esperado. Isso não comprova isolamento de todas as tabelas, campos ou ações.

Evidência: [diagnóstico SQL](evidence/authorization-baseline.sql), [resultado TAP](evidence/authorization-baseline.tap) e [oito resultados da suíte existente](evidence/existing-sql-suite/). O diagnóstico permanece fora da suíte padrão porque documenta falhas conhecidas da baseline, sem mascará-las como testes aprovados.

## Ambiente e limites

- Docker iniciado após autorização; container exclusivo `seualbum-s1-db-20261115`, `--network none`, sem portas expostas, dados em tmpfs. Outros containers não foram modificados.
- Imagem já instalada `public.ecr.aws/supabase/postgres:17.6.1.167`. Extensões pré-carregadas `pg_net,pg_cron,pgsodium`; `cron.launch_active_jobs=off`. Nenhum serviço externo foi chamado.
- A CLI Supabase 2.117.0 falhou ao iniciar o ambiente temporário na porta 57422. Alternativa: imagem oficial executada diretamente.
- Schema Storage: migrations oficiais da imagem instalada `storage-api:v1.72.1`, ordenadas numericamente, `search_path=storage,public,extensions` e `storage.install_roles=false`, reutilizando os papéis da imagem.
- Auth: 75 migrations oficiais via `gotrue:v2.197.0 auth migrate`, compartilhando apenas a rede sem saída do banco. A rodada anterior, com Auth incompleto, foi descartada; os resultados arquivados são posteriores ao bootstrap Auth.
- O papel postgres recebeu superusuário **somente neste bootstrap descartável**, para criar os triggers Auth. As verificações mudam para `authenticated` e configuram claims sintéticas por ator; não são realizadas como service role ou superusuário.
- Todos os 42 arquivos de migration da aplicação foram processados, com uma exceção explícita: a criação do segredo Vault de cron na 0015 foi omitida apenas na cópia temporária, pois a imagem não forneceu a chave necessária. Policies, helpers e RPCs de autorização foram aplicados sem alterações. Portanto, este ensaio **não valida um bootstrap integral das migrations**, criptografia Vault, limpeza agendada ou integração de rede.
- Fixtures são inventadas e cada arquivo encerra com rollback. Sem leitura de credenciais do projeto, banco remoto, clientes reais, R2, Stripe ou AWS. Não há evidência sobre o schema atualmente implantado.

## Reprodução e próxima ação

Os arquivos SQL podem ser enviados via stdin a `docker exec -i seualbum-s1-db-20261115 psql -X -qAt -U postgres -d postgres -v ON_ERROR_STOP=1` somente depois do bootstrap acima. Examinar TAP e erros SQL. Não executar com URL remota.

A correção deve tratar tanto o helper quanto policies que chamam `is_equipe()` diretamente; trocar o significado global desse helper sem mapear consumidores pode afetar produção, mensagens e operação interna. Preparar migration aditiva revisável e testar atores atribuídos, não atribuídos e operações legítimas antes de qualquer rollout. Não houve alteração de policy nesta rodada.

Ambiente descartável encerrado após a coleta; evidências preservadas no repositório. A validação de upload no navegador e a reconciliação de schema remoto permanecem pendentes.
