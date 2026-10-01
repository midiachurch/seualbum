-- =============================================================================
-- Migration 0010: contato do cliente final + idempotência em `orders`
--
-- 1. Contato do cliente final (o casal) em colunas próprias — antes ia
--    concatenado no fim do `briefing`. Base para as automações de CRM e de
--    envio da prova direto ao cliente.
-- 2. `chave_idempotencia`: UUID gerado no navegador quando o rascunho do wizard
--    nasce (`usePedidoWizardStore`). Reenviar o mesmo rascunho — rede caiu
--    depois do INSERT, toque duplo — bate no UNIQUE em vez de duplicar o
--    pedido. Nullable para os pedidos anteriores; a aplicação sempre envia.
--    UNIQUE aceita vários NULL, então os pedidos antigos coexistem.
--
-- Idempotente: pode ser reexecutada com segurança.
-- =============================================================================

alter table public.orders
  add column if not exists cliente_final_nome     varchar(120),
  add column if not exists cliente_final_telefone varchar(30),
  add column if not exists cliente_final_email    varchar(160),
  add column if not exists chave_idempotencia     uuid;

do $$ begin
  alter table public.orders
    add constraint orders_chave_idempotencia_key unique (chave_idempotencia);
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  alter table public.orders
    add constraint orders_cliente_final_email_check
    check (cliente_final_email is null or cliente_final_email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$');
exception when duplicate_object then null; end $$;
