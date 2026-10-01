-- =============================================================================
-- Migration 0020: novo papel `designer` (Fase 4.5 — workspace do designer)
--
-- Separada da 0021 de propósito: o Postgres não deixa usar um valor novo de
-- enum na mesma transação em que ele foi criado.
-- =============================================================================

alter type public.platform_role add value if not exists 'designer';
