# Booking (agenda e reservas) — B01 a B04

Status: implementado localmente no branch do worktree, testado em banco descartável. Nenhuma migration foi aplicada em ambiente remoto; sem push, deploy ou custo externo. Pagamento/sinal é SIMULADO (campo e RPC, sem provedor).

## O que foi construído

### Migrations (aditivas, novas; nenhuma policy/RLS existente foi alterada)

| Arquivo | Conteúdo |
| --- | --- |
| `20261122000100_0060_agenda_modelo.sql` | `btree_gist`; tabelas `agenda_recursos`, `agenda_disponibilidade`, `agenda_bloqueios`, `agenda_reservas` (com `EXCLUDE USING gist`), `agenda_reserva_eventos`; RLS e grants mínimos; RPCs de configuração |
| `20261122000200_0061_agenda_reservas.sql` | Gerador de slots no banco, hold/confirmação/cancelamento/conclusão/remarcação, vínculo com `clientes`, sinal simulado, reembolso manual |
| `20261122000300_0062_agenda_publica.sql` | Superfície anônima restrita para `/agendar/[slug]` |

Escopo por organização (0051): `papel_na_organizacao(org)` decide tudo. Cliente final nunca é membro; a posse da própria reserva é provada por um segredo.

### RPCs

- Configuração (dono/admin): `agenda_salvar_recurso`, `agenda_arquivar_recurso`, `agenda_definir_disponibilidade` (substitui a grade inteira, atômica e idempotente).
- Operação (dono/admin/editor): `agenda_criar_bloqueio`, `agenda_remover_bloqueio`, `agenda_reservar_estudio`, `agenda_confirmar`, `agenda_cancelar`, `agenda_concluir`, `agenda_remarcar`, `agenda_registrar_sinal`, `agenda_vincular_cliente`, `agenda_listar_slots_estudio`. Reembolso manual (`agenda_registrar_reembolso`): dono/admin.
- Leitura (qualquer membro, inclusive visualizador): SELECT por RLS em recursos, grade, bloqueios, reservas (sem `token_hash`, sem GRANT de coluna) e trilha.
- Públicas (anon + authenticated): `agenda_recurso_publico`, `agenda_listar_slots`, `agenda_criar_hold`, `agenda_reserva_publica`, `agenda_confirmar_publica`, `agenda_pagar_sinal_simulado`, `agenda_cancelar_publica`, `agenda_remarcar_publica`.
- Internas (`agenda_i_*`): sem EXECUTE para ninguém. Todas as funções são `SECURITY DEFINER` com `search_path = public, pg_temp` e `revoke ... from public, anon, service_role`.

Códigos de erro: `42501` sem permissão, `22023` dado inválido, `23P01` horário indisponível, `54000` limite anti-abuso, `55000` estado ou prazo não permite.

### Rotas e telas

- `/dashboard/agenda` (somente `fotografo`, item "Agenda" no nav): abas Reservas (aguardando, próximas, histórico; confirmar, cancelar, remarcar, concluir, vincular a cliente, registrar sinal, reembolso, nova reserva pelo estúdio) e Recursos e horários (cadastro, grade semanal, bloqueios, arquivar). Os botões respeitam o papel; o banco é quem decide de fato.
- `/agendar/[slug]` (pública, anônima, `noindex`): slots livres dos próximos 14 dias no fuso do recurso, com navegação por datas, formulário e hold.
- `/agendar/[slug]/reserva/[id]`: o visitante confirma, paga o sinal simulado, cancela ou remarca a própria reserva.
- `src/proxy.ts` não foi alterado: `/agendar` não está em `PROTECTED_PREFIXES` e `/dashboard/agenda` já cai sob `/dashboard`.

### Código TypeScript

`src/lib/agenda/{regras,formatacao,publico,colunas}.ts`, `src/lib/actions/{agenda,agendar}.ts`, componentes em `src/components/dashboard/agenda-*.tsx` e `src/components/agendar/*`, tipos em `src/types/database.ts`.

## Decisões e por quê

