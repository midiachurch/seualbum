# Estado atual — leitura local em 15/11/2026

> Atualização 16/11/2026: primeiro incremento da Operação Digital em [EXECUTION-STATUS](../operacao-digital/EXECUTION-STATUS.md). A descrição abaixo preserva a baseline histórica.

Atualização S1: upload corrigido localmente; migration 0043 validada em banco descartável com 512 verificações SQL aprovadas. E2E bloqueado por API local ausente, remoto desconhecido. O inventário histórico abaixo descreve a baseline; situação vigente em [CONSOLIDACAO](../sprints/CONSOLIDACAO.md).

Commit-base local: `1d90e82`. A leitura descreve o checkout local e não o release em produção.

## Escopo e confiança

Inventário estrutural de rotas, componentes, bibliotecas, actions, SQL, testes e configuração. Revisão detalhada de caminhos críticos, não certificação de todo o sistema. As 42 migrations locais declaram 43 nomes de tabelas e 91 nomes de funções SQL (extração textual, sem resolver sobrecargas/estado efetivo). Há uma view declarada `diagramacao_itens`. Inventário com caminhos e linhas: [TECHNICAL-INVENTORY](TECHNICAL-INVENTORY.md).

Nenhum banco remoto foi consultado. Presença de migration ou teste não comprova aplicação nem aprovação do teste. `supabase/legado/0001_init.sql` não pertence à cadeia atual, conforme README. Nenhum segredo ou arquivo .env foi lido para montar o plano.

## Stack e infraestrutura identificados

Next.js App Router (`package.json`: ^16.3.8), React ^19, TypeScript, Tailwind 3, Radix e Lucide; Zustand para o wizard, Konva para edição, sharp/HEIC e EXIF para imagens. Versões declaradas não comprovam a versão implantada. Supabase Auth/Postgres/RLS e Realtime; R2 por SDK S3; AWS Rekognition; Stripe Checkout; Vercel e crons. CI declara Node 24, tipos, lint e Vitest. Playwright e pgTAP existem, mas não são executados por essa rotina CI atual.

## Funcionalidades e pontos de entrada

| Domínio | Existente em código | Fontes locais principais |
|---|---|---|
| Identidade | Login/cadastro/Google, seis papéis e redirecionamento por área | `src/proxy.ts`, `src/lib/supabase/queries.ts`, `src/types/platform.ts`, actions/contas |
| Pedidos | Wizard, fotos R2, chave idempotente, conversão após pagamento | actions/pedidos, migrations 0010–0017/0030–0031 |
| Projetos | Cliente, fotógrafo, responsável, status, briefing, prazo, histórico | components/admin/projects, actions/projetos |
| Gallery inicial | Fotos, grupos, lightbox, estrela, busca por selfie | components/cliente, lib/reconhecimento e rekognition |
| Design | Álbum avulso/projeto, fotos/textos/formas, templates, layout, versões, impressão e ZIP | components/album-editor, lib/album, actions/album-editor |
| Prova | Versões completas/parciais, pins/áreas, checklist e ajuste/aprovação | components/cliente/proof, lib/prova, migrations 0032/0039 |
| Faturamento | Planos, orders, fechamento por extras, cortesia, Checkout e webhook | lib/stripe, actions/pagamentos/faturamento, migrations 0023/0026/0035 |
| Operação | Controle de diagramação, SLA, prioridade, espera e expedição | lib/diagramacao, actions/diagramacao/expedicao, migration 0038 |
| Studio inicial | Clientes, CRM de retenção, orçamentos e conversas | actions/crm/orcamentos/mensagens, migration 0037 |
| Vitrine | Planos, banners, portfólio, CMS e biblioteca pública | components/admin/vitrine/media, actions/vitrine/paginas |
| Jobs | Limpeza de rascunhos/órfãos e retenção/indexação facial | api/cron, vercel.json, lib/r2/varredura |

Store de impressões, agenda e construtor de sites por estúdio não foram identificados como domínios completos na estrutura inventariada. A vitrine central não é um Website Builder multi-organização. O reconhecimento facial é diferencial existente no código, não prova de serviço AWS ativo ou conformidade jurídica.

## Fluxos que devem ser preservados

Pedido do fotógrafo → Checkout quando aplicável → conversão em projeto → fotos/briefing → diagramação → revisão interna → prova liberada → ajustes ou aprovação → fatura de extras/adicionais quando devida → pagamento/cortesia → produção/expedição. O estado aprovado com fechamento pendente impede liberação manual indevida na lógica SQL revisada.

Álbum avulso tem aprovação pública por token e exportação; álbum de projeto publica lâminas no fluxo de produção. Não fundir essas aprovações com favoritos de fotos.

## Dados, escopo e autorização

O vínculo comercial atual é predominantemente `fotografo_id`, com o estúdio associado à identidade de usuário, e `cliente_id`/`responsavel_id` por projeto. Não foram encontrados identificadores organization_id/organizacao_id ou memberships nas migrations examinadas. A equipe interna é um escopo distinto do futuro membro de organização. Há regras em UI, proxy, helpers de servidor, políticas RLS, RPCs e triggers; elas não são equivalentes entre si. Ver [auditoria](AUDIT-FINDINGS.md) e [permissões](PERMISSIONS.md).

## Upload e armazenamento

Assinar PUT → navegador envia ao R2 → confirmar com HeadObject → persistir chave e ID. Reservas por usuário e validação de chave estão na migration 0040. Leituras antigas de Supabase Storage coexistem com R2. Mídia pública/logos usam bucket público separado dos originais privados. Não substituir caminhos históricos ou apagar objetos como efeito de modularização.

O backend retorna ID persistido, mas o componente cliente de fotos não o incorpora no estado atual. A rotina compartilhada lança erros úteis que esse consumidor suprime. A confirmação é idempotente para chave já registrada; reexecutar upload com um novo UUID não equivale a retomar a mesma operação.

## Lacunas de implantação e testes

README declara 0041 pendente, enquanto comentário da própria migration a declara aplicada; a 0042 também existe. Esse conflito documental é confirmado; estado remoto é desconhecido. Configuração real de bucket público, pagamento simulado, webhooks, cron, Auth, IAM e CORS precisa de inventário autorizado futuro apenas de metadados. Não inferir produção a partir de mocks ou testes que podem estar pulados.
