-- =============================================================================
-- Migration 0022: valores novos de enum da Fase 5 (fechamento e upsell)
--
-- Separada da 0023: valor novo de enum não pode ser usado na mesma transação.
--   - project_status `aprovado_aguardando_pagamento`: prova aprovada e travada,
--     com lâminas extras a pagar pelo fotógrafo — o arquivo ainda não vai
--     para a gráfica. `aprovado` passa a significar "Aprovado para impressão".
--   - fatura_status `dispensada`: cortesia dada pela gestão (sem cobrança).
-- =============================================================================

alter type public.project_status add value if not exists 'aprovado_aguardando_pagamento' before 'aprovado';
alter type public.fatura_status add value if not exists 'dispensada';
