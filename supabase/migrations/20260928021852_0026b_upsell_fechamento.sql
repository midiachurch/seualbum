-- =============================================================================
-- Migration 0026b: Upsell B2B2C — segunda parte da 0026 (decidir_adicional,
-- fechamento e comunicação). Aplicada no remoto separada da 0026; ver o
-- cabeçalho de 20260928021809_0026_upsell_adicionais.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 5. O estúdio decide os adicionais pedidos pelo casal
-- -----------------------------------------------------------------------------

create or replace function public.decidir_adicional(p_item_id uuid, p_aceitar boolean)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  i       record;
  v_resto integer;
begin
  select fi.id, fi.situacao, fi.descricao, f.id as fatura_id, f.status_pagamento, f.projeto_id, p.fotografo_id
    into i
    from public.fatura_itens fi
    join public.faturas f on f.id = fi.fatura_id
    join public.projetos p on p.id = f.projeto_id
    where fi.id = p_item_id
    for update of fi, f;
  if not found then
    raise exception 'Item não encontrado.' using errcode = '42704';
  end if;
  if i.fotografo_id is distinct from auth.uid() then
    raise exception 'Só o estúdio dono do projeto decide os adicionais.' using errcode = '42501';
  end if;
  if i.status_pagamento <> 'pendente' or i.situacao <> 'aguardando_estudio' then
    raise exception 'Este adicional já foi decidido.' using errcode = 'P0001';
  end if;

  update public.fatura_itens
    set situacao = case when p_aceitar then 'confirmado' else 'removido' end,
        decidido_em = now(), decidido_por = auth.uid()
    where id = p_item_id;

  insert into public.projeto_atividades (projeto_id, autor_id, mensagem)
  values (i.projeto_id, auth.uid(),
          format('Estúdio %s o adicional pedido pelo cliente: %s.', case when p_aceitar then 'aceitou' else 'recusou' end, i.descricao));

  -- Recusou tudo e não sobrou nada a cobrar: fecha sem cobrança e libera.
  select count(*) into v_resto from public.fatura_itens where fatura_id = i.fatura_id and situacao <> 'removido';
  if v_resto = 0 then
    update public.faturas set status_pagamento = 'cancelado' where id = i.fatura_id;
    perform public._liberar_para_impressao(i.projeto_id, auth.uid(),
      'Estúdio recusou os adicionais e não havia outra cobrança — liberado para impressão.');
    return 'liberado';
  end if;
  return 'pendente';
end;
$$;

