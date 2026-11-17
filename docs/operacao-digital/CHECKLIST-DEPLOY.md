# Checklist de deploy

1. Validar o SHA integrado, tipos/lint/unitários, SQL/HTTP/concorrência, navegador e build.
2. Revisar diff e varrer credenciais/dados pessoais; excluir pesquisa bruta, .env, autenticação e caches.
3. Commit e push somente na branch de desenvolvimento, com PR #2 mantido draft. Sem force push, merge ou produção.
4. Acompanhar CI e Preview até estado terminal; registrar SHA e URL exatos.
5. Conferir baseline e variáveis de staging sem revelar valores. O preview não aplica automaticamente as migrations 0045–0047.
6. Acessar pela autenticação Vercel normal e homologar itens de CHECKLIST-HOMOLOGACAO. Não remover proteção.
7. Preparar plano de aplicação/restauração/observação de migrations e obter aprovação específica para remoto, após resolver 403.
8. Produção somente após homologação e autorização própria. Não reabrir RLS como rollback. Nenhuma exclusão automática ou custo autorizado por esta lista.
