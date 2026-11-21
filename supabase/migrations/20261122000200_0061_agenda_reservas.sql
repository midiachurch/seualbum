-- Booking (B02/B03) — cálculo de slots no banco, holds, confirmação, cancelamento,
-- conclusão, remarcação, vínculo com cliente e sinal SIMULADO.
-- ADITIVA. Concorrência: advisory lock por recurso + EXCLUDE gist (0060) como
-- última barreira. Funções agenda_i_* são internas (sem EXECUTE para ninguém);
-- as RPCs de equipe e as públicas (0062) as chamam.
-- Códigos de erro: 42501 sem permissão; 22023 dado inválido; 23P01 horário
-- indisponível; 54000 limite anti-abuso; 55000 estado/prazo não permite.
-- Sem provedor de pagamento: "pago" é registrado por RPC simulada.
-- NÃO aplicada em ambiente remoto.
begin;

-- Marca holds vencidos do recurso como 'expirada' (sob o lock do chamador).
create function public.agenda_i_expirar(p_recurso uuid) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n integer;
begin
  with e as (
    update public.agenda_reservas set status = 'expirada'
     where recurso_id = p_recurso and status = 'hold' and expira_em <= now()
    returning id, sinal_status)
  , s as (
    insert into public.agenda_reserva_eventos(reserva_id, tipo, ator, detalhes)
    select id, 'expirada', 'sistema', jsonb_build_object('motivo', 'hold vencido') from e returning 1)
  select count(*) into v_n from s;
  return v_n;
end $$;
revoke all on function public.agenda_i_expirar(uuid) from public, anon, authenticated, service_role;