revoke execute on function public.decidir_adicional(uuid, boolean) from public, anon;
grant execute on function public.decidir_adicional(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Pagamento e cortesia: nada fecha com item aguardando o estúdio
-- -----------------------------------------------------------------------------

create or replace function public._fatura_tem_item_aguardando(p_fatura_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.fatura_itens where fatura_id = p_fatura_id and situacao = 'aguardando_estudio');
$$;

revoke execute on function public._fatura_tem_item_aguardando(uuid) from public, anon, authenticated;

create or replace function public.pagar_fatura_simulada(p_fatura_id uuid, p_forma public.forma_pagamento)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  f record;
begin
  if coalesce((select value from private.app_config where key = 'pagamento_simulado'), 'false') <> 'true' then
    raise exception 'Pagamento simulado desativado — use o checkout.' using errcode = '42501';
  end if;

  select fa.id, fa.projeto_id, fa.status_pagamento, fa.valor_total, p.fotografo_id
    into f
    from public.faturas fa join public.projetos p on p.id = fa.projeto_id
    where fa.id = p_fatura_id
    for update of fa;
  if not found or f.status_pagamento <> 'pendente' then
    raise exception 'Fatura não encontrada ou já processada.' using errcode = '42704';
  end if;
  if f.fotografo_id is distinct from auth.uid() then
    raise exception 'Só o estúdio dono do projeto paga esta fatura.' using errcode = '42501';
  end if;
  if public._fatura_tem_item_aguardando(p_fatura_id) then
    raise exception 'Confirme ou recuse os adicionais pedidos pelo cliente antes de pagar.' using errcode = 'P0001';
  end if;

  update public.faturas set status_pagamento = 'pago', forma_pagamento = p_forma, pago_em = now() where id = p_fatura_id;
  perform public._liberar_para_impressao(
    f.projeto_id, auth.uid(),
    format('Pagamento de R$ %s confirmado (%s, simulado) — liberado para impressão.',
      replace(to_char(f.valor_total, 'FM999990.00'), '.', ','), case p_forma when 'pix' then 'Pix' else 'cartão' end)
  );
end;
$$;

create or replace function public.confirmar_pagamento_fatura(p_fatura_id uuid, p_forma public.forma_pagamento)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  f record;
begin
  select fa.id, fa.projeto_id, fa.status_pagamento, fa.valor_total into f
    from public.faturas fa where fa.id = p_fatura_id for update;
  if not found then
    raise exception 'Fatura não encontrada.' using errcode = '42704';
  end if;
  if f.status_pagamento = 'pago' then
    return;
  end if;
  if f.status_pagamento <> 'pendente' then
    raise exception 'Fatura já encerrada (%).', f.status_pagamento using errcode = 'P0001';
  end if;
  if public._fatura_tem_item_aguardando(p_fatura_id) then
    raise exception 'Fatura com adicionais aguardando o estúdio.' using errcode = 'P0001';
  end if;

  update public.faturas set status_pagamento = 'pago', forma_pagamento = p_forma, pago_em = now() where id = p_fatura_id;
  perform public._liberar_para_impressao(
    f.projeto_id, null,
    format('Pagamento de R$ %s confirmado — liberado para impressão.', replace(to_char(f.valor_total, 'FM999990.00'), '.', ','))
  );
end;
$$;

create or replace function public.dispensar_fatura(p_fatura_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  f      record;
  v_nome text;
begin
  if not public.is_gestor_ou_admin() then
    raise exception 'Só a gestão pode dispensar a cobrança.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Informe o motivo da cortesia.' using errcode = '22023';
  end if;

  select fa.id, fa.projeto_id, fa.status_pagamento, fa.valor_total into f
    from public.faturas fa where fa.id = p_fatura_id for update;
  if not found or f.status_pagamento <> 'pendente' then
    raise exception 'Fatura não encontrada ou já processada.' using errcode = '42704';
  end if;
  -- Adicional que o estúdio ainda não aceitou não pode virar produção por cortesia.
  if public._fatura_tem_item_aguardando(p_fatura_id) then
    raise exception 'O estúdio ainda precisa aceitar ou recusar os adicionais pedidos pelo cliente.' using errcode = 'P0001';
  end if;

  update public.faturas
    set status_pagamento = 'dispensada', dispensada_motivo = left(trim(p_motivo), 500),
        dispensada_por = auth.uid(), dispensada_em = now()
    where id = p_fatura_id;

  select nome_completo into v_nome from public.profiles where id = auth.uid();
  perform public._liberar_para_impressao(
    f.projeto_id, auth.uid(),
    format('Cobrança de R$ %s dispensada por %s (cortesia): "%s" — liberado para impressão.',
      replace(to_char(f.valor_total, 'FM999990.00'), '.', ','), coalesce(v_nome, 'gestão'), left(trim(p_motivo), 500))
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Aviso ao estúdio: o que falta decidir e pagar
-- -----------------------------------------------------------------------------

create or replace function public.registrar_comunicacao_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cliente   record;
  v_fotografo text;
  v_versao    integer;
  v_fatura    record;
  v_lista     text;
  v_tipo      text;
  v_assunto   text;
  v_corpo     text;
  v_rodape    text := '<p style="color:#595959;font-size:12px">Este é um e-mail simulado — nenhuma mensagem real foi enviada (infraestrutura de e-mail ainda não conectada).</p>';
begin
  if new.status = old.status then
    return new;
  end if;

  v_tipo := case new.status
    when 'aguardando_fotos' then 'aguardando_fotos'
    when 'aguardando_aprovacao_cliente' then 'prova_pronta'
    when 'aprovado_aguardando_pagamento' then 'excedente_pendente'
    when 'aprovado' then 'aprovado'
    when 'enviado' then 'enviado'
    when 'finalizado' then 'finalizado'
    else null
  end;

  if v_tipo is null then
    return new;
  end if;

  if v_tipo = 'prova_pronta' then
    select max(numero) into v_versao
    from public.design_versions
    where projeto_id = new.id and status = 'aprovada';
    if coalesce(v_versao, 1) > 1 then
      v_tipo := 'nova_versao';
    end if;
  end if;

  if new.fotografo_id is not null then
    select coalesce(nullif(trim(f.estudio), ''), pr.nome_completo) into v_fotografo
    from public.profiles pr left join public.fotografos f on f.id = pr.id
    where pr.id = new.fotografo_id;
  end if;

  -- Fechamento do estúdio (lâminas extras e/ou adicionais): só o fotógrafo recebe.
  if v_tipo = 'excedente_pendente' then
    select fa.id, fa.valor_total,
           exists (select 1 from public.fatura_itens i where i.fatura_id = fa.id and i.situacao = 'aguardando_estudio') as tem_pedido_cliente
      into v_fatura
      from public.faturas fa where fa.projeto_id = new.id and fa.status_pagamento = 'pendente'
      order by fa.created_at desc limit 1;

    select string_agg('<li>' || i.quantidade || '× ' || i.descricao
                      || case when i.situacao = 'aguardando_estudio' then ' <em>(pedido do cliente — aguarda sua confirmação)</em>' else '' end
                      || '</li>', '' order by i.created_at)
      into v_lista
      from public.fatura_itens i where i.fatura_id = v_fatura.id and i.situacao <> 'removido';

    insert into public.comunicacoes_log (projeto_id, cliente_id, tipo_evento, assunto, corpo_html, status, destinatario)
    values (
      new.id, new.cliente_id, v_tipo,
      case when v_fatura.tem_pedido_cliente
        then 'Seu cliente pediu adicionais — confirme no painel — ' || new.nome
        else 'Álbum aprovado — fechamento pendente — ' || new.nome end,
      '<div style="font-family:sans-serif;color:#171717;line-height:1.5">'
        || '<p>Olá, ' || coalesce(v_fotografo, 'estúdio') || '!</p>'
        || '<p>O álbum <strong>' || new.nome || '</strong> foi aprovado. Para seguir para a gráfica, falta o fechamento no seu painel, em Meus álbuns:</p>'
        || '<ul>' || coalesce(v_lista, '') || '</ul>'
        || v_rodape || '</div>',
      'simulado', 'fotografo'
    );
    return new;
  end if;

  select c.nome, c.email into v_cliente from public.clientes c where c.id = new.cliente_id;

  v_assunto := case v_tipo
    when 'aguardando_fotos' then 'Estamos esperando as fotos do seu evento — ' || new.nome
    when 'prova_pronta' then 'Sua prova digital está pronta! — ' || new.nome
    when 'nova_versao' then 'Nova versão disponível para aprovação — ' || new.nome || ' (versão ' || v_versao || ')'
    when 'aprovado' then 'Álbum aprovado — a caminho da gráfica! — ' || new.nome
    when 'enviado' then 'Seu álbum está a caminho! — ' || new.nome
    when 'finalizado' then 'Seu álbum foi finalizado! — ' || new.nome
  end;

  v_corpo := '<div style="font-family:sans-serif;color:#171717;line-height:1.5">'
    || '<p>Olá, ' || coalesce(v_cliente.nome, 'cliente') || '!</p>'
    || '<p>' || (case v_tipo
        when 'aguardando_fotos' then 'Recebemos seu pedido para o projeto <strong>' || new.nome || '</strong> e estamos aguardando o envio das fotos para começar a diagramação.'
        when 'prova_pronta' then 'A prova digital do seu álbum <strong>' || new.nome || '</strong> já está pronta. Acesse o portal para revisar e aprovar quando quiser.'
        when 'nova_versao' then 'Aplicamos os ajustes que você pediu. A versão ' || v_versao || ' do álbum <strong>' || new.nome || '</strong> já está disponível para aprovação no portal.'
        when 'aprovado' then 'Seu álbum <strong>' || new.nome || '</strong> foi aprovado e já seguiu para a produção gráfica. Em breve você recebe novidades sobre a entrega.'
        when 'enviado' then 'Seu álbum <strong>' || new.nome || '</strong> foi despachado!' ||
          case when new.codigo_rastreio is not null then ' Código de rastreio: <strong>' || new.codigo_rastreio || '</strong>.' else '' end
        when 'finalizado' then 'Seu álbum <strong>' || new.nome || '</strong> foi finalizado. Obrigado por confiar no nosso trabalho!'
      end) || '</p>'
    || v_rodape
    || '</div>';

  insert into public.comunicacoes_log (projeto_id, cliente_id, tipo_evento, assunto, corpo_html, status, destinatario)
  values (new.id, new.cliente_id, v_tipo, v_assunto, v_corpo, 'simulado', 'cliente');

  if v_tipo in ('prova_pronta', 'nova_versao') and new.fotografo_id is not null then
    insert into public.comunicacoes_log (projeto_id, cliente_id, tipo_evento, assunto, corpo_html, status, destinatario)
    values (
      new.id, new.cliente_id, v_tipo,
      case v_tipo
        when 'nova_versao' then 'Nova versão disponível para aprovação — ' || new.nome || ' (versão ' || v_versao || ')'
        else 'Prova digital pronta para revisão — ' || new.nome
      end,
      '<div style="font-family:sans-serif;color:#171717;line-height:1.5">'
        || '<p>Olá, ' || coalesce(v_fotografo, 'estúdio') || '!</p>'
        || '<p>' || (case v_tipo
            when 'nova_versao' then 'A equipe aplicou os ajustes da versão anterior. A versão ' || v_versao || ' do álbum <strong>' || new.nome || '</strong> está disponível para aprovação no seu painel, em Meus álbuns.'
            else 'A prova digital do álbum <strong>' || new.nome || '</strong> está pronta. Revise, marque os pontos de ajuste e aprove pelo seu painel, em Meus álbuns.'
          end) || '</p>'
        || v_rodape
        || '</div>',
      'simulado', 'fotografo'
    );
  end if;

  return new;
end;
$$;

revoke execute on function public.registrar_comunicacao_status() from public, anon, authenticated;