1. **Concorrência**: advisory lock por recurso (`pg_advisory_xact_lock`) serializa criação/confirmação/remarcação, e `EXCLUDE USING gist (recurso_id =, tstzrange(inicio, ocupa_ate) &&) WHERE status IN ('hold','confirmada')` é a última barreira, valendo até para INSERT fora das RPCs. `btree_gist` existe na imagem Supabase Postgres 17 usada pelo harness.
2. **Expiração de hold sem job**: restrição não pode usar `now()`. Hold vence em 10 minutos; a listagem de slots ignora hold vencido, e as RPCs de escrita marcam vencidos como `expirada` sob lock antes de inserir. Não depende de pg_cron.
3. **Buffer** (folga entre sessões, como Acuity) entra na ocupação: `ocupa_ate = fim + buffer`, gravado na criação, de modo que mudar o buffer depois não reescreve reservas existentes.
4. **Fuso e DST**: grade em horário local do recurso (fuso IANA validado em `pg_timezone_names`). Horário inexistente no salto de primavera é descartado; no outono o horário repetido é oferecido uma vez (primeira ocorrência). O fuso da sessão do servidor não interfere (testado com sessão em Tóquio e UTC+14).
5. **Segredo de posse = chave de idempotência**: o visitante gera um segredo; só o `sha256` vai ao banco (`token_hash`, único). O mesmo valor serve de chave de retry: repetir a criação devolve a mesma reserva, e reutilizar a chave com outro contato ou horário é recusado. O segredo fica em cookie httpOnly restrito a `/agendar`, nunca em JavaScript do cliente. Sem e-mail transacional, o link da reserva só funciona no mesmo navegador (limitação assumida, ver pendências).
6. **Anti-abuso sem captcha**: no máximo 3 holds vivos por e-mail e organização, 10 tentativas por hora por e-mail e 30 holds vivos por recurso (`54000`). A reserva feita pelo estúdio não passa por esses limites.
7. **Política de cancelamento** como no mercado: cliente cancela/remarca por conta própria até N horas antes (padrão 24 h, por recurso); a equipe não tem prazo. Cancelar hold é sempre livre.
8. **Sinal simulado e pagamento tardio**: com sinal, o cliente só confirma pagando. Pagamento sobre hold vigente confirma; pagamento sobre hold expirado/cancelado NUNCA reocupa o slot e marca `reembolso_pendente` (compensação manual, depois `reembolsado` por dono/admin). Cancelar reserva paga também gera `reembolso_pendente`.
9. **Vínculo com `clientes`**: manual, idempotente, um por reserva; reaproveita o cliente do dono da organização com o mesmo e-mail; senão cria com `origem = 'agenda'`.
10. **Papéis**: dono/admin configuram; editor opera reservas e bloqueios; visualizador só lê. Bloqueios não cancelam reservas existentes (a equipe decide caso a caso).
11. **Privacidade**: o público recebe apenas slots livres e, do próprio visitante, a visão da própria reserva sem contato. Intervalos ocupados aparecem apenas como ausência de slot ("indisponível").
12. **Auditoria**: `agenda_reserva_eventos` registra hold, confirmação, cancelamento, expiração, remarcação (de/para), sinal, vínculo e reembolso, com autor.

## Testes

- pgTAP: `supabase/tests/booking_recursos.test.sql` (50), `booking_reservas.test.sql` (136), `booking_fuso.test.sql` (21). Cobrem sobreposição e buffer, EXCLUDE direto, expiração, idempotência, sinal tardio, anti-abuso, cancelamento por política, remarcação, conclusão, vínculo, papéis, isolamento entre organizações, cliente final, anon, grants e DST.
- Concorrência real (opt-in): `SEUALBUM_BOOKING_CONCURRENCY=1` roda `scripts/booking-concorrencia.py` no harness: 8 sessões simultâneas no mesmo slot resultam em 1 hold e 7 recusas `23P01`.
- Vitest: `src/lib/agenda/agenda.test.ts`, `src/lib/actions/agenda.test.ts`, `src/lib/actions/agendar.test.ts` (28 testes).

## Pendências reais

- Nenhum e-mail/SMS ao cliente ou à equipe (confirmação, lembrete, link para gerenciar a reserva em outro aparelho). Exige decisão de custo e provedor.
- Sem sincronização com Google/Outlook Calendar.
- Sinal real (provedor de pagamento, estorno automático) depende de S04; hoje é simulado e o reembolso é manual.
- Expiração é preguiçosa (correta, mas a tela do estúdio mostra o estado efetivo calculado no cliente até a próxima escrita). Um job de varredura é opcional.
- Exceções de disponibilidade que ABREM horário extra (hoje só bloqueios fecham) e vários serviços/durações por recurso.
- Sem rate limit por IP/captcha na borda; a contenção é por e-mail e recurso.
- Horário repetido do outono: a segunda ocorrência (por exemplo 01:30 pela segunda vez) não é oferecida.
- Retenção/LGPD do contato dos clientes que nunca viram cliente cadastrado.
- Migrations 0060 a 0062 ainda não foram aplicadas em nenhum ambiente remoto.