create function public.agenda_i_evento(p_reserva uuid, p_tipo text, p_ator text, p_ator_id uuid, p_detalhes jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.agenda_reserva_eventos(reserva_id, tipo, ator, ator_id, detalhes) values (p_reserva, p_tipo, p_ator, p_ator_id, coalesce(p_detalhes, '{}'::jsonb))
$$;
revoke all on function public.agenda_i_evento(uuid, text, text, uuid, jsonb) from public, anon, authenticated, service_role;

-- Slots livres de um recurso, em horário local → instantes UTC. Respeita DST
-- (horários inexistentes na virada são descartados), bloqueios, reservas vivas
-- (com buffer), holds vigentes e antecedência (salvo p_estudio).
create function public.agenda_i_slots(p_recurso uuid, p_de date, p_ate date, p_ignorar uuid default null, p_estudio boolean default false)
returns table (slot_inicio timestamptz, slot_fim timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare rec public.agenda_recursos;
begin
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 62 then
    raise exception 'Período inválido.' using errcode = '22023'; end if;
  select * into rec from public.agenda_recursos where id = p_recurso and ativo;
  if not found then return; end if;
  return query
  with dias as (select g::date as dia from generate_series(p_de::timestamp, p_ate::timestamp, interval '1 day') g),
  base as (
    select (dias.dia + j.inicio) + make_interval(mins => n.n * rec.intervalo_min) as loc,
           (dias.dia + j.fim) as loc_fim_janela
      from dias
      join public.agenda_disponibilidade j on j.recurso_id = rec.id and j.dia_semana = extract(dow from dias.dia)::int
      cross join lateral generate_series(0, (extract(epoch from (j.fim - j.inicio)) / 60)::int / rec.intervalo_min) n(n)
  ),
  cand as (
    select b.loc, b.loc_fim_janela, (b.loc at time zone rec.fuso) as ini from base b
  ),
  slots as (
    select distinct c.ini as s_ini, c.ini + make_interval(mins => rec.duracao_min) as s_fim
      from cand c
     -- descarta horário que não existe no fuso (salto do horário de verão)
     where (c.ini at time zone rec.fuso) = c.loc
       and ((c.ini + make_interval(mins => rec.duracao_min)) at time zone rec.fuso) <= c.loc_fim_janela
  )
  select s.s_ini, s.s_fim from slots s
   where s.s_ini > now()
     and (p_estudio or s.s_ini >= now() + make_interval(mins => rec.antecedencia_min_min))
     and (p_estudio or s.s_ini <= now() + make_interval(days => rec.antecedencia_max_dias))
     and not exists (select 1 from public.agenda_bloqueios b
                      where b.recurso_id = rec.id and b.periodo && tstzrange(s.s_ini, s.s_fim, '[)'))
     and not exists (select 1 from public.agenda_reservas r
                      where r.recurso_id = rec.id and r.id is distinct from p_ignorar
                        and (r.status = 'confirmada' or (r.status = 'hold' and r.expira_em > now()))
                        and tstzrange(r.inicio, r.ocupa_ate, '[)') && tstzrange(s.s_ini, s.s_fim + make_interval(mins => rec.buffer_min), '[)'))
   order by s.s_ini;
end $$;
revoke all on function public.agenda_i_slots(uuid, date, date, uuid, boolean) from public, anon, authenticated, service_role;

-- Cria hold (ou reserva direta do estúdio). Idempotente pela chave (token_hash).
create function public.agenda_i_criar(
  p_recurso uuid, p_inicio timestamptz, p_nome text, p_email text, p_telefone text, p_token_hash text,
  p_ator text, p_ator_id uuid, p_direto boolean
) returns public.agenda_reservas
language plpgsql security definer set search_path = public, pg_temp as $$
declare rec public.agenda_recursos; v public.agenda_reservas; v_email text := lower(trim(coalesce(p_email, '')));
  v_dia date;
begin
  if p_inicio is null or p_nome is null or length(trim(p_nome)) not between 2 and 120
     or v_email !~ '^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$' or length(v_email) > 254
     or (p_telefone is not null and length(p_telefone) > 30)
     or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  select * into rec from public.agenda_recursos where id = p_recurso and ativo;
  if not found then raise exception 'Recurso não encontrado.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_recurso::text, 60));
  select * into v from public.agenda_reservas where token_hash = p_token_hash;
  if found then
    if v.recurso_id <> p_recurso or v.inicio <> p_inicio or v.contato_email <> v_email then
      raise exception 'Chave já utilizada.' using errcode = '22023'; end if;
    return v;
  end if;
  perform public.agenda_i_expirar(p_recurso);
  if not p_direto then
    if (select count(*) from public.agenda_reservas where organizacao_id = rec.organizacao_id and contato_email = v_email
          and status = 'hold' and expira_em > now()) >= 3
       or (select count(*) from public.agenda_reservas where organizacao_id = rec.organizacao_id and contato_email = v_email
          and created_at > now() - interval '1 hour') >= 10
       or (select count(*) from public.agenda_reservas where recurso_id = p_recurso and status = 'hold' and expira_em > now()) >= 30 then
      raise exception 'Muitas tentativas. Tente novamente em alguns minutos.' using errcode = '54000'; end if;
  end if;
  v_dia := (p_inicio at time zone rec.fuso)::date;
  if not exists (select 1 from public.agenda_i_slots(p_recurso, v_dia, v_dia, null, p_direto) s where s.slot_inicio = p_inicio) then
    raise exception 'Horário indisponível.' using errcode = '23P01'; end if;
  begin
    insert into public.agenda_reservas(organizacao_id, recurso_id, status, inicio, fim, ocupa_ate, contato_nome, contato_email,
        contato_telefone, token_hash, expira_em, confirmada_em, sinal_centavos, sinal_status)
      values (rec.organizacao_id, p_recurso, case when p_direto then 'confirmada' else 'hold' end, p_inicio,
        p_inicio + make_interval(mins => rec.duracao_min), p_inicio + make_interval(mins => rec.duracao_min + rec.buffer_min),
        trim(p_nome), v_email, nullif(trim(coalesce(p_telefone, '')), ''), p_token_hash,
        case when p_direto then null else now() + interval '10 minutes' end,
        case when p_direto then now() end, rec.sinal_centavos,
        case when not p_direto and coalesce(rec.sinal_centavos, 0) > 0 then 'pendente' else 'nenhum' end)
      returning * into v;
  exception when exclusion_violation then
    raise exception 'Horário indisponível.' using errcode = '23P01';
  end;
  perform public.agenda_i_evento(v.id, case when p_direto then 'confirmada' else 'hold' end, p_ator, p_ator_id, jsonb_build_object('inicio', v.inicio));
  return v;
end $$;
revoke all on function public.agenda_i_criar(uuid, timestamptz, text, text, text, text, text, uuid, boolean) from public, anon, authenticated, service_role;

-- Carrega a reserva sob o lock do recurso (ordem fixa: recurso, depois linha).
create function public.agenda_i_travar(p_id uuid) returns public.agenda_reservas
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_rec uuid; v public.agenda_reservas;
begin
  select recurso_id into v_rec from public.agenda_reservas where id = p_id;
  if v_rec is null then raise exception 'Reserva não encontrada.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_rec::text, 60));
  select * into v from public.agenda_reservas where id = p_id for update;
  return v;
end $$;
revoke all on function public.agenda_i_travar(uuid) from public, anon, authenticated, service_role;

-- Retorna o estado resultante: 'confirmada' ou 'expirada' (hold vencido não confirma).
create function public.agenda_i_confirmar(p_id uuid, p_ator text, p_ator_id uuid, p_exigir_sinal boolean) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.agenda_reservas;
begin
  v := public.agenda_i_travar(p_id);
  if v.status = 'confirmada' then return 'confirmada'; end if;
  if v.status <> 'hold' then raise exception 'Esta reserva não pode mais ser confirmada.' using errcode = '55000'; end if;
  if v.expira_em <= now() then
    perform public.agenda_i_expirar(v.recurso_id);
    return 'expirada';
  end if;
  if p_exigir_sinal and v.sinal_status = 'pendente' then
    raise exception 'O sinal precisa ser pago para confirmar.' using errcode = '55000'; end if;
  update public.agenda_reservas set status = 'confirmada', confirmada_em = now(), expira_em = null where id = p_id;
  perform public.agenda_i_evento(p_id, 'confirmada', p_ator, p_ator_id);
  return 'confirmada';
end $$;
revoke all on function public.agenda_i_confirmar(uuid, text, uuid, boolean) from public, anon, authenticated, service_role;

-- Sinal SIMULADO. Pagamento tardio nunca reocupa slot perdido: vira reembolso pendente.
create function public.agenda_i_sinal(p_id uuid, p_ator text, p_ator_id uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.agenda_reservas;
begin
  v := public.agenda_i_travar(p_id);
  if v.sinal_status in ('pago', 'reembolso_pendente', 'reembolsado') then return v.status; end if;
  if v.sinal_status <> 'pendente' then raise exception 'Esta reserva não tem sinal a pagar.' using errcode = '22023'; end if;
  if v.status = 'hold' and v.expira_em > now() then
    update public.agenda_reservas set status = 'confirmada', confirmada_em = now(), expira_em = null, sinal_status = 'pago' where id = p_id;
    perform public.agenda_i_evento(p_id, 'sinal', p_ator, p_ator_id, jsonb_build_object('resultado', 'pago'));
    perform public.agenda_i_evento(p_id, 'confirmada', p_ator, p_ator_id);
    return 'confirmada';
  end if;
  if v.status = 'hold' then perform public.agenda_i_expirar(v.recurso_id); end if;
  update public.agenda_reservas set sinal_status = 'reembolso_pendente' where id = p_id;
  perform public.agenda_i_evento(p_id, 'sinal', p_ator, p_ator_id, jsonb_build_object('resultado', 'tardio', 'status_reserva', case when v.status = 'hold' then 'expirada' else v.status end));
  return 'reembolso_pendente';
end $$;
revoke all on function public.agenda_i_sinal(uuid, text, uuid) from public, anon, authenticated, service_role;

create function public.agenda_i_cancelar(p_id uuid, p_ator text, p_ator_id uuid, p_motivo text, p_respeitar_prazo boolean) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.agenda_reservas; v_horas integer;
begin
  if p_motivo is not null and length(p_motivo) > 300 then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  v := public.agenda_i_travar(p_id);
  if v.status = 'cancelada' then return 'cancelada'; end if;
  if v.status in ('expirada', 'concluida') then raise exception 'Esta reserva não pode mais ser cancelada.' using errcode = '55000'; end if;
  if v.status = 'confirmada' and p_respeitar_prazo then
    select cancelamento_antecedencia_h into v_horas from public.agenda_recursos where id = v.recurso_id;
    if v.inicio - now() < make_interval(hours => v_horas) then
      raise exception 'Fora do prazo de cancelamento.' using errcode = '55000'; end if;
  end if;
  update public.agenda_reservas set status = 'cancelada', cancelada_em = now(),
      cancelada_por = case when p_ator = 'cliente' then 'cliente' else 'estudio' end,
      motivo_cancelamento = nullif(trim(coalesce(p_motivo, '')), ''),
      sinal_status = case sinal_status when 'pago' then 'reembolso_pendente' else sinal_status end
   where id = p_id;
  perform public.agenda_i_evento(p_id, 'cancelada', p_ator, p_ator_id, jsonb_build_object('status_anterior', v.status));
  return 'cancelada';
end $$;
revoke all on function public.agenda_i_cancelar(uuid, text, uuid, text, boolean) from public, anon, authenticated, service_role;

create function public.agenda_i_remarcar(p_id uuid, p_novo_inicio timestamptz, p_ator text, p_ator_id uuid, p_respeitar_prazo boolean) returns timestamptz
language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.agenda_reservas; rec public.agenda_recursos; v_dia date;
begin
  if p_novo_inicio is null then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  v := public.agenda_i_travar(p_id);
  if v.status <> 'confirmada' then raise exception 'Somente reservas confirmadas podem ser remarcadas.' using errcode = '55000'; end if;
  select * into rec from public.agenda_recursos where id = v.recurso_id and ativo;
  if not found then raise exception 'Recurso não encontrado.' using errcode = '22023'; end if;
  if p_respeitar_prazo and v.inicio - now() < make_interval(hours => rec.cancelamento_antecedencia_h) then
    raise exception 'Fora do prazo de remarcação.' using errcode = '55000'; end if;
  if p_novo_inicio = v.inicio then return v.inicio; end if;
  perform public.agenda_i_expirar(v.recurso_id);
  v_dia := (p_novo_inicio at time zone rec.fuso)::date;
  if not exists (select 1 from public.agenda_i_slots(v.recurso_id, v_dia, v_dia, p_id, not p_respeitar_prazo) s where s.slot_inicio = p_novo_inicio) then
    raise exception 'Horário indisponível.' using errcode = '23P01'; end if;
  begin
    update public.agenda_reservas set inicio = p_novo_inicio, fim = p_novo_inicio + make_interval(mins => rec.duracao_min),
        ocupa_ate = p_novo_inicio + make_interval(mins => rec.duracao_min + rec.buffer_min), remarcacoes = remarcacoes + 1
     where id = p_id;
  exception when exclusion_violation then
    raise exception 'Horário indisponível.' using errcode = '23P01';
  end;
  perform public.agenda_i_evento(p_id, 'remarcada', p_ator, p_ator_id, jsonb_build_object('de', v.inicio, 'para', p_novo_inicio));
  return p_novo_inicio;
end $$;
revoke all on function public.agenda_i_remarcar(uuid, timestamptz, text, uuid, boolean) from public, anon, authenticated, service_role;

-- Exige papel entre os listados na organização da reserva; devolve a organização.
create function public.agenda_i_org_da_reserva(p_id uuid, p_papeis text[]) returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_papel text;
begin
  select organizacao_id into v_org from public.agenda_reservas where id = p_id;
  v_papel := case when v_org is null then null else public.papel_na_organizacao(v_org) end;
  if v_papel is null or not (v_papel = any (p_papeis)) then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  return v_org;
end $$;
revoke all on function public.agenda_i_org_da_reserva(uuid, text[]) from public, anon, authenticated, service_role;

-- ---- RPCs da equipe (dono/admin/editor escrevem; visualizador só lê) ----------

create function public.agenda_listar_slots_estudio(p_recurso uuid, p_de date, p_ate date)
returns table (slot_inicio timestamptz, slot_fim timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_org uuid;
begin
  select organizacao_id into v_org from public.agenda_recursos where id = p_recurso and ativo;
  if v_org is null or public.papel_na_organizacao(v_org) is null then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  return query select s.slot_inicio, s.slot_fim from public.agenda_i_slots(p_recurso, p_de, p_ate, null, true) s;
end $$;
revoke all on function public.agenda_listar_slots_estudio(uuid, date, date) from public, anon, service_role;
grant execute on function public.agenda_listar_slots_estudio(uuid, date, date) to authenticated;

-- Reserva feita pelo estúdio (telefone/balcão): já nasce confirmada, sem limite anti-abuso.
create function public.agenda_reservar_estudio(p_recurso uuid, p_inicio timestamptz, p_nome text, p_email text, p_telefone text, p_token_hash text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v_papel text; v public.agenda_reservas;
begin
  select organizacao_id into v_org from public.agenda_recursos where id = p_recurso and ativo;
  v_papel := case when v_org is null then null else public.papel_na_organizacao(v_org) end;
  if v_papel is null or v_papel not in ('dono', 'admin', 'editor') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  v := public.agenda_i_criar(p_recurso, p_inicio, p_nome, p_email, p_telefone, p_token_hash, 'estudio', auth.uid(), true);
  return v.id;
end $$;
revoke all on function public.agenda_reservar_estudio(uuid, timestamptz, text, text, text, text) from public, anon, service_role;
grant execute on function public.agenda_reservar_estudio(uuid, timestamptz, text, text, text, text) to authenticated;

-- A equipe pode confirmar hold vigente mesmo com sinal pendente (dispensa o sinal).
create function public.agenda_confirmar(p_id uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.agenda_i_org_da_reserva(p_id, array['dono', 'admin', 'editor']);
  return public.agenda_i_confirmar(p_id, 'estudio', auth.uid(), false);
end $$;
revoke all on function public.agenda_confirmar(uuid) from public, anon, service_role;
grant execute on function public.agenda_confirmar(uuid) to authenticated;

create function public.agenda_cancelar(p_id uuid, p_motivo text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.agenda_i_org_da_reserva(p_id, array['dono', 'admin', 'editor']);
  return public.agenda_i_cancelar(p_id, 'estudio', auth.uid(), p_motivo, false);
end $$;
revoke all on function public.agenda_cancelar(uuid, text) from public, anon, service_role;
grant execute on function public.agenda_cancelar(uuid, text) to authenticated;

create function public.agenda_concluir(p_id uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.agenda_reservas;
begin
  perform public.agenda_i_org_da_reserva(p_id, array['dono', 'admin', 'editor']);
  v := public.agenda_i_travar(p_id);
  if v.status = 'concluida' then return 'concluida'; end if;
  if v.status <> 'confirmada' then raise exception 'Somente reservas confirmadas podem ser concluídas.' using errcode = '55000'; end if;
  if v.inicio > now() then raise exception 'A reserva ainda não começou.' using errcode = '55000'; end if;
  update public.agenda_reservas set status = 'concluida', concluida_em = now() where id = p_id;
  perform public.agenda_i_evento(p_id, 'concluida', 'estudio', auth.uid());
  return 'concluida';
end $$;
revoke all on function public.agenda_concluir(uuid) from public, anon, service_role;
grant execute on function public.agenda_concluir(uuid) to authenticated;

create function public.agenda_remarcar(p_id uuid, p_novo_inicio timestamptz) returns timestamptz
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.agenda_i_org_da_reserva(p_id, array['dono', 'admin', 'editor']);
  return public.agenda_i_remarcar(p_id, p_novo_inicio, 'estudio', auth.uid(), false);
end $$;
revoke all on function public.agenda_remarcar(uuid, timestamptz) from public, anon, service_role;
grant execute on function public.agenda_remarcar(uuid, timestamptz) to authenticated;

-- Simula o pagamento do sinal em nome do cliente (balcão). Sem provedor.
create function public.agenda_registrar_sinal(p_id uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.agenda_i_org_da_reserva(p_id, array['dono', 'admin', 'editor']);
  return public.agenda_i_sinal(p_id, 'estudio', auth.uid());
end $$;
revoke all on function public.agenda_registrar_sinal(uuid) from public, anon, service_role;
grant execute on function public.agenda_registrar_sinal(uuid) to authenticated;

-- Marca o reembolso manual como feito (compensação definida: pendente → reembolsado).
create function public.agenda_registrar_reembolso(p_id uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.agenda_reservas;
begin
  perform public.agenda_i_org_da_reserva(p_id, array['dono', 'admin']);
  v := public.agenda_i_travar(p_id);
  if v.sinal_status = 'reembolsado' then return true; end if;
  if v.sinal_status <> 'reembolso_pendente' then raise exception 'Não há reembolso pendente.' using errcode = '55000'; end if;
  update public.agenda_reservas set sinal_status = 'reembolsado' where id = p_id;
  perform public.agenda_i_evento(p_id, 'reembolso', 'estudio', auth.uid());
  return true;
end $$;
revoke all on function public.agenda_registrar_reembolso(uuid) from public, anon, service_role;
grant execute on function public.agenda_registrar_reembolso(uuid) to authenticated;

-- Vínculo opcional e idempotente com `clientes` (um por reserva). Reaproveita o
-- cliente do dono do estúdio com o mesmo e-mail; senão cria um.
create function public.agenda_vincular_cliente(p_id uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_org uuid; v public.agenda_reservas; v_dono uuid; v_cli uuid;
begin
  v_org := public.agenda_i_org_da_reserva(p_id, array['dono', 'admin', 'editor']);
  v := public.agenda_i_travar(p_id);
  if v.cliente_id is not null then return v.cliente_id; end if;
  if v.status not in ('confirmada', 'concluida') then raise exception 'Confirme a reserva antes de vincular o cliente.' using errcode = '55000'; end if;
  select dono_id into v_dono from public.organizacoes where id = v_org;
  perform pg_advisory_xact_lock(hashtextextended(v_dono::text || v.contato_email, 61));
  select id into v_cli from public.clientes where fotografo_id = v_dono and lower(email) = v.contato_email and status = 'ativo' order by created_at limit 1;
  if v_cli is null then
    insert into public.clientes(fotografo_id, nome, email, telefone, origem) values (v_dono, v.contato_nome, v.contato_email, v.contato_telefone, 'agenda') returning id into v_cli;
  end if;
  update public.agenda_reservas set cliente_id = v_cli where id = p_id and cliente_id is null;
  perform public.agenda_i_evento(p_id, 'cliente_vinculado', 'estudio', auth.uid(), jsonb_build_object('cliente_id', v_cli));
  return v_cli;
end $$;
revoke all on function public.agenda_vincular_cliente(uuid) from public, anon, service_role;
grant execute on function public.agenda_vincular_cliente(uuid) to authenticated;

commit;
