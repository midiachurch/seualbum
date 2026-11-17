# ADR-001 — Monólito modular

Status: diretriz aprovada em 15/11/2026; ainda não implementada.

## Contexto

O MVP já compartilha Auth, banco, storage, editor e pagamentos. Separar aplicações agora duplicaria contratos e operação.

## Alternativas

Manter código sem fronteiras; reescrever; extrair microserviços desde o início.

## Recomendação

Um Next.js com módulos por domínio e contratos pequenos; encapsular antes de mover; rotas atuais continuam válidas.

## Consequências

Menor risco de migração, mas exige disciplina de imports e propriedade de dados. Não criar pasta funcional nesta missão.

## Validação e reversão

Aceitar incrementalmente com contratos/regressões; reverter adoção de módulo por flag sem apagar dados. Extração futura depende de carga/equipe demonstradas.

## Decisão adotada

Adotar um monólito modular no Next.js existente, com sete módulos e infraestrutura compartilhada. Preservar rotas e contratos do MVP, encapsulando antes de mover código. Não criar microserviços ou aplicações separadas nesta etapa.

## Registro da autorização

O responsável pelo produto autorizou as próximas decisões na conversa em 15/11/2026: “autorizo as proximas decisoes.” As escolhas acima foram fechadas pelo agente com base nessa delegação e nas recomendações do masterplan; não representam respostas individuais fornecidas pelo usuário a cada alternativa. A autorização registra a direção de produto/arquitetura, sem executar código, migrations, deploy ou operações financeiras.
