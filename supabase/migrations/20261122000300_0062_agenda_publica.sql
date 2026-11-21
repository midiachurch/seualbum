-- Booking (B03/B04) — superfície PÚBLICA anônima da agenda (/agendar/[slug]).
-- Só RPCs restritas: publica apenas recursos publicados e ativos; devolve
-- slots LIVRES (o que não aparece é "indisponível"; nunca nomes, e-mails ou
-- intervalos de outras reservas). O cliente final prova a posse da reserva com
-- o segredo cujo hash é a chave de idempotência (token_hash); sem conta, sem
-- ser membro da organização. NÃO aplicada em ambiente remoto.
begin;

create function public.agenda_i_publica(p_id uuid, p_token_hash text) returns public.agenda_reservas
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v public.agenda_reservas;
begin
  if p_id is null or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Reserva não encontrada.' using errcode = '22023'; end if;
  select * into v from public.agenda_reservas where id = p_id and token_hash = p_token_hash;
  if not found then raise exception 'Reserva não encontrada.' using errcode = '22023'; end if;
  return v;
end $$;
revoke all on function public.agenda_i_publica(uuid, text) from public, anon, authenticated, service_role;

create function public.agenda_recurso_publico(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r public.agenda_recursos; o text;
begin
  select * into r from public.agenda_recursos where slug = lower(coalesce(p_slug, '')) and publicado and ativo;
  if not found then return null; end if;
  select nome into o from public.organizacoes where id = r.organizacao_id;
  return jsonb_build_object('slug', r.slug, 'nome', r.nome, 'tipo', r.tipo, 'descricao', r.descricao, 'estudio', o, 'fuso', r.fuso,
    'duracao_min', r.duracao_min, 'sinal_centavos', r.sinal_centavos, 'cancelamento_antecedencia_h', r.cancelamento_antecedencia_h,
    'antecedencia_max_dias', r.antecedencia_max_dias);
end $$;
revoke all on function public.agenda_recurso_publico(text) from public, anon, service_role;
grant execute on function public.agenda_recurso_publico(text) to anon, authenticated;

create function public.agenda_listar_slots(p_slug text, p_de date, p_ate date)
returns table (slot_inicio timestamptz, slot_fim timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 31 then
    raise exception 'Período inválido.' using errcode = '22023'; end if;
  select id into v_id from public.agenda_recursos where slug = lower(coalesce(p_slug, '')) and publicado and ativo;
  if v_id is null then return; end if;
  return query select s.slot_inicio, s.slot_fim from public.agenda_i_slots(v_id, p_de, p_ate, null, false) s;
end $$;
revoke all on function public.agenda_listar_slots(text, date, date) from public, anon, service_role;
grant execute on function public.agenda_listar_slots(text, date, date) to anon, authenticated;

-- Hold de 10 minutos. p_token_hash = sha256 do segredo gerado pelo navegador/servidor do visitante.
create function public.agenda_criar_hold(p_slug text, p_inicio timestamptz, p_nome text, p_email text, p_telefone text, p_token_hash text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v public.agenda_reservas;
begin
  select id into v_id from public.agenda_recursos where slug = lower(coalesce(p_slug, '')) and publicado and ativo;
  if v_id is null then raise exception 'Agenda não encontrada.' using errcode = '22023'; end if;
  v := public.agenda_i_criar(v_id, p_inicio, p_nome, p_email, p_telefone, p_token_hash, 'cliente', null, false);
  return jsonb_build_object('id', v.id, 'status', v.status, 'inicio', v.inicio, 'fim', v.fim, 'expira_em', v.expira_em,
    'sinal_centavos', v.sinal_centavos, 'sinal_status', v.sinal_status);
end $$;
revoke all on function public.agenda_criar_hold(text, timestamptz, text, text, text, text) from public, anon, service_role;
grant execute on function public.agenda_criar_hold(text, timestamptz, text, text, text, text) to anon, authenticated;

-- Visão da própria reserva (status e horário), só com o segredo.
create function public.agenda_reserva_publica(p_id uuid, p_token_hash text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v public.agenda_reservas; r public.agenda_recursos; o text; v_status text;
begin
  v := public.agenda_i_publica(p_id, p_token_hash);
  select * into r from public.agenda_recursos where id = v.recurso_id;
  select nome into o from public.organizacoes where id = v.organizacao_id;
  v_status := case when v.status = 'hold' and v.expira_em <= now() then 'expirada' else v.status end;
  return jsonb_build_object('id', v.id, 'status', v_status, 'inicio', v.inicio, 'fim', v.fim, 'expira_em', v.expira_em,
    'recurso', r.nome, 'estudio', o, 'fuso', r.fuso, 'sinal_centavos', v.sinal_centavos, 'sinal_status', v.sinal_status,
    'cancelamento_antecedencia_h', r.cancelamento_antecedencia_h);
end $$;
revoke all on function public.agenda_reserva_publica(uuid, text) from public, anon, service_role;
grant execute on function public.agenda_reserva_publica(uuid, text) to anon, authenticated;

create function public.agenda_confirmar_publica(p_id uuid, p_token_hash text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.agenda_i_publica(p_id, p_token_hash);
  return public.agenda_i_confirmar(p_id, 'cliente', null, true);
end $$;
revoke all on function public.agenda_confirmar_publica(uuid, text) from public, anon, service_role;
grant execute on function public.agenda_confirmar_publica(uuid, text) to anon, authenticated;

create function public.agenda_pagar_sinal_simulado(p_id uuid, p_token_hash text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.agenda_i_publica(p_id, p_token_hash);
  return public.agenda_i_sinal(p_id, 'cliente', null);
end $$;
revoke all on function public.agenda_pagar_sinal_simulado(uuid, text) from public, anon, service_role;
grant execute on function public.agenda_pagar_sinal_simulado(uuid, text) to anon, authenticated;

create function public.agenda_cancelar_publica(p_id uuid, p_token_hash text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.agenda_i_publica(p_id, p_token_hash);
  return public.agenda_i_cancelar(p_id, 'cliente', null, null, true);
end $$;
revoke all on function public.agenda_cancelar_publica(uuid, text) from public, anon, service_role;
grant execute on function public.agenda_cancelar_publica(uuid, text) to anon, authenticated;

create function public.agenda_remarcar_publica(p_id uuid, p_token_hash text, p_novo_inicio timestamptz) returns timestamptz
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.agenda_i_publica(p_id, p_token_hash);
  return public.agenda_i_remarcar(p_id, p_novo_inicio, 'cliente', null, true);
end $$;
revoke all on function public.agenda_remarcar_publica(uuid, text, timestamptz) from public, anon, service_role;
grant execute on function public.agenda_remarcar_publica(uuid, text, timestamptz) to anon, authenticated;

commit;
